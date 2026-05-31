/**
 * SiteNexis Intelligence Index (SII)
 *
 * A unified composite score measuring how "understandable" a website is
 * across both search engines and AI systems. Combines 6 orthogonal
 * dimensions into a single 0–100 score with full explainability.
 *
 * Weights (default model):
 *   SEO Readability       20%  — technical crawlability + SEO health
 *   AI Visibility         25%  — machine extraction + semantic trust
 *   Semantic Structure    20%  — schema completeness + machine readability
 *   Entity Clarity        15%  — entity confidence, consistency, disambiguation
 *   Retrieval Friendliness 10% — chunk quality + query-answer alignment
 *   Citation Potential    10%  — factual density + authority signals
 */

export interface SIIInput {
  url: string;
  // From Site Audit Agent
  seoScore: number | null;
  // From AI Visibility Agent
  machineReadabilityScore: number | null;
  aiVisibilityScore: number | null;
  semanticTrustScore: number | null;
  // From Entity Extraction System
  entityConfidenceScore: number | null;
  // From Retrieval Analysis Module
  retrievalReadinessScore: number | null;
  citationProbabilityScore: number | null;
  // Schema (from Site Audit Agent)
  schemaScore: number | null;
  // Optional context for confidence calculation
  pagesCrawled?: number;
  totalPagesEstimate?: number;
}

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

export interface SIIRecommendation {
  area: string;
  action: string;
  expected_gain: string;
}

export interface SIIResult {
  url: string;
  sii_score: number;
  confidence: number;
  breakdown: SIIBreakdown;
  weighted_contributions: SIIWeightedContributions;
  insights: string[];
  critical_gaps: string[];
  recommendation_priority: SIIRecommendation[];
}

// ─── Weights ──────────────────────────────────────────────────────────────────

const WEIGHTS: Record<keyof SIIBreakdown, number> = {
  seo_readability:      0.20,
  ai_visibility:        0.25,
  semantic_structure:   0.20,
  entity_clarity:       0.15,
  retrieval_friendliness: 0.10,
  citation_potential:   0.10,
};

// ─── Dimension derivation ─────────────────────────────────────────────────────

function deriveAIVisibility(input: SIIInput): number | null {
  // Blends machine readability + semantic trust to represent pure AI access
  // quality without double-counting entity or citation (separate dimensions).
  const mr   = input.machineReadabilityScore;
  const st   = input.semanticTrustScore;
  const full = input.aiVisibilityScore;

  if (mr !== null && st !== null) return Math.round(mr * 0.55 + st * 0.45);
  if (mr !== null) return mr;
  if (st !== null) return st;
  return full; // fallback to composite if sub-scores unavailable
}

function deriveSemanticStructure(input: SIIInput): number | null {
  const schema = input.schemaScore;
  const mr     = input.machineReadabilityScore;
  if (schema === null && mr === null) return null;
  if (schema === null) return mr;
  if (mr === null) return schema;
  return Math.round(schema * 0.60 + mr * 0.40);
}

// ─── Confidence ───────────────────────────────────────────────────────────────

function computeConfidence(breakdown: SIIBreakdown, input: SIIInput): number {
  let confidence = 1.0;

  // Each null dimension reduces confidence proportional to its weight × 1.5
  for (const [dim, val] of Object.entries(breakdown)) {
    if (val === null) {
      confidence -= WEIGHTS[dim as keyof SIIBreakdown] * 1.5;
    }
  }

  // Shallow crawl penalty (fewer than 5 pages is a low-signal audit)
  if (input.pagesCrawled !== undefined && input.pagesCrawled < 5) {
    confidence -= 0.15;
  }

  // Very shallow vs estimated total
  if (input.pagesCrawled !== undefined && input.totalPagesEstimate !== undefined && input.totalPagesEstimate > 0) {
    const ratio = input.pagesCrawled / input.totalPagesEstimate;
    if (ratio < 0.20) confidence -= 0.10;
  }

  return Math.round(Math.max(0.10, Math.min(1.0, confidence)) * 100) / 100;
}

// ─── Insights ────────────────────────────────────────────────────────────────

