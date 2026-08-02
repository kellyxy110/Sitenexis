import {
  createConfidenceSummary,
  type EvidenceProjection,
  type EvidenceProjectionConfidence,
  type EvidenceValue,
} from './intelligence-report-v2';

export const EXTRACTION_AVAILABILITY = ['AVAILABLE', 'FAILED', 'NOT_ATTEMPTED'] as const;
export type ExtractionAvailability = (typeof EXTRACTION_AVAILABILITY)[number];

export const RAW_RENDERED_RELATIONSHIPS = [
  'MATCH',
  'RAW_ONLY',
  'RENDERED_ONLY',
  'DIFFERENT',
  'BOTH_MISSING',
  'NOT_COMPARABLE',
] as const;
export type RawRenderedRelationship = (typeof RAW_RENDERED_RELATIONSHIPS)[number];

export const RAW_RENDERED_FIELDS = [
  'title',
  'metaDescription',
  'canonicalUrl',
  'h1',
  'h2',
  'bodyTextLength',
  'contentHash',
  'schemaTypes',
  'robotsDirectives',
  'openGraph',
] as const;
export type RawRenderedComparableField = (typeof RAW_RENDERED_FIELDS)[number];

/** Structural subset shared by current static and rendered CrawledPage outputs. */
export interface RawRenderedPageEvidence {
  url?: string | null | undefined;
  requestedUrl?: string | null | undefined;
  finalUrl?: string | null | undefined;
  statusCode?: number | null | undefined;
  title?: string | null | undefined;
  metaDescription?: string | null | undefined;
  canonicalUrl?: string | null | undefined;
  h1?: string | null | undefined;
  headings?: ReadonlyArray<{ level: number; text: string }> | undefined;
  bodyText?: string | null | undefined;
  contentHash?: string | null | undefined;
  schemaTypes?: readonly string[] | undefined;
  robotsDirectives?: readonly string[] | undefined;
  openGraph?: Record<string, string | undefined> | undefined;
}

/**
 * Availability is supplied independently from field values. A failed or
 * unattempted rendered extraction can therefore never be mistaken for an empty
 * rendered document.
 */
export interface ExtractionEvidenceSnapshot {
  availability: ExtractionAvailability;
  page?: RawRenderedPageEvidence | null | undefined;
  extractionMethod?: string | null | undefined;
  extractionConfidence?: number | null | undefined;
  sourceUrl?: string | null | undefined;
  observedAt?: Date | string | null | undefined;
  moduleId?: string | null | undefined;
  moduleVersion?: string | null | undefined;
  extractorVersion?: string | null | undefined;
}

export interface RawRenderedEvidenceReference {
  sourceLayer: 'RAW_HTML' | 'RENDERED_DOM';
  sourceUrl?: string | undefined;
  observedAt?: string | undefined;
  extractionMethod?: string | undefined;
}

export interface RawRenderedEvidenceComparison {
  url?: string | undefined;
  field: RawRenderedComparableField;
  rawAvailability: ExtractionAvailability;
  renderedAvailability: ExtractionAvailability;
  rawValue?: EvidenceValue | null | undefined;
  renderedValue?: EvidenceValue | null | undefined;
  relationship: RawRenderedRelationship;
  confidence: EvidenceProjectionConfidence;
  evidenceReferences: RawRenderedEvidenceReference[];
  metadata?: Record<string, EvidenceValue> | undefined;
}

export interface RawRenderedProjectionContext {
  auditId: string;
  domain?: string | undefined;
}

/** Projects direct static extraction observations only when raw extraction succeeded. */
export function projectRawExtractionEvidence(
  raw: ExtractionEvidenceSnapshot,
  context: RawRenderedProjectionContext,
): EvidenceProjection[] {
  return projectExtractionEvidence(raw, context, 'RAW_HTML', 'raw');
}

/** Projects direct rendered-DOM observations only when rendered extraction succeeded. */
export function projectRenderedExtractionEvidence(
  rendered: ExtractionEvidenceSnapshot,
  context: RawRenderedProjectionContext,
): EvidenceProjection[] {
  return projectExtractionEvidence(rendered, context, 'RENDERED_DOM', 'rendered');
}

