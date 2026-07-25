import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getAuditById: vi.fn(),
  getMachineTrustSecurityHistory: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@sitenexis/db', () => ({
  getAuditById: h.getAuditById,
  getMachineTrustSecurityHistory: h.getMachineTrustSecurityHistory,
}));

const { GET } = await import('../route');

function req(): NextRequest {
  return {} as unknown as NextRequest;
}
const params = { params: Promise.resolve({ id: 'audit-1' }) };

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
  h.getAuditById.mockResolvedValue({ id: 'audit-1', userId: 'user-1', domain: 'example.com' });
  h.getMachineTrustSecurityHistory.mockResolvedValue([
    { auditId: 'audit-0', createdAt: new Date('2026-07-01'), overallScore: 62, criticalFindings: 2, warningFindings: 1, infoFindings: 0 },
    { auditId: 'audit-1', createdAt: new Date('2026-07-20'), overallScore: 88, criticalFindings: 0, warningFindings: 0, infoFindings: 1 },
  ]);
});

describe('GET /api/audit/[id]/machine-trust-security/history', () => {
  it('401 when unauthenticated', async () => {
    h.requireAuth.mockRejectedValueOnce(new Error('Unauthorized'));
    const res = await GET(req(), params);
    expect(res.status).toBe(401);
  });

  it('404 when the audit does not exist or belongs to another user', async () => {
    h.getAuditById.mockResolvedValueOnce(null);
    const res = await GET(req(), params);
    expect(res.status).toBe(404);
  });

  it('200 with a chronological score series for the domain', async () => {
    const res = await GET(req(), params);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.domain).toBe('example.com');
    expect(json.series).toHaveLength(2);
    expect(json.series[0].overallScore).toBe(62);
    expect(json.series[1].overallScore).toBe(88);
    expect(h.getMachineTrustSecurityHistory).toHaveBeenCalledWith('user-1', 'example.com');
  });
});
