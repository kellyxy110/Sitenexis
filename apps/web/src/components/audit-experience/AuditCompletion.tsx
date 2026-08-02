'use client';

import type { PhaseTimelineEntry } from '@/lib/audit-progress';
import { PHASE_STATUS_ICON, PHASE_STATUS_COLOR } from './phase-status-styles';

interface AuditCompletionProps {
  partial: boolean;
  pagesAnalysed: number | null;
  phases: PhaseTimelineEntry[];
  reducedMotion: boolean;
}

/**
 * Deliberate completion transition — never an abrupt swap to the report.
 * Every checklist line reflects a real phase status from the progress
 * engine; a phase that never actually finished (e.g. the audit ended early)
 * shows its true state rather than being marked complete for effect.
 */
export function AuditCompletion({ partial, pagesAnalysed, phases, reducedMotion }: AuditCompletionProps) {
  return (
    <div className="relative z-10 flex flex-col items-center text-center">
      <div className={`mb-2 flex h-16 w-16 items-center justify-center rounded-full ${partial ? 'bg-amber-500/10' : 'bg-green-500/10'}`}>
        <span className={`text-3xl ${partial ? 'text-amber-400' : 'text-green-400'}`} aria-hidden>
          {partial ? '◐' : '✓'}
        </span>
      </div>

      <h2 className="text-xl font-bold tracking-tight text-white">
        {partial ? 'Audit Complete — Partial Results' : 'Audit Complete'}
      </h2>
      {pagesAnalysed != null && (
        <p className="mt-1 text-sm text-slate-400">{pagesAnalysed} Pages Analysed</p>
      )}

      <ul className="mt-5 w-full max-w-xs space-y-1.5 text-left">
        {phases.map((phase) => (
          <li key={phase.id} className="flex items-center gap-2 text-sm">
            <span className={`w-4 text-center font-bold ${PHASE_STATUS_COLOR[phase.status]}`} aria-hidden>
              {PHASE_STATUS_ICON[phase.status]}
            </span>
            <span className={phase.status === 'WAITING' ? 'text-slate-600' : 'text-slate-300'}>{phase.label}</span>
          </li>
        ))}
      </ul>

      <p className="mt-6 flex items-center gap-2 text-xs text-slate-500">
        {!reducedMotion && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan" />
          </span>
        )}
        Preparing your Intelligence Dashboard…
      </p>
    </div>
  );
}