const DIMENSION_ACTIONS: Record<keyof SIIBreakdown, { low: string; medium: string; high: string }> = {
  seo_readability: {
    low:    'resolve crawlability failures and fix critical metadata gaps',
    medium: 'address canonical and sitemap completeness',
    high:   'maintain crawl health; no structural blockers detected',
  },
  ai_visibility: {
    low:    'reduce boilerplate ratio and improve chunk boundary quality',
    medium: 'improve semantic trust signals and extraction fidelity',
    high:   'strong AI extraction pipeline — minimal degradation detected',
  },
  semantic_structure: {
    low:    'implement complete schema markup for primary entity and all key pages',
    medium: 'extend schema coverage to product, FAQ, and author entities',
    high:   'structured data foundation is solid',
  },
  entity_clarity: {
    low:    'define primary entity explicitly with full schema and sameAs links',
    medium: 'resolve entity attribute inconsistencies across pages',
    high:   'entity representation is clear and consistently applied',
  },
  retrieval_friendliness: {
    low:    'restructure paragraphs into self-contained semantic units',
    medium: 'add FAQ content and direct-answer structures to key pages',
    high:   'content retrieval structure supports query-answer alignment',
  },
  citation_potential: {
    low:    'increase factual density with sourced, specific claims',
    medium: 'add dateModified schema and improve temporal freshness signals',
    high:   'citation authority signals are well established',
  },
};

function generateInsights(breakdown: SIIBreakdown): string[] {
  const insights: string[] = [];

  for (const [dim, score] of Object.entries(breakdown)) {
    if (score === null) {
      insights.push(`${dim}:null — input missing; dimension excluded from scoring`);
      continue;
    }
    const actions = DIMENSION_ACTIONS[dim as keyof SIIBreakdown];
    if (score < 50) {
      insights.push(`${dim}:${score} — ${actions.low}`);
    } else if (score < 70) {
      insights.push(`${dim}:${score} — ${actions.medium}`);
    } else if (score >= 85) {
      insights.push(`${dim}:${score} — ${actions.high}`);
    }
    // 70–84 is "acceptable" — no insight generated (reduces noise)
  }

  return insights;
}

// ─── Critical gaps ────────────────────────────────────────────────────────────

function generateCriticalGaps(breakdown: SIIBreakdown): string[] {
  const gaps: string[] = [];

  for (const [dim, score] of Object.entries(breakdown)) {
    if (score === null) {
      gaps.push(`${dim} — score unavailable: input data missing from audit`);
    } else if (score < 50) {
      gaps.push(`${dim}:${score} — below critical threshold (50); direct score suppression`);
    }
  }

  // Large spread between best and worst non-null dimension
  const scores = Object.values(breakdown).filter((s): s is number => s !== null);
  if (scores.length >= 2) {
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    if (max - min > 35) {
      const bestDim  = Object.keys(breakdown).find((k) => breakdown[k as keyof SIIBreakdown] === max);
      const worstDim = Object.keys(breakdown).find((k) => breakdown[k as keyof SIIBreakdown] === min);
      gaps.push(`dimension_spread:${max - min}pts — ${worstDim ?? 'unknown'} dragging composite despite strong ${bestDim ?? 'unknown'}`);
    }
  }

  return gaps;
}

// ─── Recommendations ─────────────────────────────────────────────────────────

const RECOMMENDATION_TEMPLATES: Record<keyof SIIBreakdown, (score: number) => SIIRecommendation> = {
  seo_readability: (score) => ({
    area: 'SEO Readability',
    action: score < 50
      ? 'Fix crawl errors, duplicate titles, and missing canonical tags before any other optimisation'
      : 'Complete sitemap coverage and resolve remaining metadata gaps on key pages',
    expected_gain: `+${Math.round((75 - Math.min(score, 75)) * WEIGHTS.seo_readability)}pts to SII`,
  }),
  ai_visibility: (score) => ({
    area: 'AI Visibility',
    action: score < 50
      ? 'Remove boilerplate content, restructure chunks to ≤500 tokens with clear semantic boundaries'
      : 'Strengthen authorship trust signals and reduce semantic trust deficits on high-traffic pages',
    expected_gain: `+${Math.round((78 - Math.min(score, 78)) * WEIGHTS.ai_visibility)}pts to SII`,
  }),
  semantic_structure: (score) => ({
    area: 'Semantic Structure',
    action: score < 50
      ? 'Implement Organization schema on all pages; add Product/Service/FAQ schema to conversion pages'
      : 'Extend schema to author entities, breadcrumbs, and FAQ across informational content',
    expected_gain: `+${Math.round((80 - Math.min(score, 80)) * WEIGHTS.semantic_structure)}pts to SII`,
  }),
  entity_clarity: (score) => ({
    area: 'Entity Clarity',
    action: score < 50
      ? 'Define primary entity explicitly in body text and schema on every key page; add minimum 3 sameAs links'
      : 'Resolve entity attribute inconsistencies between schema and body text on top pages by PageRank',
    expected_gain: `+${Math.round((80 - Math.min(score, 80)) * WEIGHTS.entity_clarity)}pts to SII`,
  }),
  retrieval_friendliness: (score) => ({
    area: 'Retrieval Friendliness',
    action: score < 50
      ? 'Rewrite key paragraphs as self-contained semantic units; add explicit direct-answer sections'
      : 'Add FAQ schema to 5+ high-traffic pages; restructure long pages with clear H2 section answers',
    expected_gain: `+${Math.round((80 - Math.min(score, 80)) * WEIGHTS.retrieval_friendliness)}pts to SII`,
  }),
  citation_potential: (score) => ({
    area: 'Citation Potential',
    action: score < 50
      ? 'Add specific statistics with source citations to every key page; implement dateModified schema'
      : 'Increase claim specificity — replace general assertions with verifiable, dated, attributed facts',
    expected_gain: `+${Math.round((80 - Math.min(score, 80)) * WEIGHTS.citation_potential)}pts to SII`,
  }),
};

