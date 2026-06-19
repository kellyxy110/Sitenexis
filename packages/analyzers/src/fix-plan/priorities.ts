import type { FixPriority, FixPlanImpactScores, SEOIssueSeverity } from '@sitenexis/shared';

const MODULE_WEIGHT: Record<string, number> = {
  seo: 8,
  schema: 7,
  'machine-readability': 6,
  entity: 7,
  citation: 5,
  'semantic-trust': 6,
  'ai-visibility': 7,
  content: 5,
  performance: 4,
  'link-graph': 5,
  'machine-trust': 6,
  'retrieval-simulation': 5,
  'temporal-authority': 4,
  'recommendation-surface': 5,
  'synthetic-entity': 3,
};

const SEVERITY_SCORE: Record<SEOIssueSeverity, number> = {
  critical: 10,
  warning: 5,
  info: 2,
};

export function assignPriority(
  severity: SEOIssueSeverity,
  module: string,
  impactScores: FixPlanImpactScores,
): FixPriority {
  const severityScore = SEVERITY_SCORE[severity] ?? 2;
  const moduleWeight = MODULE_WEIGHT[module] ?? 5;
  const impactTotal = impactScores.seoImpact + impactScores.aiVisibilityImpact + impactScores.trustImpact;

  const composite = severityScore * 3 + moduleWeight * 2 + impactTotal;

  if (composite >= 55 || severity === 'critical') return 'P0';
  if (composite >= 30 || severity === 'warning') return 'P1';
  return 'P2';
}

export function computeImpactScores(
  severity: SEOIssueSeverity,
  module: string,
  type: string,
): FixPlanImpactScores {
  let seoImpact = 0;
  let aiVisibilityImpact = 0;
  let trustImpact = 0;

  // SEO-heavy modules
  if (['seo', 'link-graph', 'performance'].includes(module)) {
    seoImpact = severity === 'critical' ? 9 : severity === 'warning' ? 6 : 3;
  }

  // AI visibility modules
  if (['ai-visibility', 'machine-readability', 'entity', 'citation', 'retrieval-simulation', 'recommendation-surface'].includes(module)) {
    aiVisibilityImpact = severity === 'critical' ? 9 : severity === 'warning' ? 6 : 3;
  }

  // Trust modules
  if (['semantic-trust', 'machine-trust', 'synthetic-entity', 'temporal-authority'].includes(module)) {
    trustImpact = severity === 'critical' ? 9 : severity === 'warning' ? 6 : 3;
  }

  // Schema affects all three dimensions
  if (module === 'schema') {
    seoImpact = severity === 'critical' ? 7 : 4;
    aiVisibilityImpact = severity === 'critical' ? 8 : 5;
    trustImpact = severity === 'critical' ? 6 : 3;
  }

  // Content affects SEO + AI visibility
  if (module === 'content') {
    seoImpact = severity === 'critical' ? 6 : 3;
    aiVisibilityImpact = severity === 'critical' ? 7 : 4;
  }

  // Type-specific boosts
  if (type.includes('missing_h1') || type.includes('missing_title')) seoImpact = Math.max(seoImpact, 8);
  if (type.includes('entity') || type.includes('disambiguation')) aiVisibilityImpact = Math.max(aiVisibilityImpact, 7);
  if (type.includes('contradiction') || type.includes('trust')) trustImpact = Math.max(trustImpact, 7);
  if (type.includes('schema')) {
    seoImpact = Math.max(seoImpact, 5);
    aiVisibilityImpact = Math.max(aiVisibilityImpact, 6);
  }

  return { seoImpact, aiVisibilityImpact, trustImpact };
}

export function estimateEffort(
  _module: string,
  type: string,
  hasFixCode: boolean,
): 'low' | 'medium' | 'high' {
  if (hasFixCode) return 'low';

  const highEffortTypes = [
    'content', 'thin_content', 'missing_page', 'content_gap',
    'entity_coverage', 'topical_authority', 'contradiction',
  ];
  if (highEffortTypes.some((t) => type.includes(t))) return 'high';

  const lowEffortTypes = [
    'missing_title', 'missing_meta', 'missing_h1', 'missing_alt',
    'missing_canonical', 'noindex', 'schema_missing',
  ];
  if (lowEffortTypes.some((t) => type.includes(t))) return 'low';

  return 'medium';
}

export function estimateEffortHours(effort: 'low' | 'medium' | 'high'): number {
  if (effort === 'low') return 0.5;
  if (effort === 'medium') return 2;
  return 6;
}

export function computeExpectedImpact(
  severity: SEOIssueSeverity,
  impactScores: FixPlanImpactScores,
): 'high' | 'medium' | 'low' {
  const total = impactScores.seoImpact + impactScores.aiVisibilityImpact + impactScores.trustImpact;
  if (severity === 'critical' || total >= 18) return 'high';
  if (severity === 'warning' || total >= 10) return 'medium';
  return 'low';
}
