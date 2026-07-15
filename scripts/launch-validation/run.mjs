#!/usr/bin/env node
/**
 * SiteNexis Launch Validation Suite — production certification runner.
 *
 * Orchestrates every validation category, runs what can be run truthfully against
 * the current target, and SKIPs (never fakes) what needs staging infrastructure —
 * with the exact enable condition for each. Emits the full certification scorecard
 * and a Go/No-Go. Exit 0 = READY (no critical blockers), 1 = NOT READY, 2 = crash.
 *
 *   node scripts/launch-validation/run.mjs                       # local (:3001)
 *   BASE_URL=https://staging.example node scripts/launch-validation/run.mjs --json report.json
 *   ONLY=functional,security node scripts/launch-validation/run.mjs   # subset
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { STATUS, probeInfra, http } from './lib/harness.mjs';
import { computeScorecard, formatScorecard, UNKNOWN } from './lib/scoring-model.mjs';
import { loadCoverageSnapshot } from './lib/coverage-snapshot.mjs';

import * as functional from './categories/functional.mjs';
import * as reliability from './categories/reliability.mjs';
import * as security from './categories/security.mjs';
import * as load from './categories/load.mjs';
import * as resilience from './categories/resilience.mjs';
import * as frontend from './categories/frontend.mjs';
import * as regression from './categories/regression.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const jsonIdx = process.argv.indexOf('--json');
const jsonOut = jsonIdx >= 0 ? process.argv[jsonIdx + 1] : null;
const only = process.env.ONLY ? process.env.ONLY.split(',').map((s) => s.trim()) : null;
const corpus = JSON.parse(readFileSync(join(__dirname, 'diversity-benchmark.json'), 'utf8'));

const CATEGORIES = [
  ['functional', functional],
  ['reliability', reliability],
  ['security', security],
  ['load', load],
  ['resilience', resilience],
  ['frontend', frontend],
  ['regression', regression],
];

async function main() {
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`  SiteNexis Launch Validation Suite — ${new Date().toISOString()}`);
  console.log(`  Target: ${BASE_URL}`);
  console.log(`═══════════════════════════════════════════════════════════`);

  const infra = await probeInfra(BASE_URL);
  console.log(`\nInfrastructure probe: server=${infra.server} db=${infra.db} redis=${infra.redis} queue=${infra.queue} worker=${infra.worker}\n`);
  if (!infra.server) {
    console.error(`FATAL: no server at ${BASE_URL}. Start it (pnpm --filter web dev) or set BASE_URL.`);
    process.exit(2);
  }

  // Warm the routes the suite measures so first-hit compilation (dev servers compile
  // routes on demand under Turbopack) is not mis-attributed as a latency/hang failure.
  // Harmless against a production build where routes are already compiled.
  if (!process.env.SKIP_WARMUP) {
    process.stdout.write('\nWarming routes (health, quick-audit)… ');
    await Promise.all([
      http(BASE_URL, '/api/health', { method: 'GET' }, 180_000).catch(() => {}),
      http(BASE_URL, '/', { method: 'GET' }, 180_000).catch(() => {}),      // compile the document route for the browser check
      http(BASE_URL, '/login', { method: 'GET' }, 180_000).catch(() => {}), // and its redirect target
      http(BASE_URL, '/api/quick-audit', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com' }),
      }, 120_000).catch(() => {}),
    ]);
    console.log('done.');
    // Refresh the infra snapshot post-warmup so the functional health check reads a
    // stable response rather than a cold-start one.
    Object.assign(infra, await probeInfra(BASE_URL));
  }

  const allChecks = [];
  const ctx = { baseUrl: BASE_URL, infra, corpus };
  for (const [name, mod] of CATEGORIES) {
    if (only && !only.includes(name)) continue;
    console.log(`\n▶ ${name.toUpperCase()}`);
    try {
      const res = await mod.run(ctx);
      ctx[name] = res;
      allChecks.push(...res.checks);
    } catch (e) {
      console.error(`  category ${name} crashed: ${e}`);
      allChecks.push({ category: name, name: `${name}: category runner`, status: STATUS.FAIL, evidence: `crashed: ${String(e).slice(0, 120)}`, critical: true });
    }
  }

  // ── Scores (mathematically reproducible; UNKNOWN when inputs unmeasured) ───────
  const coverage = loadCoverageSnapshot(); // null ⇒ testCoverage = UNKNOWN (never invented)
  const scorecard = computeScorecard({ checks: allChecks, perSite: ctx.reliability?.perSite ?? [], infra, coverage });
  const scores = Object.fromEntries(Object.entries(scorecard.scores).map(([k, v]) => [k, v.value]));

  const criticalBlockers = allChecks.filter((c) => c.status === STATUS.FAIL && c.critical);
  const skipped = allChecks.filter((c) => c.status === STATUS.SKIP);
  const warnings = allChecks.filter((c) => c.status === STATUS.WARNING);
  const goNoGo = criticalBlockers.length === 0 ? 'GO' : 'NO-GO';

  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`  CERTIFICATION SCORECARD  (reproducible — see derivations below)`);
  console.log(`═══════════════════════════════════════════════════════════`);
  const label = { launchReadiness: 'Launch Readiness', reliability: 'Reliability', scalability: 'Scalability',
    security: 'Security', performance: 'Performance', infrastructure: 'Infrastructure',
    testCoverage: 'Test Coverage', aiAccuracy: 'AI Accuracy' };
  const line = (k, v) => console.log(`  ${label[k].padEnd(22)} ${v === UNKNOWN ? 'UNKNOWN (input not measured)' : `${v}/100`}`);
  for (const k of Object.keys(label)) line(k, scores[k]);

  // Full derivation: formula + raw inputs + thresholds for every score.
  console.log(`\n  ── SCORE DERIVATIONS ─────────────────────────────────────`);
  console.log(formatScorecard(scorecard));

  console.log(`\n  Passed:  ${allChecks.filter((c) => c.status === STATUS.PASS).length}`);
  console.log(`  Failed:  ${allChecks.filter((c) => c.status === STATUS.FAIL).length} (${criticalBlockers.length} critical)`);
  console.log(`  Warnings:${warnings.length}   Skipped(infra): ${skipped.length}`);

  console.log(`\n  Critical blockers:`);
  if (criticalBlockers.length === 0) console.log('    none 🎉');
  for (const b of criticalBlockers) console.log(`    🔴 [${b.category}] ${b.name} — ${b.evidence}`);

  console.log(`\n  Remaining risks (SKIP — need staging infra):`);
  for (const s of skipped) console.log(`    ⤼ [${s.category}] ${s.name} → ${s.enableWith ?? 'n/a'}`);

  console.log(`\n  ══ GO / NO-GO: ${goNoGo} ══`);
  console.log(goNoGo === 'GO'
    ? '  No critical blockers. Safe to merge/promote (subject to SKIP items on staging).'
    : '  Critical blockers present — DO NOT merge until resolved with evidence.\n');

  const report = {
    generatedAt: new Date().toISOString(), target: BASE_URL, infra,
    scores, scoreDerivations: scorecard.scores, goNoGo,
    criticalBlockers: criticalBlockers.map((c) => ({ category: c.category, name: c.name, evidence: c.evidence })),
    warnings: warnings.map((c) => ({ category: c.category, name: c.name, evidence: c.evidence })),
    skipped: skipped.map((c) => ({ category: c.category, name: c.name, enableWith: c.enableWith })),
    checks: allChecks,
    perSite: ctx.reliability?.perSite ?? [],
  };
  if (jsonOut) { writeFileSync(jsonOut, JSON.stringify(report, null, 2)); console.log(`\n  Report → ${jsonOut}`); }

  process.exit(criticalBlockers.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error('Suite crashed:', e); process.exit(2); });
