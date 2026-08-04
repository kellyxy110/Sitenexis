import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  rateLimit: vi.fn(),
  getAuditById: vi.fn(),
  resetReportForRegeneration: vi.fn(),
  generateAndPersistIntelligenceReport: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: h.rateLimit }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@sitenexis/db', () => ({ getAuditById: h.getAuditById, resetReportForRegeneration: h.resetReportForRegeneration }));
vi.mock('@/lib/audit-intelligence/report-generation-service', () => ({ generateAndPersistIntelligenceReport: h.generateAndPersistIntelligenceReport }));

const { POST } = await import('../route');

function req(): NextRequest {
  return {} as unknown as NextRequest;
}
const params = { params: Promise.resolve({ id: 'audit-1' }) };

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
  h.rateLimit.mockResolvedValue({ ok: true, headers: {} });
  h.getAuditById.mockResolvedValue({ id: 'audit-1', userId: 'user-1', domain: 'example.com', status: 'complete' });
  h.generateAndPersistIntelligenceReport.mockResolvedValue({ status: 'ready' });
});

describe('POST /api/audit/[id]/report/regenerate — explicit, authorized regeneration', () => {
  it('401 when unauthenticated', async () => {
    h.requireAuth.mockRejectedValueOnce(new Error('no'));
    const res = await POST(req(), params);
    expect(res.status).toBe(401);
  });

  it('429 when the caller exceeds the regeneration rate limit', async () => {
    h.rateLimit.mockResolvedValue({ ok: false, headers: {} });
    const res = await POST(req(), params);
    expect(res.status).toBe(429);
    expect(h.generateAndPersistIntelligenceReport).not.toHaveBeenCalled();
  });

  it('404 when the audit does not exist', async () => {
    h.getAuditById.mockResolvedValue(null);
    const res = await POST(req(), params);
    expect(res.status).toBe(404);
  });

  it('403 when the audit belongs to another user', async () => {
    h.getAuditById.mockResolvedValue({ id: 'audit-1', userId: 'someone-else', domain: 'example.com', status: 'complete' });
    const res = await POST(req(), params);
    expect(res.status).toBe(403);
    expect(h.generateAndPersistIntelligenceReport).not.toHaveBeenCalled();
  });

  it('409 when the audit has not reached a report-eligible terminal state', async () => {
    h.getAuditById.mockResolvedValue({ id: 'audit-1', userId: 'user-1', domain: 'example.com', status: 'running' });
    const res = await POST(req(), params);
    expect(res.status).toBe(409);
    expect(h.generateAndPersistIntelligenceReport).not.toHaveBeenCalled();
  });

  it('resets the report to pending before generating, so an already-"ready" report can still be forced to regenerate', async () => {
    const res = await POST(req(), params);
    const json = await res.json();

    expect(h.resetReportForRegeneration).toHaveBeenCalledWith('audit-1');
    expect(h.generateAndPersistIntelligenceReport).toHaveBeenCalledWith('audit-1');
    expect(json.status).toBe('ready');
  });

  it('allows regeneration for a partial audit, not only a complete one', async () => {
    h.getAuditById.mockResolvedValue({ id: 'audit-1', userId: 'user-1', domain: 'example.com', status: 'partial' });
    const res = await POST(req(), params);
    expect(res.status).toBe(200);
  });
});
