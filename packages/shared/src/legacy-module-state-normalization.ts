import {
  type IntelligenceExecutionMode,
  type IntelligenceModuleExecutionSummary,
  type IntelligenceModuleReasonCode,
} from './intelligence-module-state';

export interface LegacyModuleNormalizationInput {
  moduleId: string;
  /** Existing module output only. The normalizer never fetches or writes it. */
  output?: Record<string, unknown> | null | undefined;
  moduleVersion?: string | undefined;
  executionMode?: IntelligenceExecutionMode | undefined;
  provider?: string | undefined;
  providerConfigured?: boolean | undefined;
  providerAvailable?: boolean | undefined;
  auditLayerEligible?: boolean | undefined;
  planEligible?: boolean | undefined;
  intentionallySkipped?: boolean | undefined;
  dependency?: 'failed' | 'incomplete' | 'unavailable' | undefined;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
  durationMs?: number | undefined;
  retryCount?: number | undefined;
}

/** Structural subset of the current Scout result. */
export interface LegacyScoutModuleResult {
  state?: 'complete' | 'partial' | 'empty' | undefined;
  timestamp?: string | undefined;
  pagesAnalyzed?: number | undefined;
  recommendations?: readonly unknown[] | undefined;
}

/** Structural subset of the current Citation Intelligence result. */
export interface LegacyCitationModuleResult {
  status?: 'pending' | 'running' | 'completed' | 'partial' | 'failed' | 'not_configured' | 'not_applicable' | 'no_data' | undefined;
  availabilityState?: 'available_with_evidence' | 'available_no_evidence' | 'partially_available' | 'unavailable' | 'failed' | undefined;
  providerState?: 'not_configured' | 'not_applicable' | 'available' | 'failed' | undefined;
  evidenceState?: 'evidence_found' | 'no_evidence_found' | undefined;
  generatedAt?: string | undefined;
  engineVersion?: string | undefined;
  signals?: readonly unknown[] | undefined;
  gaps?: readonly unknown[] | undefined;
  scores?: Record<string, number | null> | undefined;
}

/** Normalizes a Scout GTL result without treating an empty result as completion. */
export function normalizeScoutModuleState(
  result: LegacyScoutModuleResult | null | undefined,
  input: Omit<LegacyModuleNormalizationInput, 'moduleId' | 'output' | 'moduleVersion' | 'completedAt'> = {},
): IntelligenceModuleExecutionSummary {
  return normalizeLegacyModuleState({
    ...input,
    moduleId: 'scout',
    moduleVersion: undefined,
    completedAt: result?.timestamp,
    output: result ? { state: result.state } : undefined,
  }, {
    evidenceCount: result?.pagesAnalyzed,
    findingCount: result?.recommendations?.length,
  });
}

/** Preserves Citation Intelligence's explicit status, availability, and no-evidence signals. */
export function normalizeCitationIntelligenceModuleState(
  result: LegacyCitationModuleResult | null | undefined,
  input: Omit<LegacyModuleNormalizationInput, 'moduleId' | 'output' | 'moduleVersion' | 'completedAt'> = {},
): IntelligenceModuleExecutionSummary {
  const scoreAvailable = Object.values(result?.scores ?? {}).some((score) => score !== null);
  return normalizeLegacyModuleState({
    ...input,
    moduleId: 'citation-intelligence',
    moduleVersion: result?.engineVersion,
    completedAt: result?.generatedAt,
    output: result ? {
      status: result.status,
      availabilityState: result.availabilityState,
      providerState: result.providerState,
      evidenceState: result.evidenceState,
    } : undefined,
  }, {
    evidenceCount: result?.signals?.length,
    findingCount: result?.gaps?.length,
    scoreAvailable,
  });
}

/**
 * Generic adapter for existing report objects. It reads recognized state fields
 * only. A row or object with no reliable lifecycle signal is PARTIAL, not
 * COMPLETED, and is marked as an ambiguous legacy summary.
 */
