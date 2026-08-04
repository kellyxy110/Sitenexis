import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock('../client', () => ({
  db: {
    audit: { findFirst: h.findFirst, findMany: h.findMany },
  },
}));

import { getLatestUsableAuditForDomainAndUser, getLatestTwoCompleteAuditsForDomainAndUser } from './audits';

beforeEach(() => {
  vi.clearAllMocks();
  h.findFirst.mockResolvedValue(null);
  h.findMany.mockResolvedValue([]);
});

describe('getLatestUsableAuditForDomainAndUser', () => {
  it('scopes every lookup by userId — never a cross-user domain match', async () => {
    await getLatestUsableAuditForDomainAndUser('example.com', 'user-A');

    for (const call of h.findFirst.mock.calls) {
      expect(call[0].where.domain).toBe('example.com');
      expect(call[0].where.userId).toBe('user-A');
    }
    expect(h.findFirst).toHaveBeenCalledTimes(3);
  });

  it('prefers the completed audit over a partial one', async () => {
    const completed = { id: 'a-1', domain: 'example.com', status: 'complete', createdAt: new Date(), completedAt: new Date() };
    h.findFirst.mockImplementation((args: { where: { status?: string } }) =>
      args.where.status === 'complete' ? Promise.resolve(completed) : Promise.resolve(null),
    );

    const result = await getLatestUsableAuditForDomainAndUser('example.com', 'user-A');
    expect(result.audit).toEqual(completed);
    expect(result.isPartial).toBe(false);
  });

  it('falls back to a partial audit only when no completed audit exists', async () => {
    const partial = { id: 'a-2', domain: 'example.com', status: 'partial', createdAt: new Date(), completedAt: null };
    h.findFirst.mockImplementation((args: { where: { status?: string } }) =>
      args.where.status === 'partial' ? Promise.resolve(partial) : Promise.resolve(null),
    );

    const result = await getLatestUsableAuditForDomainAndUser('example.com', 'user-A');
    expect(result.audit).toEqual(partial);
    expect(result.isPartial).toBe(true);
  });

  it('reports the true latest status (queued/running/failed) when nothing usable exists', async () => {
    h.findFirst.mockImplementation((args: { where: { status?: string }; select?: { status?: boolean } }) =>
      args.select?.status && !args.where.status ? Promise.resolve({ status: 'running', createdAt: new Date() }) : Promise.resolve(null),
    );

    const result = await getLatestUsableAuditForDomainAndUser('example.com', 'user-A');
    expect(result.audit).toBeNull();
    expect(result.latestAny?.status).toBe('running');
  });
});

describe('getLatestTwoCompleteAuditsForDomainAndUser', () => {
  it('queries only complete, non-archived, non-null-completedAt audits scoped by user+domain, newest first', async () => {
    await getLatestTwoCompleteAuditsForDomainAndUser('example.com', 'user-A');

    const args = h.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      domain: 'example.com',
      userId: 'user-A',
      status: 'complete',
      archivedAt: null,
      completedAt: { not: null },
    });
    expect(args.orderBy).toEqual({ completedAt: 'desc' });
    expect(args.take).toBe(2);
  });

  it('never returns another user\'s audits for the same domain', async () => {
    h.findMany.mockResolvedValue([{ id: 'a-1', completedAt: new Date() }]);
    await getLatestTwoCompleteAuditsForDomainAndUser('shared-domain.com', 'user-A');
    expect(h.findMany.mock.calls[0][0].where.userId).toBe('user-A');
  });
});
