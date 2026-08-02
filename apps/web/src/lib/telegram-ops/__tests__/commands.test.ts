import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  checkDatabase: vi.fn(),
  checkRedis: vi.fn(),
  checkBullMQQueue: vi.fn(),
  checkWorkerHeartbeat: vi.fn(),
  listRecentAuditsForOps: vi.fn(),
  listAuditsByStatusForOps: vi.fn(),
  listStalledAuditsForOps: vi.fn(),
  dbAuditFindMany: vi.fn(),
  getRecentDeploymentEvents: vi.fn(),
  deriveModuleAndProviderState: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: h.logger }));
vi.mock('@/lib/health-checks', () => ({
  checkDatabase: h.checkDatabase,
  checkRedis: h.checkRedis,
  checkBullMQQueue: h.checkBullMQQueue,
  checkWorkerHeartbeat: h.checkWorkerHeartbeat,
}));
vi.mock('@/lib/intelligence-report-v2-modules', () => ({
  deriveModuleAndProviderState: h.deriveModuleAndProviderState,
}));
vi.mock('@sitenexis/db', () => ({
  listRecentAuditsForOps: h.listRecentAuditsForOps,
  listAuditsByStatusForOps: h.listAuditsByStatusForOps,
  listStalledAuditsForOps: h.listStalledAuditsForOps,
  db: { audit: { findMany: h.dbAuditFindMany } },
}));
vi.mock('../deployment-log', () => ({
  getRecentDeploymentEvents: h.getRecentDeploymentEvents,
}));

const {
  commandAudits,
  commandFailures,
  commandProviders,
  commandIncidents,
  commandDeployments,
} = await import('../commands');

const audit = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'audit-1', domain: 'example.com', status: 'complete' as const, errorMessage: null,
  createdAt: new Date('2026-01-01T00:00:00Z'), startedAt: new Date('2026-01-01T00:00:00Z'),
  completedAt: null, updatedAt: new Date('2026-01-01T00:05:00Z'),
  failedAgentCount: 0, partialAgentCount: 0, requiredAgentCount: 10, isDemo: false,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.checkWorkerHeartbeat.mockResolvedValue({ stage: 'worker_heartbeat', status: 'ok' });
  h.listStalledAuditsForOps.mockResolvedValue([]);
  h.listAuditsByStatusForOps.mockResolvedValue([]);
  h.listRecentAuditsForOps.mockResolvedValue([]);
  h.dbAuditFindMany.mockResolvedValue([]);
  h.getRecentDeploymentEvents.mockResolvedValue([]);
  h.deriveModuleAndProviderState.mockReturnValue({ modules: [], providers: [] });
});

describe('commandAudits', () => {
  it('lists recent audits when data exists', async () => {
    h.listRecentAuditsForOps.mockResolvedValue([audit({ domain: 'a.com' }), audit({ domain: 'b.com', status: 'failed' })]);

    const reply = await commandAudits();

    expect(reply).toContain('a.com');
    expect(reply).toContain('b.com');
  });

  it('reports "No recent audits found." on empty data, per the desired UX', async () => {
    h.listRecentAuditsForOps.mockResolvedValue([]);

    const reply = await commandAudits();

    expect(reply).toContain('No recent audits found.');
  });

  it('returns a degraded-state reply instead of throwing when the DB query rejects', async () => {
    h.listRecentAuditsForOps.mockRejectedValue(new Error('connection refused at postgres://user:secret@host:5432/db'));

    const reply = await commandAudits();

    expect(reply).toContain('Degraded');
    expect(reply).not.toContain('secret');
    expect(reply).not.toContain('postgres://');
  });

  it('logs the raw error server-side without exposing it in the Telegram reply', async () => {
    h.listRecentAuditsForOps.mockRejectedValue(new Error('db down'));

    await commandAudits();

    expect(h.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'audits' }),
      expect.any(String),
    );
  });

  it('escapes HTML-significant characters in a domain name', async () => {
    h.listRecentAuditsForOps.mockResolvedValue([audit({ domain: 'a<b>&c.com' })]);

    const reply = await commandAudits();

    expect(reply).toContain('a&lt;b&gt;&amp;c.com');
    expect(reply).not.toContain('a<b>&c.com');
  });
});

