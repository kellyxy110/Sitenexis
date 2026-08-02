import {
  createConfidenceSummary,
  resolveIntelligenceReportVersionMetadata,
  type AuditCoverage,
  type EvidenceProjection,
  type EvidenceProjectionConfidence,
  type EvidenceValue,
  type IntelligenceReportVersionMetadata,
} from './intelligence-report-v2';
import type { RawRenderedEvidenceComparison } from './raw-rendered-evidence-projection';
import type {
  IntelligenceExecutionMode,
  IntelligenceModuleExecutionSummary,
  ProviderAvailability,
} from './intelligence-module-state';

/** Identity supplied by a caller that has already read the underlying audit. */
export interface IntelligenceReportV2AuditIdentity {
  auditId: string;
  domain: string;
  projectId?: string | null | undefined;
  tenantId?: string | null | undefined;
  organizationId?: string | null | undefined;
  auditStartedAt?: string | null | undefined;
  auditCompletedAt?: string | null | undefined;
  auditExecutionMode?: IntelligenceExecutionMode | undefined;
  auditLayer?: string | null | undefined;
}

/** Optional assembler context. It is not persisted or used to execute modules. */
export interface IntelligenceReportV2InputMetadata {
  assembledAt?: string | null | undefined;
  assemblerVersion?: string | null | undefined;
  sourceAuditVersion?: string | null | undefined;
  dataCompletenessNotes?: readonly string[] | undefined;
  callerMetadata?: Readonly<Record<string, EvidenceValue>> | undefined;
}

/**
 * Canonical, read-only boundary for a future Intelligence Report v2 projection.
 * It deliberately contains inputs only: no scores, report sections, prose, or
 * persistence instructions are represented here.
 */
export interface IntelligenceReportV2Input {
  audit: IntelligenceReportV2AuditIdentity;
  version: IntelligenceReportVersionMetadata;
  evidence: readonly EvidenceProjection[];
  rawRenderedComparisons: readonly RawRenderedEvidenceComparison[];
  modules: readonly IntelligenceModuleExecutionSummary[];
  coverage?: AuditCoverage | undefined;
  confidence: EvidenceProjectionConfidence;
  providers: readonly ProviderAvailability[];
  historicalEvidence?: readonly EvidenceProjection[] | undefined;
  metadata?: IntelligenceReportV2InputMetadata | undefined;
}

/** Caller-supplied values accepted by the pure composition helper. */
export interface IntelligenceReportV2InputCompositionRequest {
  audit: IntelligenceReportV2AuditIdentity;
  version?: Partial<IntelligenceReportVersionMetadata> | null | undefined;
  evidence?: readonly EvidenceProjection[] | undefined;
  rawRenderedComparisons?: readonly RawRenderedEvidenceComparison[] | undefined;
  modules?: readonly IntelligenceModuleExecutionSummary[] | undefined;
  coverage?: AuditCoverage | undefined;
  confidence?: EvidenceProjectionConfidence | undefined;
  providers?: readonly ProviderAvailability[] | undefined;
  historicalEvidence?: readonly EvidenceProjection[] | undefined;
  metadata?: IntelligenceReportV2InputMetadata | undefined;
}

export const INTELLIGENCE_REPORT_V2_INPUT_VALIDATION_CODES = [
  'AUDIT_ID_MISMATCH',
  'DOMAIN_MISMATCH',
  'CROSS_AUDIT_EVIDENCE',
  'MISSING_MODULE_SUMMARY',
  'DUPLICATE_MODULE_SUMMARY',
  'INVALID_VERSION_METADATA',
] as const;

export type IntelligenceReportV2InputValidationCode =
  (typeof INTELLIGENCE_REPORT_V2_INPUT_VALIDATION_CODES)[number];

export interface IntelligenceReportV2InputValidationIssue {
  code: IntelligenceReportV2InputValidationCode;
  message: string;
}

/** Boundary-integrity diagnostics only. This is not a contradiction engine. */
export interface IntelligenceReportV2InputValidation {
  valid: boolean;
  warnings: IntelligenceReportV2InputValidationIssue[];
  errors: IntelligenceReportV2InputValidationIssue[];
}

export interface IntelligenceReportV2InputCompositionResult {
  input: IntelligenceReportV2Input;
  validation: IntelligenceReportV2InputValidation;
}

/**
 * Creates an isolated, read-time report input from already-fetched records.
 * This helper never accesses a database, provider, cache, crawler, or module.
 */
export function composeIntelligenceReportV2Input(
  request: IntelligenceReportV2InputCompositionRequest,
): IntelligenceReportV2InputCompositionResult {
  const input: IntelligenceReportV2Input = {
    audit: { ...request.audit },
    version: resolveIntelligenceReportVersionMetadata(request.version),
    evidence: (request.evidence ?? []).map(copyEvidence),
    rawRenderedComparisons: (request.rawRenderedComparisons ?? []).map(copyComparison),
    modules: (request.modules ?? []).map(copyModuleSummary),
    ...(request.coverage ? { coverage: copyCoverage(request.coverage) } : {}),
    confidence: copyConfidence(request.confidence),
    providers: (request.providers ?? []).map((provider) => ({ ...provider })),
    ...(request.historicalEvidence ? { historicalEvidence: request.historicalEvidence.map(copyEvidence) } : {}),
    ...(request.metadata ? { metadata: copyMetadata(request.metadata) } : {}),
  };

  return { input, validation: validateIntelligenceReportV2Input(input, request.version) };
}

