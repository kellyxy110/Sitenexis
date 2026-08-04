import type { AuditStatus } from '@sitenexis/shared';
import type { HybridAuditContext, ExecutiveSummaryOutput } from '@sitenexis/analyzers';

const EXEC_SUMMARY_VERSION = 'v1.0';
const NARRATIVE_VERSION = 'v4.1';
const EXEC_SUMMARY_SYSTEM = 'You are the SiteNexis Executive Audit Narrator. You write professional prose assessment reports for website owners. You synthesize multi-agent audit data into readable editorial intelligence. You never invent data. Return a single valid JSON object only — no surrounding text, no markdown.';
const NARRATIVE_SYSTEM = 'You are the SiteNexis Hybrid Audit Narrator. You synthesize verified multi-agent outputs into structured intelligence reports. You never invent data. You always return a single valid JSON object with no surrounding text, explanation, or markdown.';

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100;
}

/**
 * Assembles the shared context both prose prompts consume. The one and only
 * place this computation happens — the dashboard routes, the post-audit
 * hook, and any future consumer (PDF, Second Brain) all go through
 * `generateAndPersistIntelligenceReport` rather than re-deriving this.
 */
async function assembleContext(auditId: string): Promise<{ domain: string; status: AuditStatus; context: HybridAuditContext } | null> {
  const {
    getAuditWithResults, getIssuesByAudit, getMachineTrustScore,
    getTemporalAuthorityRecord, getRetrievalSimulations, getRecommendationSurfaceMap,
  } = await import('@sitenexis/db');

  const audit = await getAuditWithResults(auditId) as {
    status: AuditStatus;
    domain: string;
    pageCount: number | null;
    scores: { seoScore: number; aiScore: number; overall: number } | null;
    aiVisibilityScores: {
      aiVisibilityScore: number; entityConfidenceScore: number; citationProbabilityScore: number;
      machineReadabilityScore: number; semanticTrustScore: number;
    } | null;
    entities: Array<{ name: string; sameAsUrls: string[] }> | null;
  } | null;
  if (!audit) return null;

  const { dedupeFindings } = await import('@sitenexis/analyzers');

  const [rawIssues, trustScore, temporalRecord, retrievalSims, surfaceMap] = await Promise.all([
    getIssuesByAudit(auditId),
    getMachineTrustScore(auditId).catch(() => null),
    getTemporalAuthorityRecord(auditId).catch(() => null),
    getRetrievalSimulations(auditId).catch(() => [] as Awaited<ReturnType<typeof getRetrievalSimulations>>),
    getRecommendationSurfaceMap(auditId).catch(() => null),
  ]);

  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  const topIssues = dedupeFindings(
    rawIssues.map((issue) => ({
      module: issue.module, type: issue.type, severity: issue.severity as 'critical' | 'warning' | 'info',
      message: issue.message, recommendation: issue.recommendation, pageUrl: issue.pageUrl,
    })),
  )
    .sort((a, b) => (severityOrder[a.representative.severity] ?? 2) - (severityOrder[b.representative.severity] ?? 2))
    .slice(0, 15)
    .map((group) => ({
      module: group.representative.module, type: group.representative.type, severity: group.representative.severity,
      message: group.affectedPageCount > 1 ? `${group.representative.message} (affects ${group.affectedPageCount} pages)` : group.representative.message,
      recommendation: group.representative.recommendation,
    }));

  const simulated = (retrievalSims as Array<{
    simulated: boolean; retrievalQualityScore: number | null; chunkStabilityIndex: number | null;
    citationEligibilityScore: number | null; fragileClaimsCount: number;
  }>).filter((r) => r.simulated);

  const retrievalSummary = simulated.length > 0 ? {
    avgRetrievalQualityScore: avg(simulated.map((r) => r.retrievalQualityScore ?? 0)),
    avgChunkStabilityIndex: avg(simulated.map((r) => r.chunkStabilityIndex ?? 0)),
    avgCitationEligibilityScore: avg(simulated.map((r) => r.citationEligibilityScore ?? 0)),
    totalFragileClaimsCount: simulated.reduce((s, r) => s + r.fragileClaimsCount, 0),
  } : null;

  const entities = (audit.entities ?? []) as Array<{ name: string; sameAsUrls: string[] }>;
  const trust = trustScore as {
    overall: number; entityCredibilityScore: number; schemaTrustAlignmentScore: number;
    externalValidationScore: number; contradictionAbsenceScore: number | null;
  } | null;
  const surface = surfaceMap as {
    surfaces: {
      aiOverviews: { inclusionProbability: number }; chatRecommendation: { inclusionProbability: number };
      voiceRetrieval: { inclusionProbability: number }; agentDiscovery: { inclusionProbability: number };
    };
  } | null;
  const temporal = temporalRecord as { updateFrequencyClassification?: string } | null;

  const context: HybridAuditContext = {
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
      overall: trust.overall, entityCredibilityScore: trust.entityCredibilityScore,
      schemaTrustAlignmentScore: trust.schemaTrustAlignmentScore, externalValidationScore: trust.externalValidationScore,
      contradictionAbsenceScore: trust.contradictionAbsenceScore,
    } : null,
    surfaceSummary: surface ? {
      aiOverviewsProbability: surface.surfaces.aiOverviews.inclusionProbability,
      chatProbability: surface.surfaces.chatRecommendation.inclusionProbability,
      voiceProbability: surface.surfaces.voiceRetrieval.inclusionProbability,
      agentProbability: surface.surfaces.agentDiscovery.inclusionProbability,
    } : null,
    schemaTypes: [],
    updateFrequency: temporal?.updateFrequencyClassification ?? null,
  };

  return { domain: audit.domain, status: audit.status, context };
}

