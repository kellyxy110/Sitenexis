/**
 * FUNCTIONAL + PRODUCTION-READINESS + API-CONTRACT category.
 *
 * Runnable now against any BASE_URL. Verifies the health diagnostics, quick-audit
 * correctness on a control page, env/config readiness, and the HTTP contract of the
 * public and auth-gated API surface (auth-gated routes MUST 401 without a session).
 */
import { STATUS, createRecorder, http } from '../lib/harness.mjs';

// Auth-gated routes: contract is "reject unauthenticated with 401" (never 200/500).
const AUTH_GATED = [
  ['GET', '/api/audits'],
  ['GET', '/api/usage'],
  ['GET', '/api/me'],
  ['GET', '/api/team'],
  ['GET', '/api/portfolio'],
  ['POST', '/api/audit/start'],
];

export async function run({ baseUrl, infra }) {
  const { checks, record } = createRecorder('functional');

  // ── Health diagnostics ──────────────────────────────────────────────────────
  const h = infra.raw;
  if (h && Array.isArray(h.stages)) {
    const failed = h.stages.filter((s) => s.status === 'error').map((s) => s.stage);
    // Only the application's own correctness gates a code-critical FAIL: the app
    // must connect to its database and resolve its Prisma engine. Redis / BullMQ /
    // worker being down is an infrastructure-provisioning state (e.g. the shared
    // dev Redis is over quota, no worker runs locally) — surfaced as a WARNING and
    // tracked as a deploy/ops blocker in the load + resilience categories, not a
    // reason to fail the platform's code readiness.
    const CODE_CRITICAL = ['db_connectivity', 'db_schema', 'prisma_engine'];
    const INFRA_STAGES = ['redis_ping', 'bullmq_queue', 'worker_heartbeat'];
    const codeDown = failed.filter((s) => CODE_CRITICAL.includes(s));
    const infraDown = failed.filter((s) => INFRA_STAGES.includes(s));
    const status = codeDown.length ? STATUS.FAIL : failed.length ? STATUS.WARNING : STATUS.PASS;
    record(
      'health: /api/health returns per-stage diagnostics',
      status,
      `status=${h.status} codeFailures=[${codeDown.join(', ') || 'none'}] infraNotProvisioned=[${infraDown.join(', ') || 'none'}]`,
      { critical: codeDown.length > 0 },
    );
  } else {
    record('health: /api/health responds', STATUS.FAIL, 'no/invalid health response', { critical: true });
  }

  // ── Quick-audit correctness (control page) ───────────────────────────────────
  try {
    const r = await http(baseUrl, '/api/quick-audit', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    }, 40_000);
    const ok = r.status === 200 && typeof r.body?.quickScore === 'number' && Array.isArray(r.body?.issues);
    // example.com is a thin, schema-less page — assert the analyzer actually detects that.
    const detectsThin = ok && r.body.issues.some((i) => i.type === 'thin_content');
    record('quick-audit: scores a control page with accurate issues', ok && detectsThin ? STATUS.PASS : STATUS.FAIL,
      ok ? `score=${r.body.quickScore}, issues=[${r.body.issues.map((i) => i.type).join(',')}]` : `http=${r.status}`,
      { critical: !ok });
  } catch (e) {
    record('quick-audit: scores a control page', STATUS.FAIL, String(e).slice(0, 120), { critical: true });
  }

  // ── Production readiness: env + config ───────────────────────────────────────
  if (h && Array.isArray(h.stages)) {
    const envStage = h.stages.find((s) => s.stage === 'env_vars');
    record('readiness: required env vars present', envStage?.status === 'ok' ? STATUS.PASS : STATUS.WARNING,
      envStage?.status === 'ok' ? 'all required env present' : `env gaps: ${envStage?.error ?? 'unknown'}`);
    const engine = h.stages.find((s) => s.stage === 'prisma_engine');
    record('readiness: Prisma engine resolvable', engine?.status === 'ok' ? STATUS.PASS : STATUS.FAIL,
      engine?.status === 'ok' ? 'engine found' : (engine?.error ?? 'engine missing'), { critical: engine?.status !== 'ok' });
  }

  // ── API contract: auth-gated routes reject unauthenticated with 401 ──────────
  let contractPass = 0, contractFail = 0;
  for (const [method, path] of AUTH_GATED) {
    try {
      const r = await http(baseUrl, path, {
        method, headers: { 'content-type': 'application/json' },
        ...(method === 'POST' ? { body: '{}' } : {}),
      }, 20_000);
      const ok = r.status === 401;
      ok ? contractPass++ : contractFail++;
      if (!ok) record(`api-contract: ${method} ${path} rejects anon`, STATUS.FAIL, `http=${r.status} (expected 401)`, { critical: true });
    } catch (e) {
      contractFail++;
      record(`api-contract: ${method} ${path}`, STATUS.FAIL, `no response: ${String(e).slice(0, 80)}`, { critical: true });
    }
  }
  record('api-contract: auth-gated routes return 401 unauthenticated', contractFail === 0 ? STATUS.PASS : STATUS.FAIL,
    `${contractPass}/${AUTH_GATED.length} routes correctly gated`, { critical: contractFail > 0 });

  return { checks };
}
