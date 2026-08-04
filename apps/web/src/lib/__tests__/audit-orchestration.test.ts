import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  after: vi.fn(),
  rateLimit: vi.fn(),
  isFullyConfigured: vi.fn(),
  getLatestAuditByDomain: vi.fn(),
  upsertUser: vi.fn(),
  checkLayer4Access: vi.fn(),
  checkAndDeductCredits: vi.fn(),
  getUserCredits: vi.fn(),
  createAudit: vi.fn(),
  initializeAuditManifest: vi.fn(),
  updateAuditStatus: vi.fn(),
  getRedisUrl: vi.fn(),
  createRedisClient: vi.fn(),
  enqueueCrawlJob: vi.fn(),
  runServerlessAudit: vi.fn(),
}));

vi.mock('next/server', () => ({ after: h.after }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/mode', () => ({ isFullyConfigured: h.isFullyConfigured }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: h.rateLimit }));
vi.mock('@/lib/plans', () => ({ checkLayer4Access: h.checkLayer4Access }));
vi.mock('@/lib/credits', () => ({ checkAndDeductCredits: h.checkAndDeductCredits }));
vi.mock('@/lib/serverless-audit', () => ({ runServerlessAudit: h.runServerlessAudit }));
vi.mock('@sitenexis/shared', () => ({ DEFAULT_AUDIT_AGENTS: ['crawl', 'seo'] }));
vi.mock('@sitenexis/crawler', () => ({
  getRedisUrl: h.getRedisUrl,
  createRedisClient: h.createRedisClient,
  HEARTBEAT_KEY: 'heartbeat',
  HEARTBEAT_STALE_MS: 30_000,
  enqueueCrawlJob: h.enqueueCrawlJob,
}));
vi.mock('@sitenexis/db', () => ({
  getLatestAuditByDomain: h.getLatestAuditByDomain,
  upsertUser: h.upsertUser,
  getUserCredits: h.getUserCredits,
  createAudit: h.createAudit,
  initializeAuditManifest: h.initializeAuditManifest,
  updateAuditStatus: h.updateAuditStatus,
}));

const { normalizeAndValidateDomain, startAuditForUser } = await import('../audit-orchestration');

beforeEach(() => {
  vi.clearAllMocks();
  h.rateLimit.mockResolvedValue({ ok: true, remaining: 9, reset: 0, headers: {} });
  h.isFullyConfigured.mockReturnValue(true);
  h.getLatestAuditByDomain.mockResolvedValue(null);
  h.upsertUser.mockResolvedValue({ id: 'user-1' });
  h.checkLayer4Access.mockResolvedValue(false);
  h.checkAndDeductCredits.mockResolvedValue({ allowed: true });
  h.getUserCredits.mockResolvedValue({ balance: 10, isUnlimited: false });
  h.createAudit.mockResolvedValue({ id: 'audit-1' });
  h.initializeAuditManifest.mockResolvedValue(undefined);
  h.getRedisUrl.mockReturnValue(null); // no worker — serverless fallback path
});

describe('normalizeAndValidateDomain', () => {
  it('accepts a well-formed domain, stripping scheme/path/case', () => {
    expect(normalizeAndValidateDomain('HTTPS://Example.COM/some/path')).toEqual({ ok: true, domain: 'example.com' });
  });

  it('rejects a malformed/unauthorized domain string', () => {
    expect(normalizeAndValidateDomain('not a domain')).toEqual({ ok: false, reason: 'invalid_format' });
  });

  it('rejects private/reserved hosts (SSRF guard)', () => {
    // Bare "localhost" / raw IPs fail the domain-format check first (no
    // TLD) — the SSRF branch is reached by domains that otherwise look
    // well-formed but resolve into a private/reserved prefix.
    expect(normalizeAndValidateDomain('localhost.internal.example')).toEqual({ ok: false, reason: 'private_or_reserved' });
    expect(normalizeAndValidateDomain('10.mycompany.internal')).toEqual({ ok: false, reason: 'private_or_reserved' });
    expect(normalizeAndValidateDomain('192.168.example.com')).toEqual({ ok: false, reason: 'private_or_reserved' });
  });
});

describe('startAuditForUser', () => {
  it('rejects an unauthorized/malformed domain before touching the database', async () => {
    const result = await startAuditForUser('user-1', 'a@example.com', 'not a domain');
    expect(result).toEqual({ ok: false, reason: 'invalid_domain', message: 'Invalid domain format.' });
    expect(h.getLatestAuditByDomain).not.toHaveBeenCalled();
    expect(h.createAudit).not.toHaveBeenCalled();
  });

  it('rejects a private/reserved domain (SSRF) before touching the database', async () => {
    // Must be a domain that passes the format check (has a TLD-like suffix)
    // but resolves into a private/reserved prefix — bare "localhost" fails
    // the format check first and would falsely report 'invalid_domain'.
    const result = await startAuditForUser('user-1', 'a@example.com', '10.mycompany.internal');
    expect(result).toEqual({ ok: false, reason: 'private_domain', message: 'Private or reserved domains are not allowed.' });
    expect(h.createAudit).not.toHaveBeenCalled();
  });

  it('rejects when the per-user rate limit is exceeded', async () => {
    h.rateLimit.mockResolvedValue({ ok: false, remaining: 0, reset: 0, headers: { 'X-RateLimit-Remaining': '0' } });
    const result = await startAuditForUser('user-1', 'a@example.com', 'example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('rate_limited');
      expect(result.rateLimitHeaders).toEqual({ 'X-RateLimit-Remaining': '0' });
    }
    expect(h.createAudit).not.toHaveBeenCalled();
  });

  it('rejects when credits/quota are exhausted', async () => {
    h.checkAndDeductCredits.mockResolvedValue({ allowed: false, reason: 'Insufficient credits.' });
    const result = await startAuditForUser('user-1', 'a@example.com', 'example.com');
    expect(result).toEqual({ ok: false, reason: 'credits_denied', message: 'Insufficient credits.' });
    expect(h.createAudit).not.toHaveBeenCalled();
  });

  it('rejects when an audit is already queued or running for this user+domain — new duplicate-audit guard', async () => {
    h.getLatestAuditByDomain.mockImplementation((_domain: string, _userId: string, status?: string) =>
      status === 'running' ? Promise.resolve({ id: 'existing-audit', domain: 'example.com', status: 'running', errorMessage: null, createdAt: new Date(), completedAt: null }) : Promise.resolve(null),
    );
    const result = await startAuditForUser('user-1', 'a@example.com', 'example.com');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('duplicate_running');
      expect(result.existingAuditId).toBe('existing-audit');
    }
    expect(h.createAudit).not.toHaveBeenCalled();
  });

  it('creates and dispatches an audit on the happy path (serverless fallback when no worker is alive)', async () => {
    const result = await startAuditForUser('user-1', 'a@example.com', 'example.com');
    expect(result).toEqual({ ok: true, auditId: 'audit-1', domain: 'example.com', executionMode: 'serverless', workerAlive: false });
    expect(h.createAudit).toHaveBeenCalledWith('user-1', 'example.com');
    expect(h.initializeAuditManifest).toHaveBeenCalledWith('audit-1', ['crawl', 'seo']);
    expect(h.enqueueCrawlJob).not.toHaveBeenCalled();

    // after() defers execution to post-response — invoke the captured
    // callback directly to prove it dispatches to runServerlessAudit.
    expect(h.after).toHaveBeenCalledTimes(1);
    await h.after.mock.calls[0]?.[0]();
    expect(h.runServerlessAudit).toHaveBeenCalledWith('audit-1', 'example.com', 'user-1');
  });

  it('dispatches via BullMQ when a worker heartbeat is alive', async () => {
    h.getRedisUrl.mockReturnValue('redis://localhost:6379');
    const probe = { get: vi.fn().mockResolvedValue(String(Date.now())), disconnect: vi.fn() };
    h.createRedisClient.mockReturnValue(probe);
    h.enqueueCrawlJob.mockResolvedValue(undefined);

    const result = await startAuditForUser('user-1', 'a@example.com', 'example.com');

    expect(result).toEqual({ ok: true, auditId: 'audit-1', domain: 'example.com', executionMode: 'bullmq', workerAlive: true });
    expect(h.enqueueCrawlJob).toHaveBeenCalledWith({ auditId: 'audit-1', domain: 'example.com', userId: 'user-1', layer4Enabled: false });
    expect(h.runServerlessAudit).not.toHaveBeenCalled();
  });

  it('never proceeds to audit creation when the platform is not configured', async () => {
    h.isFullyConfigured.mockReturnValue(false);
    const result = await startAuditForUser('user-1', 'a@example.com', 'example.com');
    expect(result).toEqual({ ok: false, reason: 'not_configured', message: 'No data available — configure your database and run an audit.' });
    expect(h.createAudit).not.toHaveBeenCalled();
  });
});
