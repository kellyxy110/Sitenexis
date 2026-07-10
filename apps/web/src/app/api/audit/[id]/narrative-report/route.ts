export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { gtlEmpty, gtlResponse, resolveGTLState } from '@/lib/gtl';
import type { AuditStatus } from '@sitenexis/shared';

interface Params { params: Promise<{ id: string }> }

const CACHE_TTL_SECONDS = 86_400; // 24h
const NARRATIVE_CACHE_VERSION = 'v4.1';

type NarrativeReport = Record<string, unknown>;

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
      entities: Array<{
        name: string;
        type: string;
        consistencyScore: number;
        disambiguationScore: number;
        sameAsUrls: string[];
      }> | null;
    } | null;

    if (!audit) return gtlEmpty();
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const state = resolveGTLState(audit.status, true);

    // ── Redis cache check ────────────────────────────────────────────────────
    let redisGet: ((k: string) => Promise<string | null>) | null = null;
    let redisSet: ((k: string, v: string, ex: number) => Promise<void>) | null = null;

    try {
      const { createRedisClient, getRedisUrl } = await import('@sitenexis/crawler');
      if (getRedisUrl()) {
        const client = createRedisClient(false);
        redisGet = (k) => client.get(k);
        redisSet = (k, v, ex) => client.set(k, v, 'EX', ex).then(() => void 0);
      }
    } catch { /* Redis unavailable — continue without cache */ }

    const cacheKey = `narrative:${id}:${NARRATIVE_CACHE_VERSION}`;
    if (redisGet) {
      try {
        const cached = await redisGet(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as NarrativeReport;
          return gtlResponse(state, parsed);
        }
      } catch { /* cache miss */ }
    }

    // ── Assemble audit context ───────────────────────────────────────────────
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
      .slice(0, 15)
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

    const entities = (audit.entities ?? []) as Array<{
      name: string;
      sameAsUrls: string[];
    }>;

    const trust = trustScore as {
      overall: number;
      entityCredibilityScore: number;
      schemaTrustAlignmentScore: number;
      externalValidationScore: number;
      contradictionAbsenceScore: number | null;
    } | null;

    const surface = surfaceMap as {
      aiOverviewsProbability: number;
      chatProbability: number;
      voiceProbability: number;
      agentProbability: number;
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

    // ── Generate narrative via AI ─────────────────────────────────────────────
    const { hybridAuditReportPrompt, routeTask, parseAIResponse } = await import('@sitenexis/analyzers');

    const SYSTEM = 'You are the SiteNexis Hybrid Audit Narrator. You synthesize verified multi-agent outputs into structured intelligence reports. You never invent data. You always return a single valid JSON object with no surrounding text, explanation, or markdown.';
    const USER = hybridAuditReportPrompt(context);

    // Prefer DeepSeek (whole_site_analysis) for its reasoning depth.
    // Falls back to Groq via parseAIResponse on the callAI path.
    let report: NarrativeReport | null = await routeTask<NarrativeReport>(
      'whole_site_analysis',
      SYSTEM,
      USER,
      { jsonMode: true, maxTokens: 3000 },
    );

    // Groq fallback — less token budget, same prompt
    if (!report) {
      const { callAI } = await import('@sitenexis/analyzers');
      const raw = await callAI<string>(USER, SYSTEM);
      // callAI already parses — if T was inferred as string, it might be pre-parsed object
      report = (typeof raw === 'string' ? parseAIResponse<NarrativeReport>(raw) : raw) as NarrativeReport;
    }

    if (!report) {
      return NextResponse.json({ error: 'AI model unavailable — narrative report could not be generated' }, { status: 503 });
    }

    const output = {
      auditId: id,
      domain: audit.domain,
      generatedAt: new Date().toISOString(),
      modelVersion: NARRATIVE_CACHE_VERSION,
      ...report,
    };

    // ── Cache ────────────────────────────────────────────────────────────────
    if (redisSet) {
      try {
        await redisSet(cacheKey, JSON.stringify(output), CACHE_TTL_SECONDS);
      } catch { /* non-fatal */ }
    }

    return gtlResponse(state, output);
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/narrative-report failed');
    return NextResponse.json({ error: 'Failed to generate narrative report' }, { status: 500 });
  }
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100;
}
