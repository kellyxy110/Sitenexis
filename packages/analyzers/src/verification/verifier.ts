import type {
  CrawledPage,
  Entity,
  EvidenceReference,
  SEOIssue,
  SEOIssueSeverity,
  SEOIssueType,
  SchemaIssue,
  VerifiedFinding,
} from '@sitenexis/shared';
import {
  computeConfidence,
  computeExtractionConsistency,
  computeSourceReliability,
  DETERMINISTIC_CONFIDENCE,
} from './confidence';
import {
  bodyTextEvidence,
  canonicalEvidence,
  countEvidenceSources,
  crossValidateSchemaToDom,
  h1Evidence,
  headingEvidence,
  imageAltEvidence,
  metaDescriptionEvidence,
  redirectChainEvidence,
  robotsEvidence,
  schemaTypeEvidence,
  schemaValueEvidence,
  titleEvidence,
  wordCountEvidence,
} from './dom-evidence';

// ── Severity adjustment ───────────────────────────────────────────────────────

/**
 * Adjusts the reported severity of a finding based on its confidence.
 *
 *   VERIFIED  (≥ 0.90) → keep original severity
 *   PROBABLE  (0.70–0.89) → keep original severity
 *   WEAK      (0.50–0.69) → critical → warning; warning → info
 *   SUPPRESSED (< 0.50)  → suppress entirely
 */
export function adjustedSeverity(
  original: SEOIssueSeverity,
  confidenceValue: number,
): SEOIssueSeverity | 'suppressed' {
  if (confidenceValue < 0.5) return 'suppressed';
  if (confidenceValue < 0.7) {
    if (original === 'critical') return 'warning';
    if (original === 'warning') return 'info';
  }
  return original;
}

// ── Deterministic SEO issue types ─────────────────────────────────────────────
// These are directly observable from the CrawledPage snapshot.
// Confidence is always 1.0 when the value is extracted directly.

const DETERMINISTIC_TYPES = new Set<SEOIssueType>([
  'missing_title',
  'duplicate_title',
  'title_too_long',
  'title_too_short',
  'missing_meta_description',
  'duplicate_meta_description',
  'meta_description_too_long',
  'missing_h1',
  'multiple_h1',
  'missing_canonical',
  'broken_canonical',
  'noindex_page',
  'missing_alt_text',
  'broken_internal_link',
  'redirect_chain',
  'low_word_count',
  'missing_robots_txt',
  'missing_sitemap',
]);

// ── SEO issue verification ────────────────────────────────────────────────────

export function verifySEOIssue(
  issue: SEOIssue,
  page: CrawledPage,
  findingId: string,
): VerifiedFinding {
  const isDeterministic = DETERMINISTIC_TYPES.has(issue.type);
  const evidence = buildSEOEvidence(issue, page);
  const confidence = isDeterministic
    ? DETERMINISTIC_CONFIDENCE
    : computeConfidence({
        evidenceCompleteness: evidence.length > 0 ? 0.8 : 0.2,
        sourceReliability: 0.7,
        extractionConsistency: 0.7,
      });

  return {
    findingId,
    sourceAnalyzer: 'seo',
    issueType: issue.type,
    category: 'seo',
    description: issue.message,
    recommendation: issue.recommendation,
    severity: issue.severity,
    adjustedSeverity: adjustedSeverity(issue.severity, confidence.value),
    confidence,
    evidence,
    pageUrl: issue.url,
    originalFinding: issue,
  };
}

function buildSEOEvidence(
  issue: SEOIssue,
  page: CrawledPage,
): EvidenceReference[] {
  const refs: EvidenceReference[] = [];

  switch (issue.type) {
    case 'missing_title':
    case 'duplicate_title':
    case 'title_too_long':
    case 'title_too_short':
      refs.push(titleEvidence(page));
      break;

    case 'missing_meta_description':
    case 'duplicate_meta_description':
    case 'meta_description_too_long':
      refs.push(metaDescriptionEvidence(page));
      break;

    case 'missing_h1':
    case 'multiple_h1':
      refs.push(h1Evidence(page));
      break;

    case 'missing_canonical':
    case 'broken_canonical':
      refs.push(canonicalEvidence(page));
      break;

    case 'noindex_page':
      refs.push(robotsEvidence(page));
      break;

    case 'missing_alt_text':
      refs.push(...imageAltEvidence(page));
      break;

    case 'redirect_chain':
      refs.push(redirectChainEvidence(page));
      break;

    case 'low_word_count':
      refs.push(wordCountEvidence(page));
      break;
  }

  return refs;
}

// ── Schema issue verification ─────────────────────────────────────────────────

