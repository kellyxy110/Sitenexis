// Enhanced Audit Report — types for the full intelligence report layer.
// Every AuditIssue carries evidence, business impact, AI visibility impact, SEO impact,
// a generated fix, and expected improvement. No black boxes.

export type AuditIssueCategory =
  | 'technical'
  | 'seo'
  | 'schema'
  | 'ai_visibility'
  | 'entity'
  | 'content'
  | 'trust'
  | 'accessibility'
  | 'performance'
  | 'conversion';

export type AuditIssueSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface AuditIssueEvidence {
  pageUrl: string;
  observedValue?: string;
  expectedValue?: string;
  sourceSnippet?: string;
  crawlDataField?: string;
  confidence: number;
}

export interface AuditIssueBusinessImpact {
  summary: string;
  impactLevel: 'very_high' | 'high' | 'medium' | 'low';
  affectedAreas: string[];
}

export interface AuditIssueAIVisibilityImpact {
  summary: string;
  affectedSignals: string[];
  estimatedScoreLoss: number;
}

export interface AuditIssueSEOImpact {
  summary: string;
  estimatedScoreLoss: number;
}

export interface AuditIssueRecommendedSolution {
  summary: string;
  steps: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: string;
}

export type GeneratedFixType =
  | 'json_ld'
  | 'html'
  | 'meta'
  | 'copy'
  | 'robots'
  | 'sitemap'
  | 'canonical'
  | 'alt_text'
  | 'faq';

export interface AuditIssueFix {
  type: GeneratedFixType;
  code?: string;
  copy?: string;
  placementInstructions?: string;
}

export interface AuditIssueExpectedImprovement {
  aiVisibilityGain: number;
  seoGain: number;
  trustGain: number;
  confidence: number;
}

export interface AuditIssue {
  id: string;
  title: string;
  category: AuditIssueCategory;
  severity: AuditIssueSeverity;
  affectedPages: string[];
  evidence: AuditIssueEvidence[];
  whyItMatters: string;
  businessImpact: AuditIssueBusinessImpact;
  aiVisibilityImpact: AuditIssueAIVisibilityImpact;
  seoImpact: AuditIssueSEOImpact;
  recommendedSolution: AuditIssueRecommendedSolution;
  generatedFix?: AuditIssueFix;
  expectedImprovement: AuditIssueExpectedImprovement;
  priorityScore: number;
}

// ─── Explainable Score ───────────────────────────────────────────────────────

export interface ExplainableScoreTopFix {
  action: string;
  estimatedGain: number;
}

export interface ExplainableScore {
  dimension: string;
  value: number;
  reason: string;
  positiveSignals: string[];
  negativeSignals: string[];
  topFixes: ExplainableScoreTopFix[];
  estimatedAfterFixes: number;
}

export interface EnhancedScores {
  overall: ExplainableScore;
  seoHealth: ExplainableScore;
  aiVisibility: ExplainableScore;
  entityClarity: ExplainableScore;
  schemaCompleteness: ExplainableScore;
  machineReadability: ExplainableScore;
  citationProbability: ExplainableScore;
  trustAndEEAT: ExplainableScore;
  contentDepth: ExplainableScore;
  technicalHealth: ExplainableScore;
  conversionReadiness: ExplainableScore;
}

// ─── Page Analysis ───────────────────────────────────────────────────────────

export interface PageAnalysisResult {
  url: string;
  title: string | null;
  issueIds: string[];
  scores: {
    seo: number;
    aiVisibility: number;
    schema: number;
  };
  retrievalQualityScore: number;
  citationEligibilityScore: number;
  primaryEntity: string | null;
  schemaTypes: string[];
  wordCount: number;
  recommendations: string[];
}

// ─── Schema Recommendation ───────────────────────────────────────────────────

export interface SchemaRecommendation {
  pageUrl: string;
  schemaType: string;
  reason: string;
  generatedCode: string;
  priority: 'high' | 'medium' | 'low';
}

// ─── AI Visibility Recommendation ────────────────────────────────────────────

export interface AIVisibilityRecommendation {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'easy' | 'medium' | 'hard';
  affectedScore: string;
  estimatedGain: number;
}

// ─── Generated Fix Summary ───────────────────────────────────────────────────

export interface GeneratedFixSummary {
  issueId: string;
  issueTitle: string;
  fixType: GeneratedFixType;
  code?: string;
  copy?: string;
  placementInstructions?: string;
}

// ─── Implementation Roadmap ──────────────────────────────────────────────────

export interface RoadmapItem {
  week: 1 | 2 | 3 | 4;
  title: string;
  description: string;
  issueIds: string[];
  estimatedImpact: { aiVisibility: number; seo: number; trust: number };
  effort: 'easy' | 'medium' | 'hard';
}

// ─── Expected Improvement ────────────────────────────────────────────────────

export interface ExpectedImprovement {
  current: { aiVisibility: number; seo: number; trust: number; overall: number };
  afterWeek1: { aiVisibility: number; seo: number; trust: number; overall: number };
  afterAllFixes: { aiVisibility: number; seo: number; trust: number; overall: number };
  confidence: number;
}

// ─── Evidence Appendix ───────────────────────────────────────────────────────

export interface EvidenceRecord {
  issueId: string;
  issueTitle: string;
  pageUrl: string;
  crawlDataField: string;
  observedValue: string;
  expectedValue: string;
  confidence: number;
}

// ─── Top-Level Report ────────────────────────────────────────────────────────

export interface EnhancedAuditMeta {
  auditId: string;
  domain: string;
  generatedAt: Date;
  pagesAnalyzed: number;
  crawlDurationMs?: number;
  engineVersion: string;
}

export interface ExecutiveSummary {
  overallScore: number;
  headline: string;
  keyFindings: string[];
  topOpportunities: string[];
  estimatedTotalGain: { aiVisibility: number; seo: number; trust: number };
}

export interface EnhancedAuditReport {
  meta: EnhancedAuditMeta;
  executiveSummary: ExecutiveSummary;
  scores: EnhancedScores;
  criticalIssues: AuditIssue[];
  highIssues: AuditIssue[];
  mediumIssues: AuditIssue[];
  lowIssues: AuditIssue[];
  pageAnalyses: PageAnalysisResult[];
  schemaRecommendations: SchemaRecommendation[];
  aiVisibilityRecommendations: AIVisibilityRecommendation[];
  generatedFixes: GeneratedFixSummary[];
  implementationRoadmap: RoadmapItem[];
  expectedImprovements: ExpectedImprovement;
  evidenceAppendix: EvidenceRecord[];
}

// ─── Engine Input ─────────────────────────────────────────────────────────────

export interface EnhancedReportInput {
  auditId: string;
  domain: string;
  crawlDurationMs?: number;
  pages: import('./types').CrawledPage[];
  scores: {
    seoScore: number;
    schemaScore: number;
    aiScore: number;
    machineReadabilityScore: number;
    entityConfidenceScore: number;
    retrievalReadinessScore: number;
    citationProbabilityScore: number;
    semanticTrustScore: number;
    recommendationConfidence: number;
    overall: number;
  };
  seoIssues: Array<{
    type: string;
    severity: 'critical' | 'warning' | 'info';
    url: string;
    message: string;
    problem: string;
    cause: string;
    solution: string;
    recommendation: string;
  }>;
}
