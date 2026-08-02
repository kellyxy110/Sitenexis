import {
  type EvidenceProjection,
  type EvidenceProjectionConfidence,
  type EvidenceScope,
  type VerificationState,
} from './intelligence-report-v2';
import type { RawRenderedComparableField, RawRenderedEvidenceComparison } from './raw-rendered-evidence-projection';
import type { IntelligenceModuleExecutionSummary, ProviderAvailability } from './intelligence-module-state';
import type { IntelligenceReportV2AuditIdentity } from './intelligence-report-v2-input';

export const FINDING_INTEGRITY_DIAGNOSTIC_CODES = [
  'MISSING_AFFECTED_URL',
  'MISSING_SUPPORTING_EVIDENCE',
  'EXTRACTION_FAILED',
  'EXTRACTION_NOT_ATTEMPTED',
  'NOT_DETECTED_ONLY',
  'PAGE_CLASSIFICATION_UNVERIFIED',
  'PROVIDER_UNAVAILABLE',
  'CROSS_AUDIT_EVIDENCE',
  'HISTORICAL_EVIDENCE_ONLY',
  'MODULE_NOT_COMPLETED',
  'MODULE_UNAVAILABLE',
  'MODULE_BLOCKED',
  'INSUFFICIENT_CONFIDENCE',
  'UNSUPPORTED_PAGE_TYPE',
  'UNSUPPORTED_EXTERNAL_CLAIM',
  'INSUFFICIENT_DOMAIN_BREADTH',
  'VISUAL_EVIDENCE_REQUIRED',
  'RAW_RENDERED_CONFLICT',
  'RECOMMENDATION_REQUIRES_UNVERIFIED_FACTS',
] as const;

export type FindingIntegrityDiagnosticCode = (typeof FINDING_INTEGRITY_DIAGNOSTIC_CODES)[number];

export interface FindingIntegrityDiagnostic {
  code: FindingIntegrityDiagnosticCode;
  message: string;
}

export const PAGE_CLASSIFICATIONS = [
  'HOMEPAGE', 'PRODUCT', 'SERVICE', 'LANDING_PAGE', 'ARTICLE', 'BLOG_POST', 'DOCUMENTATION',
  'CHANGELOG', 'PRICING', 'CONTACT', 'ABOUT', 'LEGAL', 'CATEGORY', 'ARCHIVE', 'APPLICATION', 'UNKNOWN',
] as const;
export type PageClassification = (typeof PAGE_CLASSIFICATIONS)[number];

/** Caller-supplied classification evidence. This phase does not classify pages. */
export interface PageClassificationEvidence {
  classification: PageClassification;
  confidence: EvidenceProjectionConfidence;
  evidenceIds: readonly string[];
  pageId?: string | null | undefined;
  url?: string | null | undefined;
  verificationState?: VerificationState | undefined;
}

export interface PageClassificationRequirement {
  classification: Exclude<PageClassification, 'UNKNOWN'>;
  /** Optional policy supplied by a future caller. There is no global threshold in Phase 8. */
  minimumConfidence?: number | undefined;
}

export const FINDING_CONCLUSION_KINDS = ['OBSERVATION', 'INFERENCE', 'FINDING', 'RECOMMENDATION'] as const;
export type FindingConclusionKind = (typeof FINDING_CONCLUSION_KINDS)[number];
export const CLAIM_POLARITIES = ['NEUTRAL', 'PRESENCE', 'ABSENCE'] as const;
export type ClaimPolarity = (typeof CLAIM_POLARITIES)[number];

/** In-memory candidate only. It is not the existing Issue model or a persisted finding. */
export interface FindingCandidateContext {
  intendedScope: EvidenceScope;
  intendedVerificationState?: VerificationState | undefined;
  conclusionKind?: FindingConclusionKind | undefined;
  claimPolarity?: ClaimPolarity | undefined;
  ruleId?: string | undefined;
  evidenceIds?: readonly string[] | undefined;
  affectedUrls?: readonly string[] | undefined;
  moduleId?: string | undefined;
  requiredFields?: readonly RawRenderedComparableField[] | undefined;
  pageClassificationRequirement?: PageClassificationRequirement | undefined;
  providerRequirement?: string | undefined;
  requiresExternalProvider?: boolean | undefined;
  requiresVisualEvidence?: boolean | undefined;
  domainEvidenceSufficient?: boolean | undefined;
  historicalContext?: boolean | undefined;
  requiresUnverifiedBusinessFacts?: boolean | undefined;
}

