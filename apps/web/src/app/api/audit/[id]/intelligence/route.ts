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
const HERMES_MODEL = 'nousresearch/hermes-3-llama-3.1-405b:free';

const BodySchema = z.object({
  question: z.string().min(1, 'question is required').max(2_000),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4_000) }))
    .max(20)
    .optional(),
});

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

  // ── Providers — Groq primary, Hermes 3 (OpenRouter) fallback ─────────────────
  // Agnes (apihub.agnes-ai.com) is deliberately not used here — it is a single,
  // independently-hosted provider with no fallback of its own, and outages there
  // took this feature down entirely. Groq + an OpenRouter model are both already
  // relied on elsewhere in the app, so a failure of either is independent of the other.
  const { getGroqAdapter, getOpenRouterAdapter } = await import('@sitenexis/adapters');
  const providers = [
    { adapter: getGroqAdapter(), model: 'llama-3.3-70b-versatile' },
    { adapter: getOpenRouterAdapter(HERMES_MODEL, env.OPENROUTER_HERMES_KEY || env.OPENROUTER_API_KEY), model: HERMES_MODEL },
  ].filter((p) => p.adapter.isConfigured());

  if (providers.length === 0) {
    return NextResponse.json(
      { error: 'The Intelligence assistant is not currently available.', reason: 'no_provider_configured' },
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

  // ── Try each provider in order — independent failures, not retries of the same one ──
  let lastErr: unknown;
  for (const p of providers) {
    try {
      const out = await p.adapter.complete({
        systemPrompt: AGNES_SYSTEM_PROMPT,
        userPrompt,
        model: p.model,
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
      logger.warn(
        { auditId: id, provider: p.adapter.provider, err: err instanceof Error ? err.message : String(err) },
        'Intelligence provider failed — trying next provider',
      );
      continue;
    }
  }

  // ── Graceful failure — every provider failed; no key, no stack, clear message ─
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
