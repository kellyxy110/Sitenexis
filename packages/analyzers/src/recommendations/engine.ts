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
} from '@sitenexis/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Recommendation {
  id: string;
  dimension: 'technical_seo' | 'ai_visibility' | 'entity_coverage' | 'citation_readiness'
    | 'knowledge_graph' | 'trust_signals' | 'performance' | 'geo';
  severity: 'critical' | 'warning' | 'info';
  issue: string;
  impact: string;
  fix: string;
  estimatedImprovement: number;
  priority: number;
}

// ─── Generator functions per dimension ───────────────────────────────────────

function recommendTechnicalSeo(seo: SEOScore, schema: SchemaScore): Recommendation[] {
  const recs: Recommendation[] = [];

  const criticalCount = seo.issues.filter((i) => i.severity === 'critical').length;
  if (criticalCount > 0) {
    recs.push({
      id: 'seo-critical-issues',
      dimension: 'technical_seo',
      severity: 'critical',
      issue: `${criticalCount} critical SEO issue(s) detected including ${seo.issues.find((i) => i.severity === 'critical')?.type.replace(/_/g, ' ')}.`,
      impact: 'Critical SEO issues block AI crawlers and search engines from correctly indexing key pages, directly reducing AI retrieval probability.',
      fix: 'Resolve all critical issues in the SEO Issues report. Prioritise: missing titles, broken canonicals, broken internal links.',
      estimatedImprovement: Math.min(15, criticalCount * 5),
      priority: 1,
    });
  }

  if (schema.coverage < 0.5) {
    recs.push({
      id: 'schema-low-coverage',
      dimension: 'technical_seo',
      severity: 'warning',
      issue: `Schema markup present on only ${Math.round(schema.coverage * 100)}% of pages.`,
      impact: 'AI systems rely on structured data to extract entity information. Low schema coverage reduces entity confidence and citation eligibility.',
      fix: 'Add Organization, WebPage, and Article schema to all key pages. Use FAQ schema on pages with Q&A content.',
      estimatedImprovement: Math.round((1 - schema.coverage) * 10),
      priority: 2,
    });
  }

  return recs;
}

function recommendAIVisibility(
  aiReadability: AIReadabilityScore,
  machineReadability: MachineReadabilityScore,
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (machineReadability.breakdown.boilerplateRatio < 60) {
    recs.push({
      id: 'high-boilerplate',
      dimension: 'ai_visibility',
      severity: 'warning',
      issue: 'High boilerplate ratio — navigation, footers, and banners consume a significant portion of crawled text.',
      impact: 'AI systems extract semantic chunks from body text. Excessive boilerplate dilutes chunk quality and reduces extraction fidelity.',
      fix: 'Reduce navigation copy. Move footer/header content to aside elements with aria-hidden. Ensure main content represents ≥60% of page text.',
      estimatedImprovement: 8,
      priority: 3,
    });
  }

  if (aiReadability.breakdown.entityClarity < 60) {
    recs.push({
      id: 'low-entity-clarity',
      dimension: 'ai_visibility',
      severity: 'warning',
      issue: 'Entity clarity score is below threshold — named entities are not explicitly defined in context.',
      impact: 'When AI systems cannot anchor content to a clear entity, it is treated as generic text with low retrieval priority.',
      fix: 'Add explicit entity definitions in the first paragraph of key pages. Use schema markup to anchor entity names and descriptions.',
      estimatedImprovement: 10,
      priority: 2,
    });
  }

  if (aiReadability.breakdown.conversationalReadiness < 50) {
    recs.push({
      id: 'low-conversational-readiness',
      dimension: 'ai_visibility',
      severity: 'warning',
      issue: 'Content is not structured to answer natural language queries directly.',
      impact: 'Chat-based AI systems prioritise content that directly answers conversational queries. Low conversational readiness reduces inclusion in AI-generated responses.',
      fix: 'Add FAQ sections addressing common user questions. Structure H2/H3 headings as questions. Write direct, concise answers in the opening sentences.',
      estimatedImprovement: 12,
      priority: 2,
    });
  }

  return recs;
}

