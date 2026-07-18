export const dynamic = 'force-dynamic';
export const maxDuration = 60;
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';
import { getGroqAndHermesProviders, completeWithFallback } from '@/lib/ai/provider-chain';

interface Params { params: Promise<{ id: string; pageId: string }> }

const RATE_LIMIT = 20;
const RATE_WINDOW_SEC = 3_600;
const TIMEOUT_MS = 45_000;

const LlmResponseSchema = z.object({
  diagnosis: z.string(),
  recommendations: z.array(z.object({
    action: z.string(),
    rationale: z.string(),
    sourceFindingIds: z.array(z.string()),
    expectedImpact: z.string(),
  })),
  optimizedTitle: z.string().nullable().optional(),
  optimizedMetaDescription: z.string().nullable().optional(),
  optimizedH1: z.string().nullable().optional(),
  optimizedBodyText: z.string(),
  citabilityByEngine: z.array(z.object({
    engine: z.string(),
    likelihood: z.enum(['low', 'medium', 'high']),
    reasoning: z.string(),
  })),
});

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id: auditId, pageId } = await params;

  const rl = await rateLimit('page-intelligence', user.id, { limit: RATE_LIMIT, windowSec: RATE_WINDOW_SEC });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Rate limit exceeded. You can run up to ${RATE_LIMIT} Page Intelligence generations per hour.` },
      { status: 429, headers: rl.headers },
    );
  }

  const { getAuditWithResults, getPageById, getIssuesByPage, getRetrievalSimulations, createOptimizationSession } = await import('@sitenexis/db');

  const audit = await getAuditWithResults(auditId) as { userId: string; status: string } | null;
  if (!audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const page = await getPageById(pageId);
  if (!page || page.auditId !== auditId) return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  if (!page.bodyText) {
    return NextResponse.json({ error: 'This page has no extracted body text to optimize.' }, { status: 409 });
  }

  const providers = await getGroqAndHermesProviders();
  if (providers.length === 0) {
    return NextResponse.json({ error: 'Page Intelligence is not currently available.', reason: 'no_provider_configured' }, { status: 503 });
  }

  // ── Build the closed set of citable findings for this page ──────────────────
  const [issues, allSimulations] = await Promise.all([
    getIssuesByPage(pageId),
    getRetrievalSimulations(auditId).catch(() => []),
  ]);
  const simulation = (allSimulations as Array<{ pageUrl: string; retrievalFailures: unknown }>).find((s) => s.pageUrl === page.url);
  const retrievalFailures = (simulation?.retrievalFailures as Array<{ stage: string; description: string; severity: string }> | undefined) ?? [];

  const { buildFindingPool, filterTraceableRecommendations, PAGE_INTELLIGENCE_SYSTEM_PROMPT, buildPageIntelligenceUserPrompt } = await import('@sitenexis/analyzers');

  const pageFacts = {
    title: page.title,
    metaDescription: page.metaDescription,
    h1: page.h1,
    wordCount: page.wordCount,
    seoScore: page.seoScore,
    aiScore: page.aiScore,
  };

  const findingPool = buildFindingPool({
    page: pageFacts,
    issues: issues.map((i) => ({ id: i.id, module: i.module, type: i.type, severity: i.severity, message: i.message })),
    retrievalFailures,
  });

  const userPrompt = buildPageIntelligenceUserPrompt({
    url: page.url,
    page: pageFacts,
    bodyText: page.bodyText,
    findings: findingPool,
  });

  // ── Generate ──────────────────────────────────────────────────────────────
  let parsed: z.infer<typeof LlmResponseSchema>;
  try {
    const out = await completeWithFallback(providers, {
      systemPrompt: PAGE_INTELLIGENCE_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.4,
      maxTokens: 4_096,
      jsonMode: true,
      ctx: { auditId, timeoutMs: TIMEOUT_MS },
    });
    parsed = LlmResponseSchema.parse(JSON.parse(out.content));
  } catch (err) {
    logger.error({ auditId, pageId, err: err instanceof Error ? err.message : String(err) }, 'Page Intelligence generation failed');
    return NextResponse.json(
      { error: 'Page Intelligence could not generate a result. Please try again shortly.', retryable: true },
      { status: 502 },
    );
  }

  // ── Enforce the traceability rule — discard anything not backed by a real finding ──
  const traceableRecommendations = filterTraceableRecommendations(parsed.recommendations, findingPool);

  const session = await createOptimizationSession({
    auditId,
    pageId,
    userId: user.id,
    diagnosis: parsed.diagnosis,
    originalTitle: page.title,
    originalMetaDescription: page.metaDescription,
    originalH1: page.h1,
    originalBodyText: page.bodyText,
    optimizedTitle: parsed.optimizedTitle ?? null,
    optimizedMetaDescription: parsed.optimizedMetaDescription ?? null,
    optimizedH1: parsed.optimizedH1 ?? null,
    optimizedBodyText: parsed.optimizedBodyText,
    scoresSnapshot: { seoScore: page.seoScore, aiScore: page.aiScore, wordCount: page.wordCount, retrievalQualityScore: (simulation as { retrievalQualityScore?: number } | undefined)?.retrievalQualityScore ?? null },
    recommendations: traceableRecommendations,
    citabilityByEngine: parsed.citabilityByEngine,
  });

  return NextResponse.json({ session, diagnosis: parsed.diagnosis, discardedRecommendationCount: parsed.recommendations.length - traceableRecommendations.length });
}
