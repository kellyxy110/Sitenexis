import type { OperationalEvent, OperationalEventType, OperationalEventSeverity, RoutingDecision } from './types';

/**
 * One deterministic policy table — the only place severity/notify/dedupe-window
 * decisions live. Pure: same event type always routes the same way.
 */
const POLICY: Record<OperationalEventType, RoutingDecision> = {
  AUDIT_COMPLETE:          { severity: 'info',     shouldNotify: true, dedupeWindowSeconds: 300 },
  AUDIT_FAILED:            { severity: 'critical', shouldNotify: true, dedupeWindowSeconds: 300 },
  AUDIT_PARTIAL:           { severity: 'warning',  shouldNotify: true, dedupeWindowSeconds: 900 },
  AUDIT_STALLED:           { severity: 'warning',  shouldNotify: true, dedupeWindowSeconds: 900 },
  PROVIDER_DEGRADED:       { severity: 'warning',  shouldNotify: true, dedupeWindowSeconds: 1800 },
  WORKER_HEALTH_DEGRADED:  { severity: 'critical', shouldNotify: true, dedupeWindowSeconds: 1800 },
  DEPLOYMENT_READY:        { severity: 'info',     shouldNotify: true, dedupeWindowSeconds: 60 },
  DEPLOYMENT_ERROR:        { severity: 'critical', shouldNotify: true, dedupeWindowSeconds: 60 },
};

export function routeEvent(event: OperationalEvent): RoutingDecision {
  return POLICY[event.type];
}

export const SEVERITY_ICON: Record<OperationalEventSeverity, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  critical: '🔴',
};
