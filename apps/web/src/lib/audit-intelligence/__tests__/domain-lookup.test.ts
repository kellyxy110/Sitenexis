import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeDomainInput } from '../domain-lookup';

const h = vi.hoisted(() => ({
  getLatestUsableAuditForDomainOps: vi.fn(),
}));

vi.mock('@sitenexis/db', () => ({
  getLatestUsableAuditForDomainOps: h.getLatestUsableAuditForDomainOps,
}));

const { resolveAuditForDomain } = await import('../domain-lookup');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('normalizeDomainInput', () => {
  it('strips protocol and trailing path', () => {
    expect(normalizeDomainInput('https://www.truvyx.org/')).toBe('www.truvyx.org');
    expect(normalizeDomainInput('http://truvyx.org/some/path')).toBe('truvyx.org');
  });

  it('lowercases and trims', () => {
    expect(normalizeDomainInput('  TruVyx.ORG  ')).toBe('truvyx.org');
  });

  it('returns null for empty input', () => {
    expect(normalizeDomainInput('')).toBeNull();
    expect(normalizeDomainInput('   ')).toBeNull();
  });
});

const completeAudit = { id: 'a1', domain: 'truvyx.org', status: 'complete' as const, createdAt: new Date(), completedAt: new Date() };

describe('resolveAuditForDomain', () => {
  it('resolves a plain domain to its completed audit', async () => {
    h.getLatestUsableAuditForDomainOps.mockResolvedValue({ audit: completeAudit, isPartial: false, latestAny: { status: 'complete', createdAt: new Date() } });

    const result = await resolveAuditForDomain('truvyx.org');

    expect(result?.audit?.id).toBe('a1');
    expect(result?.isPartial).toBe(false);
    expect(h.getLatestUsableAuditForDomainOps).toHaveBeenCalledTimes(1);
  });

  it('resolves a URL-form domain the same way', async () => {
    h.getLatestUsableAuditForDomainOps.mockResolvedValue({ audit: completeAudit, isPartial: false, latestAny: { status: 'complete', createdAt: new Date() } });

    const result = await resolveAuditForDomain('https://truvyx.org/');

    expect(result?.domain).toBe('truvyx.org');
    expect(result?.audit?.id).toBe('a1');
  });

  it('falls back to the www-toggled domain when the exact form has no history', async () => {
    h.getLatestUsableAuditForDomainOps
      .mockResolvedValueOnce({ audit: null, isPartial: false, latestAny: null })
      .mockResolvedValueOnce({ audit: completeAudit, isPartial: false, latestAny: { status: 'complete', createdAt: new Date() } });

    const result = await resolveAuditForDomain('https://www.truvyx.org/');

    expect(h.getLatestUsableAuditForDomainOps).toHaveBeenCalledTimes(2);
    expect(h.getLatestUsableAuditForDomainOps).toHaveBeenNthCalledWith(1, 'www.truvyx.org');
    expect(h.getLatestUsableAuditForDomainOps).toHaveBeenNthCalledWith(2, 'truvyx.org');
    expect(result?.audit?.id).toBe('a1');
  });

  it('does not fall back when the exact domain has any audit history at all (even non-usable)', async () => {
    h.getLatestUsableAuditForDomainOps.mockResolvedValue({ audit: null, isPartial: false, latestAny: { status: 'running', createdAt: new Date() } });

    const result = await resolveAuditForDomain('truvyx.org');

    expect(h.getLatestUsableAuditForDomainOps).toHaveBeenCalledTimes(1);
    expect(result?.audit).toBeNull();
    expect(result?.latestAnyStatus).toBe('running');
    expect(result?.hadAnyAuditHistory).toBe(true);
  });

  it('reports no audit history at all when neither form has ever been audited', async () => {
    h.getLatestUsableAuditForDomainOps.mockResolvedValue({ audit: null, isPartial: false, latestAny: null });

    const result = await resolveAuditForDomain('never-audited.example');

    expect(result?.hadAnyAuditHistory).toBe(false);
  });

  it('returns null for an empty domain without querying the database', async () => {
    const result = await resolveAuditForDomain('   ');
    expect(result).toBeNull();
    expect(h.getLatestUsableAuditForDomainOps).not.toHaveBeenCalled();
  });

  it('surfaces partial-audit fallback semantics from the query layer', async () => {
    const partialAudit = { ...completeAudit, status: 'partial' as const };
    h.getLatestUsableAuditForDomainOps.mockResolvedValue({ audit: partialAudit, isPartial: true, latestAny: { status: 'partial', createdAt: new Date() } });

    const result = await resolveAuditForDomain('truvyx.org');

    expect(result?.isPartial).toBe(true);
    expect(result?.audit?.status).toBe('partial');
  });
});
