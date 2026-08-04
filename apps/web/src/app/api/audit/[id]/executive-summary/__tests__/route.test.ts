import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getAuditById: vi.fn(),
  getExecutiveSummary: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@sitenexis/db', () => ({ getAuditById: h.getAuditById }));
vi.mock('@/lib/audit-intelligence/executive-summary-service', () => ({ getExecutiveSummary: h.getExecutiveSummary }));

const { GET } = await import('../route');

function req(): NextRequest {
  return {} as unknown as NextRequest;
}
const params = { params: Promise.resolve({ id: 'audit-1' }) };

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
  h.getAuditById.mockResolvedValue({ id: 'audit-1', userId: 'user-1', domain: 'example.com', status: 'complete' });
});

describe('GET /api/audit/[id]/executive-summary — read-only contract', () => {
  it('401 when unauthenticated', async () => {
    h.requireAuth.mockRejectedValueOnce(new Error('no'));
    const res = await GET(req(), params);
    expect(res.status).toBe(401);
  });

  it('returns an empty GTL state when the audit does not exist', async () => {
    h.getAuditById.mockResolvedValue(null);
    const res = await GET(req(), params);
    const json = await res.json();
    expect(json.state).toBe('empty');
    expect(h.getExecutiveSummary).not.toHaveBeenCalled();
  });

  it('403 when the audit belongs to another user', async () => {
    h.getAuditById.mockResolvedValue({ id: 'audit-1', userId: 'someone-else', domain: 'example.com', status: 'complete' });
    const res = await GET(req(), params);
    expect(res.status).toBe(403);
    expect(h.getExecutiveSummary).not.toHaveBeenCalled();
  });

  it('returns the persisted canonical summary when available, calling the exact same read function Telegram uses', async () => {
    h.getExecutiveSummary.mockResolvedValue({ state: 'complete', data: { auditId: 'audit-1', modelVersion: 'v1.0', domain: 'example.com', composite_score: 8.1, composite_label: 'Good' } });

    const res = await GET(req(), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(h.getExecutiveSummary).toHaveBeenCalledWith('audit-1');
    expect(json.data.composite_score).toBe(8.1);
  });

  it('returns a truthful "processing" state instead of an error when nothing has been generated yet — never generates itself', async () => {
    h.getExecutiveSummary.mockResolvedValue({ state: 'complete', data: null });

    const res = await GET(req(), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.reportStatus).toBe('processing');
  });

  it('returns empty when the read service reports the audit as gone (defensive double-check)', async () => {
    h.getExecutiveSummary.mockResolvedValue(null);

    const res = await GET(req(), params);
    const json = await res.json();

    expect(json.state).toBe('empty');
  });
});
