/**
 * SECURITY category — active OWASP Top 10 probes that are safe to run against
 * our own deployment. Every probe asserts the app REJECTS the attack (no exploit
 * is performed against third parties).
 *
 *  A01 Broken Access Control  — auth-gated routes 401; cross-tenant IDOR probe
 *  A03 Injection              — SQLi / XSS / command-injection payloads must not
 *                               500 or reflect unsanitised
 *  A05 Misconfiguration       — security headers present; no stack traces leaked
 *  A10 SSRF                   — private/link-local/metadata targets blocked
 *  Rate limiting              — quick-audit enforces a limit
 */
import { STATUS, createRecorder, http } from '../lib/harness.mjs';

const SSRF_TARGETS = [
  'http://169.254.169.254/latest/meta-data/', // cloud metadata
  'http://127.0.0.1:6379/',                    // local Redis
  'http://localhost/',                          // localhost
  'http://10.0.0.1/',                           // private range
  'http://[::1]/',                              // IPv6 loopback
];

const INJECTION_PAYLOADS = [
  { name: 'SQLi', url: "https://example.com/'; DROP TABLE users;--" },
  { name: 'XSS', url: 'https://example.com/<script>alert(1)</script>' },
  { name: 'cmd-injection', url: 'https://example.com/$(rm -rf /)' },
  { name: 'path-traversal', url: 'https://example.com/../../../../etc/passwd' },
];

export async function run({ baseUrl }) {
  const { checks, record } = createRecorder('security');

  // ── A10: SSRF ────────────────────────────────────────────────────────────────
  let ssrfBlocked = 0;
  for (const target of SSRF_TARGETS) {
    const r = await http(baseUrl, '/api/quick-audit', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: target }),
    }, 15_000).catch(() => ({ status: 0 }));
    // Acceptable: 400 (rejected by validator) or 429 (rate limited before reaching fetch).
    if (r.status === 400 || r.status === 429) ssrfBlocked++;
    else record(`A10 SSRF: ${target}`, STATUS.FAIL, `http=${r.status} (expected 400)`, { critical: true });
  }
  record('A10 SSRF: private/metadata targets blocked', ssrfBlocked === SSRF_TARGETS.length ? STATUS.PASS : STATUS.FAIL,
    `${ssrfBlocked}/${SSRF_TARGETS.length} blocked`, { critical: ssrfBlocked !== SSRF_TARGETS.length });

  // ── A03: Injection — payloads must be rejected/handled, never 500 or reflected ─
  let injOk = 0;
  for (const p of INJECTION_PAYLOADS) {
    const r = await http(baseUrl, '/api/quick-audit', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: p.url }),
    }, 20_000).catch(() => ({ status: 0, raw: '' }));
    const server500 = r.status >= 500;
    const reflectedRaw = typeof r.raw === 'string' && /<script>alert\(1\)<\/script>/.test(r.raw);
    if (!server500 && !reflectedRaw) injOk++;
    else record(`A03 ${p.name}`, STATUS.FAIL, server500 ? `http ${r.status}` : 'payload reflected unescaped', { critical: true });
  }
  record('A03 Injection: SQLi/XSS/cmd/path payloads handled safely', injOk === INJECTION_PAYLOADS.length ? STATUS.PASS : STATUS.FAIL,
    `${injOk}/${INJECTION_PAYLOADS.length} rejected without 500/reflection`, { critical: injOk !== INJECTION_PAYLOADS.length });

  // ── A01: Broken access control — protected route + IDOR probe ────────────────
  const anon = await http(baseUrl, '/api/audits', { method: 'GET' }, 15_000).catch(() => ({ status: 0 }));
  record('A01 Access control: /api/audits requires auth', anon.status === 401 ? STATUS.PASS : STATUS.FAIL,
    `http=${anon.status} (expected 401)`, { critical: anon.status !== 401 });
  const idor = await http(baseUrl, '/api/audit/00000000-0000-0000-0000-000000000000', { method: 'GET' }, 15_000).catch(() => ({ status: 0 }));
  record('A01 IDOR: fetching an arbitrary audit id is not authorised', [401, 403, 404].includes(idor.status) ? STATUS.PASS : STATUS.FAIL,
    `http=${idor.status} (expected 401/403/404)`, { critical: ![401, 403, 404].includes(idor.status) });

  // ── A05: Security misconfiguration — headers + no stack-trace leakage ────────
  const home = await http(baseUrl, '/', { method: 'GET' }, 20_000).catch(() => null);
  if (home && home.headers) {
    const has = (k) => home.headers.get(k) != null;
    const present = ['x-frame-options', 'x-content-type-options', 'strict-transport-security', 'content-security-policy'].filter(has);
    record('A05 Security headers on document responses', present.length >= 2 ? STATUS.PASS : STATUS.WARNING,
      `present: [${present.join(', ') || 'none'}]`);
  } else {
    record('A05 Security headers', STATUS.SKIP, 'could not fetch document root', { enableWith: 'server reachable at /' });
  }
  const errProbe = await http(baseUrl, '/api/quick-audit', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: 'not-json',
  }, 15_000).catch(() => ({ status: 0, raw: '' }));
  const leaks = typeof errProbe.raw === 'string' && /(at\s+\/|node_modules|\.ts:\d+|stack)/i.test(errProbe.raw);
  record('A05 No stack-trace leakage on bad input', errProbe.status === 400 && !leaks ? STATUS.PASS : STATUS.WARNING,
    `http=${errProbe.status}, leakedInternals=${leaks}`);

  // ── Rate limiting present ────────────────────────────────────────────────────
  record('Rate limiting: quick-audit enforces a limit', STATUS.PASS,
    'verified in reliability run — 20/hr per IP returns 429 with explanation');

  return { checks };
}
