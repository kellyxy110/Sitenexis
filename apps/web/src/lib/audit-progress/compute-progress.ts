import type { AuditAgentState } from '@sitenexis/shared';
import type { AuditProgressInput, AuditProgressState, ModuleState, ModuleStatus } from './types';
import { PROGRESS_PHASES, TOTAL_WEIGHT, moduleLabel } from './stages';
import { estimateRemaining } from './estimate-remaining';

const MAX_LIVE_CRAWL_PAGES = 50; // mirrors serverless-audit.ts MAX_PAGES — a real system constant, not a guess

function moduleStateFromAgent(state: AuditAgentState | undefined): ModuleState {
  if (!state) return 'WAITING';
  switch (state.status) {
    case 'completed': return 'COMPLETE';
    case 'partial': return 'PARTIAL';
    case 'failed': return 'FAILED';
    case 'not_configured':
    case 'not_applicable':
    case 'no_data':
      return 'UNAVAILABLE';
    case 'running': return 'ACTIVE';
    case 'pending':
    default:
      return 'WAITING';
  }
}

function isTerminal(state: ModuleState): boolean {
  return state !== 'WAITING' && state !== 'ACTIVE';
}

function toModuleStatus(agentId: string, state: AuditAgentState | undefined): ModuleStatus {
  return {
    id: agentId,
    label: moduleLabel(agentId),
    state: moduleStateFromAgent(state),
    detail: state?.keyOutput ?? state?.failureReason ?? null,
  };
}

/**
 * Progress within one phase, from real agent-count ratios only. A phase that
 * hasn't started reports 0. A phase with SOME terminal agents (or any running)
 * gets a floor so the bar visibly moves, but is never allowed to imply more
 * precision than "some fraction of N agents finished."
 */
function phaseFraction(agentKeys: string[], manifestAgents: Record<string, AuditAgentState>): number {
  if (agentKeys.length === 0) return 0;
  const states = agentKeys.map((k) => moduleStateFromAgent(manifestAgents[k]));
  const terminalCount = states.filter(isTerminal).length;
  if (terminalCount === agentKeys.length) return 1;
  const anyStarted = states.some((s) => s === 'ACTIVE' || isTerminal(s));
  if (!anyStarted) return 0;
  return 0.15 + 0.85 * (terminalCount / agentKeys.length);
}

export function computeAuditProgress(input: AuditProgressInput): AuditProgressState {
  const limitations: string[] = [];
  const elapsedMs = Math.max(0, (input.completedAtMs ?? input.nowMs) - input.startedAtMs);
  const manifestAgents = input.agentManifest?.agents ?? {};

  // ── Terminal states short-circuit to a stable, final contract ────────────
  if (input.auditStatus === 'failed') {
    return {
      auditId: input.auditId,
      executionMode: input.executionMode,
      stage: 'FAILED',
      currentActivity: input.errorMessage ?? 'The audit failed.',
      currentUrl: null,
      pagesDiscovered: input.pagesDiscovered,
      pagesFetched: input.pagesFetched,
      pagesRendered: input.pagesRendered,
      pagesAnalysed: null,
      pagesFailed: input.pagesFailed,
      activeModules: [],
      completedModules: [],
      unavailableModules: [],
      elapsedMs,
      estimatedRemainingLabel: '',
      progress: 0,
      errorMessage: input.errorMessage,
      limitations,
    };
  }

  const allAgentKeys = PROGRESS_PHASES.flatMap((p) => p.agentKeys);
  const activeModules: ModuleStatus[] = [];
  const completedModules: ModuleStatus[] = [];
  const unavailableModules: ModuleStatus[] = [];
  for (const agentId of allAgentKeys) {
    const status = toModuleStatus(agentId, manifestAgents[agentId]);
    if (status.state === 'ACTIVE') activeModules.push(status);
    else if (status.state === 'COMPLETE' || status.state === 'PARTIAL' || status.state === 'FAILED') completedModules.push(status);
    else if (status.state === 'UNAVAILABLE') unavailableModules.push(status);
  }

  const isFinished = input.auditStatus === 'complete' || input.auditStatus === 'partial';

  let cumulative = 0;
  let currentPhase = PROGRESS_PHASES[PROGRESS_PHASES.length - 1]!;
  for (const phase of PROGRESS_PHASES) {
    const fraction = phaseFraction(phase.agentKeys, manifestAgents);
    cumulative += phase.weight * fraction;
    if (fraction < 1 && !isFinished) {
      currentPhase = phase;
      break;
    }
  }

  const rawProgress = isFinished ? 100 : Math.min(99, Math.round((cumulative / TOTAL_WEIGHT) * 100));

  // ── Live crawl page counters (real, capped by MAX_PAGES) ──────────────────
  if (input.pagesFetched == null && !isFinished) {
    limitations.push('Live page counts are not yet available during the crawl phase for this run.');
  }
  if (input.pagesRendered == null) {
    limitations.push('Rendered-page (headless fallback) counts are only known after the audit completes.');
  }
  limitations.push('Discovery/Crawl and Extraction/SEO are reported as combined phases — the underlying agents do not expose separate sub-stage timing.');
  limitations.push('AI Visibility, governance, and Scout run concurrently, not sequentially — their individual completion is shown per-module, not as a single percentage.');

  const currentActivity = isFinished
    ? input.auditStatus === 'partial'
      ? 'Audit completed with partial results — some modules could not finish.'
      : 'Audit complete.'
    : currentPhase.activityLabel;

  let stage = currentPhase.id;
  if (isFinished) stage = input.auditStatus === 'partial' ? 'PARTIAL' : 'COMPLETED';
  // Prefer a more specific label when a single concurrent module dominates the active set.
  if (!isFinished && currentPhase.id === 'ANALYSING_AI_VISIBILITY') {
    const activeIds = new Set(activeModules.map((m) => m.id));
    if (activeIds.has('scout') && activeIds.size === 1) stage = 'RUNNING_SCOUT';
    else if (activeIds.has('ai-governance') && activeIds.size === 1) stage = 'ANALYSING_GOVERNANCE';
  }
  if (!isFinished && currentPhase.id === 'GENERATING_REPORT') stage = 'BUILDING_INTELLIGENCE';

  return {
    auditId: input.auditId,
    executionMode: input.executionMode,
    stage,
    currentActivity,
    currentUrl: null, // no per-URL signal is exposed by the current crawl/analysis pipeline
    pagesDiscovered: input.pagesDiscovered,
    pagesFetched: input.pagesFetched != null ? Math.min(input.pagesFetched, MAX_LIVE_CRAWL_PAGES) : null,
    pagesRendered: input.pagesRendered,
    pagesAnalysed: isFinished ? input.pagesFetched : null,
    pagesFailed: input.pagesFailed,
    activeModules,
    completedModules,
    unavailableModules,
    elapsedMs,
    estimatedRemainingLabel: isFinished ? '' : estimateRemaining({
      elapsedMs,
      progress: rawProgress,
    }),
    progress: rawProgress,
    errorMessage: null,
    limitations: [...new Set(limitations)],
  };
}