export interface FindingEligibilityEvaluationInput {
  audit: Pick<IntelligenceReportV2AuditIdentity, 'auditId' | 'domain'>;
  candidate: FindingCandidateContext;
  evidence?: readonly EvidenceProjection[] | undefined;
  rawRenderedComparisons?: readonly RawRenderedEvidenceComparison[] | undefined;
  moduleSummary?: IntelligenceModuleExecutionSummary | undefined;
  providers?: readonly ProviderAvailability[] | undefined;
  pageClassification?: PageClassificationEvidence | undefined;
  historicalEvidence?: readonly EvidenceProjection[] | undefined;
}

export interface FindingEligibilityResult {
  eligible: boolean;
  maximumVerificationState: VerificationState;
  diagnostics: FindingIntegrityDiagnostic[];
  evidenceIds: string[];
  affectedUrls: string[];
}

export interface RecommendationEligibilityResult extends FindingEligibilityResult {
  applicable: boolean;
}

/**
 * Read-time eligibility only. It determines whether supplied evidence can
 * support a requested strength of conclusion; it never creates a finding.
 */
export function evaluateFindingEligibility(input: FindingEligibilityEvaluationInput): FindingEligibilityResult {
  const diagnostics: FindingIntegrityDiagnostic[] = [];
  const candidate = input.candidate;
  const targetState = candidate.intendedVerificationState ?? 'CONFIRMED';
  const selected = selectEvidence(input.evidence ?? [], candidate.evidenceIds);
  const currentEvidence = selected.filter((item) => item.auditId === input.audit.auditId);
  const crossAudit = selected.filter((item) => item.auditId !== input.audit.auditId);
  const historicalEvidence = candidate.historicalContext && candidate.intendedScope === 'HISTORICAL_TREND'
    ? selectEvidence(input.historicalEvidence ?? [], candidate.evidenceIds)
    : [];
  const supportingEvidence = currentEvidence.length > 0 ? currentEvidence : historicalEvidence;
  const affectedUrls = unique([
    ...(candidate.affectedUrls ?? []),
    ...supportingEvidence.flatMap((item) => item.url ? [item.url] : []),
  ]);
  let maximum: VerificationState = 'CONFIRMED';

  if (crossAudit.length > 0) {
    diagnostics.push(diagnostic('CROSS_AUDIT_EVIDENCE', 'Evidence from another audit cannot support a current finding.'));
    maximum = cap(maximum, 'UNVERIFIED');
  }
  if (supportingEvidence.length === 0) {
    if ((input.historicalEvidence?.length ?? 0) > 0) {
      diagnostics.push(diagnostic('HISTORICAL_EVIDENCE_ONLY', 'Historical evidence is separate and cannot silently support a current-state finding.'));
    } else {
      diagnostics.push(diagnostic('MISSING_SUPPORTING_EVIDENCE', 'No current structured evidence was supplied for this conclusion.'));
    }
    maximum = cap(maximum, 'UNVERIFIED');
  }
  if (isPageSpecificScope(candidate.intendedScope) && affectedUrls.length === 0) {
    diagnostics.push(diagnostic('MISSING_AFFECTED_URL', 'A page-scoped conclusion requires an affected URL.'));
    maximum = cap(maximum, 'PARTIAL');
  }
  if (candidate.intendedScope === 'DOMAIN' && candidate.domainEvidenceSufficient !== true) {
    diagnostics.push(diagnostic('INSUFFICIENT_DOMAIN_BREADTH', 'Domain-wide language requires explicitly supplied aggregate or domain-level evidence.'));
    maximum = cap(maximum, 'LIKELY');
  }

  maximum = evaluateEvidenceStates(supportingEvidence, maximum, diagnostics);
  maximum = evaluateModuleState(input.moduleSummary, maximum, diagnostics);
  maximum = evaluateProvider(candidate, input.providers ?? [], maximum, diagnostics);
  maximum = evaluatePageClassification(candidate, input.pageClassification, maximum, diagnostics);
  maximum = evaluateVisualEvidence(candidate, supportingEvidence, maximum, diagnostics);
  maximum = evaluateRawRendered(candidate, input.rawRenderedComparisons ?? [], maximum, diagnostics);

  if (candidate.requiresUnverifiedBusinessFacts) {
    diagnostics.push(diagnostic('RECOMMENDATION_REQUIRES_UNVERIFIED_FACTS', 'The candidate requires business facts that are not verified by this eligibility contract.'));
    maximum = cap(maximum, 'UNVERIFIED');
  }

  const eligible = diagnostics.every((entry) => !hardBlocker(entry.code))
    && verificationRank(maximum) >= verificationRank(targetState);
  return { eligible, maximumVerificationState: maximum, diagnostics, evidenceIds: supportingEvidence.map((item) => item.id), affectedUrls };
}

