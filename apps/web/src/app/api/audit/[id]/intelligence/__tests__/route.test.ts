import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// ── Hoisted mock fns (available inside vi.mock factories) ────────────────────
const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  rateLimit: vi.fn(),
  getAuditWithResults: vi.fn(),
  getIssuesByAudit: vi.fn(),
  logUsage: vi.fn(),
  groqComplete: vi.fn(),
  groqIsConfigured: vi.fn(),
  openrouterComplete: vi.fn(),
  openrouterIsConfigured: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
  AuthError: class extends Error {},
}));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: h.rateLimit }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/env', () => ({
  env: { OPENROUTER_HERMES_KEY: 'sk-or-mock-hermes-key-longer-than-10', OPENROUTER_API_KEY: 'sk-or-mock-fallback-key' },
}));
vi.mock('@sitenexis/db', () => ({
  getAuditWithResults: h.getAuditWithResults,
  getIssuesByAudit: h.getIssuesByAudit,
  logUsage: h.logUsage,
}));
vi.mock('@sitenexis/adapters', () => ({
  getGroqAdapter: () => ({ provider: 'groq', isConfigured: h.groqIsConfigured, complete: h.groqComplete }),
  getOpenRouterAdapter: () => ({ provider: 'openrouter', isConfigured: h.openrouterIsConfigured, complete: h.openrouterComplete }),
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
  h.groqIsConfigured.mockReturnValue(true);
  h.openrouterIsConfigured.mockReturnValue(true);
  h.groqComplete.mockResolvedValue({ content: 'Here is your action plan.', model: 'llama-3.3-70b-versatile', provider: 'groq', latencyMs: 120, inputTokens: 200, outputTokens: 60 });
  h.openrouterComplete.mockResolvedValue({ content: 'Fallback answer.', model: 'nousresearch/hermes-3-llama-3.1-405b:free', provider: 'openrouter', latencyMs: 90 });
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

  it('503 when no provider is configured', async () => {
    h.groqIsConfigured.mockReturnValueOnce(false);
    h.openrouterIsConfigured.mockReturnValueOnce(false);
    const res = await POST(req({ question: 'hi' }), params);
    expect(res.status).toBe(503);
  });

  it('200 on success — Groq answers first, logs usage, never leaks the key', async () => {
    const res = await POST(req({ question: 'what should I fix first?' }), params);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.answer).toContain('action plan');
    expect(json.provider).toBe('groq');
    expect(h.logUsage).toHaveBeenCalledTimes(1);
    expect(h.openrouterComplete).not.toHaveBeenCalled(); // Groq succeeded — no fallback needed
    // usage metadata must not carry the API key
    const meta = h.logUsage.mock.calls[0][0];
    expect(JSON.stringify(meta)).not.toMatch(/sk-or-mock/);
    // response body must never contain the key
    expect(JSON.stringify(json)).not.toMatch(/sk-or-mock/);
  });

  it('falls back to the second provider when the first fails', async () => {
    h.groqComplete.mockRejectedValue(new Error('groq unavailable'));
    const res = await POST(req({ question: 'hi' }), params);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.answer).toBe('Fallback answer.');
    expect(json.provider).toBe('openrouter');
    expect(h.groqComplete).toHaveBeenCalledTimes(1);
    expect(h.openrouterComplete).toHaveBeenCalledTimes(1);
  });

  it('504 on provider timeout (AbortError) when every provider times out', async () => {
    const abort = new Error('aborted'); abort.name = 'AbortError';
    h.groqComplete.mockRejectedValue(abort);
    h.openrouterComplete.mockRejectedValue(abort);
    const res = await POST(req({ question: 'hi' }), params);
    expect(res.status).toBe(504);
  });

  it('502 when every configured provider fails (non-transient)', async () => {
    h.groqComplete.mockRejectedValue(new Error('bad request 400'));
    h.openrouterComplete.mockRejectedValue(new Error('bad request 400'));
    const res = await POST(req({ question: 'hi' }), params);
    expect(res.status).toBe(502);
    expect(h.groqComplete).toHaveBeenCalledTimes(1);
    expect(h.openrouterComplete).toHaveBeenCalledTimes(1);
  });
});