/**
 * Checks only that caller-supplied current-audit inputs do not conflict at the
 * composition boundary. Historical evidence remains separate by design.
 */
export function validateIntelligenceReportV2Input(
  input: IntelligenceReportV2Input,
  suppliedVersion?: Partial<IntelligenceReportVersionMetadata> | null,
): IntelligenceReportV2InputValidation {
  const warnings: IntelligenceReportV2InputValidationIssue[] = [];
  const errors: IntelligenceReportV2InputValidationIssue[] = [];
  const auditDomain = normalizeDomain(input.audit.domain);

  if (hasInvalidVersionMetadata(suppliedVersion)) {
    warnings.push(issue('INVALID_VERSION_METADATA', 'Blank version metadata was resolved with a legacy read-time default.'));
  }

  for (const evidence of input.evidence) {
    if (evidence.auditId !== input.audit.auditId) {
      errors.push(issue('CROSS_AUDIT_EVIDENCE', `Evidence ${evidence.id} belongs to audit ${evidence.auditId}, not ${input.audit.auditId}.`));
    }
    if (auditDomain && normalizeDomain(evidence.domain) && normalizeDomain(evidence.domain) !== auditDomain) {
      errors.push(issue('DOMAIN_MISMATCH', `Evidence ${evidence.id} belongs to ${evidence.domain}, not ${input.audit.domain}.`));
    }
  }

  for (const comparison of input.rawRenderedComparisons) {
    const comparisonDomain = normalizeDomain(comparison.url);
    if (auditDomain && comparisonDomain && comparisonDomain !== auditDomain) {
      errors.push(issue('DOMAIN_MISMATCH', `Raw/rendered comparison for ${comparison.url} does not match ${input.audit.domain}.`));
    }
  }

  const summaryIds = new Set<string>();
  const duplicateIds = new Set<string>();
  for (const summary of input.modules) {
    if (summaryIds.has(summary.moduleId)) duplicateIds.add(summary.moduleId);
    summaryIds.add(summary.moduleId);
  }
  for (const moduleId of duplicateIds) {
    warnings.push(issue('DUPLICATE_MODULE_SUMMARY', `Multiple execution summaries were supplied for module ${moduleId}.`));
  }

  for (const moduleId of new Set(input.evidence.flatMap((evidence) => evidence.moduleId ? [evidence.moduleId] : []))) {
    if (!summaryIds.has(moduleId)) {
      warnings.push(issue('MISSING_MODULE_SUMMARY', `Evidence references module ${moduleId}, but no execution summary was supplied.`));
    }
  }

  return { valid: errors.length === 0, warnings, errors };
}

function copyEvidence(evidence: EvidenceProjection): EvidenceProjection {
  return {
    ...evidence,
    confidence: copyConfidence(evidence.confidence),
    ...(evidence.scoreImpacts ? { scoreImpacts: evidence.scoreImpacts.map((impact) => ({ ...impact })) } : {}),
    ...(evidence.metadata ? { metadata: { ...evidence.metadata } } : {}),
    ...(evidence.provenanceMetadata ? {
      provenanceMetadata: {
        ...evidence.provenanceMetadata,
        ...(evidence.provenanceMetadata.details ? { details: { ...evidence.provenanceMetadata.details } } : {}),
      },
    } : {}),
  };
}

function copyComparison(comparison: RawRenderedEvidenceComparison): RawRenderedEvidenceComparison {
  return {
    ...comparison,
    confidence: copyConfidence(comparison.confidence),
    evidenceReferences: comparison.evidenceReferences.map((reference) => ({ ...reference })),
    ...(comparison.metadata ? { metadata: { ...comparison.metadata } } : {}),
  };
}

function copyModuleSummary(summary: IntelligenceModuleExecutionSummary): IntelligenceModuleExecutionSummary {
  return {
    ...summary,
    ...(summary.metadata ? { metadata: { ...summary.metadata } } : {}),
  };
}

function copyCoverage(coverage: AuditCoverage): AuditCoverage {
  return {
    ...coverage,
    providersAvailable: [...coverage.providersAvailable],
    providersUnavailable: [...coverage.providersUnavailable],
  };
}

function copyConfidence(confidence: EvidenceProjectionConfidence | undefined): EvidenceProjectionConfidence {
  if (!confidence) return createConfidenceSummary();
  return { ...confidence, reasons: [...confidence.reasons] };
}

function copyMetadata(metadata: IntelligenceReportV2InputMetadata): IntelligenceReportV2InputMetadata {
  return {
    ...metadata,
    ...(metadata.dataCompletenessNotes ? { dataCompletenessNotes: [...metadata.dataCompletenessNotes] } : {}),
    ...(metadata.callerMetadata ? { callerMetadata: { ...metadata.callerMetadata } } : {}),
  };
}

function hasInvalidVersionMetadata(metadata: Partial<IntelligenceReportVersionMetadata> | null | undefined): boolean {
  if (!metadata) return false;
  return Object.values(metadata).some((value) => typeof value !== 'string' || value.trim().length === 0);
}

function normalizeDomain(value: string | null | undefined): string | undefined {
  const present = value?.trim();
  if (!present) return undefined;
  try {
    return new URL(present.includes('://') ? present : `https://${present}`).hostname.toLowerCase();
  } catch {
    return present.includes('/') || present.includes(' ') ? undefined : present.toLowerCase();
  }
}

function issue(code: IntelligenceReportV2InputValidationCode, message: string): IntelligenceReportV2InputValidationIssue {
  return { code, message };
}