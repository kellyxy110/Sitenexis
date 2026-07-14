#!/usr/bin/env node
/**
 * SiteNexis Launch Validation Suite — v1 (production certification runner)
 *
 * Purpose: certify production readiness with evidence. Every check emits PASS / FAIL /
 * WARNING and contributes to a Launch Readiness Score. A deployment may only be marked
 * READY when there are zero CRITICAL blockers and all mandatory checks pass.
 *
 * v1 implements the two categories that are runnable without extra infrastructure and
 * that directly certify the robustness the Mayo Clinic case exposed:
 *   • FUNCTIONAL  — /api/health diagnostics + /api/quick-audit correctness on real sites
 *   • RELIABILITY — audit the Website Diversity Benchmark; NO site may fail silently
 *                   (blank result / hang / 5xx / uncaught exception). "Failed with a
 *                   clear reason" is an acceptable terminal state; silence is not.
 *
 * Heavier categories (SCALABILITY / STRESS / CHAOS / NOISY-NEIGHBOR / BROWSER / A11Y /
 * full SECURITY scan) are declared and reported as WARNING "not-yet-implemented" so the
 * score is honest — they are NOT counted as PASS. See README for the phased plan.
 *
 * Usage:
 *   node scripts/launch-validation/run.mjs                 # against http://localhost:3001
 *   BASE_URL=https://sitenexis.vercel.app node scripts/launch-validation/run.mjs
 *   node scripts/launch-validation/run.mjs --json report.json
 *
 * Exit code: 0 = READY (no critical blockers), 1 = NOT READY.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const PER_SITE_TIMEOUT_MS = Number(process.env.SITE_TIMEOUT_MS ?? 45_000);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 4);
const jsonOutIdx = process.argv.indexOf('--json');
const jsonOut = jsonOutIdx >= 0 ? process.argv[jsonOutIdx + 1] : null;

const corpus = JSON.parse(readFileSync(join(__dirname, 'diversity-benchmark.json'), 'utf8'));

/** @typedef {{name:string,status:'PASS'|'FAIL'|'WARNING',evidence:string,critical?:boolean}} Check */
/** @type {Check[]} */
const checks = [];
const record = (name, status, evidence, critical = false) => {
  checks.push({ name, status, evidence, critical });
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
  console.log(`  ${icon} [${status}] ${name} — ${evidence}`);
};

async function fetchJson(path, init, timeoutMs = PER_SITE_TIMEOUT_MS) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...init, signal: ac.signal });
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* non-JSON */ }
    return { ok: res.ok, status: res.status, body, rawLen: text.length, ms: Date.now() - started };
  } finally {
    clearTimeout(t);
  }
}

// ── Category: FUNCTIONAL ──────────────────────────────────────────────────────
async function functional() {
  console.log('\n▶ FUNCTIONAL');

  // Health endpoint must respond and self-report per-stage status.
  try {
    const h = await fetchJson('/api/health', { method: 'GET' }, 90_000);
    if (h.body && Array.isArray(h.body.stages)) {
      const failed = h.body.stages.filter((s) => s.status === 'error').map((s) => s.stage);
      const crit = failed.some((s) => s === 'db_connectivity' || s === 'redis_ping');
      record(
        'health: endpoint responds with per-stage diagnostics',
        failed.length === 0 ? 'PASS' : crit ? 'FAIL' : 'WARNING',
        `http=${h.status} status=${h.body.status} failedStages=[${failed.join(', ') || 'none'}]`,
        crit,
      );
    } else {
      record('health: endpoint responds with per-stage diagnostics', 'FAIL', `unexpected body (http=${h.status})`, true);
    }
  } catch (e) {
    record('health: endpoint responds', 'FAIL', `no response: ${String(e).slice(0, 120)}`, true);
  }

  // Quick-audit correctness on a known control page.
  try {
    const r = await fetchJson('/api/quick-audit', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    const ok = r.status === 200 && r.body && typeof r.body.quickScore === 'number' && Array.isArray(r.body.issues);
    record('quick-audit: scores a real page correctly', ok ? 'PASS' : 'FAIL',
      ok ? `example.com → score=${r.body.quickScore}, issues=${r.body.issues.length}` : `http=${r.status}`, !ok);
  } catch (e) {
    record('quick-audit: scores a real page', 'FAIL', String(e).slice(0, 120), true);
  }

  // SSRF guard must reject private addresses.
  const ssrf = await fetchJson('/api/quick-audit', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'http://169.254.169.254/latest/meta-data/' }),
  }).catch(() => ({ status: 0 }));
  record('security: SSRF guard blocks link-local metadata IP', ssrf.status === 400 ? 'PASS' : 'FAIL',
    `http=${ssrf.status} (expected 400)`, ssrf.status !== 400);
}

// ── Category: RELIABILITY (the heart of the Mayo certification) ────────────────
function classifyOutcome(site, r, err) {
  // FAIL only when the platform itself misbehaves: hang, 5xx, empty/garbage body, crash.
  if (err) {
    const aborted = /abort/i.test(String(err));
    return { verdict: 'FAIL', reason: aborted ? `TIMEOUT after ${PER_SITE_TIMEOUT_MS}ms (silent hang)` : `network error: ${String(err).slice(0, 80)}` };
  }
  if (r.status >= 500) return { verdict: 'FAIL', reason: `platform ${r.status} (server error, not a graceful result)` };
  if (!r.body) return { verdict: 'FAIL', reason: `non-JSON / empty body (len=${r.rawLen})` };

  // 200 with a score → audited. 200 with a structured error, or 4xx w/ reason → graceful.
  const b = r.body;
  if (r.status === 200 && typeof b.quickScore === 'number') {
    return { verdict: 'PASS', reason: `audited (score=${b.quickScore}, ${b.wordCount ?? '?'} words) in ${r.ms}ms` };
  }
  const reason = b.error ? (typeof b.error === 'string' ? b.error : JSON.stringify(b.error)) : b.status ? `http ${b.status}` : null;
  if (reason) {
    return { verdict: 'PASS', reason: `graceful failure-with-explanation: ${String(reason).slice(0, 90)}` };
  }
  return { verdict: 'FAIL', reason: `200 but no score and no explanation — ambiguous/blank result` };
}

