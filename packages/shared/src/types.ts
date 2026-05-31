// ─── Audit ───────────────────────────────────────────────────────────────────

export type AuditStatus = 'queued' | 'running' | 'complete' | 'failed';

export type Plan = 'free' | 'starter' | 'pro' | 'agency' | 'enterprise';

export interface Audit {
  id: string;
  userId: string;
  domain: string;
  status: AuditStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  archivedAt: Date | null;
}

// ─── Crawler ─────────────────────────────────────────────────────────────────

export interface CrawledPage {
  url: string;
  statusCode: number;
  redirectChain: string[];
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  headings: { level: number; text: string }[];
  bodyText: string;
  wordCount: number;
  internalLinks: string[];
  externalLinks: string[];
  images: { src: string; alt: string | null }[];
  canonicalUrl: string | null;
  robotsDirectives: string[];
  schemaMarkup: unknown[];
  responseTimeMs: number;
  contentType: string;
  crawledAt: Date;
}

export interface CrawlResult {
  auditId: string;
  domain: string;
  pages: CrawledPage[];
  crawlDurationMs: number;
}

// ─── SEO ─────────────────────────────────────────────────────────────────────

export type SEOIssueSeverity = 'critical' | 'warning' | 'info';

export type SEOIssueType =
  | 'missing_title'
  | 'duplicate_title'
  | 'title_too_long'
  | 'title_too_short'
  | 'missing_meta_description'
  | 'duplicate_meta_description'
  | 'meta_description_too_long'
  | 'missing_h1'
  | 'multiple_h1'
  | 'missing_canonical'
  | 'broken_canonical'
  | 'noindex_page'
  | 'missing_alt_text'
  | 'broken_internal_link'
  | 'redirect_chain'
  | 'low_word_count'
  | 'missing_robots_txt'
  | 'missing_sitemap';

export interface SEOIssue {
  type: SEOIssueType;
  severity: SEOIssueSeverity;
  url: string;
  message: string;
  recommendation: string;
}

export interface SEOScore {
  score: number;
  issues: SEOIssue[];
  breakdown: {
    titleOptimisation: number;
    metaOptimisation: number;
    headingStructure: number;
    canonicalisation: number;
    crawlability: number;
    imageOptimisation: number;
  };
}

// ─── AI Readability ──────────────────────────────────────────────────────────

export type AIStatus = 'pending' | 'scored' | 'failed';

export interface AIPageScore {
  url: string;
  status: AIStatus;
  entityClarity: number | null;
  conversationalReadiness: number | null;
  aiExtractability: number | null;
  knowledgeGraphStructure: number | null;
  total: number | null;
}

export interface AIReadabilityScore {
  score: number;
  pageScores: AIPageScore[];
  breakdown: {
    entityClarity: number;
    conversationalReadiness: number;
    aiExtractability: number;
    knowledgeGraphStructure: number;
  };
  missingEntities: string[];
  recommendations: string[];
}

// ─── Schema ───────────────────────────────────────────────────────────────────

export type SchemaType =
  | 'Organization'
  | 'WebSite'
  | 'WebPage'
  | 'Article'
  | 'BlogPosting'
  | 'Product'
  | 'FAQPage'
  | 'BreadcrumbList'
  | 'LocalBusiness'
  | 'Person'
  | 'Event'
  | 'Review'
  | 'HowTo'
  | 'VideoObject'
  | 'ImageObject';

export interface SchemaIssue {
  severity: SEOIssueSeverity;
  url: string;
  schemaType: SchemaType | string;
  message: string;
  missingFields: string[];
  recommendation: string;
}

export interface SchemaTypeError {
  field: string;
  expected: string;
  got: string;
}

export interface SchemaValidationResult {
  schemaType: SchemaType | string;
  isValid: boolean;
  missingRequiredFields: string[];
  missingRecommendedFields: string[];
  typeErrors: SchemaTypeError[];
  warningMessages: string[];
}

