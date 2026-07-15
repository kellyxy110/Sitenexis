/**
 * Deterministic, reproducible scoring model for the SiteNexis certification.
 *
 * Design invariant (per the certification contract):
 *   • Every score is a pure function of RAW MEASUREMENTS taken during the run.
 *   • Every score carries its formula, its inputs, its thresholds, and its result.
 *   • A score whose required inputs were not measured is UNKNOWN — never a guess,
 *     never a placeholder number. UNKNOWN is a first-class, honest outcome.
 *
 * Nothing here estimates. Given the same report JSON, this module always returns
 * the same scorecard.
 */

export const UNKNOWN = 'UNKNOWN';

/** Count check statuses within a category (or all checks if category omitted). */
function tally(checks, category) {
  const cs = category ? checks.filter((c) => c.category === category) : checks;
  return {
    pass: cs.filter((c) => c.status === 'PASS').length,
    fail: cs.filter((c) => c.status === 'FAIL').length,
    warn: cs.filter((c) => c.status === 'WARNING').length,
    skip: cs.filter((c) => c.status === 'SKIP').length,
    total: cs.length,
  };
}

const pct = (num, den) => (den === 0 ? null : Math.round((num / den) * 1000) / 10);

/**
 * @param report { checks, perSite, infra, load, coverage }
 *   coverage (optional): { packagesWithTests, runtimePackages, measured: [{pkg, linesPct}] }
 * @returns { scores: {id: ScoreResult}, meta }
 *
 * ScoreResult = {
 *   value: number|UNKNOWN, unit, formula, metrics:[{id, raw, weight, threshold, pass}],
 *   passFail, reason
 * }
 */
