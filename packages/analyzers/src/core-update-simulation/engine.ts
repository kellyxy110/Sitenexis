/**
 * Core Update Simulation Engine
 *
 * Simulates how a website would perform under three Google Core Update
 * scenarios and one AI citation alignment scenario. Deterministic and
 * reproducible — same inputs produce same outputs. No AI API calls.
 *
 * All outputs are labelled as modeled behaviour estimates, not measurements.
 */

import type {
  AuthorityStabilityScore,
  CitationAnalysis,
  EntityIntelligenceReport,
  SemanticTrustScore,
  CoreUpdateSimulationResult,
  ScenarioResult,
  ScenarioPrediction,
  StabilityForecast,
} from '@sitenexis/shared';

// ─── Scenario 1: Authority-first update ──────────────────────────────────────
// Google weights first-party experience and expert content more heavily.
// Winners: first-party authorities. Losers: aggregators, thin content.

function simulateAuthorityFirst(
  authorityStability: AuthorityStabilityScore,
  entityReport: EntityIntelligenceReport,
): ScenarioResult {
  const firstParty   = authorityStability.firstPartyDepthScore;
  const originality  = authorityStability.contentOriginalityScore;
  const entityScore  = entityReport.entityConfidenceScore;
  const classification = authorityStability.classification;

  // Composite signal for this scenario
  const signal = Math.round(firstParty * 0.45 + originality * 0.35 + entityScore * 0.20);

  let prediction: ScenarioPrediction;
  let predictedScoreChange: number;

  if (signal >= 70) {
    prediction = 'gain';
    predictedScoreChange = Math.round((signal - 60) / 4);
  } else if (signal >= 45) {
    prediction = 'neutral';
    predictedScoreChange = 0;
  } else {
    prediction = 'loss';
    predictedScoreChange = -Math.round((55 - signal) / 4);
  }

  const riskZones: string[] = [];
  const opportunityZones: string[] = [];

  if (classification === 'aggregator') {
    riskZones.push('Aggregated list pages and roundup content without original analysis');
    riskZones.push('Pages that cite external sources without adding interpretation');
  }
  if (originality < 50) {
    riskZones.push('Thin content pages with low word count and high external link density');
  }
  if (firstParty > 60) {
    opportunityZones.push('Original research and proprietary data pages');
    opportunityZones.push('Expert authored content with credential attribution');
  }
  if (entityScore > 70) {
    opportunityZones.push('Primary entity definition pages with strong sameAs validation');
  }

  return {
    scenario: 'authority_first',
    prediction,
    confidenceLevel: 0.70,
    predictedScoreChange: Math.min(20, Math.max(-20, predictedScoreChange)),
    riskZones,
    opportunityZones,
    reasoning: `${classification === 'aggregator' ? 'Aggregator pattern detected' : classification === 'hybrid' ? 'Mixed first-party and aggregated content' : 'Strong first-party authority signals'} — first-party depth score: ${firstParty}, originality: ${originality}.`,
  };
}

// ─── Scenario 2: Aggregation filter update ───────────────────────────────────
// Google suppresses sites that primarily aggregate and repackage external content.

function simulateAggregationFilter(
  authorityStability: AuthorityStabilityScore,
  semanticTrust: SemanticTrustScore,
): ScenarioResult {
  const risk         = authorityStability.aggregationRisk;
  const orgTrust     = semanticTrust.breakdown.organisationalTrust;
  const contentTrust = semanticTrust.breakdown.contentTrust;

  let riskPenalty = 0;
  if (risk === 'high')   riskPenalty = -18;
  if (risk === 'medium') riskPenalty = -6;

  const trustBoost = Math.round((orgTrust + contentTrust) / 2 - 50) / 8;
  const predictedScoreChange = Math.round(riskPenalty + trustBoost);

  const prediction: ScenarioPrediction =
    predictedScoreChange > 3  ? 'gain'    :
    predictedScoreChange < -3 ? 'loss'    : 'neutral';

  const riskZones: string[] = [];
  const opportunityZones: string[] = [];

  if (risk === 'high') {
    riskZones.push('Category/directory pages that list links to external resources');
    riskZones.push('News aggregation or content curation pages');
    riskZones.push('Comparison pages built primarily from third-party data');
  }
  if (risk === 'medium') {
    riskZones.push('Pages mixing original content with substantial external aggregation');
  }
  if (risk === 'low') {
    opportunityZones.push('Original research pages gain relative advantage as competitors are filtered');
    opportunityZones.push('Primary entity pages with strong organisational trust signals');
  }

  return {
    scenario: 'aggregation_filter',
    prediction,
    confidenceLevel: 0.65,
    predictedScoreChange: Math.min(15, Math.max(-25, predictedScoreChange)),
    riskZones,
    opportunityZones,
    reasoning: `Aggregation risk: ${risk}. Sites with ${risk} aggregation risk ${
      risk === 'low' ? 'benefit as low-quality aggregators are filtered' :
      risk === 'medium' ? 'face moderate risk if content mix tilts toward aggregation' :
      'face significant risk under an aggregation filter scenario'
    }.`,
  };
}

