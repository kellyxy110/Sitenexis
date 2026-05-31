import type {
  SEOScore,
  AIReadabilityScore,
  MachineReadabilityScore,
  EntityIntelligenceReport,
  CitationAnalysis,
  SemanticTrustScore,
  SchemaScore,
  LinkGraphScore,
  PerformanceScore,
  PerceptionGraphSnapshot,
} from '@sitenexis/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SiteNexisHealthScore {
  overall: number;
  dimensions: {
    technicalSeo: number;
    aiVisibility: number;
    entityCoverage: number;
    citationReadiness: number;
    knowledgeGraph: number;
    trustSignals: number;
    performance: number;
    geo: number;
  };
  breakdown: Record<string, unknown>;
  label: 'Excellent' | 'Good' | 'Needs Work' | 'Critical';
  color: string;
}

// ─── Weight configuration ─────────────────────────────────────────────────────

/**
 * SiteNexis Health Score dimension weights.
 * Total = 1.00
 *
 * AI Visibility and Entity Coverage are weighted highest because they
 * represent the core value proposition: machine trust and AI retrievability.
 */
const DIMENSION_WEIGHTS = {
  technicalSeo: 0.18,
  aiVisibility: 0.22,
  entityCoverage: 0.15,
  citationReadiness: 0.15,
  knowledgeGraph: 0.10,
  trustSignals: 0.12,
  performance: 0.05,
  geo: 0.03,
} as const;

// ─── Dimension scorers ────────────────────────────────────────────────────────

function scoreTechnicalSeo(seo: SEOScore, schema: SchemaScore, linkGraph: LinkGraphScore): number {
  return Math.round(
    seo.score * 0.50
    + schema.score * 0.30
    + linkGraph.score * 0.20,
  );
}

function scoreAIVisibility(
  aiReadability: AIReadabilityScore,
  machineReadability: MachineReadabilityScore,
): number {
  return Math.round(
    aiReadability.score * 0.55
    + machineReadability.score * 0.45,
  );
}

function scoreEntityCoverage(entity: EntityIntelligenceReport): number {
  return Math.round(
    entity.entityConfidenceScore * 0.40
    + entity.entityConsistencyScore * 0.35
    + entity.entityCoverageScore * 0.25,
  );
}

function scoreCitationReadiness(citation: CitationAnalysis): number {
  return citation.citationProbabilityScore;
}

function scoreKnowledgeGraph(graph: PerceptionGraphSnapshot): number {
  if (graph.nodes.length === 0) return 0;

  const avgConfidence = graph.nodes.reduce((s, n) => s + n.confidence, 0) / graph.nodes.length;
  const avgCitationReadiness = graph.nodes.reduce((s, n) => s + n.citationReadiness, 0) / graph.nodes.length;
  const density = graph.edges.length / Math.max(graph.nodes.length, 1);

  return Math.round(
    avgConfidence * 40
    + avgCitationReadiness * 35
    + Math.min(density * 10, 25),
  );
}

function scoreTrustSignals(trust: SemanticTrustScore): number {
  return trust.score;
}

function scorePerformance(performance: PerformanceScore): number {
  return performance.score;
}

function scoreGeo(
  entity: EntityIntelligenceReport,
  schema: SchemaScore,
  citation: CitationAnalysis,
): number {
  // GEO (Generative Engine Optimisation) = AI retrievability + entity authority + citation signals
  return Math.round(
    entity.entityConfidenceScore * 0.40
    + citation.citationProbabilityScore * 0.35
    + schema.score * 0.25,
  );
}

// ─── Main engine ──────────────────────────────────────────────────────────────

/**
 * Computes the SiteNexis Health Score — a composite of all 7 audit dimensions.
 * Designed specifically for the self-audit of https://sitenexis.com.
 *
 * All dimension scores are 0–100. The overall score is the weighted sum.
 */
export function computeHealthScore(inputs: {
  seo: SEOScore;
  aiReadability: AIReadabilityScore;
  machineReadability: MachineReadabilityScore;
  entity: EntityIntelligenceReport;
  citation: CitationAnalysis;
  trust: SemanticTrustScore;
  schema: SchemaScore;
  linkGraph: LinkGraphScore;
  performance: PerformanceScore;
  perceptionGraph: PerceptionGraphSnapshot;
}): SiteNexisHealthScore {
  const dimensions = {
    technicalSeo: Math.min(100, Math.max(0, scoreTechnicalSeo(inputs.seo, inputs.schema, inputs.linkGraph))),
    aiVisibility: Math.min(100, Math.max(0, scoreAIVisibility(inputs.aiReadability, inputs.machineReadability))),
    entityCoverage: Math.min(100, Math.max(0, scoreEntityCoverage(inputs.entity))),
    citationReadiness: Math.min(100, Math.max(0, scoreCitationReadiness(inputs.citation))),
    knowledgeGraph: Math.min(100, Math.max(0, scoreKnowledgeGraph(inputs.perceptionGraph))),
    trustSignals: Math.min(100, Math.max(0, scoreTrustSignals(inputs.trust))),
    performance: Math.min(100, Math.max(0, scorePerformance(inputs.performance))),
    geo: Math.min(100, Math.max(0, scoreGeo(inputs.entity, inputs.schema, inputs.citation))),
  };

  const overall = Math.round(
    dimensions.technicalSeo * DIMENSION_WEIGHTS.technicalSeo
    + dimensions.aiVisibility * DIMENSION_WEIGHTS.aiVisibility
    + dimensions.entityCoverage * DIMENSION_WEIGHTS.entityCoverage
    + dimensions.citationReadiness * DIMENSION_WEIGHTS.citationReadiness
    + dimensions.knowledgeGraph * DIMENSION_WEIGHTS.knowledgeGraph
    + dimensions.trustSignals * DIMENSION_WEIGHTS.trustSignals
    + dimensions.performance * DIMENSION_WEIGHTS.performance
    + dimensions.geo * DIMENSION_WEIGHTS.geo,
  );

  const label = getHealthLabel(overall);
  const color = getHealthColor(overall);

  const breakdown: Record<string, unknown> = {
    weights: DIMENSION_WEIGHTS,
    dimensionScores: dimensions,
    seoBreakdown: inputs.seo.breakdown,
    aiBreakdown: inputs.aiReadability.breakdown,
    machineReadabilityBreakdown: inputs.machineReadability.breakdown,
    entityBreakdown: {
      consistencyScore: inputs.entity.entityConsistencyScore,
      coverageScore: inputs.entity.entityCoverageScore,
      disambiguationScore: inputs.entity.disambiguationScore,
      entitiesDetected: inputs.entity.entitiesDetected.length,
    },
    citationBreakdown: {
      citationProbabilityScore: inputs.citation.citationProbabilityScore,
      topCandidates: inputs.citation.topCitationCandidates.slice(0, 5),
    },
    trustBreakdown: inputs.trust.breakdown,
    schemaBreakdown: { score: inputs.schema.score, coverage: inputs.schema.coverage },
    graphBreakdown: {
      nodeCount: inputs.perceptionGraph.nodes.length,
      edgeCount: inputs.perceptionGraph.edges.length,
    },
    performanceBreakdown: {
      lighthouseScore: inputs.performance.lighthouseScore,
      lcp: inputs.performance.lcp,
      cls: inputs.performance.cls,
    },
  };

  return { overall, dimensions, breakdown, label, color };
}

export function getHealthLabel(score: number): SiteNexisHealthScore['label'] {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs Work';
  return 'Critical';
}

export function getHealthColor(score: number): string {
  if (score >= 90) return '#22C55E';
  if (score >= 70) return '#0BCEBC';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}
