/**
 * Shared harness for the SiteNexis Launch Validation Suite.
 *
 * Status vocabulary (honest by design):
 *   PASS    — verified working, with evidence
 *   FAIL    — verified broken (critical=true ⇒ release blocker)
 *   WARNING — works but sub-optimal, OR a non-blocking gap
 *   SKIP    — could not run truthfully in this environment; carries the EXACT
 *             condition/command that will let it run (e.g. on staging). SKIP is
 *             never counted as PASS — the framework is complete, the run is honest.
 */

export const STATUS = { PASS: 'PASS', FAIL: 'FAIL', WARNING: 'WARNING', SKIP: 'SKIP' };

export function createRecorder(categoryName) {
  const checks = [];
  const record = (name, status, evidence, opts = {}) => {
    const c = { category: categoryName, name, status, evidence, critical: !!opts.critical, enableWith: opts.enableWith };
    checks.push(c);
    const icon = { PASS: '✓', FAIL: '✗', WARNING: '⚠', SKIP: '⤼' }[status] ?? '?';
    const tail = status === 'SKIP' && opts.enableWith ? `  (enable: ${opts.enableWith})` : '';
    console.log(`    ${icon} [${status}] ${name} — ${evidence}${tail}`);
    return c;
  };
  return { checks, record };
}

/** Fetch JSON with a hard timeout; never throws for HTTP status, only for network/timeout. */
export async function http(baseUrl, path, init = {}, timeoutMs = 30_000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(`${baseUrl}${path}`, { ...init, signal: ac.signal });
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* non-JSON */ }
    return { ok: res.ok, status: res.status, headers: res.headers, body, rawLen: text.length, raw: text, ms: Date.now() - started };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Probe infrastructure availability once via /api/health so category modules can
 * decide RUN vs SKIP truthfully.
 */
export async function probeInfra(baseUrl) {
  const infra = { server: false, db: false, redis: false, worker: false, queue: false, raw: null };
  try {
    const r = await http(baseUrl, '/api/health', { method: 'GET' }, 90_000);
    infra.server = r.status > 0;
    infra.raw = r.body;
    const stages = Array.isArray(r.body?.stages) ? r.body.stages : [];
    const ok = (name) => stages.some((s) => s.stage === name && s.status === 'ok');
    infra.db = ok('db_connectivity');
    infra.redis = ok('redis_ping');
    infra.queue = ok('bullmq_queue');
    infra.worker = ok('worker_heartbeat');
  } catch { /* server down */ }
  return infra;
}

/** percentile of a numeric array (p in 0..100). */
export function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.floor((p / 100) * s.length));
  return s[idx];
}

/** Score a set of checks: % of non-SKIP, non-WARNING checks that PASS. null if none scoreable. */
export function scoreChecks(checks) {
  const scoreable = checks.filter((c) => c.status === STATUS.PASS || c.status === STATUS.FAIL);
  if (scoreable.length === 0) return null;
  return Math.round((scoreable.filter((c) => c.status === STATUS.PASS).length / scoreable.length) * 100);
}
