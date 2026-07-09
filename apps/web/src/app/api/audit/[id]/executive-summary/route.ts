export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { gtlEmpty, gtlResponse, resolveGTLState } from '@/lib/gtl';
import type { AuditStatus } from '@sitenexis/shared';
import type { ExecutiveSummaryOutput } from '@sitenexis/analyzers';

interface Params { params: Promise<{ id: string }> }

const CACHE_TTL_SECONDS = 86_400; // 24h
const CACHE_VERSION = 'v1.0';

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  try {
    const {
      getAuditWithResults,
      getIssuesByAudit,
      getMachineTrustScore,
      getTemporalAuthorityRecord,
      getRetrievalSimulations,
      getRecommendationSurfaceMap,
    } = await import('@sitenexis/db');

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
      entities: Array<{ name: string; type: string; sameAsUrls: string[] }> | null;
    } | null;

    if (!audit) return gtlEmpty();
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const state = resolveGTLState(audit.status, true);

    // ── Redis cache ──────────────────────────────────────────────────────────
    let redisGet: ((k: string) => Promise<string | null>) | null = null;
    let redisSet: ((k: string, v: string, ex: number) => Promise<void>) | null = null;

    try {
      const { createRedisClient, getRedisUrl } = await import('@sitenexis/crawler');
      if (getRedisUrl()) {
        const client = createRedisClient(false);
        redisGet = (k) => client.get(k);
        redisSet = (k, v, ex) => client.set(k, v, 'EX', ex).then(() => void 0);
      }
    } catch { /* Redis unavailable */ }

    const cacheKey = `exec-summary:${id}:${CACHE_VERSION}`;
    if (redisGet) {
      try {
        const cached = await redisGet(cacheKey);
        if (cached) return gtlResponse(state, JSON.parse(cached) as ExecutiveSummaryOutput);
      } catch { /* cache miss */ }
    }

    // ── Assemble context (same shape as narrative-report) ───────────────────
    const [rawIssues, trustScore, temporalRecord, retrievalSims, surfaceMap] = await Promise.all([
      getIssuesByAudit(id),
      getMachineTrustScore(id).catch(() => null),
      getTemporalAuthorityRecord(id).catch(() => null),
      getRetrievalSimulations(id).catch(() => [] as Awaited<ReturnType<typeof getRetrievalSimulations>>),
      getRecommendationSurfaceMap(id).catch(() => null),
    ]);

    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    const topIssues = rawIssues
      .sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2))
      .slice(0, 12)
      .map((issue) => ({
        module: issue.module,
        type: issue.type,
        severity: issue.severity as 'critical' | 'warning' | 'info',
        message: issue.message,
        recommendation: issue.recommendation,
      }));

    const simulated = (retrievalSims as Array<{
      simulated: boolean;
      retrievalQualityScore: number | null;
      chunkStabilityIndex: number | null;
      citationEligibilityScore: number | null;
      fragileClaimsCount: number;
    }>).filter((r) => r.simulated);

    const retrievalSummary = simulated.length > 0 ? {
      avgRetrievalQualityScore: avg(simulated.map((r) => r.retrievalQualityScore ?? 0)),
      avgChunkStabilityIndex: avg(simulated.map((r) => r.chunkStabilityIndex ?? 0)),
      avgCitationEligibilityScore: avg(simulated.map((r) => r.citationEligibilityScore ?? 0)),
      totalFragileClaimsCount: simulated.reduce((s, r) => s + r.fragileClaimsCount, 0),
    } : null;

    const entities = (audit.entities ?? []) as Array<{ name: string; sameAsUrls: string[] }>;
    const trust = trustScore as {
      overall: number; entityCredibilityScore: number;
      schemaTrustAlignmentScore: number; externalValidationScore: number;
      contradictionAbsenceScore: number | null;
    } | null;
    const surface = surfaceMap as {
      aiOverviewsProbability: number; chatProbability: number;
      voiceProbability: number; agentProbability: number;
    } | null;
    const temporal = temporalRecord as { updateFrequencyClassification?: string } | null;

    const context = {
      domain: audit.domain,
      pageCount: audit.pageCount ?? 0,
      scores: {
        aiVisibility: audit.aiVisibilityScores?.aiVisibilityScore ?? 0,
        technicalSeo: audit.scores?.seoScore ?? 0,
        semanticStructure: audit.aiVisibilityScores?.machineReadabilityScore ?? 0,
        citationReadiness: audit.aiVisibilityScores?.citationProbabilityScore ?? 0,
        machineTrust: trust?.overall ?? 0,
        entityClarity: audit.aiVisibilityScores?.entityConfidenceScore ?? 0,
      },
      topIssues,
      entitySummary: {
        primaryEntityName: entities[0]?.name ?? null,
        entityCount: entities.length,
        entityConfidenceScore: audit.aiVisibilityScores?.entityConfidenceScore ?? 0,
        sameAsLinksCount: entities.reduce((s, e) => s + e.sameAsUrls.length, 0),
        missingAttributes: [],
      },
      retrievalSummary,
      trustSummary: trust ? {
        overall: trust.overall,
        entityCredibilityScore: trust.entityCredibilityScore,
        schemaTrustAlignmentScore: trust.schemaTrustAlignmentScore,
        externalValidationScore: trust.externalValidationScore,
        contradictionAbsenceScore: trust.contradictionAbsenceScore,
      } : null,
      surfaceSummary: surface ? {
        aiOverviewsProbability: surface.aiOverviewsProbability,
        chatProbability: surface.chatProbability,
        voiceProbability: surface.voiceProbability,
        agentProbability: surface.agentProbability,
      } : null,
      schemaTypes: [],
      updateFrequency: temporal?.updateFrequencyClassification ?? null,
    };

    // ── Generate via AI ──────────────────────────────────────────────────────
    const { executiveSummaryPrompt, routeTask } = await import('@sitenexis/analyzers');

    const SYSTEM = 'You are the SiteNexis Executive Audit Narrator. You write professional prose assessment reports for website owners. You synthesize multi-agent audit data into readable editorial intelligence. You never invent data. Return a single valid JSON object only — no surrounding text, no markdown.';
    const USER = executiveSummaryPrompt(context);

    let summary: ExecutiveSummaryOutput | null = await routeTask<ExecutiveSummaryOutput>(
      'whole_site_analysis',
      SYSTEM,
      USER,
      { jsonMode: true, maxTokens: 2000 },
    );

    if (!summary) {
      const { callAI } = await import('@sitenexis/analyzers');
      // Pass 3000 tokens — executive summary JSON is large and truncates at the 1024 default
      summary = await callAI<ExecutiveSummaryOutput>(USER, SYSTEM, 3000);
    }

    if (!summary) {
      return NextResponse.json({ error: 'AI model unavailable — executive summary could not be generated' }, { status: 503 });
    }

    const output: ExecutiveSummaryOutput & { auditId: string; modelVersion: string } = {
      auditId: id,
      modelVersion: CACHE_VERSION,
      ...summary,
      domain: audit.domain,
    };

    if (redisSet) {
      try { await redisSet(cacheKey, JSON.stringify(output), CACHE_TTL_SECONDS); } catch { /* non-fatal */ }
    }

    return gtlResponse(state, output);
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/executive-summary failed');
    return NextResponse.json({ error: 'Failed to generate executive summary' }, { status: 500 });
  }
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100;
}
