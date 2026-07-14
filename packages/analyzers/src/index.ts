import { type CrawledPage, type AuditScores } from '@sitenexis/shared';
import { analyzeSEO } from './seo/analyzer';
import { calculateSEOScore } from './seo/scoring';
import { analyzeAIReadability } from './ai/readability';
import { analyzeSchema } from './schema/engine';
import { analyzeLinkGraph } from './graph/engine';
import { analyzePerformance } from './performance/engine';
import { analyzeMachineReadability } from './machine-readability/engine';
import { analyzeEntityIntelligence } from './entity/engine';
import { analyzeCitationProbability } from './citation/engine';
import { analyzeSemanticTrust } from './semantic-trust/engine';
import { buildPerceptionGraph } from './perception-graph/engine';

export { analyzeSEO } from './seo/analyzer';
export { calculateSEOScore, getSEOScoreLabel, getSEOScoreColor } from './seo/scoring';
export { analyzeAIReadability } from './ai/readability';
export { analyzeSchema, generateSchemaSnippet } from './schema/engine';
export { analyzeLinkGraph } from './graph/engine';
export { analyzePerformance } from './performance/engine';
export { analyzeContentQuality } from './content/engine';
// generateAuditReport is imported directly by the reporting agent.
// Do NOT re-export here — @react-pdf/renderer and @aws-sdk/client-s3 are
// worker-only deps that must not enter the Next.js webpack bundle.
// Report integrity is a pure crypto module — safe to re-export.
export {
  signReport,
  verifyReport,
  attachOutputHash,
  computeInputHash,
  computeOutputHash,
  canonicalize,
  generateReportId,
  sha256,
  REPORT_ENGINE_VERSION,
} from './reports/integrity';
export type { ReportIntegrity, SignReportParams, VerificationResult } from './reports/integrity';
export { buildSecurityTrustReport } from './security/engine';
export { detectBotMitigation } from './security/bot-mitigation';
export type { BotMitigationResult, BotMitigationVendor } from './security/bot-mitigation';
export type {
  SecurityTrustReport,
  SecurityFinding,
  SecurityScanInput,
  SecurityPage,
  SecurityHeaderResult,
  TrustSignalResult,
  ProbeResult,
  SecuritySeverity,
} from './security/engine';
export { buildBrandPresenceReport } from './brand-presence/engine';
export type { BrandPresenceReport, BrandPresenceInput, BrandProfile } from './brand-presence/engine';
export { callAI, callClaude, parseAIResponse, AI_MODEL, CLAUDE_MODEL } from './ai/client';
export {
  entityClarityPrompt,
  conversationalReadinessPrompt,
  aiExtractabilityPrompt,
  entityDetectionPrompt,
  contradictionDetectionPrompt,
  hybridAuditReportPrompt,
  executiveSummaryPrompt,
} from './ai/prompts';
export type { HybridAuditContext, ExecutiveSummaryOutput, ExecutiveSummarySection } from './ai/prompts';
export { analyzeMachineReadability } from './machine-readability/engine';
export { analyzeEntityIntelligence } from './entity/engine';
export { analyzeCitationProbability } from './citation/engine';
export { analyzeSemanticTrust } from './semantic-trust/engine';
export { buildPerceptionGraph } from './perception-graph/engine';
export { calculateAIVisibilityScore, calculateRecommendationConfidenceScore, getRecommendationBlockers } from './ai/visibility';
export type { AIVisibilityScore } from './ai/visibility';

// ─── v3 — Retrieval Simulation ────────────────────────────────────────────────
export { runRetrievalSimulation } from './retrieval-simulation/engine';

// ─── v3 — Machine Trust ───────────────────────────────────────────────────────
export { runMachineTrustAnalysis } from './machine-trust/engine';
export { detectContradictionsWithDeepSeek } from './machine-trust/deep-contradiction';
export { isAnyOpenRouterAvailable, routeTask } from './ai/model-router';

// ─── v3 — Temporal Authority ──────────────────────────────────────────────────
export { runTemporalAuthorityAnalysis } from './temporal-authority/engine';

// ─── v3 — Recommendation Surface Mapping ─────────────────────────────────────
export { runRecommendationSurfaceMapping } from './recommendation-surface/engine';
export type { AgentProbeResults } from './recommendation-surface/engine';

// ─── v3 — Synthetic Entity Detection ─────────────────────────────────────────
export { runSyntheticEntityDetection } from './synthetic-entity/engine';

// ─── Self-audit — Health Score + Recommendations ──────────────────────────────
export { computeHealthScore, getHealthLabel, getHealthColor } from './health-score/engine';
export type { SiteNexisHealthScore } from './health-score/engine';
export { generateRecommendations } from './recommendations/engine';
export type { Recommendation } from './recommendations/engine';

// ─── SiteNexis Intelligence Index ─────────────────────────────────────────────
export { computeSIIScore } from './sii/engine';
export type { SIIInput, SIIResult } from './sii/engine';

// ─── Visual Analysis (Gemma 4 multimodal) ────────────────────────────────────
export { analyzeVisualPage } from './visual-analysis/engine';
export type { VisualAnalysisResult, VisualIssue } from './visual-analysis/engine';

