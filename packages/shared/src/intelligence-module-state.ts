/**
 * Shared vocabulary for the lifecycle of an intelligence capability. This is
 * intentionally separate from VerificationState, which describes evidence
 * certainty rather than what happened to a module.
 */
export const INTELLIGENCE_MODULE_STATES = [
  'REGISTERED',
  'INELIGIBLE',
  'READY',
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'PARTIAL',
  'BLOCKED',
  'UNAVAILABLE',
  'FAILED',
  'SKIPPED',
  'STALE',
] as const;

export type IntelligenceModuleState = (typeof INTELLIGENCE_MODULE_STATES)[number];

export const INTELLIGENCE_MODULE_REASON_CODES = [
  'MISSING_CREDENTIAL',
  'MISSING_INTEGRATION',
  'DEPENDENCY_FAILED',
  'DEPENDENCY_INCOMPLETE',
  'DEPENDENCY_UNAVAILABLE',
  'AUDIT_LAYER_TOO_LOW',
  'PLAN_NOT_ELIGIBLE',
  'WORKER_UNAVAILABLE',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_ERROR',
  'RATE_LIMITED',
  'TIMEOUT',
  'AUTHORIZATION_FAILED',
  'CONFIGURATION_ERROR',
  'NO_APPLICABLE_PAGES',
  'NO_EVIDENCE',
  'EXECUTION_FAILED',
  'EXECUTION_PARTIAL',
  'EXECUTION_NOT_STARTED',
  'STALE_RESULT',
  'UNSUPPORTED_EXECUTION_MODE',
] as const;

export type IntelligenceModuleReasonCode = (typeof INTELLIGENCE_MODULE_REASON_CODES)[number];

export const INTELLIGENCE_EXECUTION_MODES = ['WORKER', 'SERVERLESS', 'LOCAL', 'UNKNOWN'] as const;
export type IntelligenceExecutionMode = (typeof INTELLIGENCE_EXECUTION_MODES)[number];

export const INTELLIGENCE_MODULE_REQUIREMENT_TYPES = [
  'CREDENTIAL',
  'INTEGRATION',
  'AUDIT_LAYER',
  'PLAN',
  'PROVIDER',
  'EXECUTION_MODE',
  'EVIDENCE',
  'MODULE',
] as const;
export type IntelligenceModuleRequirementType = (typeof INTELLIGENCE_MODULE_REQUIREMENT_TYPES)[number];

/** Upstream input declaration only. Dependency resolution is a later concern. */
export interface IntelligenceModuleDependency {
  moduleId: string;
  required: boolean;
  minimumState: IntelligenceModuleState;
  description?: string | undefined;
}

/** Declarative capability requirement only. This does not inspect credentials or providers. */
export interface IntelligenceModuleRequirement {
  type: IntelligenceModuleRequirementType;
  key: string;
  required: boolean;
  description?: string | undefined;
}

/**
 * Platform catalogue descriptor. Existing modules do not need to register with
 * this shape until a later, separately approved integration phase.
 */
export interface IntelligenceModuleDescriptor {
  id: string;
  name: string;
  version: string;
  description?: string | undefined;
  supportedAuditLayers?: readonly string[] | undefined;
  executionModes?: readonly IntelligenceExecutionMode[] | undefined;
  dependencies?: readonly IntelligenceModuleDependency[] | undefined;
  requirements?: readonly IntelligenceModuleRequirement[] | undefined;
}

/** Read-time representation only. It does not imply any persistence schema. */
export interface IntelligenceModuleExecutionSummary {
  moduleId: string;
  state: IntelligenceModuleState;
  moduleVersion?: string | undefined;
  reasonCode?: IntelligenceModuleReasonCode | undefined;
  reason?: string | undefined;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
  durationMs?: number | undefined;
  executionMode?: IntelligenceExecutionMode | undefined;
  evidenceCount?: number | undefined;
  findingCount?: number | undefined;
  scoreAvailable?: boolean | undefined;
  partial?: boolean | undefined;
  retryCount?: number | undefined;
  provider?: string | undefined;
  metadata?: Record<string, string | number | boolean | null> | undefined;
}

