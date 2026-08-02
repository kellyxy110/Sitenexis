import {
  createConfidenceSummary,
  type EvidenceProjection,
  type EvidenceProjectionConfidence,
  type EvidenceSourceLayer,
  type EvidenceValue,
} from './intelligence-report-v2';

/** Structural subset of the persisted Page model used by the read-time adapter. */
export interface LegacyPageEvidenceRecord {
  id: string;
  auditId: string;
  url?: string | null;
  normalizedUrl?: string | null;
  requestedUrl?: string | null;
  finalUrl?: string | null;
  statusCode?: number | null;
  title?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  h2?: unknown;
  canonicalUrl?: string | null;
  rawCanonical?: string | null;
  resolvedCanonical?: string | null;
  canonicalCount?: number | null;
  canonicalSource?: string | null;
  canonicalValidity?: string | null;
  isSelfReferencing?: boolean | null;
  contentHash?: string | null;
  extractionMode?: string | null;
  extractionConfidence?: number | null;
  crawledAt?: Date | string | null;
}

/** Structural subset of the persisted Issue model used by the read-time adapter. */
export interface LegacyIssueEvidenceRecord {
  id: string;
  auditId: string;
  pageId?: string | null;
  pageUrl?: string | null;
  module: string;
  type: string;
  severity: string;
  message: string;
  recommendation: string;
  problem?: string | null;
  solution?: string | null;
  renderMethod?: string | null;
  confidence?: string | null;
  createdAt?: Date | string | null;
}

/** Context is supplied by the caller after it has already read legacy records. */
export interface LegacyEvidenceProjectionContext {
  domain?: string;
  auditTimestamp?: Date | string | null;
  page?: LegacyPageEvidenceRecord | null | undefined;
  moduleVersions?: Readonly<Record<string, string | undefined>>;
}

/**
 * Projects only stored Page values. Missing values produce no projection; the
 * adapter never creates a missing-title, missing-canonical, or other new issue.
 */
export function projectLegacyPageToEvidence(
  page: LegacyPageEvidenceRecord,
  context: LegacyEvidenceProjectionContext = {},
): EvidenceProjection[] {
  const domain = resolveDomain(context.domain, page.url, page.finalUrl, page.requestedUrl);
  if (!domain) return [];

  const common = pageCommon(page, domain, context);
  const projections: EvidenceProjection[] = [];

  addPageValue(projections, common, 'http-status', 'HTTP status', 'Observed HTTP status for this page.', page.statusCode, 'web-health');
  addPageValue(projections, common, 'title', 'Page title', 'Observed page title.', page.title, 'on-page-seo');
  addPageValue(projections, common, 'meta-description', 'Meta description', 'Observed meta description.', page.metaDescription, 'on-page-seo');
  addH1Projection(projections, common, page);
  addPageValue(projections, common, 'h2', 'H2 headings', 'Observed H2 headings.', evidenceValue(page.h2), 'on-page-seo');
  addCanonicalProjection(projections, common, page);
  addPageValue(projections, common, 'content-hash', 'Content hash', 'Stored content hash for this page.', page.contentHash, 'content');

  return projections;
}

/**
 * Projects one stored Issue without reinterpreting its severity, recommendation,
 * or rule identity. An issue without direct evidence is deliberately partial.
 */
export function projectLegacyIssueToEvidence(
  issue: LegacyIssueEvidenceRecord,
  context: LegacyEvidenceProjectionContext = {},
): EvidenceProjection | undefined {
  const pageUrl = present(issue.pageUrl) ?? present(context.page?.url) ?? undefined;
  const domain = resolveDomain(context.domain, pageUrl, context.page?.finalUrl, context.page?.requestedUrl);
  if (!domain) return undefined;

  const sourceLayer = sourceLayerFor(issue.renderMethod) ?? sourceLayerFor(context.page?.extractionMode);
  const directFailure = directFailureState(issue.type);
  const confidence = issueConfidence(issue.confidence);
  const detectedAt = timestamp(issue.createdAt) ?? timestamp(context.auditTimestamp);
  const moduleVersion = context.moduleVersions?.[issue.module];
  const metadata = compactMetadata({
    legacyRecord: true,
    problem: present(issue.problem),
    solution: present(issue.solution),
    renderMethod: present(issue.renderMethod),
  });

  return {
    id: `legacy:issue:${issue.id}`,
    auditId: issue.auditId,
    domain,
    scope: pageUrl ? 'PAGE' : 'DOMAIN',
    category: issue.module,
    title: issue.message,
    description: present(issue.problem) ?? issue.message,
    severity: severity(issue.severity),
    confidence,
    verificationState: directFailure ?? 'PARTIAL',
    sourceLayer,
    detectedAt,
    pageId: issue.pageId ?? undefined,
    issueId: issue.id,
    url: pageUrl,
    issueCode: present(issue.type),
    extractionMethod: present(issue.renderMethod),
    recommendation: issue.recommendation,
    observationType: directFailure ? 'OBSERVATION' : 'INFERENCE',
    moduleId: issue.module,
    moduleVersion,
    metadata,
  };
}