export interface SchemaPageAnalysis {
  url: string;
  detectedTypes: (SchemaType | string)[];
  validationResults: SchemaValidationResult[];
  suggestedTypes: (SchemaType | string)[];
  generatedSnippets: Record<string, string>;
}

export interface SchemaScore {
  score: number;
  issues: SchemaIssue[];
  detectedTypes: SchemaType[];
  coverage: number;
  pageAnalyses: SchemaPageAnalysis[];
}

// ─── Link Graph ───────────────────────────────────────────────────────────────

export interface GraphNode {
  /** Page URL — canonical identifier */
  url: string;
  /** Alias for url — used by graph visualisation layer */
  id: string;
  /** Human-readable label (slug or title) */
  label: string;
  pageRank: number;
  /** Inbound link count — alias for inboundCount */
  inDegree: number;
  inboundCount: number;
  /** Outbound link count — alias for outboundCount */
  outDegree: number;
  outboundCount: number;
  depth: number;
  /** Topic cluster label assigned by label-propagation */
  cluster: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  /** Number of times page A links to page B */
  weight: number;
  anchorText: string | null;
  /** Aliases matching prompt spec */
  source: string;
  target: string;
}

export interface LinkSuggestion {
  from: string;
  to: string;
  reason: string;
}

export interface LinkGraphScore {
  score: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  orphanPages: string[];
  weakClusters: string[][];
  avgPageRank: number;
  linkSuggestions: LinkSuggestion[];
}

// ─── Performance ─────────────────────────────────────────────────────────────

export interface CoreWebVitals {
  lcp: number | null;
  cls: number | null;
  inp: number | null;
  tbt: number | null;
}

export interface PerformanceOpportunity {
  title: string;
  estimatedSavingMs: number;
}

export interface PerformanceResult {
  url: string;
  lighthouseScore: number | null;
  mobileLighthouseScore: number | null;
  coreWebVitals: CoreWebVitals;
  passed: boolean;
  skipped: boolean;
  skipReason?: string;
  issues: Array<{
    severity: SEOIssueSeverity;
    url: string;
    message: string;
    recommendation: string;
  }>;
  opportunities: PerformanceOpportunity[];
}

export interface PerformanceScore {
  score: number;
  lighthouseScore: number | null;
  lcp: number | null;
  fid: number | null;
  cls: number | null;
  ttfb: number | null;
  pageResults: PerformanceResult[];
  issues: Array<{
    severity: SEOIssueSeverity;
    url: string;
    message: string;
    recommendation: string;
  }>;
}

// ─── Content Quality ─────────────────────────────────────────────────────────

export interface ContentPageScore {
  url: string;
  contentScore: number;
  semanticDepthScore: number;
  isThin: boolean;
  isStuffed: boolean;
  topKeywords: Array<{ word: string; density: number }>;
}

export interface ContentQualityScore {
  score: number;
  pageScores: ContentPageScore[];
  thinPages: string[];
  duplicateIntentGroups: string[][];
  stuffedPages: string[];
  lowDepthPages: string[];
  faqOpportunities: string[];
}

// ─── Audit Scores ────────────────────────────────────────────────────────────

export interface AuditScores {
  auditId: string;
  overall: number;
  seo: SEOScore;
  aiReadability: AIReadabilityScore;
  machineReadability: MachineReadabilityScore;
  schema: SchemaScore;
  linkGraph: LinkGraphScore;
  performance: PerformanceScore;
  entityIntelligence: EntityIntelligenceReport;
  citationAnalysis: CitationAnalysis;
  semanticTrust: SemanticTrustScore;
  perceptionGraph: PerceptionGraphSnapshot;
}

// ─── v2 — Entity Intelligence ─────────────────────────────────────────────────

export interface Entity {
  id: string;
  name: string;
  normalizedName: string;
  type: string;
  description: string | null;
  sameAsUrls: string[];
  mentionCount: number;
  consistencyScore: number;
  disambiguationScore: number;
}