/**
 * Compares known fields only. Not attempted and failed snapshots produce
 * NOT_COMPARABLE, never a false missing-value relationship.
 */
export function compareRawAndRenderedEvidence(
  raw: ExtractionEvidenceSnapshot,
  rendered: ExtractionEvidenceSnapshot,
): RawRenderedEvidenceComparison[] {
  return RAW_RENDERED_FIELDS.map((field) => compareField(field, raw, rendered));
}

/**
 * Projects a discrepancy as evidence-level inference. MATCH, BOTH_MISSING, and
 * NOT_COMPARABLE remain comparisons only; this function never emits a finding.
 */
export function projectRawRenderedComparison(
  comparison: RawRenderedEvidenceComparison,
  context: RawRenderedProjectionContext,
): EvidenceProjection | undefined {
  if (!['RAW_ONLY', 'RENDERED_ONLY', 'DIFFERENT'].includes(comparison.relationship)) return undefined;
  const domain = resolveDomain(context.domain, comparison.url);
  if (!domain) return undefined;

  return {
    id: `raw-rendered:${context.auditId}:${comparison.url ?? comparison.field}:${comparison.field}`,
    auditId: context.auditId,
    domain,
    scope: 'PAGE',
    category: 'extraction-comparison',
    title: comparisonTitle(comparison),
    description: comparisonDescription(comparison),
    confidence: comparison.confidence,
    verificationState: 'INFERRED',
    observationType: 'INFERENCE',
    url: comparison.url,
    rawValue: comparison.rawValue,
    normalizedValue: comparison.renderedValue,
    provenanceMetadata: {
      transformation: `raw-rendered:${comparison.relationship.toLowerCase()}`,
      details: {
        field: comparison.field,
        rawAvailability: comparison.rawAvailability,
        renderedAvailability: comparison.renderedAvailability,
      },
    },
  };
}

function projectExtractionEvidence(
  snapshot: ExtractionEvidenceSnapshot,
  context: RawRenderedProjectionContext,
  sourceLayer: 'RAW_HTML' | 'RENDERED_DOM',
  prefix: 'raw' | 'rendered',
): EvidenceProjection[] {
  if (snapshot.availability !== 'AVAILABLE' || !snapshot.page) return [];
  const url = pageUrl(snapshot);
  const domain = resolveDomain(context.domain, url);
  if (!domain) return [];
  const confidence = extractionConfidence(snapshot.extractionConfidence);
  const common = {
    auditId: context.auditId,
    domain,
    scope: 'PAGE' as const,
    confidence,
    verificationState: 'CONFIRMED' as const,
    sourceLayer,
    observationType: 'OBSERVATION' as const,
    url,
    canonicalUrl: knownValue(snapshot.page, 'canonicalUrl').value as string | null | undefined,
    extractionMethod: present(snapshot.extractionMethod),
    moduleId: present(snapshot.moduleId),
    moduleVersion: present(snapshot.moduleVersion),
    extractorVersion: present(snapshot.extractorVersion),
    sourceUrl: present(snapshot.sourceUrl) ?? url,
    detectedAt: timestamp(snapshot.observedAt),
    provenanceMetadata: provenance(snapshot),
  };

  const projections: EvidenceProjection[] = [];
  for (const field of RAW_RENDERED_FIELDS) {
    const value = comparableValue(field, snapshot.page);
    if (!value.known) continue;
    projections.push({
      ...common,
      id: `${prefix}:${context.auditId}:${url ?? field}:${field}`,
      category: categoryFor(field),
      title: `${labelFor(field)} from ${sourceLayer === 'RAW_HTML' ? 'raw HTML' : 'rendered DOM'}`,
      description: `Directly observed ${labelFor(field).toLowerCase()} from ${sourceLayer === 'RAW_HTML' ? 'the static response' : 'the rendered document'}.`,
      issueCode: field,
      rawValue: value.value,
    });
  }
  return projections;
}

