import type { PhaseTimelineStatus } from '@/lib/audit-progress';

/** Shared icon/color/text mapping for phase status — one source of truth for AuditStageTimeline and AuditCompletion. */
export const PHASE_STATUS_ICON: Record<PhaseTimelineStatus, string> = {
  COMPLETE: '✓',
  ACTIVE: '●',
  WAITING: '○',
  PARTIAL: '◐',
  FAILED: '✕',
};

export const PHASE_STATUS_COLOR: Record<PhaseTimelineStatus, string> = {
  COMPLETE: 'text-green-400',
  ACTIVE: 'text-cyan',
  WAITING: 'text-slate-700',
  PARTIAL: 'text-amber-400',
  FAILED: 'text-red-400',
};

export const PHASE_STATUS_TEXT: Record<PhaseTimelineStatus, string> = {
  COMPLETE: 'Complete',
  ACTIVE: 'In progress',
  WAITING: 'Waiting',
  PARTIAL: 'Partial',
  FAILED: 'Failed',
};