export function computeScorecard(report) {
  const { checks = [], perSite = [], infra = {}, coverage = null } = report;
  const scores = {};

  // ── Launch Readiness ─────────────────────────────────────────────────────────
  // Fraction of DEFINITIVE checks (PASS or FAIL only) that passed. WARNING and SKIP
  // are excluded because they are not binary verifications.
  {
    const t = tally(checks);
    const denom = t.pass + t.fail;
    scores.launchReadiness = {
      value: denom === 0 ? UNKNOWN : pct(t.pass, denom),
      unit: '% of definitive checks passing',
      formula: '100 × PASS / (PASS + FAIL)   [WARNING and SKIP excluded]',
      metrics: [
        { id: 'definitive_checks_passed', raw: t.pass, weight: 1, threshold: '—', pass: null },
        { id: 'definitive_checks_failed', raw: t.fail, weight: 1, threshold: '= 0 for GO', pass: t.fail === 0 },
        { id: 'excluded_warnings', raw: t.warn, weight: 0, threshold: '—', pass: null },
        { id: 'excluded_skips', raw: t.skip, weight: 0, threshold: '—', pass: null },
      ],
      passFail: t.fail === 0 ? 'PASS' : 'FAIL',
      reason: `${t.pass} passed / ${t.fail} failed of ${t.pass + t.fail} definitive checks`,
    };
  }

  // ── Reliability ──────────────────────────────────────────────────────────────
  // Share of probed corpus sites that terminated WITH a machine-readable outcome
  // (no silent hang / empty body / unexplained 5xx). This is the platform's core
  // "no site fails silently" guarantee, measured per-site.
  {
    const total = perSite.length;
    const silent = perSite.filter((p) => p.verdict === 'FAIL').length;
    scores.reliability = {
      value: total === 0 ? UNKNOWN : pct(total - silent, total),
      unit: '% of sites terminating with an explained outcome',
      formula: '100 × (sitesProbed − silentFailures) / sitesProbed',
      metrics: [
        { id: 'sites_probed', raw: total, weight: 1, threshold: '≥ 1 to score', pass: total > 0 },
        { id: 'silent_failures', raw: silent, weight: 1, threshold: '= 0 for PASS', pass: silent === 0 },
      ],
      passFail: total === 0 ? UNKNOWN : silent === 0 ? 'PASS' : 'FAIL',
      reason: total === 0 ? 'no sites probed' : `${silent} silent failures across ${total} sites`,
    };
  }

  // ── Security ─────────────────────────────────────────────────────────────────
  // Fraction of active OWASP probes that the app correctly defended. Each probe is
  // a binary PASS/FAIL; SKIP/WARNING excluded.
  {
    const t = tally(checks, 'security');
    const denom = t.pass + t.fail;
    scores.security = {
      value: denom === 0 ? UNKNOWN : pct(t.pass, denom),
      unit: '% of OWASP probes defended',
      formula: '100 × PASS / (PASS + FAIL) over the security category',
      metrics: [
        { id: 'probes_defended', raw: t.pass, weight: 1, threshold: '—', pass: null },
        { id: 'probes_failed', raw: t.fail, weight: 1, threshold: '= 0 for PASS', pass: t.fail === 0 },
      ],
      passFail: denom === 0 ? UNKNOWN : t.fail === 0 ? 'PASS' : 'FAIL',
      reason: `${t.pass}/${denom} probes defended (A01/A03/A05/A10 + rate-limit)`,
    };
  }

  // ── Infrastructure (environment dependency availability, point-in-time) ───────
  // NOT a code score — a measurement of which runtime dependencies were reachable
  // in THIS environment at run time. Reported so the reader can see what was live.
  {
    const deps = ['server', 'db', 'redis', 'queue', 'worker'];
    const up = deps.filter((d) => infra[d]).length;
    scores.infrastructure = {
      value: pct(up, deps.length),
      unit: '% of runtime dependencies reachable (this environment)',
      formula: '100 × dependenciesReachable / dependenciesProbed',
      metrics: deps.map((d) => ({ id: d, raw: infra[d] ? 'up' : 'down', weight: 1, threshold: 'up', pass: !!infra[d] })),
      passFail: up === deps.length ? 'PASS' : 'PARTIAL',
      reason: `${up}/${deps.length} reachable: ${deps.filter((d) => infra[d]).join(', ') || 'none'}`,
    };
  }

  // ── Test Coverage ────────────────────────────────────────────────────────────
  // Two honest sub-metrics. Breadth = packages carrying ≥1 unit test. Depth =
  // measured line coverage where the coverage tool was run. No single inflated number.
  {
    if (!coverage) {
      scores.testCoverage = {
        value: UNKNOWN, unit: '—', formula: 'breadth = testedPkgs/runtimePkgs; depth = measured line %',
        metrics: [], passFail: UNKNOWN, reason: 'coverage inputs not supplied to the scorer',
      };
    } else {
      const breadth = pct(coverage.packagesWithTests, coverage.runtimePackages);
      scores.testCoverage = {
        value: breadth,
        unit: '% of runtime packages with a unit-test suite (breadth)',
        formula: 'breadth = 100 × packagesWithTests / runtimePackages',
        metrics: [
          { id: 'packages_with_tests', raw: coverage.packagesWithTests, weight: 1, threshold: '—', pass: null },
          { id: 'runtime_packages', raw: coverage.runtimePackages, weight: 1, threshold: '—', pass: null },
          ...coverage.measured.map((m) => ({
            id: `line_coverage:${m.pkg}`, raw: `${m.linesPct}%`, weight: 0,
            threshold: '≥ 80% target', pass: m.linesPct >= 80,
          })),
        ],
        passFail: breadth >= 80 ? 'PASS' : 'BELOW_TARGET',
        reason: `breadth ${breadth}% (${coverage.packagesWithTests}/${coverage.runtimePackages}); measured line coverage: ` +
          coverage.measured.map((m) => `${m.pkg}=${m.linesPct}%`).join(', '),
      };
    }
  }

  // ── Scalability — UNKNOWN unless a real audit-pipeline throughput was measured ─
  // The HTTP ramp against /api/health is Redis-timeout-bound (see Performance) and
  // yields no clean PASS/FAIL, so it does not score. A true scalability number needs
  // healthy Redis + queue + an auth token to enqueue real audits at concurrency.
  {
    const t = tally(checks, 'load');
    const measured = t.pass + t.fail > 0; // only definitive load checks count
    scores.scalability = {
      value: measured ? pct(t.pass, t.pass + t.fail) : UNKNOWN,
      unit: measured ? '% of load checks passing' : '—',
      formula: '100 × PASS / (PASS + FAIL) over definitive audit-pipeline load checks',
      metrics: [
        { id: 'definitive_load_checks', raw: t.pass + t.fail, weight: 1, threshold: '≥ 1 to score', pass: measured },
        { id: 'warnings_dev_indicative', raw: t.warn, weight: 0, threshold: '—', pass: null },
        { id: 'skipped_need_infra', raw: t.skip, weight: 0, threshold: '—', pass: null },
      ],
      passFail: measured ? (t.fail === 0 ? 'PASS' : 'FAIL') : UNKNOWN,
      reason: measured ? `${t.pass}/${t.pass + t.fail}` :
        'no definitive audit-pipeline load measurement (needs healthy Redis+queue+auth to enqueue at scale)',
    };
  }

  // ── Performance — UNKNOWN in this environment ────────────────────────────────
  // The only unauthenticated probe endpoint (/api/health) deliberately runs a ~5s
  // Redis-ping race and returns 503 when Redis is over quota, so its latency is
  // dominated by that timeout, not by throughput. There is no valid p95 to score.
  {
    scores.performance = {
      value: UNKNOWN,
      unit: '—',
      formula: 'p50/p95/p99 latency + throughput of a representative always-200 endpoint under load',
      metrics: [
        { id: 'representative_endpoint', raw: 'none available unauthenticated', weight: 1, threshold: '—', pass: false },
      ],
      passFail: UNKNOWN,
      reason: 'the only unauth probe (/api/health) is Redis-timeout-bound; needs a production build + healthy Redis (or a dedicated always-200 liveness route) to measure truthfully',
    };
  }

  // ── AI Accuracy — UNKNOWN until the Golden Evaluation Dataset is labelled ─────
  {
    const gold = report.goldenEval ?? null;
    scores.aiAccuracy = gold && gold.labelledCases > 0
      ? {
          value: gold.f1 != null ? Math.round(gold.f1 * 1000) / 10 : UNKNOWN,
          unit: '% (macro-F1 across scored dimensions)',
          formula: 'F1 = 2·P·R/(P+R) aggregated across labelled golden cases',
          metrics: [
            { id: 'labelled_cases', raw: gold.labelledCases, weight: 1, threshold: '≥ 1', pass: gold.labelledCases > 0 },
            { id: 'precision', raw: gold.precision, weight: 1, threshold: '—', pass: null },
            { id: 'recall', raw: gold.recall, weight: 1, threshold: '—', pass: null },
          ],
          passFail: gold.f1 != null ? (gold.f1 >= 0.8 ? 'PASS' : 'BELOW_TARGET') : UNKNOWN,
          reason: `${gold.labelledCases} labelled cases`,
        }
      : {
          value: UNKNOWN, unit: '—',
          formula: 'Precision/Recall/F1 vs. a labelled Golden Evaluation Dataset',
          metrics: [{ id: 'labelled_golden_cases', raw: 0, weight: 1, threshold: '≥ 1 to score', pass: false }],
          passFail: UNKNOWN,
          reason: 'no labelled golden cases available; framework in scripts/launch-validation/golden/',
        };
  }

  return { scores, meta: { generatedAt: new Date().toISOString(), model: 'scoring-model@1' } };
}

/** Human-readable, reproducible derivation table. */
export function formatScorecard(scorecard) {
  const lines = [];
  for (const [id, s] of Object.entries(scorecard.scores)) {
    const val = s.value === UNKNOWN ? 'UNKNOWN' : `${s.value}/100`;
    lines.push(`\n■ ${id} = ${val}   [${s.passFail}]`);
    lines.push(`    formula: ${s.formula}`);
    for (const m of s.metrics) {
      const p = m.pass === null ? '' : m.pass ? ' ✓' : ' ✗';
      lines.push(`      • ${m.id}: raw=${m.raw}  weight=${m.weight}  threshold=${m.threshold}${p}`);
    }
    lines.push(`    → ${s.reason}`);
  }
  return lines.join('\n');
}
