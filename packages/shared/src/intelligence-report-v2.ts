/**
 * Additive, shared primitives for Intelligence Report v2.
 *
 * These contracts intentionally do not write data, calculate report scores, or
 * alter audit execution. They let later phases project existing evidence while
 * keeping legacy audits readable.
 */

export const VERIFICATION_STATES = [
  'CONFIRMED',
  'LIKELY',
  'INFERRED',
  'PARTIAL',
  'UNVERIFIED',
  'CONFLICTING',
  'NOT_DETECTED',
  'NOT_APPLICABLE',
  'CRAWL_FAILED',
  'TEMPORARY_FAILURE',
  'RENDERING_REQUIRED',
  'EXTERNAL_DATA_REQUIRED',
  'PROVIDER_UNAVAILABLE',
] as const;

export type VerificationState = (typeof VERIFICATION_STATES)[number];

export const EVIDENCE_SOURCE_LAYERS = [
  'RAW_HTML',
  'RENDERED_DOM',
  'HTTP_HEADERS',
  'ROBOTS',
  'SITEMAP',
  'STRUCTURED_DATA',
  'INTERNAL_LINK_GRAPH',
  'SCREENSHOT',
  'EXTERNAL_SEARCH',
  'EXTERNAL_PROFILE',
  'BUSINESS_DIRECTORY',
  'REVIEW_PLATFORM',
  'BACKLINK_PROVIDER',
  'SEARCH_CONSOLE',
  'ANALYTICS',
  'HISTORICAL_DATABASE',
  'PROVIDER_API',
  'USER_CONNECTED_DATA',
] as const;

export type EvidenceSourceLayer = (typeof EVIDENCE_SOURCE_LAYERS)[number];

export const EVIDENCE_SCOPES = [
  'PAGE',
  'TEMPLATE',
  'DIRECTORY',
  'SITEMAP',
  'DOMAIN',
  'ORGANISATION',
  'EXTERNAL_ENTITY',
  'EXTERNAL_PROFILE',
  'LOCAL_PRESENCE',
  'HISTORICAL_TREND',
  'VISUAL_RENDER',
  'PROVIDER_DATA',
] as const;

export type EvidenceScope = (typeof EVIDENCE_SCOPES)[number];

export const OBSERVATION_TYPES = ['OBSERVATION', 'INFERENCE'] as const;

/** Directly observed evidence or a conclusion derived from observed evidence. */
export type ObservationType = (typeof OBSERVATION_TYPES)[number];

export const DISCOVERY_SOURCES = [
  'SEED_URL',
  'SITEMAP',
  'INTERNAL_LINK',
  'ROBOTS',
  'RSS',
  'LLMS',
  'CANONICAL',
  'REDIRECT',
  'STRUCTURED_DATA',
  'SEARCH_CONSOLE',
  'EXTERNAL_PROVIDER',
  'USER_SUPPLIED',
] as const;

export type DiscoverySource = (typeof DISCOVERY_SOURCES)[number];

export const CONFIDENCE_LABELS = ['HIGH', 'MODERATE', 'LOW', 'UNKNOWN'] as const;

export type EvidenceProjectionConfidenceLabel = (typeof CONFIDENCE_LABELS)[number];

/**
 * This is separate from the existing verification-layer ConfidenceScore. It is
 * a report projection summary and deliberately does not define a final formula.
 */
export interface EvidenceProjectionConfidence {
  score?: number | undefined;
  label: EvidenceProjectionConfidenceLabel;
  reasons: string[];
  evidenceCount?: number | undefined;
  contradictionCount?: number | undefined;
  sourceLayerCount?: number | undefined;
  coverageInfluence?: number | undefined;
}

export type EvidenceValue =
  | string
  | number
  | boolean
  | null
  | EvidenceValue[]
  | { [key: string]: EvidenceValue };

export interface EvidenceProjectionScoreImpact {
  category: string;
  impact?: number;
  kind?: 'primary' | 'secondary';
  reason?: string;
}

/**
 * Supplementary provenance for provider or extractor details. Canonical lineage
 * fields remain top-level on EvidenceProjection to avoid competing values.
 */
export interface EvidenceProjectionProvenanceMetadata {
  sourceDocument?: string | null;
  transformation?: string | null;
  observedAt?: string | null;
  sourceIdentifier?: string | null;
  details?: Record<string, EvidenceValue>;
}

/**
 * Read-oriented evidence contract for a future v2 report projection. It does
 * not replace Page, Issue, AuditScore, or their persisted representations.
 */