/** Combines caller-supplied legacy records only. It performs no database access. */
export function projectLegacyAuditEvidence(
  input: {
    pages?: readonly LegacyPageEvidenceRecord[];
    issues?: readonly LegacyIssueEvidenceRecord[];
  },
  context: Omit<LegacyEvidenceProjectionContext, 'page'> = {},
): EvidenceProjection[] {
  const pageById = new Map((input.pages ?? []).map((page) => [page.id, page]));
  const pageEvidence = (input.pages ?? []).flatMap((page) => projectLegacyPageToEvidence(page, context));
  const issueEvidence = (input.issues ?? []).flatMap((issue) => {
    const projection = projectLegacyIssueToEvidence(issue, {
      ...context,
      page: issue.pageId ? pageById.get(issue.pageId) : undefined,
    });
    return projection ? [projection] : [];
  });

  return [...pageEvidence, ...issueEvidence];
}

function pageCommon(
  page: LegacyPageEvidenceRecord,
  domain: string,
  context: LegacyEvidenceProjectionContext,
): Omit<EvidenceProjection, 'id' | 'category' | 'title' | 'description' | 'rawValue' | 'normalizedValue'> {
  const extractionMethod = present(page.extractionMode);
  const metadata = compactMetadata({
    legacyRecord: true,
    normalizedUrl: present(page.normalizedUrl),
    requestedUrl: present(page.requestedUrl),
    finalUrl: present(page.finalUrl),
    extractionMode: extractionMethod,
  });

  return {
    auditId: page.auditId,
    domain,
    scope: 'PAGE',
    confidence: extractionConfidence(page.extractionConfidence),
    verificationState: 'CONFIRMED',
    sourceLayer: sourceLayerFor(page.extractionMode),
    detectedAt: timestamp(page.crawledAt) ?? timestamp(context.auditTimestamp),
    pageId: page.id,
    url: present(page.url),
    canonicalUrl: present(page.resolvedCanonical) ?? present(page.canonicalUrl),
    extractionMethod,
    observationType: 'OBSERVATION',
    moduleId: context.moduleVersions?.['page-extraction'] ? 'page-extraction' : undefined,
    moduleVersion: context.moduleVersions?.['page-extraction'],
    metadata,
  };
}

function addPageValue(
  projections: EvidenceProjection[],
  common: Omit<EvidenceProjection, 'id' | 'category' | 'title' | 'description' | 'rawValue' | 'normalizedValue'>,
  code: string,
  title: string,
  description: string,
  value: EvidenceValue | string | number | boolean | null | undefined,
  category: string,
): void {
  if (value === undefined || value === null || value === '') return;
  projections.push({
    ...common,
    id: `legacy:page:${common.pageId ?? common.url ?? code}:${code}`,
    category,
    title,
    description,
    issueCode: code,
    rawValue: value,
  });
}

/**
 * H1 gets dedicated handling because absence is meaningful only when the
 * rendered DOM was actually inspected. A raw-only crawl that finds no H1 may
 * simply require rendering (CSR/JS shell) — projecting a bare absence there
 * would let the scoring layer treat "not yet rendered" as "confirmed missing."
 * Presence is unconditional; only a rendered-DOM absence is ever projected.
 */
function addH1Projection(
  projections: EvidenceProjection[],
  common: Omit<EvidenceProjection, 'id' | 'category' | 'title' | 'description' | 'rawValue' | 'normalizedValue'>,
  page: LegacyPageEvidenceRecord,
): void {
  const h1 = present(page.h1);
  if (h1) {
    addPageValue(projections, common, 'h1', 'H1 heading', 'Observed H1 heading.', h1, 'on-page-seo');
    return;
  }
  if (common.sourceLayer !== 'RENDERED_DOM') return;
  if (common.confidence.label === 'LOW' || common.confidence.label === 'UNKNOWN') return;

  projections.push({
    ...common,
    id: `legacy:page:${common.pageId ?? common.url ?? 'h1'}:h1`,
    category: 'on-page-seo',
    title: 'H1 heading',
    description: 'Rendered-DOM extraction completed and found no H1 heading.',
    issueCode: 'h1',
    rawValue: null,
  });
}

