import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getAuditWithResults: vi.fn(),
  saveMachineTrustSecurityRecord: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@sitenexis/db', () => ({
  getAuditWithResults: h.getAuditWithResults,
  saveMachineTrustSecurityRecord: h.saveMachineTrustSecurityRecord,
}));

const { GET } = await import('../route');

function req(): NextRequest {
  return {} as unknown as NextRequest;
}
const params = { params: Promise.resolve({ id: 'audit-1' }) };

const completeAudit = {
  userId: 'user-1',
  status: 'complete',
  pages: [{ id: 'page-1', url: 'https://example.com', bodyText: 'Hello world', schemaMarkup: null, responseHeaders: undefined }],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
  h.getAuditWithResults.mockResolvedValue(completeAudit);
  h.saveMachineTrustSecurityRecord.mockResolvedValue(undefined);
});

describe('GET /api/audit/[id]/machine-trust-security', () => {
  it('401 when unauthenticated', async () => {
    h.requireAuth.mockRejectedValueOnce(new Error('Unauthorized'));
    const res = await GET(req(), params);
    expect(res.status).toBe(401);
  });

  it('403 when the audit belongs to another user', async () => {
    h.getAuditWithResults.mockResolvedValueOnce({ ...completeAudit, userId: 'someone-else' });
    const res = await GET(req(), params);
    expect(res.status).toBe(403);
  });

  it('empty state when the audit does not exist', async () => {
    h.getAuditWithResults.mockResolvedValueOnce(null);
    const res = await GET(req(), params);
    const json = await res.json();
    expect(json.state).toBe('empty');
  });

  it('200 with a complete report and persists a history record when the audit is complete', async () => {
    const res = await GET(req(), params);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.state).toBe('complete');
    expect(json.data.overallScore).not.toBeNull();
    expect(h.saveMachineTrustSecurityRecord).toHaveBeenCalledTimes(1);
    expect(h.saveMachineTrustSecurityRecord).toHaveBeenCalledWith('audit-1', expect.objectContaining({ version: 'machine-trust-security-v1' }));
  });

  it('does not persist a history record when the audit is not yet complete', async () => {
    h.getAuditWithResults.mockResolvedValueOnce({ ...completeAudit, status: 'running' });
    const res = await GET(req(), params);
    expect(res.status).toBe(200);
    expect(h.saveMachineTrustSecurityRecord).not.toHaveBeenCalled();
  });
});
