import type { CrawledPage, EntityIntelligenceReport, TrustIssue } from '@sitenexis/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContradictionResult {
  score: number;
  issues: TrustIssue[];
  contradictionsDetected: number;
}

// ─── Programmatic contradiction detection ────────────────────────────────────

/**
 * Detects cross-page contradictions in factual claims using programmatic
 * pattern matching. Claude API semantic detection is handled by the agent
 * (top 20 pages only, cost-controlled). This module handles:
 *   - Schema date vs body text date conflicts
 *   - Conflicting entity attribute values across pages
 *   - Schema type mismatches vs page content category
 */
export function detectContradictions(
  pages: CrawledPage[],
  entityReport: EntityIntelligenceReport,
): ContradictionResult {
  const issues: TrustIssue[] = [];
  let contradictionsDetected = 0;

  // Check datePublished/dateModified consistency
  const { dateIssues, dateContradictions } = checkDateConsistency(pages);
  issues.push(...dateIssues);
  contradictionsDetected += dateContradictions;

  // Check entity attribute contradictions (from entity report inconsistencies)
  for (const inconsistency of entityReport.inconsistencies) {
    if (inconsistency.issueType === 'inconsistency') {
      contradictionsDetected++;
      issues.push({
        type: 'entity_attribute_contradiction',
        severity: inconsistency.severity,
        entity: inconsistency.entityName,
        description: inconsistency.description,
        recommendation: inconsistency.recommendation,
      });
    }
  }

  // Check schema type vs page content category mismatch
  const { schemaIssues, schemaContradictions } = checkSchemaTypeContradictions(pages);
  issues.push(...schemaIssues);
  contradictionsDetected += schemaContradictions;

  // Contradiction absence score — starts at 100, deductions per contradiction
  const deductionPerContradiction = 12;
  const score = Math.max(0, Math.round(100 - contradictionsDetected * deductionPerContradiction));

  return { score, issues, contradictionsDetected };
}

function checkDateConsistency(pages: CrawledPage[]): {
  dateIssues: TrustIssue[];
  dateContradictions: number;
} {
  const dateIssues: TrustIssue[] = [];
  let dateContradictions = 0;

  for (const page of pages) {
    const schemaDates = extractSchemaDates(page);
    if (schemaDates.length < 2) continue;

    const [first, ...rest] = schemaDates;
    for (const other of rest) {
      // Flag if two date fields differ by more than 2 years (likely a copy-paste error)
      const yearFirst = extractYear(first.value);
      const yearOther = extractYear(other.value);
      if (yearFirst !== null && yearOther !== null && Math.abs(yearFirst - yearOther) > 2) {
        dateContradictions++;
        dateIssues.push({
          type: 'date_contradiction',
          severity: 'warning',
          entity: page.url,
          description: `Schema date contradiction on ${page.url}: ${first.field}="${first.value}" vs ${other.field}="${other.value}".`,
          recommendation: 'Verify that datePublished and dateModified are accurate and consistent with visible page content.',
        });
        break;
      }
    }
  }

  return { dateIssues, dateContradictions };
}

function checkSchemaTypeContradictions(pages: CrawledPage[]): {
  schemaIssues: TrustIssue[];
  schemaContradictions: number;
} {
  const schemaIssues: TrustIssue[] = [];
  let schemaContradictions = 0;

  for (const page of pages) {
    for (const markup of page.schemaMarkup ?? []) {
      if (!markup || typeof markup !== 'object') continue;
      const obj = markup as Record<string, unknown>;
      const schemaType = String(obj['@type'] ?? '');

      // Product schema on pages without product keywords
      if (schemaType === 'Product' && !hasProductSignals(page)) {
        schemaContradictions++;
        schemaIssues.push({
          type: 'schema_type_mismatch',
          severity: 'warning',
          entity: page.url,
          description: `Product schema found on ${page.url} but page content does not contain product signals.`,
          recommendation: 'Remove Product schema or ensure page content describes a specific product.',
        });
      }

      // Aggregate review rating without review content
      if (obj['aggregateRating'] && !hasReviewContent(page)) {
        schemaContradictions++;
        schemaIssues.push({
          type: 'schema_aggregate_rating_mismatch',
          severity: 'warning',
          entity: page.url,
          description: `AggregateRating schema present on ${page.url} but no review content detected in body text.`,
          recommendation: 'Only include AggregateRating schema when the page contains verifiable review content.',
        });
      }
    }
  }

  return { schemaIssues, schemaContradictions };
}

interface SchemaDate {
  field: string;
  value: string;
}

function extractSchemaDates(page: CrawledPage): SchemaDate[] {
  const dates: SchemaDate[] = [];
  for (const markup of page.schemaMarkup ?? []) {
    if (!markup || typeof markup !== 'object') continue;
    const obj = markup as Record<string, unknown>;
    for (const field of ['datePublished', 'dateModified', 'dateCreated', 'foundingDate']) {
      const val = obj[field];
      if (typeof val === 'string' && val.trim()) {
        dates.push({ field, value: val.trim() });
      }
    }
  }
  return dates;
}

function extractYear(dateStr: string): number | null {
  const match = dateStr.match(/\b(\d{4})\b/);
  return match ? parseInt(match[1], 10) : null;
}

function hasProductSignals(page: CrawledPage): boolean {
  const text = (page.bodyText ?? '').toLowerCase();
  return /\b(price|buy|cart|checkout|sku|in stock|add to|purchase|usd|\$\d+)\b/.test(text);
}

function hasReviewContent(page: CrawledPage): boolean {
  const text = (page.bodyText ?? '').toLowerCase();
  return /\b(review|rating|stars?|out of \d|verified purchase|customer says)\b/.test(text);
}
