import { describe, it, expect } from 'vitest';
import { canonicalAuditTimestamp, findPreviousUsableAudit } from '../audit-history';

describe('canonicalAuditTimestamp', () => {
  it('prefers completedAt when present', () => {
    const t = canonicalAuditTimestamp({ id: 'a', completedAt: '2026-08-01T00:00:00.000Z', createdAt: '2026-07-01T00:00:00.000Z' });
    expect(new Date(t).toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('falls back to createdAt when completedAt is null', () => {
    const t = canonicalAuditTimestamp({ id: 'a', completedAt: null, createdAt: '2026-07-01T00:00:00.000Z' });
    expect(new Date(t).toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });
});

describe('findPreviousUsableAudit', () => {
  const audits = [
    { id: 'a1', completedAt: '2026-06-01T00:00:00.000Z', createdAt: '2026-06-01T00:00:00.000Z' },
    { id: 'a2', completedAt: '2026-07-01T00:00:00.000Z', createdAt: '2026-07-01T00:00:00.000Z' },
    { id: 'a3', completedAt: '2026-08-01T00:00:00.000Z', createdAt: '2026-08-01T00:00:00.000Z' },
  ];

  it('returns null for the first audit (no earlier candidate)', () => {
    expect(findPreviousUsableAudit(audits, 'a1')).toBeNull();
  });

  it('returns the immediately preceding audit for the second audit', () => {
    expect(findPreviousUsableAudit(audits, 'a2')?.id).toBe('a1');
  });

  it('returns the most recent earlier audit, not just any earlier one', () => {
    expect(findPreviousUsableAudit(audits, 'a3')?.id).toBe('a2');
  });

  it('returns null when the current audit id is not in the candidate list', () => {
    expect(findPreviousUsableAudit(audits, 'unknown')).toBeNull();
  });

  it('is unaffected by input order', () => {
    const shuffled = [audits[2]!, audits[0]!, audits[1]!];
    expect(findPreviousUsableAudit(shuffled, 'a3')?.id).toBe('a2');
  });
});