function compareField(
  field: RawRenderedComparableField,
  raw: ExtractionEvidenceSnapshot,
  rendered: ExtractionEvidenceSnapshot,
): RawRenderedEvidenceComparison {
  const url = pageUrl(raw) ?? pageUrl(rendered);
  const references = [...reference(raw, 'RAW_HTML'), ...reference(rendered, 'RENDERED_DOM')];
  if (raw.availability !== 'AVAILABLE' || rendered.availability !== 'AVAILABLE' || !raw.page || !rendered.page) {
    return {
      url,
      field,
      rawAvailability: raw.availability,
      renderedAvailability: rendered.availability,
      relationship: 'NOT_COMPARABLE',
      confidence: createConfidenceSummary({ reasons: ['Both extraction snapshots are required for comparison.'] }),
      evidenceReferences: references,
    };
  }

  const rawValue = comparableValue(field, raw.page);
  const renderedValue = comparableValue(field, rendered.page);
  if (!rawValue.known || !renderedValue.known) {
    return {
      url,
      field,
      rawAvailability: raw.availability,
      renderedAvailability: rendered.availability,
      rawValue: rawValue.value,
      renderedValue: renderedValue.value,
      relationship: 'NOT_COMPARABLE',
      confidence: createConfidenceSummary({ reasons: ['At least one available extraction does not expose this field.'] }),
      evidenceReferences: references,
    };
  }

  const relationship = relationshipFor(rawValue.value, renderedValue.value, field);
  return {
    url,
    field,
    rawAvailability: raw.availability,
    renderedAvailability: rendered.availability,
    rawValue: rawValue.value,
    renderedValue: renderedValue.value,
    relationship,
    confidence: comparisonConfidence(raw.extractionConfidence, rendered.extractionConfidence),
    evidenceReferences: references,
    metadata: relationship === 'DIFFERENT' && field === 'bodyTextLength'
      ? { rawLength: rawValue.value ?? null, renderedLength: renderedValue.value ?? null }
      : undefined,
  };
}

function comparableValue(
  field: RawRenderedComparableField,
  page: RawRenderedPageEvidence,
): { known: boolean; value?: EvidenceValue | null | undefined } {
  switch (field) {
    case 'h2': {
      if (!hasOwn(page, 'headings')) return { known: false };
      return { known: true, value: (page.headings ?? []).filter((heading) => heading.level === 2).map((heading) => heading.text) };
    }
    case 'bodyTextLength': {
      if (!hasOwn(page, 'bodyText')) return { known: false };
      return { known: true, value: page.bodyText?.length ?? null };
    }
    case 'schemaTypes':
    case 'robotsDirectives': {
      if (!hasOwn(page, field)) return { known: false };
      return { known: true, value: page[field] ? [...page[field]!] : [] };
    }
    case 'openGraph': {
      if (!hasOwn(page, 'openGraph')) return { known: false };
      return { known: true, value: page.openGraph ? compactObject(page.openGraph) : null };
    }
    default:
      return knownValue(page, field);
  }
}

function knownValue(
  page: RawRenderedPageEvidence,
  field: 'title' | 'metaDescription' | 'canonicalUrl' | 'h1' | 'contentHash',
): { known: boolean; value?: EvidenceValue | null | undefined } {
  if (!hasOwn(page, field)) return { known: false };
  return { known: true, value: page[field] ?? null };
}

function relationshipFor(
  rawValue: EvidenceValue | null | undefined,
  renderedValue: EvidenceValue | null | undefined,
  field: RawRenderedComparableField,
): RawRenderedRelationship {
  const rawMissing = missing(rawValue);
  const renderedMissing = missing(renderedValue);
  if (rawMissing && renderedMissing) return 'BOTH_MISSING';
  if (rawMissing) return 'RENDERED_ONLY';
  if (renderedMissing) return 'RAW_ONLY';
  return normalized(field, rawValue) === normalized(field, renderedValue) ? 'MATCH' : 'DIFFERENT';
}