export interface EvidenceProjection {
  id: string;
  auditId: string;
  domain: string;
  scope: EvidenceScope;
  category: string;
  title: string;
  description: string;
  confidence: EvidenceProjectionConfidence;
  verificationState: VerificationState;
  sourceLayer?: EvidenceSourceLayer | undefined;
  detectedAt?: string | undefined;
  retryCount?: number | undefined;
  observationType?: ObservationType | undefined;
  moduleId?: string | null | undefined;
  moduleVersion?: string | null | undefined;
  extractorVersion?: string | null | undefined;
  discoverySource?: DiscoverySource | undefined;
  discoveredFrom?: string | null | undefined;
  provenanceMetadata?: EvidenceProjectionProvenanceMetadata | undefined;
  pageId?: string | null | undefined;
  issueId?: string | null | undefined;
  url?: string | null | undefined;
  canonicalUrl?: string | null | undefined;
  subcategory?: string | null | undefined;
  ruleId?: string | null | undefined;
  issueCode?: string | null | undefined;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'warning' | 'info' | null | undefined;
  extractionMethod?: string | null | undefined;
  rawValue?: EvidenceValue | undefined;
  normalizedValue?: EvidenceValue | undefined;
  expectedValue?: EvidenceValue | undefined;
  evidenceSnippet?: string | null | undefined;
  selector?: string | null | undefined;
  jsonPath?: string | null | undefined;
  sourceUrl?: string | null | undefined;
  statusCode?: number | null | undefined;
  responseTime?: number | null | undefined;
  firstDetectedAt?: string | null | undefined;
  lastConfirmedAt?: string | null | undefined;
  businessImpact?: string | null | undefined;
  visibilityImpact?: string | null | undefined;
  recommendation?: string | null | undefined;
  rootCauseId?: string | null | undefined;
  scoreImpacts?: EvidenceProjectionScoreImpact[] | undefined;
  metadata?: Record<string, EvidenceValue> | undefined;
}

export interface IntelligenceReportVersionMetadata {
  scoringModelVersion: string;
  reportVersion: string;
  evidenceModelVersion: string;
  crawlerVersion: string;
}

/** Read-time defaults only. Historical rows are never mutated by this helper. */
export const LEGACY_INTELLIGENCE_REPORT_VERSION_METADATA: Readonly<IntelligenceReportVersionMetadata> = {
  scoringModelVersion: 'legacy',
  reportVersion: 'v1',
  evidenceModelVersion: 'legacy',
  crawlerVersion: 'legacy',
};

export const INTELLIGENCE_REPORT_V2_VERSION_METADATA: Readonly<IntelligenceReportVersionMetadata> = {
  scoringModelVersion: 'v2',
  reportVersion: 'v2',
  evidenceModelVersion: 'v2',
  crawlerVersion: 'v2',
};

export interface AuditCoverage {
  discoveredUrls: number;
  attemptedUrls: number;
  successfulUrls: number;
  renderedUrls: number;
  partialUrls: number;
  failedUrls: number;
  blockedUrls: number;
  redirectedUrls: number;
  excludedUrls: number;
  externalSourcesChecked: number;
  providersAvailable: string[];
  providersUnavailable: string[];
  screenshotCoverage?: number | undefined;
  coverageRatio?: number | undefined;
}

export function isVerificationState(value: unknown): value is VerificationState {
  return typeof value === 'string' && (VERIFICATION_STATES as readonly string[]).includes(value);
}

export function isEvidenceSourceLayer(value: unknown): value is EvidenceSourceLayer {
  return typeof value === 'string' && (EVIDENCE_SOURCE_LAYERS as readonly string[]).includes(value);
}

export function isEvidenceScope(value: unknown): value is EvidenceScope {
  return typeof value === 'string' && (EVIDENCE_SCOPES as readonly string[]).includes(value);
}

export function isObservationType(value: unknown): value is ObservationType {
  return typeof value === 'string' && (OBSERVATION_TYPES as readonly string[]).includes(value);
}

export function isDiscoverySource(value: unknown): value is DiscoverySource {
  return typeof value === 'string' && (DISCOVERY_SOURCES as readonly string[]).includes(value);
}

export function isVerifiedState(state: VerificationState): boolean {
  return state === 'CONFIRMED';
}

export function isUnavailableState(state: VerificationState): boolean {
  return [
    'UNVERIFIED',
    'NOT_DETECTED',
    'CRAWL_FAILED',
    'TEMPORARY_FAILURE',
    'RENDERING_REQUIRED',
    'EXTERNAL_DATA_REQUIRED',
    'PROVIDER_UNAVAILABLE',
  ].includes(state);
}

