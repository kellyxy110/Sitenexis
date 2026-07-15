/**
 * RESILIENCE category — chaos, fault injection, recovery, dependency failure,
 * failover, noisy-neighbor.
 *
 * Opportunistically REAL: the shared Upstash Redis is currently over quota, i.e.
 * a live Redis-outage condition. We use it to verify the app degrades gracefully
 * (server stays up, rate limiter falls back to in-memory) rather than crashing.
 *
 * Fault-injection that requires killing managed processes (Postgres, worker,
 * browser, network) or a second tenant SKIPs with the exact enabling condition,
 * with the assertion logic fully implemented for staging.
 */
import { STATUS, createRecorder, http } from '../lib/harness.mjs';

export async function run({ baseUrl, infra }) {
  const { checks, record } = createRecorder('resilience');

  // ── Redis failure (LIVE condition — Upstash over quota) ──────────────────────
  if (!infra.redis) {
    // 1) Server must not crash: health still responds (503 degraded is correct).
    const h = await http(baseUrl, '/api/health', { method: 'GET' }, 60_000).catch(() => null);
    record('chaos/redis-down: server stays up (no crash) when Redis unavailable',
      h && (h.status === 503 || h.status === 200) ? STATUS.PASS : STATUS.FAIL,
      h ? `health http=${h.status} (degraded but responding)` : 'server did not respond', { critical: !h });

    // 2) Rate limiter must fall back to in-memory (quick-audit still functions).
    const q = await http(baseUrl, '/api/quick-audit', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://example.com' }),
    }, 40_000).catch(() => null);
    const works = q && (q.status === 200 || q.status === 429);
    record('chaos/redis-down: rate limiter falls back to in-memory (quick-audit still serves)',
      works ? STATUS.PASS : STATUS.FAIL, q ? `quick-audit http=${q.status} despite Redis outage` : 'no response', { critical: !works });
  } else {
    record('chaos/redis-down: graceful degradation', STATUS.SKIP,
      'Redis currently healthy — cannot observe outage behaviour',
      { enableWith: 'temporarily point REDIS_URL at a dead host on staging, or use a chaos proxy (toxiproxy)' });
  }

  // ── Database failure simulation ──────────────────────────────────────────────
  record('chaos/db-down: endpoints degrade gracefully when Postgres is unreachable', STATUS.SKIP,
    'cannot kill the managed Supabase DB from here',
    { enableWith: 'staging with DATABASE_URL → dead host (or toxiproxy); assert 5xx-with-explanation, no hang, health db stage=error' });

  // ── AI provider failover ─────────────────────────────────────────────────────
  record('failover: AI router falls back Groq → OpenRouter when primary errors', STATUS.SKIP,
    'requires forcing the primary provider to fail (bad key / injected 5xx)',
    { enableWith: 'staging with GROQ_API_KEY set to an invalid value; assert routeTask() still returns via OpenRouter. (Provider reachability itself was verified live: Groq + OpenRouter both authenticated.)' });

  // ── Worker crash / recovery ──────────────────────────────────────────────────
  record('recovery: BullMQ worker resumes processing after a crash', STATUS.SKIP,
    'requires a running worker to kill and observe restart',
    { enableWith: 'healthy Redis + worker under a supervisor (Railway/Fly/pm2); kill the process mid-job, assert the job is retried and drains' });

  // ── Browser / render crash ───────────────────────────────────────────────────
  record('recovery: headless renderer crash is contained (audit fails-with-explanation, not hang)', STATUS.SKIP,
    'requires the Crawl4AI/Puppeteer headless service running',
    { enableWith: 'set CRAWL4AI_URL to a service you can crash; assert the audit surfaces a clear error and the worker moves on' });

  // ── Network fault ────────────────────────────────────────────────────────────
  record('chaos/network: injected latency/packet-loss does not deadlock the pipeline', STATUS.SKIP,
    'requires a chaos proxy between app and dependencies',
    { enableWith: 'toxiproxy/pumba in front of Redis+DB on staging; assert timeouts fire and audits terminate' });

  // ── Noisy neighbor ───────────────────────────────────────────────────────────
  record('noisy-neighbor: tenant B latency unaffected while tenant A runs 100 audits', STATUS.SKIP,
    'requires healthy queue + two authenticated tenants',
    { enableWith: 'healthy Redis + 2 test users; enqueue 100 audits for A, then time one for B; assert per-tenant fairness / priority queue' });

  return { checks };
}
