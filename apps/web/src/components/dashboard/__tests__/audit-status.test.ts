import { describe, expect, it } from 'vitest';
import { AUDIT_STATUS_CONFIG, getAuditStatusConfig } from '../audit-status';

describe('dashboard audit status configuration', () => {
  it.each(['queued', 'running', 'partial', 'complete', 'failed'])('keeps recognised status %s', (status) => {
    expect(getAuditStatusConfig(status).config.dot).toBe(AUDIT_STATUS_CONFIG[status as keyof typeof AUDIT_STATUS_CONFIG].dot);
  });

  it.each([undefined, null, '', 'legacy_status', 42])('uses truthful unavailable fallback for %s', (status) => {
    expect(getAuditStatusConfig(status).status).toBe('unknown');
    expect(getAuditStatusConfig(status).config.label).toBe('Unavailable');
  });
});