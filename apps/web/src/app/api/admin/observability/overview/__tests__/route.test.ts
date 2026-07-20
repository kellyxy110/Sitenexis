import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getAiObservabilitySummary: vi.fn(),
  getRecentAiCallMetrics: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@sitenexis/db', () => ({
  getAiObservabilitySummary: h.getAiObservabilitySummary,
  getRecentAiCallMetrics: h.getRecentAiCallMetrics,
}));

const { GET } = await import('../route');

function req(url = 'https://sitenexis.vercel.app/api/admin/observability/overview'): NextRequest {
  return { nextUrl: new URL(url) } as unknown as NextRequest;
}

const summary = {
  windowHours: 24, totalCalls: 10, successCount: 9, errorCount: 1, successRate: 0.9,
  avgLatencyMs: 500, p95LatencyMs: 900, totalEstimatedCostUsd: 0.002,
  byProvider: [{ provider: 'groq', calls: 10, errorRate: 0.1, avgLatencyMs: 500, costUsd: 0.002 }],
  topErrors: [{ errorCode: 'timeout', count: 1 }],
};
const recentCalls = [{ id: '1', provider: 'groq', model: 'llama-3.3-70b-versatile', skillId: null, latencyMs: 400, success: true, errorCode: null, inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.0001, auditId: null, createdAt: new Date() }];

beforeEach(() => {
  vi.clearAllMocks();
  h.getAiObservabilitySummary.mockResolvedValue(summary);
  h.getRecentAiCallMetrics.mockResolvedValue(recentCalls);
});

describe('GET /api/admin/observability/overview', () => {
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

  it('200 with summary + recentCalls for an owner email, default 24h window', async () => {
    h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'kellyxy110@gmail.com' });
    const res = await GET(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.summary).toEqual(JSON.parse(JSON.stringify(summary)));
    expect(h.getAiObservabilitySummary).toHaveBeenCalledWith(24);
  });

  it('honours a windowHours query param, clamped to [1, 720]', async () => {
    h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'kellyxy110@gmail.com' });
    await GET(req('https://sitenexis.vercel.app/api/admin/observability/overview?windowHours=9999'));
    expect(h.getAiObservabilitySummary).toHaveBeenCalledWith(720);
  });
});