// ─── Multilingual Detection (Llama 3.3 70B) ──────────────────────────────────
export { detectSiteLanguage } from './multilingual/engine';
export type { LanguageDetectionResult, SupportedLanguage } from './multilingual/engine';

// ─── SSE — SiteNexis Scoring Engine (v3.1) ───────────────────────────────────
export { computeTopicalAuthority } from './topical-authority/engine';
export type { TopicalAuthorityResult } from './topical-authority/engine';
export { computeSemanticDensity } from './semantic-density/engine';
export type { SemanticDensityResult } from './semantic-density/engine';
export { computeAiCrawlability } from './ai-crawlability/engine';
export type { AiCrawlabilityResult } from './ai-crawlability/engine';
export { computeGeoScore } from './geo/engine';
export type { GeoScoreResult } from './geo/engine';
export { computeSnsScore } from './sns/engine';
export type { SnsScoreResult, SnsLabel } from './sns/engine';

// ─── Fix generation ───────────────────────────────────────────────────────────
export { generateFix } from './fixes/engine';
export type { GeneratedFix, IssueContext } from './fixes/types';

// ─── Source-Grounded Verification Layer ──────────────────────────────────────
export {
  runVerificationPass,
  surfaceableFindings,
  groupByConfidence,
  computeConfidence,
  DETERMINISTIC_CONFIDENCE,
  computeSourceReliability,
  computeExtractionConsistency,
  verifySEOIssue,
  verifySchemaIssue,
  verifyEntity,
  adjustedSeverity,
} from './verification';

// ─── Intelligence Modules (plug-in layer, non-breaking) ───────────────────────

// Module 1: AI Discovery Intelligence Engine
export { analyzeDiscovery } from './discovery/engine';

// Module 2: Authority Stability + Core Update Engine
export { analyzeAuthorityStability } from './authority-stability/engine';

// Module 3: Core Update Simulation Engine
export { simulateCoreUpdateScenarios } from './core-update-simulation/engine';

// Module 4: Self-Audit Benchmark Layer
export { compareToBenchmark, getBenchmarkProfile, AVAILABLE_BENCHMARKS } from './self-audit/benchmark';

// ─── Information Gain Engine ──────────────────────────────────────────────────
export { runIGEEngine } from './information-gain/engine';
export type { IGEEngineInput } from './information-gain/engine';

// ─── Scout v1 — Intent Engine ────────────────────────────────────────────────
export { runScoutAnalysis } from './intent/engine';
export type { ScoutEngineInput } from './intent/engine';

// ─── Global Fix Plan ─────────────────────────────────────────────────────────
export { buildFixPlan } from './fix-plan/engine';
export type { FixPlanInput, SubReportIssues, IssueRecord } from './fix-plan/engine';

// ─── Enhanced Report (v2) ─────────────────────────────────────────────────────
export { buildEnhancedReport } from './enhanced-report';
export { enrichSEOIssues, detectSchemaGapIssues, detectContentGapIssues } from './enhanced-report';
export { extractOrgSignals, generateOrganizationSchema, generateFAQSchema, generateBreadcrumbSchema } from './enhanced-report';
export { generateMetaDescription, generateCanonicalTag, generateOGTags } from './enhanced-report';

export async function runAllAnalyzers(
  auditId: string,
  pages: CrawledPage[],
  sitemapUrls: string[] = []
): Promise<AuditScores> {
  const { issues: seoIssues } = analyzeSEO(pages, sitemapUrls);
  const seo = calculateSEOScore(seoIssues, pages.length, { hasValidSitemap: sitemapUrls.length > 0 });

  const linkGraph = analyzeLinkGraph(pages);
  const inDegree = new Map(linkGraph.nodes.map((n) => [n.url, n.inDegree]));

  const machineReadability = analyzeMachineReadability(pages);
  const schema = analyzeSchema(pages);

  // Run AI-dependent analyzers (Claude API) concurrently
  const [aiReadability, entityIntelligence, performance] = await Promise.all([
    analyzeAIReadability(pages),
    analyzeEntityIntelligence(pages),
    analyzePerformance(pages, inDegree),
  ]);

  // Citation and semantic trust depend on entity intelligence
  const [citationAnalysis, semanticTrust] = await Promise.all([
    Promise.resolve(analyzeCitationProbability(pages, entityIntelligence, schema)),
    analyzeSemanticTrust(pages, entityIntelligence, schema),
  ]);

  const perceptionGraph = buildPerceptionGraph(auditId, pages, entityIntelligence);

  const overall = Math.round(
    (seo.score
      + aiReadability.score
      + machineReadability.score
      + schema.score
      + linkGraph.score
      + performance.score
      + entityIntelligence.entityConfidenceScore
      + citationAnalysis.citationProbabilityScore
      + semanticTrust.score) / 9
  );

  return {
    auditId,
    overall,
    seo,
    aiReadability,
    machineReadability,
    schema,
    linkGraph,
    performance,
    entityIntelligence,
    citationAnalysis,
    semanticTrust,
    perceptionGraph,
  };
}