export function isFailureState(state: VerificationState): boolean {
  return state === 'CRAWL_FAILED' || state === 'TEMPORARY_FAILURE';
}

/**
 * Signals that may be considered by a future score projection. The projection
 * must still apply its own category-specific weight and confidence rules.
 */
export function canAffectScore(state: VerificationState): boolean {
  return ['CONFIRMED', 'LIKELY', 'PARTIAL', 'CONFLICTING'].includes(state);
}

export function requiresCautiousNarrative(state: VerificationState): boolean {
  return state !== 'CONFIRMED' && state !== 'NOT_APPLICABLE';
}

export function createConfidenceSummary(
  input: Partial<EvidenceProjectionConfidence> = {},
): EvidenceProjectionConfidence {
  const score = input.score === undefined ? undefined : clampUnitInterval(input.score);
  const label = input.label ?? confidenceLabelForScore(score);

  return {
    score,
    label,
    reasons: input.reasons ? [...input.reasons] : [],
    evidenceCount: input.evidenceCount,
    contradictionCount: input.contradictionCount,
    sourceLayerCount: input.sourceLayerCount,
    coverageInfluence: input.coverageInfluence === undefined
      ? undefined
      : clampUnitInterval(input.coverageInfluence),
  };
}

export function createAuditCoverage(input: Partial<AuditCoverage> = {}): AuditCoverage {
  const coverage: AuditCoverage = {
    discoveredUrls: nonNegative(input.discoveredUrls),
    attemptedUrls: nonNegative(input.attemptedUrls),
    successfulUrls: nonNegative(input.successfulUrls),
    renderedUrls: nonNegative(input.renderedUrls),
    partialUrls: nonNegative(input.partialUrls),
    failedUrls: nonNegative(input.failedUrls),
    blockedUrls: nonNegative(input.blockedUrls),
    redirectedUrls: nonNegative(input.redirectedUrls),
    excludedUrls: nonNegative(input.excludedUrls),
    externalSourcesChecked: nonNegative(input.externalSourcesChecked),
    providersAvailable: input.providersAvailable ? [...input.providersAvailable] : [],
    providersUnavailable: input.providersUnavailable ? [...input.providersUnavailable] : [],
    screenshotCoverage: input.screenshotCoverage === undefined
      ? undefined
      : clampUnitInterval(input.screenshotCoverage),
  };

  coverage.coverageRatio = input.coverageRatio === undefined
    ? calculateObservedCoverageRatio(coverage)
    : clampUnitInterval(input.coverageRatio);

  return coverage;
}

/**
 * Observed crawl coverage only. It is not the final report-confidence or
 * scoring formula. Partial URLs contribute half coverage until a future phase
 * can provide a category-specific measurement.
 */
export function calculateObservedCoverageRatio(coverage: Pick<
  AuditCoverage,
  'attemptedUrls' | 'successfulUrls' | 'partialUrls' | 'excludedUrls'
>): number | undefined {
  const eligibleUrls = Math.max(0, coverage.attemptedUrls - coverage.excludedUrls);
  if (eligibleUrls === 0) return undefined;

  const completedUrls = coverage.successfulUrls + coverage.partialUrls * 0.5;
  return clampUnitInterval(completedUrls / eligibleUrls);
}

/** Resolves missing fields for legacy read paths without writing to storage. */
export function resolveIntelligenceReportVersionMetadata(
  metadata: Partial<IntelligenceReportVersionMetadata> | null | undefined,
): IntelligenceReportVersionMetadata {
  return {
    scoringModelVersion: nonBlank(metadata?.scoringModelVersion, LEGACY_INTELLIGENCE_REPORT_VERSION_METADATA.scoringModelVersion),
    reportVersion: nonBlank(metadata?.reportVersion, LEGACY_INTELLIGENCE_REPORT_VERSION_METADATA.reportVersion),
    evidenceModelVersion: nonBlank(metadata?.evidenceModelVersion, LEGACY_INTELLIGENCE_REPORT_VERSION_METADATA.evidenceModelVersion),
    crawlerVersion: nonBlank(metadata?.crawlerVersion, LEGACY_INTELLIGENCE_REPORT_VERSION_METADATA.crawlerVersion),
  };
}

function confidenceLabelForScore(score: number | undefined): EvidenceProjectionConfidenceLabel {
  if (score === undefined) return 'UNKNOWN';
  if (score >= 0.8) return 'HIGH';
  if (score >= 0.5) return 'MODERATE';
  return 'LOW';
}

function clampUnitInterval(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function nonNegative(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function nonBlank(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}