/** Recommendation candidates add applicability checks but still create no recommendation. */
export function evaluateRecommendationEligibility(input: FindingEligibilityEvaluationInput): RecommendationEligibilityResult {
  const result = evaluateFindingEligibility({
    ...input,
    candidate: { ...input.candidate, conclusionKind: 'RECOMMENDATION' },
  });
  return { ...result, applicable: result.eligible };
}

function selectEvidence(evidence: readonly EvidenceProjection[], ids: readonly string[] | undefined): EvidenceProjection[] {
  if (!ids || ids.length === 0) return [...evidence];
  const selected = new Set(ids);
  return evidence.filter((item) => selected.has(item.id));
}

function evaluateEvidenceStates(
  evidence: readonly EvidenceProjection[],
  maximum: VerificationState,
  diagnostics: FindingIntegrityDiagnostic[],
): VerificationState {
  if (evidence.some((item) => item.verificationState === 'CRAWL_FAILED' || item.verificationState === 'TEMPORARY_FAILURE')) {
    diagnostics.push(diagnostic('EXTRACTION_FAILED', 'A failed extraction cannot be interpreted as absence.'));
    maximum = cap(maximum, 'UNVERIFIED');
  }
  if (evidence.length > 0 && evidence.every((item) => item.verificationState === 'NOT_DETECTED')) {
    diagnostics.push(diagnostic('NOT_DETECTED_ONLY', 'Not-detected evidence supports cautious wording, not an absolute absence claim.'));
    maximum = cap(maximum, 'PARTIAL');
  }
  if (evidence.some((item) => item.verificationState === 'PROVIDER_UNAVAILABLE' || item.verificationState === 'EXTERNAL_DATA_REQUIRED')) {
    diagnostics.push(diagnostic('PROVIDER_UNAVAILABLE', 'Unavailable external data cannot support a negative external claim.'));
    maximum = cap(maximum, 'UNVERIFIED');
  }
  const scores = evidence.map((item) => item.confidence.score).filter((score): score is number => typeof score === 'number');
  if (scores.length > 0 && Math.max(...scores) < 0.5) {
    diagnostics.push(diagnostic('INSUFFICIENT_CONFIDENCE', 'Supplied evidence has low translated confidence.'));
    maximum = cap(maximum, 'LIKELY');
  }
  return maximum;
}

function evaluateModuleState(
  summary: IntelligenceModuleExecutionSummary | undefined,
  maximum: VerificationState,
  diagnostics: FindingIntegrityDiagnostic[],
): VerificationState {
  if (!summary || summary.state === 'COMPLETED') return maximum;
  if (summary.state === 'PARTIAL') return cap(maximum, 'PARTIAL');
  if (summary.state === 'BLOCKED') diagnostics.push(diagnostic('MODULE_BLOCKED', 'The relevant module was blocked; missing output is not negative evidence.'));
  else if (summary.state === 'UNAVAILABLE') diagnostics.push(diagnostic('MODULE_UNAVAILABLE', 'The relevant module was unavailable; missing output is not negative evidence.'));
  else diagnostics.push(diagnostic('MODULE_NOT_COMPLETED', `The relevant module is ${summary.state.toLowerCase()}.`));
  return cap(maximum, 'UNVERIFIED');
}

function evaluateProvider(
  candidate: FindingCandidateContext,
  providers: readonly ProviderAvailability[],
  maximum: VerificationState,
  diagnostics: FindingIntegrityDiagnostic[],
): VerificationState {
  if (!candidate.providerRequirement && !candidate.requiresExternalProvider) return maximum;
  const provider = candidate.providerRequirement
    ? providers.find((item) => item.provider.toLowerCase() === candidate.providerRequirement?.toLowerCase())
    : undefined;
  if (!provider || !provider.available) {
    diagnostics.push(diagnostic(candidate.requiresExternalProvider ? 'UNSUPPORTED_EXTERNAL_CLAIM' : 'PROVIDER_UNAVAILABLE', 'Required external-provider evidence is unavailable.'));
    return cap(maximum, 'UNVERIFIED');
  }
  return maximum;
}

function evaluatePageClassification(
  candidate: FindingCandidateContext,
  classification: PageClassificationEvidence | undefined,
  maximum: VerificationState,
  diagnostics: FindingIntegrityDiagnostic[],
): VerificationState {
  const requirement = candidate.pageClassificationRequirement;
  if (!requirement) return maximum;
  if (!classification || classification.classification === 'UNKNOWN') {
    diagnostics.push(diagnostic('PAGE_CLASSIFICATION_UNVERIFIED', 'The required page classification is not verified.'));
    return cap(maximum, 'PARTIAL');
  }
  if (classification.classification !== requirement.classification) {
    diagnostics.push(diagnostic('UNSUPPORTED_PAGE_TYPE', `The supplied page type does not support ${requirement.classification}-specific logic.`));
    return cap(maximum, 'PARTIAL');
  }
  if (classification.evidenceIds.length === 0 || classification.verificationState === 'NOT_DETECTED') {
    diagnostics.push(diagnostic('PAGE_CLASSIFICATION_UNVERIFIED', 'The supplied page classification has no supporting evidence reference.'));
    return cap(maximum, 'PARTIAL');
  }
  if (requirement.minimumConfidence !== undefined && (classification.confidence.score === undefined || classification.confidence.score < requirement.minimumConfidence)) {
    diagnostics.push(diagnostic('INSUFFICIENT_CONFIDENCE', 'The supplied page classification does not meet the caller-supplied confidence threshold.'));
    return cap(maximum, 'LIKELY');
  }
  return maximum;
}