export interface EntityIssue {
  entityName: string;
  issueType: 'inconsistency' | 'missing_attribute' | 'disambiguation_failure';
  severity: SEOIssueSeverity;
  description: string;
  recommendation: string;
}

export interface EntityIntelligenceReport {
  entitiesDetected: Entity[];
  primaryEntity: Entity | null;
  entityConsistencyScore: number;
  entityCoverageScore: number;
  disambiguationScore: number;
  entityConfidenceScore: number;
  inconsistencies: EntityIssue[];
  missingAttributes: string[];
  recommendations: string[];
}

// ─── v2 — Machine Readability ────────────────────────────────────────────────

export type ExtractionStage =
  | 'rendering_fidelity'
  | 'boilerplate_ratio'
  | 'chunk_boundary_quality'
  | 'signal_to_noise_ratio'
  | 'heading_hierarchy'
  | 'reading_order_consistency'
  | 'link_anchor_quality';

export interface MachineReadabilityIssue {
  stage: ExtractionStage;
  severity: SEOIssueSeverity;
  pageUrl: string;
  description: string;
  recommendation: string;
}

export interface MachineReadabilityScore {
  score: number;
  breakdown: {
    renderingFidelity: number;
    boilerplateRatio: number;
    chunkBoundaryQuality: number;
    signalToNoiseRatio: number;
    headingHierarchy: number;
    readingOrderConsistency: number;
    linkAnchorQuality: number;
  };
  issues: MachineReadabilityIssue[];
  pageScores: Array<{ url: string; score: number }>;
}

// ─── v2 — Citation Probability ───────────────────────────────────────────────

export interface CitationFactorBreakdown {
  factualDensity: number;
  claimSpecificity: number;
  primaryEntityAuthority: number;
  topicalAuthorityDepth: number;
  structuralCitationReadiness: number;
  temporalFreshness: number;
  trustSignalDensity: number;
}

export interface CitationPageAnalysis {
  url: string;
  citationProbability: number;
  factors: CitationFactorBreakdown;
  blockers: string[];
}

export interface CitationAnalysis {
  citationProbabilityScore: number;
  pageAnalyses: CitationPageAnalysis[];
  topCitationCandidates: string[];
  citationBlockers: string[];
  recommendations: string[];
}

// ─── v2 — Semantic Trust ─────────────────────────────────────────────────────

export type SemanticTrustIssueType =
  | 'missing_author'
  | 'unverifiable_author'
  | 'missing_organisation_schema'
  | 'missing_contact_info'
  | 'no_about_page'
  | 'thin_about_page'
  | 'missing_privacy_policy'
  | 'missing_terms'
  | 'unverified_claims'
  | 'contradiction_detected'
  | 'missing_citations'
  | 'generic_content'
  | 'no_date_signals'
  | 'stale_content'
  | 'broken_trust_links'
  | 'schema_trust_mismatch';

export interface SemanticTrustIssue {
  type: SemanticTrustIssueType;
  severity: SEOIssueSeverity;
  pageUrl: string | null;
  description: string;
  recommendation: string;
}

export interface SemanticTrustScore {
  score: number;
  breakdown: {
    authorshipTrust: number;
    organisationalTrust: number;
    contentTrust: number;
    structuralTrust: number;
  };
  issues: SemanticTrustIssue[];
  trustSignalsPresent: string[];
  trustSignalsMissing: string[];
}

// ─── v2 — AI Perception Graph ────────────────────────────────────────────────

export type PerceptionNodeType = 'entity' | 'topic' | 'claim' | 'page';

export type PerceptionRelationshipType =
  | 'isA'
  | 'partOf'
  | 'relatedTo'
  | 'contradicts'
  | 'supports'
  | 'authorOf'
  | 'locatedIn'
  | 'offers';