function generateRecommendations(breakdown: SIIBreakdown): SIIRecommendation[] {
  // Potential gain = distance from target (80) × dimension weight
  type Entry = { dim: keyof SIIBreakdown; score: number; potential: number };

  const candidates: Entry[] = [];
  for (const [dim, score] of Object.entries(breakdown)) {
    if (score === null) continue;
    const target = 80;
    if (score < target) {
      const potential = (target - score) * WEIGHTS[dim as keyof SIIBreakdown];
      candidates.push({ dim: dim as keyof SIIBreakdown, score, potential });
    }
  }

  return candidates
    .sort((a, b) => b.potential - a.potential)
    .slice(0, 3)
    .map(({ dim, score }) => RECOMMENDATION_TEMPLATES[dim](score));
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeSIIScore(input: SIIInput): SIIResult {
  // 1. Derive the 6 normalised dimension scores
  const breakdown: SIIBreakdown = {
    seo_readability:       input.seoScore,
    ai_visibility:         deriveAIVisibility(input),
    semantic_structure:    deriveSemanticStructure(input),
    entity_clarity:        input.entityConfidenceScore,
    retrieval_friendliness: input.retrievalReadinessScore,
    citation_potential:    input.citationProbabilityScore,
  };

  // 2. Compute weighted contributions (null dimensions contribute 0 but reduce confidence)
  const weighted_contributions: SIIWeightedContributions = {
    seo_readability:       breakdown.seo_readability       !== null ? Math.round(breakdown.seo_readability       * WEIGHTS.seo_readability       * 10) / 10 : null,
    ai_visibility:         breakdown.ai_visibility         !== null ? Math.round(breakdown.ai_visibility         * WEIGHTS.ai_visibility         * 10) / 10 : null,
    semantic_structure:    breakdown.semantic_structure     !== null ? Math.round(breakdown.semantic_structure     * WEIGHTS.semantic_structure     * 10) / 10 : null,
    entity_clarity:        breakdown.entity_clarity         !== null ? Math.round(breakdown.entity_clarity         * WEIGHTS.entity_clarity         * 10) / 10 : null,
    retrieval_friendliness: breakdown.retrieval_friendliness !== null ? Math.round(breakdown.retrieval_friendliness * WEIGHTS.retrieval_friendliness * 10) / 10 : null,
    citation_potential:    breakdown.citation_potential     !== null ? Math.round(breakdown.citation_potential     * WEIGHTS.citation_potential     * 10) / 10 : null,
  };

  // 3. Compute final SII score — only over present dimensions, renormalised
  let weightedSum  = 0;
  let activeWeight = 0;
  for (const [dim, score] of Object.entries(breakdown)) {
    if (score !== null) {
      const w = WEIGHTS[dim as keyof SIIBreakdown];
      weightedSum  += score * w;
      activeWeight += w;
    }
  }
  const sii_score = activeWeight > 0 ? Math.round(weightedSum / activeWeight) : 0;

  // 4. Confidence
  const confidence = computeConfidence(breakdown, input);

  // 5. Insights
  const insights = generateInsights(breakdown);

  // 6. Critical gaps
  const critical_gaps = generateCriticalGaps(breakdown);

  // 7. Recommendations
  const recommendation_priority = generateRecommendations(breakdown);

  return {
    url: input.url,
    sii_score,
    confidence,
    breakdown,
    weighted_contributions,
    insights,
    critical_gaps,
    recommendation_priority,
  };
}