// ─── Scenario 3: AI citation alignment ───────────────────────────────────────
// Rankings align more closely with what AI systems would cite — factual density,
// entity authority, direct answers. This scenario models convergence between
// AI citation signals and organic ranking signals.

function simulateAICitationAlignment(
  citationAnalysis: CitationAnalysis,
  entityReport: EntityIntelligenceReport,
  authorityStability: AuthorityStabilityScore,
): ScenarioResult {
  const citationScore    = citationAnalysis.citationProbabilityScore;
  const entityConfidence = entityReport.entityConfidenceScore;
  const firstParty       = authorityStability.firstPartyDepthScore;

  // Under citation-alignment, citation probability score directly predicts ranking change
  const baselineSignal = Math.round(
    citationScore    * 0.45 +
    entityConfidence * 0.35 +
    firstParty       * 0.20,
  );

  const predictedScoreChange = Math.round((baselineSignal - 55) / 4);
  const prediction: ScenarioPrediction =
    predictedScoreChange > 3  ? 'gain'    :
    predictedScoreChange < -3 ? 'loss'    : 'neutral';

  const riskZones: string[] = [];
  const opportunityZones: string[] = [];

  if (citationScore < 40) {
    riskZones.push('Pages with low factual density — general descriptions without verifiable claims');
    riskZones.push('Pages with promotional language — marketing copy is suppressed in citation selection');
  }
  if (entityConfidence < 50) {
    riskZones.push('Pages where the primary entity is ambiguous or inconsistently described');
  }
  if (citationScore > 65) {
    opportunityZones.push('High-factual-density pages with specific, verifiable claims');
    opportunityZones.push('Structured answer pages (FAQ, How-To) that directly satisfy informational queries');
  }
  if (entityConfidence > 70) {
    opportunityZones.push('Primary entity definition pages with strong external validation');
  }

  return {
    scenario: 'ai_citation_alignment',
    prediction,
    confidenceLevel: 0.75,
    predictedScoreChange: Math.min(20, Math.max(-20, predictedScoreChange)),
    riskZones,
    opportunityZones,
    reasoning: `Citation probability score: ${citationScore}, entity confidence: ${entityConfidence}. ${
      citationScore > 65 ? 'Strong citation eligibility — well positioned for AI-ranking alignment.' :
      citationScore < 40 ? 'Low citation eligibility — content structure not optimised for AI selection.' :
      'Moderate citation eligibility — some pages well positioned, others at risk.'
    }`,
  };
}

// ─── Stability forecast ───────────────────────────────────────────────────────

function computeStabilityForecast(
  scenarios: ScenarioResult[],
): StabilityForecast {
  const losses = scenarios.filter((s) => s.prediction === 'loss').length;
  const gains  = scenarios.filter((s) => s.prediction === 'gain').length;

  if (gains >= 2 && losses === 0) return 'growth_likely';
  if (losses >= 2)                return 'at_risk';
  return 'stable';
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function simulateCoreUpdateScenarios(
  authorityStability: AuthorityStabilityScore,
  citationAnalysis: CitationAnalysis,
  entityReport: EntityIntelligenceReport,
  semanticTrust: SemanticTrustScore,
): CoreUpdateSimulationResult {
  const s1 = simulateAuthorityFirst(authorityStability, entityReport);
  const s2 = simulateAggregationFilter(authorityStability, semanticTrust);
  const s3 = simulateAICitationAlignment(citationAnalysis, entityReport, authorityStability);

  const scenarios = [s1, s2, s3];
  const forecast  = computeStabilityForecast(scenarios);

  // Stability score: inverse of loss magnitude
  const avgChange = scenarios.reduce((sum, s) => sum + s.predictedScoreChange, 0) / scenarios.length;
  const stabilityScore = Math.min(100, Math.max(0, Math.round(50 + avgChange * 2)));

  // Primary risk factor: the highest-severity loss zone
  const lossScenarios = scenarios.filter((s) => s.prediction === 'loss');
  const primaryRiskFactor = lossScenarios.length > 0
    ? lossScenarios[0]!.riskZones[0] ?? 'Low first-party authority signals relative to algorithmic preference'
    : 'No significant risk factors detected across modeled scenarios';

  // Primary opportunity: highest gain zone
  const gainScenarios = scenarios.filter((s) => s.prediction === 'gain');
  const primaryOpportunity = gainScenarios.length > 0
    ? gainScenarios[0]!.opportunityZones[0] ?? 'Strengthen first-party content depth'
    : scenarios.flatMap((s) => s.opportunityZones)[0] ?? 'Improve factual density and entity authority';

  return {
    scenarios,
    overallStabilityForecast: forecast,
    primaryRiskFactor,
    primaryOpportunity,
    stabilityScore,
  };
}