/** Provider availability contract only. It never exposes secret values. */
export interface ProviderAvailability {
  provider: string;
  available: boolean;
  configured?: boolean | undefined;
  reasonCode?: IntelligenceModuleReasonCode | undefined;
  reason?: string | undefined;
}

export function isIntelligenceModuleState(value: unknown): value is IntelligenceModuleState {
  return typeof value === 'string' && (INTELLIGENCE_MODULE_STATES as readonly string[]).includes(value);
}

export function isIntelligenceModuleReasonCode(value: unknown): value is IntelligenceModuleReasonCode {
  return typeof value === 'string' && (INTELLIGENCE_MODULE_REASON_CODES as readonly string[]).includes(value);
}

export function isIntelligenceExecutionMode(value: unknown): value is IntelligenceExecutionMode {
  return typeof value === 'string' && (INTELLIGENCE_EXECUTION_MODES as readonly string[]).includes(value);
}

export function isIntelligenceModuleRequirementType(value: unknown): value is IntelligenceModuleRequirementType {
  return typeof value === 'string' && (INTELLIGENCE_MODULE_REQUIREMENT_TYPES as readonly string[]).includes(value);
}

export function isTerminalIntelligenceModuleState(state: IntelligenceModuleState): boolean {
  return ['COMPLETED', 'PARTIAL', 'BLOCKED', 'UNAVAILABLE', 'FAILED', 'SKIPPED', 'STALE'].includes(state);
}

export function isActiveIntelligenceModuleState(state: IntelligenceModuleState): boolean {
  return state === 'QUEUED' || state === 'RUNNING';
}

/** A successful run may have no qualifying evidence and still be completed. */
export function isNoEvidenceCompletion(summary: IntelligenceModuleExecutionSummary): boolean {
  return summary.reasonCode === 'NO_EVIDENCE' && ['COMPLETED', 'PARTIAL'].includes(summary.state);
}

/**
 * Lightweight semantic validation, not a transition engine. It flags only
 * contradictory summaries; callers decide how to display or handle warnings.
 */
export function validateIntelligenceModuleExecutionSummary(
  summary: IntelligenceModuleExecutionSummary,
): string[] {
  const issues: string[] = [];
  const hasReason = Boolean(summary.reasonCode || summary.reason);

  if (['FAILED', 'BLOCKED', 'UNAVAILABLE', 'SKIPPED', 'STALE'].includes(summary.state) && !hasReason) {
    issues.push(`${summary.state} summaries should include a reason or reason code.`);
  }
  if (summary.state === 'COMPLETED' && isFailureReason(summary.reasonCode)) {
    issues.push('COMPLETED summaries cannot use a failure reason code.');
  }
  if (summary.reasonCode === 'NO_EVIDENCE' && !['COMPLETED', 'PARTIAL'].includes(summary.state)) {
    issues.push('NO_EVIDENCE is valid only for completed or partial output.');
  }
  if (summary.state === 'PARTIAL' && summary.partial === false) {
    issues.push('PARTIAL summaries cannot explicitly set partial to false.');
  }
  if (summary.state !== 'PARTIAL' && summary.partial === true) {
    issues.push('Only PARTIAL summaries can explicitly set partial to true.');
  }
  if (summary.durationMs !== undefined && summary.durationMs < 0) {
    issues.push('durationMs cannot be negative.');
  }
  if (summary.retryCount !== undefined && summary.retryCount < 0) {
    issues.push('retryCount cannot be negative.');
  }

  return issues;
}

function isFailureReason(code: IntelligenceModuleReasonCode | undefined): boolean {
  return code !== undefined && [
    'DEPENDENCY_FAILED',
    'PROVIDER_ERROR',
    'RATE_LIMITED',
    'TIMEOUT',
    'AUTHORIZATION_FAILED',
    'CONFIGURATION_ERROR',
    'EXECUTION_FAILED',
  ].includes(code);
}
