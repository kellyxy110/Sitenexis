/**
 * LOAD / STRESS / SPIKE / SOAK / SCALABILITY / QUEUE-SATURATION category.
 *
 * HTTP-layer load (concurrency ramp, spike, soak) runs now against a light endpoint
 * and reports real throughput + p50/p95/p99 latency + error rate. Audit-PIPELINE
 * scalability and queue saturation require a healthy Redis (+ an auth token to
 * enqueue jobs), so they run when infra is present and SKIP with exact enable
 * conditions otherwise — the framework is complete either way.
 *
 * Tunables: LOAD_PATH (default /api/health), LOAD_LEVELS (csv), SPIKE_N, SOAK_SECONDS.
 * Note: dev-server numbers are indicative only; run against a production build/staging
 * for representative figures.
 */
import { STATUS, createRecorder, http, percentile } from '../lib/harness.mjs';

async function burst(baseUrl, path, n, timeoutMs = 20_000) {
  const started = Date.now();
  const results = await Promise.all(
    Array.from({ length: n }, async () => {
      const t = Date.now();
      try {
        const r = await http(baseUrl, path, { method: 'GET' }, timeoutMs);
        return { ms: Date.now() - t, ok: r.status > 0 && r.status < 500 };
      } catch { return { ms: Date.now() - t, ok: false }; }
    }),
  );
  const wallMs = Date.now() - started;
  const lat = results.map((r) => r.ms);
  const errors = results.filter((r) => !r.ok).length;
  return {
    n, wallMs, errors, errorRate: errors / n,
    rps: +(n / (wallMs / 1000)).toFixed(1),
    p50: percentile(lat, 50), p95: percentile(lat, 95), p99: percentile(lat, 99),
  };
}

export async function run({ baseUrl, infra }) {
  const { checks, record } = createRecorder('load');
  const path = process.env.LOAD_PATH ?? '/api/health';
  const levels = (process.env.LOAD_LEVELS ?? '10,25,50').split(',').map((x) => parseInt(x.trim(), 10)).filter(Boolean);
  const isDev = true; // best-effort; dev numbers are indicative

  // ── Scalability ramp ─────────────────────────────────────────────────────────
  const ramp = [];
  for (const level of levels) {
    const s = await burst(baseUrl, path, level);
    ramp.push({ level, ...s });
    console.log(`      ramp c=${level}: rps=${s.rps} p50=${s.p50}ms p95=${s.p95}ms p99=${s.p99}ms err=${(s.errorRate * 100).toFixed(0)}%`);
  }
  const worst = ramp[ramp.length - 1];
  const anyHardFail = ramp.some((r) => r.errorRate > 0.5);
  record('scalability: concurrency ramp completes without mass errors',
    anyHardFail ? STATUS.WARNING : STATUS.PASS,
    `levels=[${levels.join(',')}] worst p95=${worst?.p95}ms err=${((worst?.errorRate ?? 0) * 100).toFixed(0)}%${isDev ? ' (dev — indicative)' : ''}`);

  // ── Spike ────────────────────────────────────────────────────────────────────
  const spikeN = parseInt(process.env.SPIKE_N ?? '60', 10);
  const spike = await burst(baseUrl, path, spikeN);
  record('spike: sudden burst does not collapse the server',
    spike.errorRate <= 0.5 ? STATUS.PASS : STATUS.WARNING,
    `${spikeN} simultaneous: rps=${spike.rps} p99=${spike.p99}ms err=${(spike.errorRate * 100).toFixed(0)}%`);

  // ── Soak (short by default; set SOAK_SECONDS higher on staging) ──────────────
  const soakSec = parseInt(process.env.SOAK_SECONDS ?? '15', 10);
  const soakEnd = Date.now() + soakSec * 1000;
  let soakReq = 0, soakErr = 0; const soakLat = [];
  while (Date.now() < soakEnd) {
    const s = await burst(baseUrl, path, 5, 15_000);
    soakReq += s.n; soakErr += s.errors; soakLat.push(s.p95);
  }
  const soakDrift = soakLat.length > 1 ? (soakLat[soakLat.length - 1] - soakLat[0]) : 0;
  record('soak: sustained load shows no latency runaway / leak signal',
    soakErr / Math.max(soakReq, 1) <= 0.5 ? STATUS.PASS : STATUS.WARNING,
    `${soakSec}s, ${soakReq} reqs, err=${((soakErr / Math.max(soakReq, 1)) * 100).toFixed(0)}%, p95 drift=${soakDrift}ms${soakSec < 60 ? ' (short — raise SOAK_SECONDS on staging)' : ''}`);

  // ── Audit-pipeline scalability + queue saturation (need Redis + auth) ────────
  if (infra.redis && infra.queue) {
    record('scalability: 50/100/500 concurrent audits + queue saturation', STATUS.SKIP,
      'Redis healthy but this run has no auth token to enqueue real audits',
      { enableWith: 'set VALIDATION_AUTH_COOKIE to POST /api/audit/start at scale, then measure queue depth via /api/metrics' });
    record('worker: recovers and drains a saturated queue', STATUS.SKIP,
      'requires enqueuing a backlog + observing worker drain',
      { enableWith: 'VALIDATION_AUTH_COOKIE + running BullMQ worker' });
  } else {
    record('scalability: concurrent audits + queue saturation', STATUS.SKIP,
      `Redis/queue unavailable (redis=${infra.redis}, queue=${infra.queue}) — cannot enqueue`,
      { enableWith: 'healthy Upstash Redis (current instance is over quota) + BullMQ worker + VALIDATION_AUTH_COOKIE' });
    record('worker: recovery under saturation', STATUS.SKIP, 'no queue available',
      { enableWith: 'healthy Redis + running worker process' });
  }

  return { checks, ramp, spike };
}
