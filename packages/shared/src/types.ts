// ─── GTL (Graceful Truth Layer) ───────────────────────────────────────────────

export type GTLState = 'complete' | 'partial' | 'empty';

export interface GTLResponse<T> {
  state: GTLState;
  timestamp: string;
  data: T | null;
}

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
  /** Rich link refs populated by the extractor layer — parallel to internalLinks, do not modify internalLinks */
  internalLinkRefs?: LinkRef[];
  /** Per-page external link metadata aggregated by the extractor layer */
  externalLinkMeta?: ExternalLinkMeta;
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

export type FixLanguage = 'json-ld' | 'html' | 'typescript' | 'text';

export interface IssueFix {
  problem: string;
  solution: string;
  fixCode: string;
  fixLanguage: FixLanguage;
  expectedImpact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
}

export interface SEOIssue {
  id?: string;
  type: SEOIssueType;
  severity: SEOIssueSeverity;
  url: string;
  message: string;
  recommendation: string;
  problem?: string;
  cause?: string;
  solution?: string;
  fixCode?: string;
  fixLanguage?: FixLanguage;
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

export type LinkPosition = 'nav' | 'body' | 'footer' | 'sidebar' | 'other';

export interface LinkRef {
  url: string;
  anchorText: string;
  position: LinkPosition;
  isNoFollow: boolean;
}

export interface ExternalLinkMeta {
  externalLinkCount: number;
  topDomains: { domain: string; count: number }[];
  nofollowRatio: number;
  externalAuthorityScore: number;
}

export interface LinkStructuralIssue {
  type: 'orphan' | 'dead_end' | 'overlinked' | 'underlinked_critical';
  url: string;
  severity: SEOIssueSeverity;
  description: string;
  recommendation: string;
}

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
  /** Link Authority Flow Score — 0-100 composite of PageRank, inbound density, depth penalty */
  linkAuthorityFlowScore: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  /** Number of times page A links to page B */
  weight: number;
  anchorText: string | null;
  /** DOM context where the link appears — populated when internalLinkRefs is available */
  position: LinkPosition | null;
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
  deadEndPages: string[];
  overlinkedPages: string[];
  underlinkedCriticalPages: string[];
  weakClusters: string[][];
  avgPageRank: number;
  linkSuggestions: LinkSuggestion[];
  structuralIssues: LinkStructuralIssue[];
  linkAuthorityFlowScore: number;
  hierarchyDepth: number;
  externalLinkMeta: ExternalLinkMeta;
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
  entitiesDetected:       Entity[];
  primaryEntity:          Entity | null;
  entityConsistencyScore: number;
  entityCoverageScore:    number;
  disambiguationScore:    number;
  entityConfidenceScore:  number;
  inconsistencies:        EntityIssue[];
  missingAttributes:      string[];
  recommendations:        string[];
  // Intelligence module extensions
  platformPresence?:      PlatformPresence;
  fragmentationRisk?:     boolean;
  fragmentationRiskReason?: string;
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
  citationProbabilityScore:       number;
  pageAnalyses:                   CitationPageAnalysis[];
  topCitationCandidates:          string[];
  citationBlockers:               string[];
  recommendations:                string[];
  // Intelligence module extensions
  contentFormatClassification?:   ContentFormatType;
  retrievalCitationGap?:          number;  // positive = citations exceed retrieval; negative = retrieval exceeds citation
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
  isBaseline:                    boolean;
  authorityVelocityScore:        number | null;
  trustStabilityIndex:           number;
  contentFreshnessImpactFactor:  number;
  semanticDriftIndex:            number;
  updateFrequencyClassification: UpdateFrequencyClassification;
  stalePagesAtRisk:              string[];
  driftedPages:                  SemanticDriftRecord[];
  temporalIssues:                TemporalIssue[];
  // Intelligence module extensions
  freshnessVelocityScore?:       number;            // 0–100 composite
  visibilityRampDays?:           number;            // days to reach full AI visibility
  rampCurve?:                    VisibilityRampPoint[];
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

// ─── Intelligence Modules — Citation extensions ───────────────────────────────

export type ContentFormatType =
  | 'best_x'          // "Best X for Y", "Top N tools"
  | 'comparison'      // "A vs B", "X compared to Y"
  | 'definition'      // "What is X", "X explained"
  | 'guide'           // "Guide to X", "How to X" (multi-step)
  | 'procedural'      // Step-by-step, numbered lists
  | 'evaluative'      // "Review of X", "Is X good?"
  | 'factual'         // Data-dense, statistical
  | 'general';        // No dominant format pattern

// ─── Intelligence Modules — Entity extensions ─────────────────────────────────

export interface PlatformPresence {
  wikipedia:  boolean;
  wikidata:   boolean;
  linkedin:   boolean;
  github:     boolean;
  youtube:    boolean;
  crunchbase: boolean;
}

// ─── Intelligence Modules — Temporal extensions ───────────────────────────────

export interface VisibilityRampPoint {
  day: number;
  estimatedVisibility: number; // 0–100
}

// ─── Intelligence Modules — Discovery Engine ─────────────────────────────────

export interface AICrawlerAllowance {
  gptBot:         boolean;
  claudeBot:      boolean;
  perplexityBot:  boolean;
  googleExtended: boolean;
  googleBot:      boolean;
  allAllowed:     boolean;
}

export interface DiscoveryBottleneck {
  type:           string;
  severity:       SEOIssueSeverity;
  description:    string;
  recommendation: string;
}

export interface DiscoveryScore {
  score:                       number;  // 0–100
  estimatedDiscoveryDelayDays: number;
  crawlAccessibilityScore:     number;  // 0–100
  indexabilityScore:           number;  // 0–100
  aiCrawlerAllowance:          AICrawlerAllowance;
  multiSourceDiscoveryScore:   number;  // 0–100
  bottlenecks:                 DiscoveryBottleneck[];
  accelerationOpportunities:   string[];
}

// ─── Intelligence Modules — Authority Stability Engine ───────────────────────

export type AggregationRisk     = 'low' | 'medium' | 'high';
export type SiteClassification  = 'first_party_authority' | 'aggregator' | 'hybrid';

export interface AuthorityStabilityScore {
  score:                          number;           // 0–100
  aggregationRisk:                AggregationRisk;
  coreUpdateSurvivalProbability:  number;           // 0–100
  firstPartyDepthScore:           number;           // 0–100
  contentOriginalityScore:        number;           // 0–100
  expertAttributionScore:         number;           // 0–100
  classification:                 SiteClassification;
  weakSignals:                    string[];
  strengtheningRecommendations:   string[];
}

// ─── Intelligence Modules — Core Update Simulation Engine ────────────────────

export type UpdateScenario     = 'authority_first' | 'aggregation_filter' | 'ai_citation_alignment';
export type ScenarioPrediction = 'gain' | 'neutral' | 'loss';
export type StabilityForecast  = 'stable' | 'at_risk' | 'growth_likely';

export interface ScenarioResult {
  scenario:            UpdateScenario;
  prediction:          ScenarioPrediction;
  confidenceLevel:     number;   // 0–1
  predictedScoreChange: number;  // –30 to +30
  riskZones:           string[];
  opportunityZones:    string[];
  reasoning:           string;
}

export interface CoreUpdateSimulationResult {
  scenarios:               ScenarioResult[];
  overallStabilityForecast: StabilityForecast;
  primaryRiskFactor:       string;
  primaryOpportunity:      string;
  stabilityScore:          number;  // 0–100
}

// ─── Intelligence Modules — Self-Audit Benchmark ─────────────────────────────

export interface BenchmarkGap {
  dimension:         string;
  currentScore:      number;
  benchmarkMinimum:  number;
  gap:               number;
  severity:          SEOIssueSeverity;
}

export interface BenchmarkComparisonResult {
  passed:                    boolean;
  selfInconsistencyDetected: boolean;
  selfInconsistencyReason?:  string;
  overallGapScore:           number;   // 0–100 (100 = meets benchmark)
  gapReport:                 BenchmarkGap[];
  passingDimensions:         string[];
  failingDimensions:         string[];
  verdict:                   string;
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
  verificationReport?: VerificationReport;
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

// ─── Source-Grounded Verification Layer ──────────────────────────────────────

/** Where the evidence was extracted from — ordered from most to least authoritative */
export type EvidenceSourceType =
  | 'dom_element'        // direct HTML element (title, canonical, etc.)
  | 'meta_tag'           // <meta> attributes
  | 'link_element'       // <link> attributes (canonical, hreflang, etc.)
  | 'schema_jsonld'      // JSON-LD structured data
  | 'http_header'        // HTTP response headers (redirects, content-type, etc.)
  | 'anchor_text'        // <a> link text
  | 'heading'            // <h1>–<h6> content
  | 'body_text'          // visible body text
  | 'llm_interpretation'; // LLM-assisted interpretation — must be backed by DOM evidence

export interface EvidenceReference {
  sourceType: EvidenceSourceType;
  pageUrl: string;
  cssSelector?: string;    // e.g. 'head > meta[name="description"]'
  exactValue: string;      // the exact extracted value (never inferred)
  htmlSnippet?: string;    // up to 200 chars of source HTML
  observedAt: Date;        // crawl timestamp — used for staleness detection
}

export interface EvidenceFactors {
  /** Was the signal directly extracted from DOM, schema, or crawl artifacts? (0–1) */
  evidenceCompleteness: number;
  /**
   * Schema + DOM agreement → 1.0
   * Single reliable source (direct DOM attribute) → 0.9
   * Body text / heading only → 0.65
   * LLM interpretation with DOM backing → 0.5
   * LLM only, no DOM anchor → 0.3
   */
  sourceReliability: number;
  /**
   * Signal appears consistently across pages, schema, metadata, content → 1.0
   * Consistent in one source → 0.8
   * Conflicting signals across sources → 0.3
   */
  extractionConsistency: number;
}

export type ConfidenceClass = 'VERIFIED' | 'PROBABLE' | 'WEAK' | 'SUPPRESSED';

export interface ConfidenceScore {
  /** Composite 0–1: evidenceCompleteness×0.4 + sourceReliability×0.3 + extractionConsistency×0.3 */
  value: number;
  class: ConfidenceClass;
  factors: EvidenceFactors;
}

export interface VerifiedFinding {
  findingId: string;
  sourceAnalyzer: string;
  /** Machine-readable issue identifier, used by the self-healing agent for template lookup */
  issueType: string;
  category: 'seo' | 'entity' | 'schema' | 'content' | 'trust' | 'citation' | 'performance';
  description: string;
  recommendation: string;
  severity: SEOIssueSeverity;
  /** Severity after confidence adjustment — 'suppressed' means confidence < 0.5 */
  adjustedSeverity: SEOIssueSeverity | 'suppressed';
  confidence: ConfidenceScore;
  /** Direct evidence references — every finding must have at least one */
  evidence: EvidenceReference[];
  pageUrl: string | null;
  originalFinding: unknown;
}

export interface VerificationReport {
  auditId: string;
  verifiedAt: Date;
  totalFindings: number;
  verifiedCount: number;    // confidence ≥ 0.9 — VERIFIED facts
  probableCount: number;    // 0.70–0.89 — PROBABLE interpretations
  weakCount: number;        // 0.50–0.69 — WEAK signals
  suppressedCount: number;  // < 0.50 — suppressed (not shown to user)
  findings: VerifiedFinding[];
  coverageStats: {
    deterministic: number;  // directly observed metrics (confidence = 1.0)
    interpreted: number;    // LLM-assisted but evidence-backed
    suppressed: number;
  };
}

// ─── Self-Healing Agent ───────────────────────────────────────────────────────

export interface HealingAction {
  id: string;
  findingId: string;
  issueType: string;
  title: string;
  /** Higher number = higher urgency. Computed as severity_weight × confidence.value */
  priority: number;
  confidence: ConfidenceScore;
  affectedUrl: string | null;
  category: 'seo' | 'entity' | 'schema' | 'content' | 'trust' | 'citation' | 'performance';
  problem: string;
  solution: string;
  fixCode: string;
  fixLanguage: FixLanguage;
  expectedImpact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  fixSource: 'template' | 'llm';
}

export interface SelfHealingPlan {
  auditId: string;
  generatedAt: Date;
  totalActions: number;
  criticalActions: number;
  warningActions: number;
  /** Estimated score points recoverable if all critical + warning fixes are applied */
  estimatedScoreGain: number;
  actions: HealingAction[];
  /** Always present — surfaced in UI to prevent direct-deployment assumptions */
  disclaimer: string;
}

// ─── Crawl microservice — SSE event types ─────────────────────────────────────

export type CrawlEventType =
  | 'started'
  | 'page_crawled'
  | 'page_failed'
  | 'progress'
  | 'completed'
  | 'failed'
  | 'keepalive';

export interface CrawlEventStarted {
  type: 'started';
  jobId: string;
  domain: string;
  maxPages: number;
  timestamp: string;
}

export interface CrawlEventPageCrawled {
  type: 'page_crawled';
  jobId: string;
  url: string;
  statusCode: number;
  wordCount: number;
  chunkCount: number;
  hasSchema: boolean;
  timestamp: string;
}

export interface CrawlEventPageFailed {
  type: 'page_failed';
  jobId: string;
  url: string;
  error: string;
  timestamp: string;
}

export interface CrawlEventProgress {
  type: 'progress';
  jobId: string;
  pagesProcessed: number;
  pagesDiscovered: number;
  timestamp: string;
}

export interface CrawlEventCompleted {
  type: 'completed';
  jobId: string;
  pagesCount: number;
  durationMs: number;
  timestamp: string;
}

export interface CrawlEventFailed {
  type: 'failed';
  jobId: string;
  error: string;
  timestamp: string;
}

export interface CrawlEventKeepalive {
  type: 'keepalive';
  timestamp: string;
}

export type CrawlEvent =
  | CrawlEventStarted
  | CrawlEventPageCrawled
  | CrawlEventPageFailed
  | CrawlEventProgress
  | CrawlEventCompleted
  | CrawlEventFailed
  | CrawlEventKeepalive;

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