function addCanonicalProjection(
  projections: EvidenceProjection[],
  common: Omit<EvidenceProjection, 'id' | 'category' | 'title' | 'description' | 'rawValue' | 'normalizedValue'>,
  page: LegacyPageEvidenceRecord,
): void {
  const rawCanonical = present(page.rawCanonical) ?? present(page.canonicalUrl);
  const resolvedCanonical = present(page.resolvedCanonical) ?? present(page.canonicalUrl);
  if (!rawCanonical && !resolvedCanonical) return;

  projections.push({
    ...common,
    id: `legacy:page:${common.pageId ?? common.url ?? 'canonical'}:canonical`,
    category: 'technical-seo',
    title: 'Declared canonical',
    description: 'Observed canonical evidence stored for this page.',
    issueCode: 'canonical',
    rawValue: rawCanonical,
    normalizedValue: resolvedCanonical,
    metadata: compactMetadata({
      ...(common.metadata ?? {}),
      canonicalCount: page.canonicalCount ?? undefined,
      canonicalSource: present(page.canonicalSource),
      canonicalValidity: present(page.canonicalValidity),
      isSelfReferencing: page.isSelfReferencing ?? undefined,
    }),
  });
}

function extractionConfidence(value: number | null | undefined): EvidenceProjectionConfidence {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return createConfidenceSummary({ reasons: ['Legacy record does not include extraction confidence.'] });
  }
  const score = value > 1 ? value / 100 : value;
  return createConfidenceSummary({ score, reasons: ['Translated from legacy extraction confidence.'] });
}

function issueConfidence(value: string | null | undefined): EvidenceProjectionConfidence {
  if (value?.toLowerCase() === 'high') {
    return createConfidenceSummary({ score: 0.9, reasons: ['Legacy issue is marked high confidence.'] });
  }
  if (value?.toLowerCase() === 'low') {
    return createConfidenceSummary({ score: 0.4, reasons: ['Legacy issue is marked low confidence.'] });
  }
  return createConfidenceSummary({ reasons: ['Legacy issue does not include a usable confidence value.'] });
}

function sourceLayerFor(value: string | null | undefined): EvidenceSourceLayer | undefined {
  const normalized = value?.toLowerCase();
  if (!normalized) return undefined;
  if (/(rendered|headless|puppeteer|crawl4ai)/.test(normalized)) return 'RENDERED_DOM';
  if (/(static|fetch|raw|html)/.test(normalized)) return 'RAW_HTML';
  if (normalized.includes('sitemap')) return 'SITEMAP';
  if (normalized.includes('robots')) return 'ROBOTS';
  return undefined;
}

function directFailureState(type: string): 'CRAWL_FAILED' | 'TEMPORARY_FAILURE' | undefined {
  const normalized = type.toLowerCase();
  if (/(timeout|temporary|rate_limit)/.test(normalized)) return 'TEMPORARY_FAILURE';
  if (/(crawl_failed|fetch_failed|request_failed|unreachable)/.test(normalized)) return 'CRAWL_FAILED';
  return undefined;
}

function severity(value: string): EvidenceProjection['severity'] {
  const normalized = value.toLowerCase();
  return ['critical', 'high', 'medium', 'low', 'warning', 'info'].includes(normalized)
    ? normalized as NonNullable<EvidenceProjection['severity']>
    : undefined;
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

function timestamp(value: Date | string | null | undefined): string | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  return present(value);
}

function present(value: string | null | undefined): string | undefined {
  return value?.trim() || undefined;
}

function evidenceValue(value: unknown): EvidenceValue | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const values = value.map(evidenceValue).filter((item): item is EvidenceValue => item !== undefined);
    return values.length ? values : undefined;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, evidenceValue(item)] as const)
      .filter((entry): entry is readonly [string, EvidenceValue] => entry[1] !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  return undefined;
}

function compactMetadata(values: Record<string, EvidenceValue | undefined>): Record<string, EvidenceValue> | undefined {
  const entries = Object.entries(values).filter((entry): entry is [string, EvidenceValue] => entry[1] !== undefined);
  return entries.length ? Object.fromEntries(entries) : undefined;
}
