import { describe, it, expect } from 'vitest';
import { resolveFirstAudit } from '../website-memory';

describe('resolveFirstAudit', () => {
  it('initializes WebsiteMemory on first processing (no existing record)', () => {
    const result = resolveFirstAudit(null, { auditId: 'audit-august', auditAt: '2026-08-01T00:00:00.000Z' });
    expect(result).toEqual({ firstAuditId: 'audit-august', firstAuditAt: '2026-08-01T00:00:00.000Z', changed: true });
  });

  it('a later-discovered older audit (June) replaces an already-initialized August firstAuditId', () => {
    const august = resolveFirstAudit(null, { auditId: 'audit-august', auditAt: '2026-08-01T00:00:00.000Z' });
    const june = resolveFirstAudit(
      { auditId: august.firstAuditId, auditAt: august.firstAuditAt },
      { auditId: 'audit-june', auditAt: '2026-06-01T00:00:00.000Z' },
    );
    expect(june).toEqual({ firstAuditId: 'audit-june', firstAuditAt: '2026-06-01T00:00:00.000Z', changed: true });
  });

  it('a newer candidate never overwrites an existing earlier firstAuditId', () => {
    const result = resolveFirstAudit(
      { auditId: 'audit-june', auditAt: '2026-06-01T00:00:00.000Z' },
      { auditId: 'audit-september', auditAt: '2026-09-01T00:00:00.000Z' },
    );
    expect(result).toEqual({ firstAuditId: 'audit-june', firstAuditAt: '2026-06-01T00:00:00.000Z', changed: false });
  });

  it('reprocessing the same audit that is already firstAuditId is idempotent (changed: false)', () => {
    const result = resolveFirstAudit(
      { auditId: 'audit-june', auditAt: '2026-06-01T00:00:00.000Z' },
      { auditId: 'audit-june', auditAt: '2026-06-01T00:00:00.000Z' },
    );
    expect(result).toEqual({ firstAuditId: 'audit-june', firstAuditAt: '2026-06-01T00:00:00.000Z', changed: false });
  });

  it('result is independent of call order — resolving June-then-August or August-then-June converges to the same firstAuditId', () => {
    // June first, then August discovered later.
    const juneFirst = resolveFirstAudit(null, { auditId: 'audit-june', auditAt: '2026-06-01T00:00:00.000Z' });
    const juneThenAugust = resolveFirstAudit(
      { auditId: juneFirst.firstAuditId, auditAt: juneFirst.firstAuditAt },
      { auditId: 'audit-august', auditAt: '2026-08-01T00:00:00.000Z' },
    );

    // August first, then June discovered later (the scenario from the spec).
    const augustFirst = resolveFirstAudit(null, { auditId: 'audit-august', auditAt: '2026-08-01T00:00:00.000Z' });
    const augustThenJune = resolveFirstAudit(
      { auditId: augustFirst.firstAuditId, auditAt: augustFirst.firstAuditAt },
      { auditId: 'audit-june', auditAt: '2026-06-01T00:00:00.000Z' },
    );

    expect(juneThenAugust.firstAuditId).toBe('audit-june');
    expect(augustThenJune.firstAuditId).toBe('audit-june');
    expect(juneThenAugust.firstAuditId).toBe(augustThenJune.firstAuditId);
  });
});
