import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  set: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@sitenexis/crawler', () => ({
  createRedisClient: () => ({ set: h.set, disconnect: h.disconnect }),
}));

const { shouldSuppressDuplicate } = await import('../dedup');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('shouldSuppressDuplicate', () => {
  it('does not suppress the first occurrence of a key (Redis SET NX returns OK)', async () => {
    h.set.mockResolvedValue('OK');

    const suppressed = await shouldSuppressDuplicate('audit-failed:123', 300);

    expect(suppressed).toBe(false);
    expect(h.set).toHaveBeenCalledWith('ops-alert-dedup:audit-failed:123', '1', 'EX', 300, 'NX');
  });

  it('suppresses a duplicate within the window (Redis SET NX returns null — key already existed)', async () => {
    h.set.mockResolvedValue(null);

    const suppressed = await shouldSuppressDuplicate('audit-failed:123', 300);

    expect(suppressed).toBe(true);
  });

  it('fails open (never suppresses) when Redis is unavailable', async () => {
    h.set.mockRejectedValue(new Error('ECONNREFUSED'));

    const suppressed = await shouldSuppressDuplicate('audit-failed:123', 300);

    expect(suppressed).toBe(false);
  });

  it('always disconnects the client, even on error', async () => {
    h.set.mockRejectedValue(new Error('boom'));

    await shouldSuppressDuplicate('k', 60);

    // disconnect is only reachable inside the try/finally around a successful client construction;
    // since createRedisClient() itself doesn't throw here, finally must still run.
    expect(h.disconnect).toHaveBeenCalled();
  });
});