export interface PerceptionNode {
  id: string;
  type: PerceptionNodeType;
  label: string;
  confidence: number;
  citationReadiness: number;
  disambiguationStrength: number;
  supportingPages: string[];
}

export interface PerceptionEdge {
  source: string;
  target: string;
  relationshipType: PerceptionRelationshipType;
  strength: number;
  evidencedBy: string[];
}

export interface PerceptionGraphSnapshot {
  auditId: string;
  nodes: PerceptionNode[];
  edges: PerceptionEdge[];
}

// ─── v3 — Retrieval Simulation ───────────────────────────────────────────────

export type RetrievalFailureStage =
  | 'chunk_extraction'
  | 'ranking_pressure'
  | 'summarisation'
  | 'truncation'
  | 'citation_filter';

export interface RetrievalFailure {
  stage: RetrievalFailureStage;
  description: string;
  severity: SEOIssueSeverity;
  affectedChunks: string[];
  recommendation: string;
}

export interface RetrievalSimulationResult {
  pageUrl: string;
  simulated: boolean;
  simulationErrorReason?: string;
  retrievalQualityScore: number | null;
  chunkStabilityIndex: number | null;
  answerFormationProbability: number | null;
  summarisationLossScore: number | null;
  citationEligibilityScore: number | null;
  retrievalFailureReasons: RetrievalFailure[];
  truncationZoneWarnings: string[];
  fragileClaimsCount: number;
}

// ─── v3 — Machine Trust ──────────────────────────────────────────────────────

export type TrustDegradationSignalType =
  | 'schema_removal'
  | 'attribute_change'
  | 'external_source_loss'
  | 'contradiction_introduced';

export interface TrustDegradationSignal {
  signalType: TrustDegradationSignalType;
  entity: string;
  previousValue: string;
  currentValue: string;
  detectedAt: Date;
  severityImpact: number;
}

export interface TrustIssue {
  type: string;
  severity: SEOIssueSeverity;
  entity: string;
  description: string;
  recommendation: string;
}

export interface MachineTrustScore {
  overall: number;
  entityCredibilityScore: number;
  schemaTrustAlignmentScore: number;
  externalValidationScore: number;
  contradictionAbsenceScore: number | null;
  trustDegradationResistance: number;
  trustIssues: TrustIssue[];
  degradationSignals: TrustDegradationSignal[];
  crossSourceValidationIndex: number;
}

// ─── v3 — Temporal Authority ─────────────────────────────────────────────────

export type UpdateFrequencyClassification = 'active' | 'periodic' | 'stale' | 'abandoned';

export interface SemanticDriftRecord {
  pageUrl: string;
  driftScore: number;
  previousTopicCluster: string;
  currentTopicCluster: string;
  detectedAt: Date;
}

export interface TemporalIssue {
  type: string;
  severity: SEOIssueSeverity;
  pageUrl: string;
  description: string;
  recommendation: string;
}

export interface TemporalAuthorityResult {
  isBaseline: boolean;
  authorityVelocityScore: number | null;
  trustStabilityIndex: number;
  contentFreshnessImpactFactor: number;
  semanticDriftIndex: number;
  updateFrequencyClassification: UpdateFrequencyClassification;
  stalePagesAtRisk: string[];
  driftedPages: SemanticDriftRecord[];
  temporalIssues: TemporalIssue[];
}

// ─── v3 — Recommendation Surface Mapping ─────────────────────────────────────

export type SurfaceStatus = 'visible' | 'partial' | 'absent';

export interface SurfaceBlocker {
  type: string;
  description: string;
  recommendation: string;
}

export interface SurfaceScore {
  inclusionProbability: number;
  status: SurfaceStatus;
  blockers: SurfaceBlocker[];
  recommendations: string[];
}

export interface CoverageGap {
  surface: string;
  missedOpportunity: string;
  requiredSignals: string[];
  estimatedImpact: 'high' | 'medium' | 'low';
}