async function reliability() {
  console.log(`\n▶ RELIABILITY — Website Diversity Benchmark (${corpus.sites.length} sites, base=${BASE_URL})`);
  const sites = corpus.sites;
  let idx = 0;
  const perSite = [];
  async function worker() {
    while (idx < sites.length) {
      const site = sites[idx++];
      let out, error;
      // Retry once on a transient platform 5xx (e.g. cold route compile / momentary
      // upstream blip) before declaring a silent failure — avoids false FAILs while
      // still catching reproducible non-graceful responses.
      for (let attempt = 0; attempt < 2; attempt++) {
        error = undefined;
        try {
          out = await fetchJson('/api/quick-audit', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ url: site.url }),
          });
        } catch (e) { error = e; }
        if (!out || out.status < 500) break;
      }
      const c = classifyOutcome(site, out ?? {}, error);
      perSite.push({ url: site.url, category: site.category, protection: site.protection, ...c });
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, sites.length) }, worker));

  const fails = perSite.filter((p) => p.verdict === 'FAIL');
  for (const p of perSite) {
    const icon = p.verdict === 'PASS' ? '✓' : '✗';
    console.log(`    ${icon} ${p.url.padEnd(48)} [${p.protection}] ${p.reason}`);
  }
  record(
    'reliability: no benchmark site fails silently (blank/hang/5xx)',
    fails.length === 0 ? 'PASS' : 'FAIL',
    `${perSite.length - fails.length}/${perSite.length} produced a terminal result with explanation; ${fails.length} silent failures`,
    fails.length > 0,
  );
  return perSite;
}

// ── Declared-but-pending categories (honest WARNING, never fake PASS) ──────────
function pending() {
  console.log('\n▶ PENDING (declared, not yet automated — see README phased plan)');
  for (const name of [
    'scalability: 10/50/100/500 concurrent audits + queue saturation',
    'stress: 429/403/500 upstreams, huge DOM, million-page sites',
    'resilience/chaos: kill Redis/Postgres/AI/worker/browser mid-audit',
    'noisy-neighbor: tenant isolation + fair scheduling',
    'browser: Chrome/Firefox/Safari/Edge + mobile (Playwright)',
    'accessibility: WCAG AA, keyboard, contrast, focus order',
    'security: full OWASP Top 10 (SQLi/XSS/CSRF/authz bypass) scan',
  ]) record(name, 'WARNING', 'not-yet-implemented (phased) — excluded from PASS count');
}

// ── Scoring ────────────────────────────────────────────────────────────────────
function scoreOf(filterFn) {
  const scoped = checks.filter(filterFn);
  const scor = scoped.filter((c) => c.status !== 'WARNING');
  if (scor.length === 0) return null;
  const passed = scor.filter((c) => c.status === 'PASS').length;
  return Math.round((passed / scor.length) * 100);
}

async function main() {
  console.log(`\n═══ SiteNexis Launch Validation Suite v1 ═══\nTarget: ${BASE_URL}\n`);
  await functional();
  const perSite = await reliability();
  pending();

  const criticalBlockers = checks.filter((c) => c.status === 'FAIL' && c.critical);
  const functionalScore = scoreOf((c) => /^(health|quick-audit|security: SSRF)/.test(c.name)) ?? 0;
  const reliabilityScore = (() => {
    const total = perSite.length || 1;
    const good = perSite.filter((p) => p.verdict === 'PASS').length;
    return Math.round((good / total) * 100);
  })();
  const implemented = checks.filter((c) => c.status !== 'WARNING');
  const launchReadiness = Math.round((implemented.filter((c) => c.status === 'PASS').length / (implemented.length || 1)) * 100);

  const report = {
    generatedAt: new Date().toISOString(),
    target: BASE_URL,
    scores: {
      launchReadiness,
      functional: functionalScore,
      reliability: reliabilityScore,
      scalability: null, security: null, performance: null, infrastructure: null,
      testCoverage: null, operationalReadiness: null, deploymentReadiness: null,
    },
    criticalBlockers: criticalBlockers.map((c) => `${c.name} — ${c.evidence}`),
    pendingCategories: checks.filter((c) => c.status === 'WARNING').map((c) => c.name),
    checks,
    perSite,
    verdict: criticalBlockers.length === 0 ? 'READY' : 'NOT-READY',
  };

  console.log('\n═══ CERTIFICATION SUMMARY ═══');
  console.log(`Launch Readiness (implemented checks): ${launchReadiness}/100`);
  console.log(`  Functional:   ${functionalScore}/100`);
  console.log(`  Reliability:  ${reliabilityScore}/100  (diversity benchmark)`);
  console.log(`Critical blockers: ${criticalBlockers.length}`);
  for (const b of report.criticalBlockers) console.log(`  🔴 ${b}`);
  console.log(`\nVERDICT: ${report.verdict}`);
  if (jsonOut) { writeFileSync(jsonOut, JSON.stringify(report, null, 2)); console.log(`\nReport written to ${jsonOut}`); }

  process.exit(criticalBlockers.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error('Validation suite crashed:', e); process.exit(2); });
