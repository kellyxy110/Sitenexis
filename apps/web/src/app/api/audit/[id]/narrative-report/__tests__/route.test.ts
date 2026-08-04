import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getAuditById: vi.fn(),
  getNarrativeReport: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@sitenexis/db', () => ({ getAuditById: h.getAuditById }));
vi.mock('@/lib/audit-intelligence/narrative-report-service', () => ({ getNarrativeReport: h.getNarrativeReport }));

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

describe('GET /api/audit/[id]/narrative-report — read-only contract', () => {
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
    expect(h.getNarrativeReport).not.toHaveBeenCalled();
  });

  it('403 when the audit belongs to another user', async () => {
    h.getAuditById.mockResolvedValue({ id: 'audit-1', userId: 'someone-else', domain: 'example.com', status: 'complete' });
    const res = await GET(req(), params);
    expect(res.status).toBe(403);
    expect(h.getNarrativeReport).not.toHaveBeenCalled();
  });

  it('returns the persisted canonical report when available, calling the exact same read function Telegram uses', async () => {
    h.getNarrativeReport.mockResolvedValue({ state: 'complete', data: { auditId: 'audit-1', domain: 'example.com', generatedAt: '2026-08-01T00:00:00Z', modelVersion: 'v4.1', summary: 'ok' } });

    const res = await GET(req(), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(h.getNarrativeReport).toHaveBeenCalledWith('audit-1');
    expect(json.data.summary).toBe('ok');
  });

  it('returns a truthful "processing" state instead of an error when nothing has been generated yet — never generates itself', async () => {
    h.getNarrativeReport.mockResolvedValue({ state: 'complete', data: null });

    const res = await GET(req(), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.reportStatus).toBe('processing');
  });
});
