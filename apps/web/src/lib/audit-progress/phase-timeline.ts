/**
 * Projects AuditProgressState into a per-phase timeline — the ✓/●/○ list the
 * spec calls for. Phases that bundle multiple concurrently-running agents
 * (e.g. AI Visibility) expose their real per-module breakdown so the UI can
 * show them as visibly parallel, never a single fabricated percentage.
 */

import { PROGRESS_PHASES } from './stages';
import type { AuditProgressState, ModuleStatus } from './types';

export type PhaseTimelineStatus = 'COMPLETE' | 'ACTIVE' | 'WAITING' | 'PARTIAL' | 'FAILED';

export interface PhaseTimelineEntry {
  id: string;
  label: string;
  status: PhaseTimelineStatus;
  /** Only populated for phases with more than one concurrently-running agent. */
  modules: ModuleStatus[];
}

function waitingModule(id: string): ModuleStatus {
  return { id, label: id, state: 'WAITING', detail: null };
}

export function derivePhaseTimeline(state: AuditProgressState): PhaseTimelineEntry[] {
  const known = new Map<string, ModuleStatus>();
  for (const m of [...state.activeModules, ...state.completedModules, ...state.unavailableModules]) {
    known.set(m.id, m);
  }

  return PROGRESS_PHASES.map((phase) => {
    const modules = phase.agentKeys.map((id) => known.get(id) ?? waitingModule(id));

    const hasFailed = modules.some((m) => m.state === 'FAILED');
    const hasPartial = modules.some((m) => m.state === 'PARTIAL');
    const allSettled = modules.every((m) =>
      m.state === 'COMPLETE' || m.state === 'PARTIAL' || m.state === 'FAILED' || m.state === 'UNAVAILABLE',
    );
    const anyStarted = modules.some((m) => m.state !== 'WAITING');

    let status: PhaseTimelineStatus;
    if (allSettled) status = hasFailed ? 'FAILED' : hasPartial ? 'PARTIAL' : 'COMPLETE';
    else if (anyStarted) status = 'ACTIVE';
    else status = 'WAITING';

    return {
      id: phase.id,
      label: phase.label,
      status,
      modules: phase.agentKeys.length > 1 ? modules : [],
    };
  });
}
