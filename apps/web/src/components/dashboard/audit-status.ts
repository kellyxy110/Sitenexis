export const AUDIT_STATUS_CONFIG = {
  queued:   { label: 'Queued',      dot: 'bg-[#3A5568]',               badge: 'text-[#4A6280] bg-white/5' },
  running:  { label: 'Running',     dot: 'bg-blue-400 animate-pulse',  badge: 'text-blue-400 bg-blue-500/10' },
  partial:  { label: 'Partial',     dot: 'bg-amber-400',               badge: 'text-amber-400 bg-amber-500/10' },
  complete: { label: 'Complete',    dot: 'bg-teal-400',                badge: 'text-teal-400 bg-teal-500/10' },
  failed:   { label: 'Failed',      dot: 'bg-red-400',                  badge: 'text-red-400 bg-red-500/10' },
  unknown:  { label: 'Unavailable', dot: 'bg-slate-500',               badge: 'text-slate-400 bg-slate-500/10' },
} as const;

export type KnownAuditStatus = keyof typeof AUDIT_STATUS_CONFIG;

export function getAuditStatusConfig(status: unknown) {
  if (typeof status === 'string' && Object.prototype.hasOwnProperty.call(AUDIT_STATUS_CONFIG, status)) {
    return { status: status as KnownAuditStatus, config: AUDIT_STATUS_CONFIG[status as KnownAuditStatus] };
  }
  return { status: 'unknown' as const, config: AUDIT_STATUS_CONFIG.unknown };
}