export function normalizeLegacyModuleState(
  input: LegacyModuleNormalizationInput,
  metrics: Pick<IntelligenceModuleExecutionSummary, 'evidenceCount' | 'findingCount' | 'scoreAvailable'> = {},
): IntelligenceModuleExecutionSummary {
  const output = input.output;
  const explicitState = stringValue(output?.['state']);
  const explicitStatus = stringValue(output?.['status']);
  const availabilityState = stringValue(output?.['availabilityState']);
  const providerState = stringValue(output?.['providerState']);
  const evidenceState = stringValue(output?.['evidenceState']);
  const outputVersion = stringValue(output?.['version']) ?? stringValue(output?.['engineVersion']);

  const base = summaryBase(input, metrics, outputVersion);
  if (input.auditLayerEligible === false) return withState(base, 'INELIGIBLE', 'AUDIT_LAYER_TOO_LOW');
  if (input.planEligible === false) return withState(base, 'INELIGIBLE', 'PLAN_NOT_ELIGIBLE');
  if (input.intentionallySkipped) return withState(base, 'SKIPPED', 'EXECUTION_NOT_STARTED');
  if (input.dependency) return withState(base, 'BLOCKED', dependencyReason(input.dependency));
  if (input.providerConfigured === false) return withState(base, 'UNAVAILABLE', 'MISSING_CREDENTIAL');
  if (input.providerAvailable === false) return withState(base, 'UNAVAILABLE', 'PROVIDER_UNAVAILABLE');

  const statusSummary = statusState(base, explicitStatus, availabilityState, providerState, evidenceState);
  if (statusSummary) return statusSummary;
  const gtlSummary = gtlState(base, explicitState);
  if (gtlSummary) return gtlSummary;

  return {
    ...base,
    state: 'PARTIAL',
    reasonCode: 'EXECUTION_NOT_STARTED',
    metadata: { ...base.metadata, legacyStateAmbiguous: true },
  };
}

/** Normalizes only caller-supplied records. It performs no database access. */
export function normalizeLegacyModuleStates(
  inputs: readonly LegacyModuleNormalizationInput[],
): IntelligenceModuleExecutionSummary[] {
  return inputs.map((input) => normalizeLegacyModuleState(input));
}

function summaryBase(
  input: LegacyModuleNormalizationInput,
  metrics: Pick<IntelligenceModuleExecutionSummary, 'evidenceCount' | 'findingCount' | 'scoreAvailable'>,
  outputVersion: string | undefined,
): Omit<IntelligenceModuleExecutionSummary, 'state' | 'reasonCode'> {
  return {
    moduleId: input.moduleId,
    moduleVersion: input.moduleVersion ?? outputVersion,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    durationMs: input.durationMs,
    retryCount: input.retryCount,
    executionMode: input.executionMode,
    provider: input.provider,
    ...metrics,
    metadata: { normalizer: 'read-time-legacy-v1' },
  };
}

function statusState(
  base: Omit<IntelligenceModuleExecutionSummary, 'state' | 'reasonCode'>,
  status: string | undefined,
  availability: string | undefined,
  providerState: string | undefined,
  evidenceState: string | undefined,
): IntelligenceModuleExecutionSummary | undefined {
  if (!status) return undefined;
  if (status === 'pending') return withState(base, 'QUEUED');
  if (status === 'running') return withState(base, 'RUNNING');
  if (status === 'completed') return withState(base, 'COMPLETED', evidenceState === 'no_evidence_found' ? 'NO_EVIDENCE' : undefined);
  if (status === 'partial') return withState(base, 'PARTIAL', providerState === 'failed' ? 'PROVIDER_ERROR' : 'EXECUTION_PARTIAL');
  if (status === 'failed') return withState(base, 'FAILED', providerState === 'failed' ? 'PROVIDER_ERROR' : 'EXECUTION_FAILED');
  if (status === 'not_configured') return withState(base, 'UNAVAILABLE', 'MISSING_INTEGRATION');
  if (status === 'not_applicable') return withState(base, 'INELIGIBLE');
  if (status === 'no_data') {
    return availability === 'unavailable'
      ? withState(base, 'BLOCKED', 'DEPENDENCY_INCOMPLETE')
      : withState(base, 'PARTIAL', 'EXECUTION_NOT_STARTED');
  }
  return undefined;
}

function gtlState(
  base: Omit<IntelligenceModuleExecutionSummary, 'state' | 'reasonCode'>,
  state: string | undefined,
): IntelligenceModuleExecutionSummary | undefined {
  if (state === 'complete') return withState(base, 'COMPLETED');
  if (state === 'partial') return withState(base, 'PARTIAL', 'EXECUTION_PARTIAL');
  if (state === 'empty') return withState(base, 'PARTIAL', 'EXECUTION_NOT_STARTED');
  return undefined;
}

function withState(
  base: Omit<IntelligenceModuleExecutionSummary, 'state' | 'reasonCode'>,
  state: IntelligenceModuleExecutionSummary['state'],
  reasonCode?: IntelligenceModuleReasonCode,
): IntelligenceModuleExecutionSummary {
  return {
    ...base,
    state,
    ...(reasonCode ? { reasonCode } : {}),
    ...(state === 'PARTIAL' ? { partial: true } : {}),
  };
}

function dependencyReason(value: NonNullable<LegacyModuleNormalizationInput['dependency']>): IntelligenceModuleReasonCode {
  return value === 'failed' ? 'DEPENDENCY_FAILED'
    : value === 'incomplete' ? 'DEPENDENCY_INCOMPLETE'
      : 'DEPENDENCY_UNAVAILABLE';
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