function evaluateVisualEvidence(
  candidate: FindingCandidateContext,
  evidence: readonly EvidenceProjection[],
  maximum: VerificationState,
  diagnostics: FindingIntegrityDiagnostic[],
): VerificationState {
  if (!candidate.requiresVisualEvidence) return maximum;
  if (!evidence.some((item) => item.sourceLayer === 'SCREENSHOT' && item.verificationState === 'CONFIRMED')) {
    diagnostics.push(diagnostic('VISUAL_EVIDENCE_REQUIRED', 'A visual claim requires verified screenshot or rendered visual evidence.'));
    return cap(maximum, 'UNVERIFIED');
  }
  return maximum;
}

function evaluateRawRendered(
  candidate: FindingCandidateContext,
  comparisons: readonly RawRenderedEvidenceComparison[],
  maximum: VerificationState,
  diagnostics: FindingIntegrityDiagnostic[],
): VerificationState {
  if (!candidate.requiredFields || candidate.requiredFields.length === 0) return maximum;
  for (const field of candidate.requiredFields) {
    const fieldComparisons = comparisons.filter((comparison) => comparison.field === field);
    if (fieldComparisons.some((comparison) => comparison.rawAvailability === 'FAILED' || comparison.renderedAvailability === 'FAILED')) {
      diagnostics.push(diagnostic('EXTRACTION_FAILED', `Extraction failed while comparing ${field}.`));
      maximum = cap(maximum, 'UNVERIFIED');
      continue;
    }
    if (fieldComparisons.some((comparison) => comparison.rawAvailability === 'NOT_ATTEMPTED' || comparison.renderedAvailability === 'NOT_ATTEMPTED')) {
      diagnostics.push(diagnostic('EXTRACTION_NOT_ATTEMPTED', `Extraction was not attempted while comparing ${field}.`));
      maximum = cap(maximum, 'PARTIAL');
      continue;
    }
    if (candidate.claimPolarity === 'ABSENCE' && fieldComparisons.some((comparison) => comparison.relationship === 'RENDERED_ONLY')) {
      diagnostics.push(diagnostic('RAW_RENDERED_CONFLICT', `Rendered evidence is present for ${field}, so an absence claim is unsupported.`));
      maximum = cap(maximum, 'UNVERIFIED');
    }
  }
  return maximum;
}

function isPageSpecificScope(scope: EvidenceScope): boolean {
  return scope === 'PAGE' || scope === 'VISUAL_RENDER';
}

function cap(current: VerificationState, limit: VerificationState): VerificationState {
  return verificationRank(current) <= verificationRank(limit) ? current : limit;
}

function verificationRank(state: VerificationState): number {
  return ({ CONFIRMED: 5, LIKELY: 4, PARTIAL: 3, INFERRED: 3, UNVERIFIED: 2, CONFLICTING: 2, NOT_DETECTED: 2, NOT_APPLICABLE: 2, CRAWL_FAILED: 1, TEMPORARY_FAILURE: 1, RENDERING_REQUIRED: 2, EXTERNAL_DATA_REQUIRED: 2, PROVIDER_UNAVAILABLE: 1 } as const)[state];
}

function hardBlocker(code: FindingIntegrityDiagnosticCode): boolean {
  return ['MISSING_AFFECTED_URL', 'MISSING_SUPPORTING_EVIDENCE', 'EXTRACTION_FAILED', 'PROVIDER_UNAVAILABLE', 'CROSS_AUDIT_EVIDENCE', 'HISTORICAL_EVIDENCE_ONLY', 'MODULE_NOT_COMPLETED', 'MODULE_UNAVAILABLE', 'MODULE_BLOCKED', 'UNSUPPORTED_EXTERNAL_CLAIM', 'VISUAL_EVIDENCE_REQUIRED', 'RAW_RENDERED_CONFLICT', 'RECOMMENDATION_REQUIRES_UNVERIFIED_FACTS'].includes(code);
}

function diagnostic(code: FindingIntegrityDiagnosticCode, message: string): FindingIntegrityDiagnostic {
  return { code, message };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}