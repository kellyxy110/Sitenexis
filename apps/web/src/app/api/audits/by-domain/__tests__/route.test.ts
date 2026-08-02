import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getLatestAuditByDomain: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@sitenexis/db', () => ({
  getLatestAuditByDomain: h.getLatestAuditByDomain,
}));

const { GET } = await import('../route');

function req(url: string): NextRequest {
  return { url } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
});

describe('GET /api/audits/by-domain', () => {
  it('401 when unauthenticated', async () => {
    h.requireAuth.mockRejectedValueOnce(new Error('Unauthorized'));
    const res = await GET(req('http://test/api/audits/by-domain?domain=example.com'));
    expect(res.status).toBe(401);
  });

  it('400 when domain is missing', async () => {
    const res = await GET(req('http://test/api/audits/by-domain'));
    expect(res.status).toBe(400);
    expect(h.getLatestAuditByDomain).not.toHaveBeenCalled();
  });

  it('returns the latest complete audit as match when one exists', async () => {
    h.getLatestAuditByDomain.mockImplementation((domain: string) =>
      ({ id: 'audit-complete', domain, status: 'complete', errorMessage: null, createdAt: new Date(), completedAt: new Date() }),
    );
    const res = await GET(req('http://test/api/audits/by-domain?domain=example.com'));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.match).toEqual({ id: 'audit-complete', status: 'complete' });
    // Never leaks score breakdown/provider JSON — only id/status/errorMessage fields.
    expect(json.match).not.toHaveProperty('scores');
    expect(json.match).not.toHaveProperty('breakdown');
  });

  it('scopes the lookup to the authenticated user, not any owner', async () => {
    await GET(req('http://test/api/audits/by-domain?domain=example.com'));
    expect(h.getLatestAuditByDomain).toHaveBeenCalledWith('example.com', 'user-1', 'complete');
    expect(h.getLatestAuditByDomain).toHaveBeenCalledWith('example.com', 'user-1');
  });

  it('returns match: null and latest: failed with its error message when no complete audit exists', async () => {
    h.getLatestAuditByDomain.mockImplementation((_domain: string, _userId: string, status?: string) =>
      status === 'complete'
        ? null
        : { id: 'audit-failed', domain: 'example.com', status: 'failed', errorMessage: 'Homepage returned 403', createdAt: new Date(), completedAt: null },
    );
    const res = await GET(req('http://test/api/audits/by-domain?domain=example.com'));
    const json = await res.json();
    expect(json.match).toBeNull();
    expect(json.latest).toMatchObject({ id: 'audit-failed', status: 'failed', errorMessage: 'Homepage returned 403' });
  });

  it('returns match: null and latest: running for a domain still being audited', async () => {
    h.getLatestAuditByDomain.mockImplementation((_domain: string, _userId: string, status?: string) =>
      status === 'complete'
        ? null
        : { id: 'audit-running', domain: 'example.com', status: 'running', errorMessage: null, createdAt: new Date(), completedAt: null },
    );
    const res = await GET(req('http://test/api/audits/by-domain?domain=example.com'));
    const json = await res.json();
    expect(json.match).toBeNull();
    expect(json.latest.status).toBe('running');
  });

  it('returns match: null and latest: null when the domain has never been audited by this user', async () => {
    h.getLatestAuditByDomain.mockResolvedValue(null);
    const res = await GET(req('http://test/api/audits/by-domain?domain=never-audited.com'));
    const json = await res.json();
    expect(json.match).toBeNull();
    expect(json.latest).toBeNull();
  });
});
