import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  env: { CRON_SECRET: 'test-cron-secret' },
  listStalledAuditsForOps: vi.fn(),
  checkWorkerHeartbeat: vi.fn(),
  notifyOps: vi.fn(),
}));

vi.mock('@/lib/env', () => ({ env: h.env }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/health-checks', () => ({ checkWorkerHeartbeat: h.checkWorkerHeartbeat }));
vi.mock('@/lib/telegram-ops/orchestrator', () => ({ notifyOps: h.notifyOps }));
vi.mock('@sitenexis/db', () => ({ listStalledAuditsForOps: h.listStalledAuditsForOps }));

const { GET } = await import('../route');

function req(auth?: string): NextRequest {
  return { headers: new Headers(auth ? { authorization: auth } : {}) } as unknown as NextRequest;
}

const stalledAudit = {
  id: 'audit-1', domain: 'example.com', status: 'running' as const, errorMessage: null,
  createdAt: new Date('2026-01-01T00:00:00Z'), startedAt: new Date('2026-01-01T00:00:00Z'),
  completedAt: null, updatedAt: new Date('2026-01-01T00:30:00Z'),
  failedAgentCount: 0, partialAgentCount: 0, requiredAgentCount: 10, isDemo: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.listStalledAuditsForOps.mockResolvedValue([]);
  h.checkWorkerHeartbeat.mockResolvedValue({ stage: 'worker_heartbeat', status: 'ok' });
  h.notifyOps.mockResolvedValue(undefined);
});

describe('GET /api/cron/ops-monitor', () => {
  it('401s without the correct bearer secret', async () => {
    const res = await GET(req('Bearer wrong'));
    expect(res.status).toBe(401);
  });

  it('reports zero stalled audits and healthy worker when nothing is wrong', async () => {
    const res = await GET(req('Bearer test-cron-secret'));
    const body = await res.json() as { stalledCount: number; workerStatus: string };

    expect(body.stalledCount).toBe(0);
    expect(body.workerStatus).toBe('ok');
    expect(h.notifyOps).not.toHaveBeenCalled();
  });

  it('raises an AUDIT_STALLED alert for each stalled audit found', async () => {
    h.listStalledAuditsForOps.mockResolvedValue([stalledAudit]);

    await GET(req('Bearer test-cron-secret'));

    expect(h.notifyOps).toHaveBeenCalledWith(expect.objectContaining({
      type: 'AUDIT_STALLED',
      dedupeKey: 'audit-stalled:audit-1',
    }));
  });

  it('raises a WORKER_HEALTH_DEGRADED alert when the heartbeat check errors', async () => {
    h.checkWorkerHeartbeat.mockResolvedValue({ stage: 'worker_heartbeat', status: 'error', error: 'stale heartbeat' });

    await GET(req('Bearer test-cron-secret'));

    expect(h.notifyOps).toHaveBeenCalledWith(expect.objectContaining({ type: 'WORKER_HEALTH_DEGRADED' }));
  });

  it('does not alert on worker health when the heartbeat is merely not_configured', async () => {
    h.checkWorkerHeartbeat.mockResolvedValue({ stage: 'worker_heartbeat', status: 'not_configured' });

    await GET(req('Bearer test-cron-secret'));

    expect(h.notifyOps).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'WORKER_HEALTH_DEGRADED' }));
  });

  it('continues to check worker health even if the stalled-audit lookup throws', async () => {
    h.listStalledAuditsForOps.mockRejectedValue(new Error('db down'));

    const res = await GET(req('Bearer test-cron-secret'));

    expect(res.status).toBe(200);
    expect(h.checkWorkerHeartbeat).toHaveBeenCalled();
  });
});
