import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getAuditById: vi.fn(),
  getLatestSyntheticEntityAnalysis: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@sitenexis/db', () => ({
  getAuditById: h.getAuditById,
  getLatestSyntheticEntityAnalysis: h.getLatestSyntheticEntityAnalysis,
}));

const { GET } = await import('../route');

function req(): NextRequest {
  return {} as unknown as NextRequest;
}
const params = { params: Promise.resolve({ id: 'audit-1' }) };

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
  h.getAuditById.mockResolvedValue({ id: 'audit-1', userId: 'user-1', domain: 'example.com', status: 'complete' });
  h.getLatestSyntheticEntityAnalysis.mockResolvedValue(null);
});

describe('GET /api/audit/[id]/authenticity', () => {
  it('401 when unauthenticated', async () => {
    h.requireAuth.mockRejectedValueOnce(new Error('Unauthorized'));
    const res = await GET(req(), params);
    expect(res.status).toBe(401);
  });

  it('403 when the audit belongs to another user', async () => {
    h.getAuditById.mockResolvedValueOnce({ id: 'audit-1', userId: 'someone-else', domain: 'example.com', status: 'complete' });
    const res = await GET(req(), params);
    expect(res.status).toBe(403);
  });

  it('empty state when the audit does not exist', async () => {
    h.getAuditById.mockResolvedValueOnce(null);
    const res = await GET(req(), params);
    const json = await res.json();
    expect(json.state).toBe('empty');
  });

  it('owner succeeds and reads the persisted authenticity analysis', async () => {
    h.getLatestSyntheticEntityAnalysis.mockResolvedValueOnce({ entityAuthenticityConfidence: 88 });
    const res = await GET(req(), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data).toMatchObject({ auditId: 'audit-1', entityAuthenticityConfidence: 88 });
    expect(h.getAuditById).toHaveBeenCalledTimes(1);
  });
});
