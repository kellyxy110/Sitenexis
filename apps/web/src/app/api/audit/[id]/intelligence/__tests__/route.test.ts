import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// ── Hoisted mock fns (available inside vi.mock factories) ────────────────────
const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  rateLimit: vi.fn(),
  getAuditWithResults: vi.fn(),
  getIssuesByAudit: vi.fn(),
  logUsage: vi.fn(),
  complete: vi.fn(),
  isConfigured: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
  AuthError: class extends Error {},
}));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: h.rateLimit }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/env', () => ({
  env: { AGNES_API_KEY: 'sk-agnes-mock-key-longer-than-10', AGNES_MODEL: 'agnes-2.0-flash', AGNES_BASE_URL: 'https://apihub.agnes-ai.com/v1' },
}));
vi.mock('@sitenexis/db', () => ({
  getAuditWithResults: h.getAuditWithResults,
  getIssuesByAudit: h.getIssuesByAudit,
  logUsage: h.logUsage,
}));
vi.mock('@sitenexis/adapters', () => ({
  getAgnesAdapter: () => ({ isConfigured: h.isConfigured, complete: h.complete }),
}));

const { POST } = await import('../route');

function req(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}
const params = { params: Promise.resolve({ id: 'audit-1' }) };
const completeAudit = {
  userId: 'user-1', status: 'complete', domain: 'example.com', pageCount: 5,
  scores: { seoScore: 80, aiScore: 64, overall: 72 }, aiVisibilityScores: null, entities: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
  h.rateLimit.mockResolvedValue({ ok: true, headers: {} });
  h.getAuditWithResults.mockResolvedValue(completeAudit);
  h.getIssuesByAudit.mockResolvedValue([]);
  h.logUsage.mockResolvedValue(undefined);
  h.isConfigured.mockReturnValue(true);
  h.complete.mockResolvedValue({ content: 'Here is your action plan.', model: 'agnes-2.0-flash', provider: 'agnes', latencyMs: 120, inputTokens: 200, outputTokens: 60 });
});

describe('POST /api/audit/[id]/intelligence', () => {
  it('401 when unauthenticated', async () => {
    h.requireAuth.mockRejectedValueOnce(new Error('Unauthorized'));
    const res = await POST(req({ question: 'hi' }), params);
    expect(res.status).toBe(401);
  });

  it('400 on invalid body (missing question)', async () => {
    const res = await POST(req({}), params);
    expect(res.status).toBe(400);
  });

  it('404 when the audit does not exist', async () => {
    h.getAuditWithResults.mockResolvedValueOnce(null);
    const res = await POST(req({ question: 'hi' }), params);
    expect(res.status).toBe(404);
  });

  it('403 when the audit belongs to another user (ownership)', async () => {
    h.getAuditWithResults.mockResolvedValueOnce({ ...completeAudit, userId: 'someone-else' });
    const res = await POST(req({ question: 'hi' }), params);
    expect(res.status).toBe(403);
  });

  it('409 when the audit is not complete', async () => {
    h.getAuditWithResults.mockResolvedValueOnce({ ...completeAudit, status: 'running' });
    const res = await POST(req({ question: 'hi' }), params);
    expect(res.status).toBe(409);
  });

  it('429 when rate limited', async () => {
    h.rateLimit.mockResolvedValueOnce({ ok: false, headers: {} });
    const res = await POST(req({ question: 'hi' }), params);
    expect(res.status).toBe(429);
  });

  it('503 when Agnes is not configured', async () => {
    h.isConfigured.mockReturnValueOnce(false);
    const res = await POST(req({ question: 'hi' }), params);
    expect(res.status).toBe(503);
  });

  it('200 on success — returns the answer, logs usage, never leaks the key', async () => {
    const res = await POST(req({ question: 'what should I fix first?' }), params);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.answer).toContain('action plan');
    expect(json.provider).toBe('agnes');
    expect(h.logUsage).toHaveBeenCalledTimes(1);
    // usage metadata must not carry the API key
    const meta = h.logUsage.mock.calls[0][0];
    expect(JSON.stringify(meta)).not.toMatch(/sk-agnes/);
    // response body must never contain the key
    expect(JSON.stringify(json)).not.toMatch(/sk-agnes/);
  });

  it('504 on provider timeout (AbortError)', async () => {
    const abort = new Error('aborted'); abort.name = 'AbortError';
    h.complete.mockRejectedValue(abort);
    const res = await POST(req({ question: 'hi' }), params);
    expect(res.status).toBe(504);
  });

  it('502 on non-transient provider failure', async () => {
    h.complete.mockRejectedValue(new Error('bad request 400'));
    const res = await POST(req({ question: 'hi' }), params);
    expect(res.status).toBe(502);
    expect(h.complete).toHaveBeenCalledTimes(1); // non-transient → no retry
  });

  it('retries once on a transient failure then succeeds', async () => {
    h.complete
      .mockRejectedValueOnce(new Error('503 temporarily unavailable'))
      .mockResolvedValueOnce({ content: 'recovered', model: 'agnes-2.0-flash', provider: 'agnes', latencyMs: 90 });
    const res = await POST(req({ question: 'hi' }), params);
    expect(res.status).toBe(200);
    expect(h.complete).toHaveBeenCalledTimes(2);
  });
});