function recommendEntityCoverage(entity: EntityIntelligenceReport): Recommendation[] {
  const recs: Recommendation[] = [];

  if (!entity.primaryEntity) {
    recs.push({
      id: 'no-primary-entity',
      dimension: 'entity_coverage',
      severity: 'critical',
      issue: 'No primary entity detected. AI systems cannot form a stable knowledge representation without a clearly defined subject.',
      impact: 'Without a primary entity, this site cannot be reliably cited, recommended, or referenced by AI systems. This is the single highest-impact gap.',
      fix: 'Add Organization schema on every page with a consistent name, description, and URL. Link to the About page. Add sameAs links to Wikipedia/LinkedIn/Wikidata.',
      estimatedImprovement: 20,
      priority: 1,
    });
  } else if (entity.entityConsistencyScore < 70) {
    recs.push({
      id: 'entity-inconsistency',
      dimension: 'entity_coverage',
      severity: 'warning',
      issue: `Entity consistency score is ${entity.entityConsistencyScore}/100 — the primary entity "${entity.primaryEntity.name}" is described inconsistently across pages.`,
      impact: 'Inconsistent entity signals cause AI systems to form contradictory representations, reducing trust and citation probability.',
      fix: 'Audit all pages for consistent entity name, description, and category. Ensure schema markup matches body text on every page.',
      estimatedImprovement: 10,
      priority: 2,
    });
  }

  if (entity.primaryEntity && entity.primaryEntity.sameAsUrls.length < 2) {
    recs.push({
      id: 'insufficient-same-as',
      dimension: 'entity_coverage',
      severity: 'warning',
      issue: 'Primary entity has fewer than 2 sameAs links — limited external validation for AI knowledge graph integration.',
      impact: 'AI systems with access to external knowledge bases (Google, Bing) use sameAs links to validate entity claims. Low sameAs count reduces entity confidence.',
      fix: 'Add sameAs links in Organization schema pointing to: Wikipedia, Wikidata, LinkedIn company page, Crunchbase profile (if applicable).',
      estimatedImprovement: 8,
      priority: 3,
    });
  }

  return recs;
}

function recommendCitationReadiness(citation: CitationAnalysis): Recommendation[] {
  const recs: Recommendation[] = [];

  if (citation.citationProbabilityScore < 50) {
    recs.push({
      id: 'low-citation-probability',
      dimension: 'citation_readiness',
      severity: citation.citationProbabilityScore < 30 ? 'critical' : 'warning',
      issue: `Citation probability score is ${citation.citationProbabilityScore}/100 — content is unlikely to be selected as an AI citation source.`,
      impact: 'AI systems that generate responses with citations preferentially select content with high factual density, claim specificity, and entity authority. Low citation probability means near-zero inclusion in AI-generated answers.',
      fix: 'Increase factual density: add statistics, dates, and verifiable claims. Add author schema. Structure content with clear factual statements that can stand independently.',
      estimatedImprovement: 15,
      priority: 1,
    });
  }

  if (citation.citationBlockers.length > 0) {
    recs.push({
      id: 'citation-blockers',
      dimension: 'citation_readiness',
      severity: 'warning',
      issue: `${citation.citationBlockers.length} citation blocker(s) identified: ${citation.citationBlockers.slice(0, 2).join('; ')}.`,
      impact: 'Citation blockers directly prevent content from being selected as a source even when retrieved.',
      fix: 'Address each citation blocker in priority order. Focus on: factual claim specificity, authorship attribution, topical depth.',
      estimatedImprovement: 8,
      priority: 2,
    });
  }

  return recs;
}

