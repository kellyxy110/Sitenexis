import { describe, it, expect } from 'vitest';
import { routeEvent, SEVERITY_ICON } from '../routing-policy';
import { OPERATIONAL_EVENT_TYPES, type OperationalEvent } from '../types';

function eventOf(type: OperationalEvent['type']): OperationalEvent {
  return { type, summary: 'test', dedupeKey: 'k', occurredAt: new Date().toISOString() };
}

describe('routeEvent', () => {
  it('routes every declared event type to a decision — no gaps in the policy table', () => {
    for (const type of OPERATIONAL_EVENT_TYPES) {
      const decision = routeEvent(eventOf(type));
      expect(decision).toBeDefined();
      expect(['info', 'warning', 'critical']).toContain(decision.severity);
      expect(decision.dedupeWindowSeconds).toBeGreaterThan(0);
    }
  });

  it('marks AUDIT_FAILED and DEPLOYMENT_ERROR as critical', () => {
    expect(routeEvent(eventOf('AUDIT_FAILED')).severity).toBe('critical');
    expect(routeEvent(eventOf('DEPLOYMENT_ERROR')).severity).toBe('critical');
  });

  it('marks DEPLOYMENT_READY as info, not warning or critical', () => {
    expect(routeEvent(eventOf('DEPLOYMENT_READY')).severity).toBe('info');
  });

  it('every severity has an icon', () => {
    expect(SEVERITY_ICON.info).toBeTruthy();
    expect(SEVERITY_ICON.warning).toBeTruthy();
    expect(SEVERITY_ICON.critical).toBeTruthy();
  });
});
