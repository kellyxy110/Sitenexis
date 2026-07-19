import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getAdminOverview: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@sitenexis/db', () => ({ getAdminOverview: h.getAdminOverview }));

const { GET } = await import('../route');

function req(): NextRequest {
  return {} as unknown as NextRequest;
}

const overview = {
  windowDays: 30, totalUsers: 42, auditsStarted: 100, auditsCompleted: 90,
  auditsFailed: 5, avgAuditDurationMs: 240_000, reportsGenerated: 30,
  recommendationsApplied: 12, connectorFailures: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.getAdminOverview.mockResolvedValue(overview);
});

describe('GET /api/admin/intelligence-center/overview', () => {
  it('401 when unauthenticated', async () => {
    h.requireAuth.mockRejectedValueOnce(new Error('Unauthorized'));
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('403 when authenticated but not an owner email', async () => {
    h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'random@example.com' });
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it('200 with the aggregated overview for an owner email', async () => {
    h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'kellyxy110@gmail.com' });
    const res = await GET(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(overview);
  });

  it('owner check is case-insensitive', async () => {
    h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'KellyXY110@Gmail.com' });
    const res = await GET(req());
    expect(res.status).toBe(200);
  });
});
