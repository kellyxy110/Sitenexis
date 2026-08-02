'use client';

import type { PhaseTimelineEntry } from '@/lib/audit-progress';
import { PHASE_STATUS_ICON as STATUS_ICON, PHASE_STATUS_COLOR as STATUS_COLOR, PHASE_STATUS_TEXT as STATUS_TEXT } from './phase-status-styles';

function moduleStatusIcon(state: string): string {
  switch (state) {
    case 'COMPLETE': return '✓';
    case 'ACTIVE': return '●';
    case 'PARTIAL': return '◐';
    case 'FAILED': return '✕';
    case 'UNAVAILABLE': return '—';
    case 'SKIPPED': return '—';
    default: return '○';
  }
}

/**
 * ✓/●/○ stage list. Status is always conveyed by an icon + text label
 * together, never color alone. Phases with concurrently-running agents show
 * their real per-module breakdown as a nested row, rather than collapsing
 * genuinely parallel work into one fake percentage.
 */
export function AuditStageTimeline({ phases }: { phases: PhaseTimelineEntry[] }) {
  return (
    <ol className="relative z-10 mt-6 w-full max-w-lg space-y-1.5">
      {phases.map((phase) => (
        <li key={phase.id} className="rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2">
          <div className="flex items-center gap-2.5">
            <span className={`w-4 text-center text-sm font-bold ${STATUS_COLOR[phase.status]}`} aria-hidden>
              {STATUS_ICON[phase.status]}
            </span>
            <span className={`flex-1 text-sm ${phase.status === 'WAITING' ? 'text-slate-600' : 'text-white'}`}>
              {phase.label}
            </span>
            <span className={`text-[10px] font-medium uppercase tracking-wider ${STATUS_COLOR[phase.status]}`}>
              {STATUS_TEXT[phase.status]}
            </span>
          </div>

          {phase.modules.length > 0 && phase.status !== 'WAITING' && (
            <div className="ml-6 mt-1.5 flex flex-wrap gap-1.5" aria-label={`${phase.label} — concurrent modules`}>
              {phase.modules.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[10px] text-slate-400"
                  title={m.detail ?? undefined}
                >
                  <span aria-hidden>{moduleStatusIcon(m.state)}</span>
                  {m.label}
                </span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