function normalized(field: RawRenderedComparableField, value: EvidenceValue | null | undefined): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim().replace(/\s+/g, ' ').toLowerCase()).sort().join('\u0000');
  }
  if (field === 'openGraph' && value && typeof value === 'object') {
    return JSON.stringify(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
  }
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

function missing(value: EvidenceValue | null | undefined): boolean {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

function comparisonConfidence(
  raw: number | null | undefined,
  rendered: number | null | undefined,
): EvidenceProjectionConfidence {
  const rawScore = confidenceScore(raw);
  const renderedScore = confidenceScore(rendered);
  if (rawScore === undefined || renderedScore === undefined) {
    return createConfidenceSummary({ reasons: ['One or both extraction confidence values are unavailable.'] });
  }
  // Compatibility translation only. This is not the v2 confidence formula.
  return createConfidenceSummary({ score: Math.min(rawScore, renderedScore), reasons: ['Bounded by the lower legacy extraction confidence.'] });
}

function extractionConfidence(value: number | null | undefined): EvidenceProjectionConfidence {
  const score = confidenceScore(value);
  return score === undefined
    ? createConfidenceSummary({ reasons: ['Extraction confidence is unavailable.'] })
    : createConfidenceSummary({ score, reasons: ['Translated from extraction confidence.'] });
}

function confidenceScore(value: number | null | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value > 1 ? value / 100 : value;
}

function reference(snapshot: ExtractionEvidenceSnapshot, sourceLayer: 'RAW_HTML' | 'RENDERED_DOM'): RawRenderedEvidenceReference[] {
  if (snapshot.availability !== 'AVAILABLE') return [];
  return [{
    sourceLayer,
    sourceUrl: present(snapshot.sourceUrl) ?? pageUrl(snapshot),
    observedAt: timestamp(snapshot.observedAt),
    extractionMethod: present(snapshot.extractionMethod),
  }];
}

function provenance(snapshot: ExtractionEvidenceSnapshot): EvidenceProjection['provenanceMetadata'] {
  const observedAt = timestamp(snapshot.observedAt);
  const sourceIdentifier = present(snapshot.sourceUrl);
  if (!observedAt && !sourceIdentifier) return undefined;
  return {
    ...(observedAt ? { observedAt } : {}),
    ...(sourceIdentifier ? { sourceIdentifier } : {}),
  };
}

function pageUrl(snapshot: ExtractionEvidenceSnapshot): string | undefined {
  return present(snapshot.page?.finalUrl) ?? present(snapshot.page?.url) ?? present(snapshot.page?.requestedUrl) ?? present(snapshot.sourceUrl);
}

function resolveDomain(...candidates: Array<string | null | undefined>): string | undefined {
  for (const candidate of candidates) {
    const value = present(candidate);
    if (!value) continue;
    try {
      return new URL(value.includes('://') ? value : `https://${value}`).hostname;
    } catch {
      if (!value.includes('/') && !value.includes(' ')) return value;
    }
  }
  return undefined;
}

function comparisonTitle(comparison: RawRenderedEvidenceComparison): string {
  return `${labelFor(comparison.field)} differs between raw and rendered extraction`;
}

function comparisonDescription(comparison: RawRenderedEvidenceComparison): string {
  if (comparison.relationship === 'RENDERED_ONLY') {
    return `${labelFor(comparison.field)} is available only after rendering in the compared snapshots.`;
  }
  if (comparison.relationship === 'RAW_ONLY') {
    return `${labelFor(comparison.field)} is available only in the raw extraction in the compared snapshots.`;
  }
  return `${labelFor(comparison.field)} has different raw and rendered values in the compared snapshots.`;
}

function labelFor(field: RawRenderedComparableField): string {
  return {
    title: 'Title', metaDescription: 'Meta description', canonicalUrl: 'Canonical URL', h1: 'H1', h2: 'H2 headings',
    bodyTextLength: 'Visible-text length', contentHash: 'Content hash', schemaTypes: 'Schema types',
    robotsDirectives: 'Robots directives', openGraph: 'Open Graph metadata',
  }[field];
}

function categoryFor(field: RawRenderedComparableField): string {
  return ['canonicalUrl', 'robotsDirectives'].includes(field) ? 'technical-seo'
    : ['schemaTypes'].includes(field) ? 'structured-data'
      : ['bodyTextLength', 'contentHash'].includes(field) ? 'content'
        : 'on-page-seo';
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function compactObject(value: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => entry[1] !== undefined));
}

function timestamp(value: Date | string | null | undefined): string | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  return present(value);
}

function present(value: string | null | undefined): string | undefined {
  return value?.trim() || undefined;
}
