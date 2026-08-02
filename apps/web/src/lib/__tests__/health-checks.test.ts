import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  redisGet: vi.fn(),
}));

vi.mock('@sitenexis/crawler', () => ({
  HEARTBEAT_KEY: 'worker:heartbeat',
  HEARTBEAT_STALE_MS: 60_000,
  getRedisConnection: () => ({ get: h.redisGet }),
}));

const { checkWorkerHeartbeat } = await import('../health-checks');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkWorkerHeartbeat — semantics fix', () => {
  it('reports not_configured (not error) when no heartbeat key has ever been written — the expected steady state on the serverless-only deployment', async () => {
    h.redisGet.mockResolvedValue(null);

    const stage = await checkWorkerHeartbeat();

    expect(stage.status).toBe('not_configured');
    expect(stage.error).toBeUndefined();
  });

  it('reports ok when the heartbeat is fresh', async () => {
    h.redisGet.mockResolvedValue(String(Date.now() - 1_000));

    const stage = await checkWorkerHeartbeat();

    expect(stage.status).toBe('ok');
  });

  it('reports error (a real regression) when the heartbeat key exists but is stale — a worker was running and has since gone dark', async () => {
    h.redisGet.mockResolvedValue(String(Date.now() - 120_000)); // 120s old, threshold is 60s

    const stage = await checkWorkerHeartbeat();

    expect(stage.status).toBe('error');
    expect(stage.error).toMatch(/stale/i);
  });

  it('reports error when the Redis read itself throws — a genuine probe failure, distinct from an absent key', async () => {
    h.redisGet.mockRejectedValue(new Error('ECONNREFUSED'));

    const stage = await checkWorkerHeartbeat();

    expect(stage.status).toBe('error');
    expect(stage.error).toContain('ECONNREFUSED');
  });

  it('the recommended_fix for not_configured explains it is expected, not an outage to chase', async () => {
    h.redisGet.mockResolvedValue(null);

    const stage = await checkWorkerHeartbeat();

    expect(stage.recommended_fix).toMatch(/expected/i);
  });
});
