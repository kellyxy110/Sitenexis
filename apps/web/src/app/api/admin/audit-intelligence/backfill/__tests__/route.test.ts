import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getAuditById: vi.fn(),
  generateAndPersistIntelligenceReport: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@sitenexis/db', () => ({ getAuditById: h.getAuditById }));
vi.mock('@/lib/audit-intelligence/report-generation-service', () => ({ generateAndPersistIntelligenceReport: h.generateAndPersistIntelligenceReport }));

const { POST } = await import('../route');

function req(body?: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'owner-1', email: 'kellyxy110@gmail.com' });
  h.getAuditById.mockResolvedValue({ id: 'audit-1', domain: 'truvyx.org', status: 'complete' });
  h.generateAndPersistIntelligenceReport.mockResolvedValue({ status: 'ready' });
});

describe('POST /api/admin/audit-intelligence/backfill — administrator-controlled, single-audit', () => {
  it('401 when unauthenticated', async () => {
    h.requireAuth.mockRejectedValueOnce(new Error('no'));
    const res = await POST(req({ auditId: 'audit-1' }));
    expect(res.status).toBe(401);
  });

  it('403 when the authenticated user is not an owner — this is not a per-user self-service route', async () => {
    h.requireAuth.mockResolvedValue({ id: 'user-2', email: 'random-user@example.com' });
    const res = await POST(req({ auditId: 'audit-1' }));
    expect(res.status).toBe(403);
    expect(h.generateAndPersistIntelligenceReport).not.toHaveBeenCalled();
  });

  it('400 when auditId is missing', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    expect(h.generateAndPersistIntelligenceReport).not.toHaveBeenCalled();
  });

  it('400 on an invalid JSON body', async () => {
    const badReq = { json: async () => { throw new Error('bad json'); } } as unknown as NextRequest;
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });

  it('404 when the named audit does not exist', async () => {
    h.getAuditById.mockResolvedValue(null);
    const res = await POST(req({ auditId: 'missing' }));
    expect(res.status).toBe(404);
    expect(h.generateAndPersistIntelligenceReport).not.toHaveBeenCalled();
  });

  it('409 when the audit has not reached a report-eligible terminal state', async () => {
    h.getAuditById.mockResolvedValue({ id: 'audit-1', domain: 'truvyx.org', status: 'running' });
    const res = await POST(req({ auditId: 'audit-1' }));
    expect(res.status).toBe(409);
    expect(h.generateAndPersistIntelligenceReport).not.toHaveBeenCalled();
  });

  it('backfills exactly the one named audit and returns its result', async () => {
    const res = await POST(req({ auditId: 'audit-1' }));
    const json = await res.json();

    expect(h.generateAndPersistIntelligenceReport).toHaveBeenCalledTimes(1);
    expect(h.generateAndPersistIntelligenceReport).toHaveBeenCalledWith('audit-1');
    expect(json).toEqual({ auditId: 'audit-1', domain: 'truvyx.org', status: 'ready' });
  });

  it('allows backfilling a partial audit, not only a complete one', async () => {
    h.getAuditById.mockResolvedValue({ id: 'audit-1', domain: 'truvyx.org', status: 'partial' });
    const res = await POST(req({ auditId: 'audit-1' }));
    expect(res.status).toBe(200);
  });
});