async function writeRedisCache(key: string, value: unknown): Promise<void> {
  try {
    const { createRedisClient, getRedisUrl } = await import('@sitenexis/crawler');
    if (!getRedisUrl()) return;
    const client = createRedisClient(false);
    await client.set(key, JSON.stringify(value), 'EX', 86_400);
  } catch {
    // Redis is a performance cache only — a write failure here must never
    // affect the canonical, already-persisted DB row.
  }
}

export interface GenerationResult {
  status: 'ready' | 'partial' | 'failed' | 'skipped';
}

/**
 * The single, bounded entry point for generating the canonical Intelligence
 * Report. Called from exactly two places: the post-audit-completion hook,
 * and the explicit, deliberately-authorized regeneration route. Never called
 * from an ordinary GET request — see executive-summary/narrative-report
 * routes and the Telegram services, all of which only READ this table.
 *
 * Idempotent: uses `claimReportGeneration` as an atomic compare-and-swap, so
 * a retried invocation, a replayed event, or a concurrent call for the same
 * audit is a safe no-op for every caller except the one that wins the claim.
 */
export async function generateAndPersistIntelligenceReport(auditId: string): Promise<GenerationResult> {
  const { claimReportGeneration, saveGeneratedReport, markReportGenerationFailed } = await import('@sitenexis/db');

  const claimed = await claimReportGeneration(auditId);
  if (!claimed) return { status: 'skipped' };

  const assembled = await assembleContext(auditId);
  if (!assembled) {
    await markReportGenerationFailed(auditId, 'Audit not found at generation time');
    return { status: 'failed' };
  }

  const { executiveSummaryPrompt, hybridAuditReportPrompt, routeTask, callAI, parseAIResponse } = await import('@sitenexis/analyzers');

  let executiveSummary: ExecutiveSummaryOutput | null = null;
  try {
    const execUser = executiveSummaryPrompt(assembled.context);
    executiveSummary = await routeTask<ExecutiveSummaryOutput>('whole_site_analysis', EXEC_SUMMARY_SYSTEM, execUser, { jsonMode: true, maxTokens: 2000 });
    if (!executiveSummary) executiveSummary = await callAI<ExecutiveSummaryOutput>(execUser, EXEC_SUMMARY_SYSTEM, 3000);
  } catch { /* executiveSummary stays null — narrative generation still proceeds independently */ }

  let narrativeReport: Record<string, unknown> | null = null;
  try {
    const narrativeUser = hybridAuditReportPrompt(assembled.context);
    narrativeReport = await routeTask<Record<string, unknown>>('whole_site_analysis', NARRATIVE_SYSTEM, narrativeUser, { jsonMode: true, maxTokens: 3000 });
    if (!narrativeReport) {
      const raw = await callAI<string>(narrativeUser, NARRATIVE_SYSTEM);
      narrativeReport = (typeof raw === 'string' ? parseAIResponse<Record<string, unknown>>(raw) : raw) as Record<string, unknown>;
    }
  } catch { /* narrativeReport stays null — executive summary is still saved independently */ }

  if (!executiveSummary && !narrativeReport) {
    await markReportGenerationFailed(auditId, 'Both executive summary and narrative report generation failed — no AI provider returned a usable result');
    return { status: 'failed' };
  }

  const executiveSummaryPayload = executiveSummary
    ? { auditId, modelVersion: EXEC_SUMMARY_VERSION, ...executiveSummary, domain: assembled.domain }
    : undefined;
  const narrativeReportPayload = narrativeReport
    ? { auditId, domain: assembled.domain, generatedAt: new Date().toISOString(), modelVersion: NARRATIVE_VERSION, ...narrativeReport }
    : undefined;

  await saveGeneratedReport(auditId, {
    ...(executiveSummaryPayload ? { executiveSummary: executiveSummaryPayload, executiveSummaryVersion: EXEC_SUMMARY_VERSION } : {}),
    ...(narrativeReportPayload ? { narrativeReport: narrativeReportPayload, narrativeReportVersion: NARRATIVE_VERSION } : {}),
    provider: 'openrouter',
  });

  // Write-through to the existing Redis keys — legacy/performance cache only.
  // Sequential, not Promise.all: two concurrent dynamic import() calls of the
  // same module can race under some bundler/mock setups, so keep this simple
  // and safe rather than parallelizing two cheap SET calls.
  if (executiveSummaryPayload) await writeRedisCache(`exec-summary:${auditId}:${EXEC_SUMMARY_VERSION}`, executiveSummaryPayload);
  if (narrativeReportPayload) await writeRedisCache(`narrative:${auditId}:${NARRATIVE_VERSION}`, narrativeReportPayload);

  return { status: executiveSummary && narrativeReport ? 'ready' : 'partial' };
}
