#!/usr/bin/env node
/**
 * Golden Evaluation runner — compares live analyzer output against labelled expected
 * output and computes analytical-quality metrics: precision, recall, F1, false
 * positives/negatives, score variance (reproducibility), and hallucination rate.
 *
 * Runs the deterministic single-page quick-scan dimensions today. The full 12-dimension
 * eval requires the authenticated pipeline (Redis + worker) — those dimensions are
 * reported UNKNOWN, never faked, until labelled on staging.
 *
 *   BASE_URL=http://localhost:3001 node scripts/launch-validation/golden/run.mjs [--json out.json]
 *
 * Exit 0 if F1 ≥ MIN_F1 (default 0.9) and hallucinationRate ≤ MAX_HALLUC (default 0),
 * else 1 — so a release cannot regress analytical quality.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// Import the pure, dependency-free metrics directly from the built analyzers output
// (this script lives outside any workspace package, so it can't resolve @sitenexis/*).
import { setMetrics, aggregate, hallucinationRate, numericMatch, variance } from '../../../packages/analyzers/dist/golden-eval/metrics.js';

const here = dirname(fileURLToPath(import.meta.url));
const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const MIN_F1 = Number(process.env.MIN_F1 ?? 0.9);
const MAX_HALLUC = Number(process.env.MAX_HALLUC ?? 0);
const jsonIdx = process.argv.indexOf('--json');
const jsonOut = jsonIdx >= 0 ? process.argv[jsonIdx + 1] : null;

const dataset = JSON.parse(readFileSync(join(here, 'dataset.json'), 'utf8'));

async function quickAudit(url) {
  const res = await fetch(`${BASE_URL}/api/quick-audit`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }),
  });
  return res.json();
}

async function main() {
  console.log(`\n Golden Evaluation — ${new Date().toISOString()}  target=${BASE_URL}\n`);

  const schemaCases = [];
  const issueCases = [];
  const hallucValues = [];
  const scoreErrors = [];
  const perScoreSamples = {}; // url → [scores] for variance
  const rows = [];

  for (const c of dataset.cases) {
    const g = c.quickScan;
    // Sample twice to measure reproducibility (variance) of the deterministic score.
    const a1 = await quickAudit(c.url);
    const a2 = await quickAudit(c.url);
    const actualSchema = a1.schemaTypes ?? [];
    const actualIssues = (a1.issues ?? []).map((i) => i.type);

    const sm = setMetrics(g.expectedSchemaTypes, actualSchema);
    const im = setMetrics(g.expectedIssueTypes, actualIssues);
    schemaCases.push(sm);
    issueCases.push(im);
    hallucValues.push(hallucinationRate(actualIssues, g.allowedIssueUniverse));
    const nm = numericMatch(g.expectedQuickScore, a1.quickScore ?? -999, dataset.scoreTolerance);
    scoreErrors.push(nm.absError);
    perScoreSamples[c.url] = [a1.quickScore, a2.quickScore].filter((x) => typeof x === 'number');

    const outcomeOk = a1.outcome?.state === g.expectedOutcomeState;
    rows.push({ url: c.url, schemaF1: sm.f1, issueF1: im.f1, scoreErr: nm.absError, scoreMatch: nm.match, outcomeOk });
    console.log(`  ${c.url}`);
    console.log(`     schema P/R/F1=${sm.precision.toFixed(2)}/${sm.recall.toFixed(2)}/${sm.f1.toFixed(2)}  issues P/R/F1=${im.precision.toFixed(2)}/${im.recall.toFixed(2)}/${im.f1.toFixed(2)}`);
    console.log(`     quickScore expected=${g.expectedQuickScore} actual=${a1.quickScore} absErr=${nm.absError} (${nm.match ? 'MATCH' : 'MISS'})  outcome=${a1.outcome?.state ?? '—'} (${outcomeOk ? 'ok' : 'MISMATCH'})`);
  }

  const schemaAgg = aggregate(schemaCases);
  const issueAgg = aggregate(issueCases);
  const macroF1 = (schemaAgg.f1 + issueAgg.f1) / 2;
  const maxHalluc = Math.max(0, ...hallucValues);
  const scoreVarByUrl = Object.fromEntries(Object.entries(perScoreSamples).map(([u, v]) => [u, variance(v)]));
  const maxScoreVar = Math.max(0, ...Object.values(scoreVarByUrl));

  console.log(`\n ── AGGREGATE (runnable quick-scan dimensions) ──`);
  console.log(`   schema:  P=${schemaAgg.precision.toFixed(3)} R=${schemaAgg.recall.toFixed(3)} F1=${schemaAgg.f1.toFixed(3)} FP=${schemaAgg.falsePositives} FN=${schemaAgg.falseNegatives}`);
  console.log(`   issues:  P=${issueAgg.precision.toFixed(3)} R=${issueAgg.recall.toFixed(3)} F1=${issueAgg.f1.toFixed(3)} FP=${issueAgg.falsePositives} FN=${issueAgg.falseNegatives}`);
  console.log(`   macro-F1=${macroF1.toFixed(3)}  hallucinationRate(max)=${maxHalluc.toFixed(3)}  scoreVariance(max)=${maxScoreVar}`);
  console.log(`\n ── FULL PIPELINE DIMENSIONS: UNKNOWN ──`);
  console.log(`   ${dataset.fullPipelineDimensions.join(', ')}`);
  console.log(`   ${dataset.fullPipelineStatus}\n`);

  const pass = macroF1 >= MIN_F1 && maxHalluc <= MAX_HALLUC && schemaAgg.falsePositives === 0;
  const report = {
    generatedAt: new Date().toISOString(), target: BASE_URL,
    precision: { schema: schemaAgg.precision, issues: issueAgg.precision },
    recall: { schema: schemaAgg.recall, issues: issueAgg.recall },
    f1: macroF1, falsePositives: schemaAgg.falsePositives + issueAgg.falsePositives,
    falseNegatives: schemaAgg.falseNegatives + issueAgg.falseNegatives,
    hallucinationRate: maxHalluc, scoreVariance: scoreVarByUrl, scoreErrors,
    labelledCases: dataset.cases.length,
    fullPipeline: { status: 'UNKNOWN', dimensions: dataset.fullPipelineDimensions },
    rows, pass,
  };
  if (jsonOut) { writeFileSync(jsonOut, JSON.stringify(report, null, 2)); console.log(` Report → ${jsonOut}`); }
  console.log(` GOLDEN EVAL: ${pass ? 'PASS' : 'FAIL'} (macro-F1 ${macroF1.toFixed(3)} ≥ ${MIN_F1}, hallucination ${maxHalluc} ≤ ${MAX_HALLUC})`);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error('golden eval crashed:', e); process.exit(2); });