describe('commandFailures', () => {
  it('lists failed and stalled audits when present', async () => {
    h.listAuditsByStatusForOps.mockResolvedValue([audit({ domain: 'broken.com', status: 'failed', errorMessage: 'timeout' })]);
    h.listStalledAuditsForOps.mockResolvedValue([audit({ domain: 'stuck.com' })]);

    const reply = await commandFailures();

    expect(reply).toContain('broken.com');
    expect(reply).toContain('stuck.com');
  });

  it('reports "No recent failures." on empty data', async () => {
    const reply = await commandFailures();
    expect(reply).toContain('No recent failures.');
  });

  it('degrades gracefully when the DB query rejects', async () => {
    h.listAuditsByStatusForOps.mockRejectedValue(new Error('pool exhausted'));

    const reply = await commandFailures();

    expect(reply).toContain('Degraded');
  });

  it('escapes HTML-significant characters in an error message', async () => {
    h.listAuditsByStatusForOps.mockResolvedValue([audit({ domain: 'x.com', status: 'failed', errorMessage: 'a<script>&fail</script>' })]);

    const reply = await commandFailures();

    expect(reply).toContain('a&lt;script&gt;&amp;fail&lt;/script&gt;');
    expect(reply).not.toContain('<script>');
  });
});

describe('commandProviders', () => {
  it('reports unavailable providers aggregated across recent audits, via a single batched query', async () => {
    h.listRecentAuditsForOps.mockResolvedValue([audit({ id: 'a1' }), audit({ id: 'a2' })]);
    h.dbAuditFindMany.mockResolvedValue([
      { id: 'a1', agentManifest: {}, aiVisibilityScores: null, scoutAnalysis: null },
      { id: 'a2', agentManifest: {}, aiVisibilityScores: null, scoutAnalysis: null },
    ]);
    h.deriveModuleAndProviderState.mockReturnValue({
      modules: [],
      providers: [{ provider: 'citation', available: false, reason: 'not configured' }],
    });

    const reply = await commandProviders();

    expect(h.dbAuditFindMany).toHaveBeenCalledTimes(1);
    expect(h.dbAuditFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['a1', 'a2'] } },
    }));
    expect(reply).toContain('citation');
  });

  it('reports "No recent audits to evaluate." when there is no audit history', async () => {
    const reply = await commandProviders();
    expect(reply).toContain('No recent audits to evaluate.');
  });

  it('reports all-available when no providers are degraded', async () => {
    h.listRecentAuditsForOps.mockResolvedValue([audit()]);
    h.dbAuditFindMany.mockResolvedValue([{ id: 'audit-1', agentManifest: {}, aiVisibilityScores: null, scoutAnalysis: null }]);
    h.deriveModuleAndProviderState.mockReturnValue({ modules: [], providers: [{ provider: 'citation', available: true }] });

    const reply = await commandProviders();

    expect(reply).toContain('All providers available.');
  });

  it('degrades gracefully when the batched query rejects', async () => {
    h.listRecentAuditsForOps.mockResolvedValue([audit()]);
    h.dbAuditFindMany.mockRejectedValue(new Error('db down'));

    const reply = await commandProviders();

    expect(reply).toContain('Degraded');
  });
});

describe('commandIncidents', () => {
  it('reports "No open incidents." when there are no failures and the worker is healthy', async () => {
    const reply = await commandIncidents();
    expect(reply).toContain('No open incidents.');
  });

  it('surfaces failures as an open incident', async () => {
    h.listAuditsByStatusForOps.mockResolvedValue([audit({ domain: 'broken.com', status: 'failed' })]);

    const reply = await commandIncidents();

    expect(reply).toContain('broken.com');
    expect(reply).not.toContain('No open incidents.');
  });

  it('surfaces worker degradation as an open incident even with no audit failures', async () => {
    h.checkWorkerHeartbeat.mockResolvedValue({ stage: 'worker_heartbeat', status: 'error', error: 'stale heartbeat' });

    const reply = await commandIncidents();

    expect(reply).toContain('Worker');
    expect(reply).not.toContain('No open incidents.');
  });
});

describe('commandDeployments', () => {
  it('lists recent deployment events', async () => {
    h.getRecentDeploymentEvents.mockResolvedValue([{ state: 'READY', url: null, recordedAt: new Date().toISOString() }]);

    const reply = await commandDeployments();

    expect(reply).toContain('READY');
  });

  it('reports "No deployment records available." on empty data', async () => {
    const reply = await commandDeployments();
    expect(reply).toContain('No deployment records available.');
  });

  it('degrades gracefully instead of hanging when the Redis-backed lookup rejects', async () => {
    h.getRecentDeploymentEvents.mockRejectedValue(new Error('ECONNREFUSED'));

    const reply = await commandDeployments();

    expect(reply).toContain('Degraded');
  });

  it('degrades gracefully instead of hanging forever when the Redis-backed lookup never resolves', async () => {
    h.getRecentDeploymentEvents.mockReturnValue(new Promise(() => { /* never resolves */ }));

    const reply = await commandDeployments();

    expect(reply).toContain('Degraded');
    expect(reply).toContain('did not respond in time');
  }, 10_000);
});
