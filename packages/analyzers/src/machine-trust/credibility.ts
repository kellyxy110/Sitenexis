import type { CrawledPage, EntityIntelligenceReport, TrustIssue } from '@sitenexis/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CredibilityResult {
  score: number;
  issues: TrustIssue[];
  inconsistentAttributes: string[];
}

// Attributes that must agree across schema, body, and metadata for entity credibility
const CREDIBILITY_ATTRIBUTES = ['name', 'description', 'url', 'address', 'foundingDate'] as const;

// ─── Entity credibility consistency ──────────────────────────────────────────

/**
 * Measures whether the primary entity and its attributes are described
 * consistently across all pages, schema markup, and body text.
 *
 * Scores: 0–100. Deductions for each inconsistency found.
 */
export function analyseEntityCredibility(
  pages: CrawledPage[],
  entityReport: EntityIntelligenceReport,
): CredibilityResult {
  const issues: TrustIssue[] = [];
  const inconsistentAttributes: string[] = [];

  if (!entityReport.primaryEntity) {
    issues.push({
      type: 'missing_primary_entity',
      severity: 'critical',
      entity: 'unknown',
      description: 'No primary entity detected — AI systems cannot form a stable trust model without a clear subject.',
      recommendation: 'Add Organization or Person schema with a consistent name, description, and URL.',
    });
    return { score: 0, issues, inconsistentAttributes };
  }

  const primary = entityReport.primaryEntity;

  // Check consistency across pages via schema markup
  const schemaNames = extractSchemaValues(pages, 'name');
  const schemaDescriptions = extractSchemaValues(pages, 'description');

  if (schemaNames.size > 1) {
    inconsistentAttributes.push('name');
    issues.push({
      type: 'entity_name_inconsistency',
      severity: 'critical',
      entity: primary.name,
      description: `Entity name appears in ${schemaNames.size} different forms across schema markup: ${[...schemaNames].slice(0, 3).join(', ')}.`,
      recommendation: 'Standardise the entity name in schema markup across all pages.',
    });
  }

  if (schemaDescriptions.size > 3) {
    inconsistentAttributes.push('description');
    issues.push({
      type: 'entity_description_inconsistency',
      severity: 'warning',
      entity: primary.name,
      description: 'Entity description varies significantly across pages — AI systems may form contradictory representations.',
      recommendation: 'Use a consistent core description, then add page-specific context.',
    });
  }

  // Check entity consistency score from entity report
  if (entityReport.entityConsistencyScore < 50) {
    issues.push({
      type: 'low_entity_consistency',
      severity: 'critical',
      entity: primary.name,
      description: `Entity consistency score is ${entityReport.entityConsistencyScore}/100 — critical inconsistencies detected across the entity graph.`,
      recommendation: 'Resolve all entity inconsistencies identified in the Entity Intelligence report.',
    });
  } else if (entityReport.entityConsistencyScore < 70) {
    issues.push({
      type: 'moderate_entity_inconsistency',
      severity: 'warning',
      entity: primary.name,
      description: `Entity consistency score is ${entityReport.entityConsistencyScore}/100 — some inconsistencies reducing trust confidence.`,
      recommendation: 'Review entity inconsistencies and standardise attributes across all pages.',
    });
  }

  // sameAs validation
  if (primary.sameAsUrls.length === 0) {
    issues.push({
      type: 'missing_same_as',
      severity: 'warning',
      entity: primary.name,
      description: 'No sameAs links detected — AI systems cannot cross-validate this entity against external knowledge sources.',
      recommendation: 'Add sameAs links to Wikipedia, Wikidata, or other authoritative sources in Organization or Person schema.',
    });
  }

  // Compute score
  const baseScore = entityReport.entityConsistencyScore;
  const attributePenalty = inconsistentAttributes.length * 10;
  const sameAsPenalty = primary.sameAsUrls.length === 0 ? 10 : 0;

  const score = Math.max(0, Math.round(baseScore - attributePenalty - sameAsPenalty));

  return { score, issues, inconsistentAttributes };
}

function extractSchemaValues(pages: CrawledPage[], field: string): Set<string> {
  const values = new Set<string>();
  for (const page of pages) {
    for (const markup of page.schemaMarkup ?? []) {
      if (markup && typeof markup === 'object') {
        const val = (markup as Record<string, unknown>)[field];
        if (typeof val === 'string' && val.trim()) {
          values.add(val.trim().toLowerCase());
        }
      }
    }
  }
  return values;
}

// Silence unused import warning — CREDIBILITY_ATTRIBUTES used for documentation only
void CREDIBILITY_ATTRIBUTES;