export function verifySchemaIssue(
  issue: SchemaIssue,
  page: CrawledPage,
  findingId: string,
): VerifiedFinding {
  const evidence: EvidenceReference[] = [];

  // Attempt to find the schema type in the page
  const schemaRef = schemaTypeEvidence(page, issue.schemaType);
  if (schemaRef) evidence.push(schemaRef);

  // Cross-validate schema name against DOM title if it's an Organization schema
  let conflictDetected = false;
  if (issue.schemaType === 'Organization' || issue.schemaType === 'LocalBusiness') {
    const crossCheck = crossValidateSchemaToDom(page, issue.schemaType, 'name');
    if (crossCheck) {
      conflictDetected = !crossCheck.agrees;
      evidence.push({
        sourceType: schemaRef ? 'schema_jsonld' : 'dom_element',
        pageUrl: page.url,
        cssSelector: 'head > title',
        exactValue: `Schema name: "${crossCheck.schemaValue}" vs DOM title: "${crossCheck.domValue}"`,
        observedAt: page.crawledAt,
      });
    }
  }

  const hasSchemaEvidence = evidence.some((e) => e.sourceType === 'schema_jsonld');
  const hasDomEvidence = evidence.some((e) => e.sourceType === 'dom_element');

  const confidence = computeConfidence({
    // If we found the schema type in the DOM, evidence is complete
    evidenceCompleteness: schemaRef ? 1.0 : 0.3,
    sourceReliability: computeSourceReliability(hasDomEvidence, hasSchemaEvidence, false),
    extractionConsistency: computeExtractionConsistency(evidence.length, conflictDetected),
  });

  return {
    findingId,
    sourceAnalyzer: 'schema',
    issueType: `schema_${issue.schemaType}`,
    category: 'schema',
    description: issue.message,
    recommendation: issue.recommendation,
    severity: issue.severity,
    adjustedSeverity: adjustedSeverity(issue.severity, confidence.value),
    confidence,
    evidence,
    pageUrl: issue.url,
    originalFinding: issue,
  };
}

// ── Entity verification ───────────────────────────────────────────────────────

/**
 * Verifies an entity finding against DOM evidence across the provided page sample.
 * An entity must be traceable to at least one of: body text, heading, schema markup, or anchor text.
 */
export function verifyEntity(
  entity: Entity,
  pages: CrawledPage[],
  findingId: string,
): VerifiedFinding {
  const evidence: EvidenceReference[] = [];

  // Limit the page sample for performance — top 20 pages
  const samplePages = pages.slice(0, 20);

  for (const page of samplePages) {
    const bodyRef = bodyTextEvidence(page, entity.name);
    if (bodyRef) evidence.push(bodyRef);

    const headingRef = headingEvidence(page, entity.name);
    if (headingRef) evidence.push(headingRef);

    const schemaRef = schemaValueEvidence(page, entity.name);
    if (schemaRef) evidence.push(schemaRef);
  }

  // Deduplicate by sourceType + pageUrl
  const seen = new Set<string>();
  const deduped = evidence.filter((e) => {
    const key = `${e.sourceType}:${e.pageUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const { inBodyText, inHeadings, inSchema, conflictDetected } =
    countEvidenceSources(entity.name, samplePages);

  const hasDomEvidence = inBodyText > 0 || inHeadings > 0;
  const hasSchemaEvidence = inSchema > 0;
  const sourceCount = (hasDomEvidence ? 1 : 0) + (hasSchemaEvidence ? 1 : 0);

  // Evidence completeness: how much of the page sample contains the entity
  const mentionDensity = Math.min(
    1,
    (inBodyText + inHeadings + inSchema) / Math.max(1, samplePages.length * 0.3),
  );

  const confidence = computeConfidence({
    evidenceCompleteness: deduped.length > 0 ? Math.max(0.4, mentionDensity) : 0.1,
    sourceReliability: computeSourceReliability(hasDomEvidence, hasSchemaEvidence, false),
    extractionConsistency: computeExtractionConsistency(sourceCount, conflictDetected),
  });

  // Entities with no DOM evidence at all are weak signals — they came from LLM extraction
  // with no observable anchor. We still report them but flag the LLM source.
  if (deduped.length === 0) {
    deduped.push({
      sourceType: 'llm_interpretation',
      pageUrl: pages[0]?.url ?? '',
      exactValue: entity.name,
      observedAt: pages[0]?.crawledAt ?? new Date(),
    });
  }

  const severity: SEOIssueSeverity =
    confidence.value < 0.7 ? 'warning' : 'info';

  return {
    findingId,
    sourceAnalyzer: 'entity',
    issueType: 'entity_grounding',
    category: 'entity',
    description: `Entity "${entity.name}" (${entity.type}) — ${entity.mentionCount} mentions across site`,
    recommendation:
      inSchema === 0
        ? `Add "${entity.name}" to JSON-LD schema markup to strengthen machine trust signals.`
        : inBodyText === 0
        ? `Reference "${entity.name}" explicitly in body text — schema-only entities have lower AI trust.`
        : `Entity is well-grounded. Add sameAs links to improve disambiguation confidence.`,
    severity,
    adjustedSeverity: adjustedSeverity(severity, confidence.value),
    confidence,
    evidence: deduped.slice(0, 6),
    pageUrl: null,
    originalFinding: entity,
  };
}
