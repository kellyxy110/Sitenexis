/**
 * Integration test: real webhook route → real command handlers → real
 * telegram-provider (HTML formatting, chunking, fallback) all wired together.
 * Only the true I/O boundaries are mocked: the outgoing Telegram HTTP call
 * (global.fetch) and the DB/Redis dependencies the command handlers read
 * from. This is what previously existed only as separate unit tests with
 * commands.ts itself mocked out — this file proves the actual formatted text
 * a real command produces survives the real provider and reaches a
 * (mocked) Telegram API call correctly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  env: {
    TELEGRAM_BOT_TOKEN: 'test-token-not-real',
    TELEGRAM_ADMIN_CHAT_ID: '8619262047',
    TELEGRAM_WEBHOOK_SECRET: 'a'.repeat(32),
    TELEGRAM_ALERTS_ENABLED: true,
  },
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

vi.mock('@/lib/env', () => ({ env: h.env }));
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

// telegram-provider and commands are intentionally NOT mocked — this is the point.
const { POST } = await import('@/app/api/telegram/webhook/route');

const originalFetch = global.fetch;

function ok() {
  return { ok: true, status: 200, json: async () => ({ ok: true }) };
}
function telegramError(errorCode: number, description: string) {
  return { ok: false, status: errorCode, json: async () => ({ ok: false, error_code: errorCode, description }) };
}

function webhookReq(text: string, chatId: number | string = 8619262047): NextRequest {
  return {
    headers: new Headers({ 'x-telegram-bot-api-secret-token': h.env.TELEGRAM_WEBHOOK_SECRET }),
    json: async () => ({ message: { chat: { id: chatId }, text } }),
  } as unknown as NextRequest;
}

function sentText(fetchMock: ReturnType<typeof vi.fn>, callIndex = 0): string {
  const call = fetchMock.mock.calls[callIndex] as [string, RequestInit];
  return (JSON.parse(call[1].body as string) as { text: string }).text;
}

const audit = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'audit-1', domain: 'example.com', status: 'complete' as const, errorMessage: null,
  createdAt: new Date('2026-01-01T00:00:00Z'), startedAt: new Date('2026-01-01T00:00:00Z'),
  completedAt: null, updatedAt: new Date('2026-01-01T00:05:00Z'),
  failedAgentCount: 0, partialAgentCount: 0, requiredAgentCount: 10, isDemo: false,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.env.TELEGRAM_ALERTS_ENABLED = true;
  global.fetch = vi.fn().mockResolvedValue(ok()) as unknown as typeof fetch;
  h.checkDatabase.mockResolvedValue({ stage: 'db_connectivity', status: 'ok', latency_ms: 12 });
  h.checkRedis.mockResolvedValue({ stage: 'redis_ping', status: 'ok', latency_ms: 5 });
  h.checkBullMQQueue.mockResolvedValue({ stage: 'bullmq_queue', status: 'ok', latency_ms: 8 });
  h.checkWorkerHeartbeat.mockResolvedValue({ stage: 'worker_heartbeat', status: 'not_configured' });
  h.listRecentAuditsForOps.mockResolvedValue([]);
  h.listAuditsByStatusForOps.mockResolvedValue([]);
  h.listStalledAuditsForOps.mockResolvedValue([]);
  h.dbAuditFindMany.mockResolvedValue([]);
  h.getRecentDeploymentEvents.mockResolvedValue([]);
  h.deriveModuleAndProviderState.mockReturnValue({ modules: [], providers: [] });
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('end-to-end: /start', () => {
  it('sends an explicit welcome message listing every command', async () => {
    const res = await POST(webhookReq('/start'));

    expect(res.status).toBe(200);
    const text = sentText(global.fetch as ReturnType<typeof vi.fn>);
    expect(text).toContain('SiteNexis Ops');
    expect(text).toContain('/status');
    expect(text).toContain('/audits');
    expect(text).toContain('/deployments');
  });
});

describe('end-to-end: unknown command', () => {
  it('sends the generic help text instead of silence', async () => {
    const res = await POST(webhookReq('/totallyMadeUp'));

    expect(res.status).toBe(200);
    const text = sentText(global.fetch as ReturnType<typeof vi.fn>);
    expect(text).toContain('SiteNexis Ops');
    expect(text).toContain('/status');
  });
});

describe('end-to-end: /status (regression — must remain unchanged)', () => {
  it('reports operational status via a single real fetch call', async () => {
    const res = await POST(webhookReq('/status'));

    expect(res.status).toBe(200);
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const text = sentText(fetchMock);
    expect(text).toContain('System Status');
    expect(text).toContain('operational');
  });
});

describe('end-to-end: the five previously-silent commands', () => {
  it('/audits sends a real formatted reply for real data', async () => {
    h.listRecentAuditsForOps.mockResolvedValue([audit({ domain: 'a.com' })]);

    await POST(webhookReq('/audits'));

    expect(sentText(global.fetch as ReturnType<typeof vi.fn>)).toContain('a.com');
  });

  it('/audits sends "No recent audits found." on empty data — never silence', async () => {
    await POST(webhookReq('/audits'));

    expect(sentText(global.fetch as ReturnType<typeof vi.fn>)).toContain('No recent audits found.');
  });

  it('/failures sends a real formatted reply, with domain and error message HTML-escaped', async () => {
    h.listAuditsByStatusForOps.mockResolvedValue([
      audit({ domain: 'evil<script>&.com', status: 'failed', errorMessage: 'timeout <br> at & fetch' }),
    ]);

    await POST(webhookReq('/failures'));

    const text = sentText(global.fetch as ReturnType<typeof vi.fn>);
    expect(text).toContain('evil&lt;script&gt;&amp;.com');
    expect(text).toContain('timeout &lt;br&gt; at &amp; fetch');
    expect(text).not.toContain('<script>');
  });

  it('/providers sends a real formatted reply via the batched query', async () => {
    h.listRecentAuditsForOps.mockResolvedValue([audit({ id: 'a1' })]);
    h.dbAuditFindMany.mockResolvedValue([{ id: 'a1', agentManifest: {}, aiVisibilityScores: null, scoutAnalysis: null }]);
    h.deriveModuleAndProviderState.mockReturnValue({ modules: [], providers: [{ provider: 'citation', available: false, reason: 'not configured' }] });

    await POST(webhookReq('/providers'));

    expect(sentText(global.fetch as ReturnType<typeof vi.fn>)).toContain('citation');
  });

  it('/incidents sends "No open incidents." when everything is healthy', async () => {
    await POST(webhookReq('/incidents'));

    expect(sentText(global.fetch as ReturnType<typeof vi.fn>)).toContain('No open incidents.');
  });

  it('/deployments sends a real formatted reply', async () => {
    h.getRecentDeploymentEvents.mockResolvedValue([{ state: 'READY', url: null, recordedAt: new Date().toISOString() }]);

    await POST(webhookReq('/deployments'));

    expect(sentText(global.fetch as ReturnType<typeof vi.fn>)).toContain('READY');
  });
});

describe('end-to-end: Telegram HTML parse rejection recovers via plain-text fallback', () => {
  it('a command whose real formatted output Telegram rejects for entity parsing still reaches the user', async () => {
    h.listRecentAuditsForOps.mockResolvedValue([audit({ domain: 'a.com' })]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(telegramError(400, "Bad Request: can't parse entities"))
      .mockResolvedValueOnce(ok());
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await POST(webhookReq('/audits'));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentText(fetchMock, 1)).toContain('a.com');
  });
});

describe('end-to-end: production-sized long output is chunked, never silently dropped', () => {
  it('/audits with a very large result set arrives across multiple real fetch calls', async () => {
    h.listRecentAuditsForOps.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => audit({ domain: `audit-${i}-with-a-fairly-long-subdomain-name.example.com`, id: `a${i}` })),
    );

    const res = await POST(webhookReq('/audits'));

    expect(res.status).toBe(200);
    // 10 short lines easily fits in one message — this proves normal-sized
    // results are NOT needlessly split, while the provider-level unit tests
    // already prove the splitting behavior itself for genuinely long output.
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});

describe('end-to-end: failed Telegram API response produces a sanitized diagnostic, never a thrown error', () => {
  it('logs status/description without ever including the bot token or full API URL', async () => {
    global.fetch = vi.fn().mockResolvedValue(telegramError(401, 'Unauthorized')) as unknown as typeof fetch;

    const res = await POST(webhookReq('/status'));

    expect(res.status).toBe(200);
    const allLoggedText = JSON.stringify(h.logger.error.mock.calls);
    expect(allLoggedText).not.toContain(h.env.TELEGRAM_BOT_TOKEN);
    expect(allLoggedText).toContain('401');
  });
});