export interface RecommendationSurfaceMap {
  overallSurfaceScore: number;
  surfaces: {
    aiOverviews: SurfaceScore;
    chatRecommendation: SurfaceScore;
    voiceRetrieval: SurfaceScore;
    agentDiscovery: SurfaceScore;
  };
  coverageGaps: CoverageGap[];
  missingVisibilityChannels: string[];
}

// ─── v3 — Synthetic Entity Detection ─────────────────────────────────────────

export type SyntheticPatternType =
  | 'fake_entity'
  | 'authority_network'
  | 'schema_manipulation'
  | 'citation_farming'
  | 'unnatural_clustering';

export interface SyntheticPattern {
  patternType: SyntheticPatternType;
  confidence: number;
  evidence: string[];
  affectedEntities: string[];
  severity: SEOIssueSeverity;
}

export interface FlaggedEntity {
  entityName: string;
  flagReason: string;
  confidence: number;
}

export interface SyntheticEntityAnalysis {
  syntheticRiskScore: number;
  entityAuthenticityConfidence: number;
  networkIntegrityScore: number;
  detectedPatterns: SyntheticPattern[];
  flaggedEntities: FlaggedEntity[];
  recommendations: string[];
}

// ─── v3 — Machine Trust Intelligence Score ────────────────────────────────────

export interface MachineTrustIntelligenceScore {
  overall: number;
  retrievalQualityScore: number;
  machineTrustScore: number;
  authorityVelocityScore: number;
  recommendationSurfaceScore: number;
  entityAuthenticityConfidence: number;
}

// ─── v2 — AI Visibility Score ────────────────────────────────────────────────

export interface AIVisibilityScore {
  score: number;
  breakdown: {
    machineReadability: number;
    entityConfidence: number;
    retrievalReadiness: number;
    citationProbability: number;
    semanticTrust: number;
    schemaCompleteness: number;
  };
  recommendationConfidenceScore: number;
}

// ─── Score labels ─────────────────────────────────────────────────────────────

export type ScoreLabel = 'Excellent' | 'Good' | 'Needs Work' | 'Critical';

export function getScoreLabel(score: number): ScoreLabel {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs Work';
  return 'Critical';
}

export function getScoreTailwindClass(score: number): string {
  if (score >= 90) return 'text-green-500';
  if (score >= 70) return 'text-teal-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-500';
}

// ─── Plan limits (v3 — includes layer4Analysis + competitiveAnalysis) ────────

export const PLAN_LIMITS: Record<Plan, {
  auditsPerMonth: number;
  apiAccess: boolean;
  bulkDomains: boolean;
  whiteLabel: boolean;
  competitiveAnalysis: boolean;
  layer4Analysis: boolean;
}> = {
  free: {
    auditsPerMonth: 1,
    apiAccess: false,
    bulkDomains: false,
    whiteLabel: false,
    competitiveAnalysis: false,
    layer4Analysis: false,
  },
  starter: {
    auditsPerMonth: 50,
    apiAccess: false,
    bulkDomains: false,
    whiteLabel: false,
    competitiveAnalysis: false,
    layer4Analysis: false,
  },
  pro: {
    auditsPerMonth: -1,
    apiAccess: false,
    bulkDomains: false,
    whiteLabel: false,
    competitiveAnalysis: true,
    layer4Analysis: true,
  },
  agency: {
    auditsPerMonth: -1,
    apiAccess: true,
    bulkDomains: true,
    whiteLabel: false,
    competitiveAnalysis: true,
    layer4Analysis: true,
  },
  enterprise: {
    auditsPerMonth: -1,
    apiAccess: true,
    bulkDomains: true,
    whiteLabel: true,
    competitiveAnalysis: true,
    layer4Analysis: true,
  },
};

// ─── AuditReport (master type) ───────────────────────────────────────────────