function recommendTrustSignals(trust: SemanticTrustScore): Recommendation[] {
  const recs: Recommendation[] = [];

  if (trust.breakdown.authorshipTrust < 50) {
    recs.push({
      id: 'low-authorship-trust',
      dimension: 'trust_signals',
      severity: 'warning',
      issue: 'Authorship trust signals are weak — AI systems cannot verify who created this content.',
      impact: 'AI systems apply lower trust weights to content without verifiable authorship, reducing citation eligibility and recommendation confidence.',
      fix: 'Add author schema (Person) to all blog posts and articles. Include author bios with LinkedIn sameAs links. Add bylines to key pages.',
      estimatedImprovement: 8,
      priority: 3,
    });
  }

  if (trust.breakdown.organisationalTrust < 60) {
    recs.push({
      id: 'low-org-trust',
      dimension: 'trust_signals',
      severity: 'warning',
      issue: 'Organisational trust signals are insufficient — no About page, contact information, or privacy policy detected.',
      impact: 'AI systems that model source credibility require clear organisational identity signals. Missing trust signals reduce semantic trust score and AI recommendation confidence.',
      fix: 'Add a comprehensive About page with company history, team, and mission. Ensure Contact page is linked from navigation. Add Privacy Policy and Terms pages.',
      estimatedImprovement: 10,
      priority: 2,
    });
  }

  for (const missing of trust.trustSignalsMissing.slice(0, 3)) {
    recs.push({
      id: `missing-trust-${missing.replace(/\s+/g, '-').toLowerCase()}`,
      dimension: 'trust_signals',
      severity: 'info',
      issue: `Missing trust signal: ${missing}.`,
      impact: 'Each trust signal adds evidence for AI systems that this source is credible and citable.',
      fix: `Add ${missing} to the site.`,
      estimatedImprovement: 2,
      priority: 4,
    });
  }

  return recs;
}

function recommendPerformance(performance: PerformanceScore): Recommendation[] {
  const recs: Recommendation[] = [];

  if (performance.score < 60) {
    recs.push({
      id: 'low-performance',
      dimension: 'performance',
      severity: 'warning',
      issue: `Performance score is ${performance.score}/100. ${performance.lighthouseScore !== null ? `Lighthouse: ${performance.lighthouseScore}/100.` : ''}`,
      impact: 'Poor performance slows AI crawler rendering, increases the risk of partial content extraction, and reduces page authority in search engines.',
      fix: 'Optimise Core Web Vitals: reduce LCP with image optimisation and critical CSS. Improve CLS by specifying image dimensions. Use caching headers.',
      estimatedImprovement: 5,
      priority: 3,
    });
  }

  return recs;
}

// ─── Main engine ──────────────────────────────────────────────────────────────

/**
 * Generates prioritised recommendations across all audit dimensions.
 *
 * Every recommendation includes:
 * - issue: what was detected
 * - impact: why it matters for AI visibility
 * - fix: specific actionable steps
 * - estimatedImprovement: expected health score gain (points)
 */
export function generateRecommendations(inputs: {
  seo: SEOScore;
  aiReadability: AIReadabilityScore;
  machineReadability: MachineReadabilityScore;
  entity: EntityIntelligenceReport;
  citation: CitationAnalysis;
  trust: SemanticTrustScore;
  schema: SchemaScore;
  linkGraph: LinkGraphScore;
  performance: PerformanceScore;
}): Recommendation[] {
  const all: Recommendation[] = [
    ...recommendTechnicalSeo(inputs.seo, inputs.schema),
    ...recommendAIVisibility(inputs.aiReadability, inputs.machineReadability),
    ...recommendEntityCoverage(inputs.entity),
    ...recommendCitationReadiness(inputs.citation),
    ...recommendTrustSignals(inputs.trust),
    ...recommendPerformance(inputs.performance),
  ];

  // Sort: critical first, then by estimated improvement descending
  return all.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return b.estimatedImprovement - a.estimatedImprovement;
  });
}
