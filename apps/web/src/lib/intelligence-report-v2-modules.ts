import {
  AGENT_RESULT_STATUSES,
  normalizeCitationIntelligenceModuleState,
  normalizeLegacyModuleState,
  normalizeScoutModuleState,
  type AgentResultStatus,
  type IntelligenceModuleExecutionSummary,
  type ProviderAvailability,
  type ScoutAnalysisResult,
} from '@sitenexis/shared';

/**
 * Read-time module/provider derivation for Intelligence Report v2. Pure and
 * DB-free: the caller supplies whatever it already fetched from storage
 * (agentManifest JSON, the AIVisibilityScore.citationProbabilityScore column,
 * an already-fetched ScoutAnalysis row). This never infers a module's outcome
 * from an absent record — an agent with no manifest entry produces no module
 * summary at all, not a fabricated failure/unavailable claim.
 */

interface RawAuditAgentState {
  agent?: unknown;
  status?: unknown;
  startedAt?: unknown;
  finishedAt?: unknown;
  durationMs?: unknown;
  retryCount?: unknown;
  keyOutput?: unknown;
  failureReason?: unknown;
}

export interface RawAgentManifestLike {
  agents?: Record<string, RawAuditAgentState> | undefined;
}

export interface DeriveModuleAndProviderStateInput {
  agentManifest?: RawAgentManifestLike | null | undefined;
  /** Already-stored AIVisibilityScore.citationProbabilityScore, if the audit has one. */
  citationProbabilityScore?: number | null | undefined;
  /** Already-fetched ScoutAnalysis row for this audit, if one exists. */
  scoutAnalysis?: ScoutAnalysisResult | null | undefined;
}

export interface ModuleAndProviderState {
  modules: IntelligenceModuleExecutionSummary[];
  providers: ProviderAvailability[];
}

const AGENT_RESULT_STATUS_SET = new Set<string>(AGENT_RESULT_STATUSES);

function isAgentResultStatus(value: unknown): value is AgentResultStatus {
  return typeof value === 'string' && AGENT_RESULT_STATUS_SET.has(value);
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function deriveModuleAndProviderState(input: DeriveModuleAndProviderStateInput): ModuleAndProviderState {
  const agents = input.agentManifest?.agents ?? {};
  const modules: IntelligenceModuleExecutionSummary[] = [];
  const providers: ProviderAvailability[] = [];

  for (const [agentId, state] of Object.entries(agents)) {
    if (!isAgentResultStatus(state?.status)) continue;
    const status = state.status;
    const startedAt = stringOrUndefined(state.startedAt);
    const finishedAt = stringOrUndefined(state.finishedAt);
    const durationMs = numberOrUndefined(state.durationMs);
    const retryCount = numberOrUndefined(state.retryCount);

    if (agentId === 'scout') {
      modules.push(normalizeScoutModuleState(input.scoutAnalysis ?? undefined, { startedAt, retryCount }));
    } else if (agentId === 'citation') {
      modules.push(normalizeCitationIntelligenceModuleState({
        status,
        ...(input.citationProbabilityScore == null ? {} : { scores: { citationProbabilityScore: input.citationProbabilityScore } }),
      }, { startedAt, retryCount }));
    } else {
      modules.push(normalizeLegacyModuleState({
        moduleId: agentId,
        output: { status },
        startedAt,
        completedAt: finishedAt,
        durationMs,
        retryCount,
      }));
    }

    // Three distinct AgentResultStatus values each represent a genuine
    // provider/evidence gap, and were previously conflated or silently
    // dropped — 'no_data' (e.g. information-gain without SERPER_API_KEY) and
    // 'failed' (e.g. a live analysis call that errored) are just as real a
    // provider-unavailability signal as 'not_configured', just for a
    // different reason. Each keeps its own reasonCode so the report can
    // distinguish "never set up" from "ran and came back empty" from "broke".
    const keyOutput = stringOrUndefined(state.keyOutput);
    const failureReason = stringOrUndefined(state.failureReason);

    if (status === 'not_configured') {
      providers.push({
        provider: agentId,
        available: false,
        configured: false,
        reasonCode: 'MISSING_INTEGRATION',
        reason: keyOutput ?? failureReason ?? `The ${agentId} agent reported its provider or integration as not configured for this audit.`,
      });
    } else if (status === 'no_data') {
      providers.push({
        provider: agentId,
        available: false,
        configured: true,
        reasonCode: 'PROVIDER_ERROR',
        reason: keyOutput ?? failureReason ?? `The ${agentId} agent completed without producing usable data for this audit.`,
      });
    } else if (status === 'failed') {
      providers.push({
        provider: agentId,
        available: false,
        configured: true,
        reasonCode: 'EXECUTION_FAILED',
        reason: failureReason ?? keyOutput ?? `The ${agentId} agent failed to execute for this audit.`,
      });
    }
  }

  return { modules, providers };
}