export interface AuditReport {
  auditId: string;
  domain: string;
  crawledAt: Date;
  pagesCount: number;
  seoScore: SEOScore;
  aiScore: AIReadabilityScore;
  schemaAnalysis: SchemaScore;
  linkGraph: LinkGraphScore;
  contentQuality: ContentQualityScore;
  performanceScore: PerformanceScore;
  entityIntelligence: EntityIntelligenceReport;
  perceptionGraph: PerceptionGraphSnapshot;
  retrievalSimulations: RetrievalSimulationResult[];
  machineTrust: MachineTrustScore;
  temporalAuthority: TemporalAuthorityResult;
  recommendationSurfaces: RecommendationSurfaceMap;
  syntheticEntityAnalysis: SyntheticEntityAnalysis;
  machineTrustIntelligence: MachineTrustIntelligenceScore;
  topIssues: SEOIssue[];
  summaryInsights: string[];
}

// ─── Naming aliases ───────────────────────────────────────────────────────────

export type AuditJob = Audit;
export type InternalLinkGraph = LinkGraphScore;
export type SchemaAnalysis = SchemaScore;

// ─── Agent Orchestrator ───────────────────────────────────────────────────────

export type OrchestratorCrawlDataType = 'full_page' | 'partial' | 'multi_page';

export type OrchestratorUserIntent =
  | 'seo_audit'
  | 'ai_visibility'
  | 'entity_mapping'
  | 'retrieval_analysis'
  | 'full_intelligence'
  | null;

export type OrchestratorAgentName =
  | 'Site Audit Agent'
  | 'AI Visibility Agent'
  | 'Entity Extraction Agent'
  | 'Retrieval Analysis Agent'
  | 'SII Aggregator';

export interface OrchestratorStoredResult {
  cachedAt: string;
  ageHours: number;
  fresh: boolean;
}

export interface OrchestratorPageMetrics {
  wordCount?: number;
  metaTagCount?: number;
  schemaMarkupDensity?: number;
  isNew?: boolean;
  hasDynamicContent?: boolean;
  pageCount?: number;
}

export interface OrchestratorInput {
  url: string;
  crawlDataType: OrchestratorCrawlDataType;
  userIntent?: OrchestratorUserIntent;
  existingResults?: Partial<Record<
    'siteAudit' | 'aiVisibility' | 'entityExtraction' | 'retrievalAnalysis',
    OrchestratorStoredResult
  >>;
  pageMetrics?: OrchestratorPageMetrics;
}

export interface OrchestratorExecutionStep {
  agent: OrchestratorAgentName;
  reason: string;
  priority: number;
}

export type OrchestratorAggregationMode = 'SII Aggregator' | 'partial' | 'none';

export interface OrchestratorResult {
  url: string;
  execution_plan: OrchestratorExecutionStep[];
  parallel_execution: string[];
  final_aggregation: OrchestratorAggregationMode;
  confidence: number;
  optimization_notes: string[];
}

// ─── SiteNexis Intelligence Index (SII) ──────────────────────────────────────

export interface SIIBreakdown {
  seo_readability: number | null;
  ai_visibility: number | null;
  semantic_structure: number | null;
  entity_clarity: number | null;
  retrieval_friendliness: number | null;
  citation_potential: number | null;
}

export interface SIIWeightedContributions {
  seo_readability: number | null;
  ai_visibility: number | null;
  semantic_structure: number | null;
  entity_clarity: number | null;
  retrieval_friendliness: number | null;
  citation_potential: number | null;
}

export interface SIIRecommendationEntry {
  area: string;
  action: string;
  expected_gain: string;
}

export interface SIIScore {
  url: string;
  sii_score: number;
  confidence: number;
  breakdown: SIIBreakdown;
  weighted_contributions: SIIWeightedContributions;
  insights: string[];
  critical_gaps: string[];
  recommendation_priority: SIIRecommendationEntry[];
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ApiError {
  error: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
