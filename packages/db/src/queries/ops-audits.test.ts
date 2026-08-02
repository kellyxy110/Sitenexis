import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  findMany: vi.fn(),
  groupBy: vi.fn(),
}));

vi.mock('../client', () => ({
  db: {
    audit: { findMany: h.findMany, groupBy: h.groupBy },
  },
}));

import {
  listRecentAuditsForOps,
  listAuditsByStatusForOps,
  listStalledAuditsForOps,
  countAuditsByStatusSince,
} from './audits';

beforeEach(() => {
  vi.clearAllMocks();
  h.findMany.mockResolvedValue([]);
  h.groupBy.mockResolvedValue([]);
});

describe('listRecentAuditsForOps', () => {
  it('excludes demo audits and archived audits, ordered by newest first', async () => {
    await listRecentAuditsForOps(10);

    const args = h.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ archivedAt: null, isDemo: false });
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
    expect(args.take).toBe(10);
  });
});

describe('listAuditsByStatusForOps', () => {
  it('filters by the given statuses and a since date', async () => {
    const since = new Date('2026-01-01');
    await listAuditsByStatusForOps(['failed', 'partial'], since, 15);

    const args = h.findMany.mock.calls[0][0];
    expect(args.where.status).toEqual({ in: ['failed', 'partial'] });
    expect(args.where.createdAt).toEqual({ gte: since });
    expect(args.take).toBe(15);
  });
});

describe('listStalledAuditsForOps', () => {
  it('queries for running audits not updated within the stale window', async () => {
    await listStalledAuditsForOps(20);

    const args = h.findMany.mock.calls[0][0];
    expect(args.where.status).toBe('running');
    expect(args.where.updatedAt.lt).toBeInstanceOf(Date);
    expect(args.orderBy).toEqual({ updatedAt: 'asc' });
  });
});

describe('countAuditsByStatusSince', () => {
  it('fills in zero for statuses with no rows in the grouped result', async () => {
    h.groupBy.mockResolvedValue([{ status: 'complete', _count: { _all: 4 } }]);

    const result = await countAuditsByStatusSince(new Date());

    expect(result).toEqual({ queued: 0, running: 0, partial: 0, complete: 4, failed: 0 });
  });
});
