export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';
import type { AuditStatus } from '@sitenexis/shared';
import { buildCompactAuditSummary } from '@/lib/agnes/summary';
import { AGNES_SYSTEM_PROMPT, buildAgnesUserPrompt, type ChatTurn } from '@/lib/agnes/prompt';

interface Params { params: Promise<{ id: string }> }

// Per-user hourly cap for the assistant (reasoning calls are billable upstream).
const RATE_LIMIT = 30;
const RATE_WINDOW_SEC = 3_600;
const AGNES_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2; // 1 retry on transient provider failure

const BodySchema = z.object({
  question: z.string().min(1, 'question is required').max(2_000),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4_000) }))
    .max(20)
    .optional(),
});

function isTransient(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return /timeout|aborted|429|5\d\d|econnreset|network|temporarily/.test(msg);
}

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  // ── Auth ───────────────────────────────────────────────────────────────────
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  // ── Validate body ────────────────────────────────────────────────────────────
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { question, history = [] } = parsed.data;

  // ── Ownership + completeness (same pattern as executive-summary) ─────────────
  const { getAuditWithResults, getIssuesByAudit, logUsage } = await import('@sitenexis/db');
  const audit = await getAuditWithResults(id) as {
    userId: string;
    status: AuditStatus;
    domain: string;
    pageCount: number | null;
    scores: { seoScore: number; aiScore: number; overall: number } | null;
    aiVisibilityScores: {
      aiVisibilityScore: number;
      entityConfidenceScore: number;
      citationProbabilityScore: number;
      machineReadabilityScore: number;
      semanticTrustScore: number;
    } | null;
    entities: Array<{ name: string; type: string }> | null;
  } | null;

  if (!audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (audit.status !== 'complete') {
    return NextResponse.json({ error: 'Intelligence is available only for completed audits.' }, { status: 409 });
  }

  // ── Rate limit (per user) ────────────────────────────────────────────────────
  const rl = await rateLimit('agnes-chat', user.id, { limit: RATE_LIMIT, windowSec: RATE_WINDOW_SEC });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Rate limit exceeded. You can ask up to ${RATE_LIMIT} Intelligence questions per hour.` },
      { status: 429, headers: rl.headers },
    );
  }

  // ── Provider availability (graceful fallback if unconfigured) ────────────────
  const { getAgnesAdapter } = await import('@sitenexis/adapters');
  const agnes = getAgnesAdapter(env.AGNES_API_KEY, env.AGNES_MODEL, env.AGNES_BASE_URL);
  if (!agnes.isConfigured()) {
    return NextResponse.json(
      { error: 'The Intelligence assistant is not currently available.', reason: 'agnes_unconfigured' },
      { status: 503 },
    );
  }

  // ── Compact summary (never the full crawl) ───────────────────────────────────
  const rawIssues = await getIssuesByAudit(id);
  const summary = buildCompactAuditSummary({
    domain: audit.domain,
    status: audit.status,
    pageCount: audit.pageCount,
    scores: audit.scores ? { overall: audit.scores.overall, seoScore: audit.scores.seoScore, aiScore: audit.scores.aiScore } : null,
    aiVisibilityScores: audit.aiVisibilityScores,
    issues: rawIssues.map((i) => ({ module: i.module, type: i.type, severity: i.severity, message: i.message, recommendation: i.recommendation })),
    entities: audit.entities,
  });

  const userPrompt = buildAgnesUserPrompt(summary, question, history as ChatTurn[]);

  // ── Call Agnes with a bounded retry on transient failures ────────────────────
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const out = await agnes.complete({
        systemPrompt: AGNES_SYSTEM_PROMPT,
        userPrompt,
        model: env.AGNES_MODEL,
        temperature: 0.3,
        maxTokens: 1_024,
        ctx: { auditId: id, timeoutMs: AGNES_TIMEOUT_MS },
      });

      // Usage logging — NEVER logs the API key or the prompt/response content.
      await logUsage({
        userId: user.id,
        auditId: id,
        event: 'agnes_chat',
        metadata: {
          provider: out.provider,
          model: out.model,
          latencyMs: out.latencyMs,
          inputTokens: out.inputTokens ?? null,
          outputTokens: out.outputTokens ?? null,
          attempt,
        },
      }).catch((e) => logger.warn({ err: e }, 'agnes usage log failed'));

      return NextResponse.json({
        answer: out.content,
        model: out.model,
        provider: out.provider,
        latencyMs: out.latencyMs,
        usage: { inputTokens: out.inputTokens ?? null, outputTokens: out.outputTokens ?? null },
      });
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS && isTransient(err)) continue;
      break;
    }
  }

  // ── Graceful failure — no key, no stack, clear message ───────────────────────
  logger.error({ auditId: id, err: lastErr instanceof Error ? lastErr.message : String(lastErr) }, 'Agnes intelligence call failed');
  const timedOut = lastErr instanceof Error && lastErr.name === 'AbortError';
  return NextResponse.json(
    {
      error: timedOut
        ? 'The Intelligence assistant timed out. Please try again.'
        : 'The Intelligence assistant is temporarily unavailable. Please try again shortly.',
      retryable: true,
    },
    { status: timedOut ? 504 : 502 },
  );
}
