/**
 * Operational event layer — the typed vocabulary every alert source (audit
 * runner, health checks, deploy webhook, ops-monitor cron) produces, and the
 * one shape the routing policy / dedup / Telegram provider all consume.
 * Nothing in this layer knows about Telegram, Redis, or HTTP.
 */

export const OPERATIONAL_EVENT_TYPES = [
  'AUDIT_FAILED',
  'AUDIT_PARTIAL',
  'AUDIT_STALLED',
  'PROVIDER_DEGRADED',
  'WORKER_HEALTH_DEGRADED',
  'DEPLOYMENT_READY',
  'DEPLOYMENT_ERROR',
] as const;
export type OperationalEventType = (typeof OPERATIONAL_EVENT_TYPES)[number];

export const OPERATIONAL_EVENT_SEVERITIES = ['info', 'warning', 'critical'] as const;
export type OperationalEventSeverity = (typeof OPERATIONAL_EVENT_SEVERITIES)[number];

export interface OperationalEvent {
  type: OperationalEventType;
  /** Human-readable one-line summary — never includes secrets or full page content. */
  summary: string;
  /** Additional real, already-known facts — never fabricated. */
  detail?: string | undefined;
  /** A stable key used to de-duplicate repeats of "the same" event within a window. */
  dedupeKey: string;
  occurredAt: string; // ISO timestamp
  metadata?: Record<string, string | number | boolean | null> | undefined;
}

export interface RoutingDecision {
  severity: OperationalEventSeverity;
  shouldNotify: boolean;
  /** How long a duplicate of this event (same dedupeKey) is suppressed for. */
  dedupeWindowSeconds: number;
}
