#!/usr/bin/env node
/**
 * Produces a real line-coverage snapshot for the certification scorer.
 * Runs vitest --coverage in each package that has the coverage tool, parses the
 * "All files … % Lines" summary, and writes .coverage-snapshot.json. Only packages
 * actually measured appear; the scorer treats a missing snapshot as UNKNOWN.
 *
 *   node scripts/launch-validation/coverage.mjs
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

// Runtime packages considered for the breadth metric.
const RUNTIME_PACKAGES = ['analyzers', 'adapters', 'crawler', 'agents', 'db'];
// Packages that carry both tests AND the @vitest/coverage-v8 tool.
const COVERAGE_PACKAGES = ['analyzers'];

const measured = [];
for (const pkg of COVERAGE_PACKAGES) {
  try {
    const out = execSync(`pnpm --filter @sitenexis/${pkg} exec vitest run --coverage`, {
      cwd: repoRoot, encoding: 'utf8', stdio: 'pipe', timeout: 300_000,
    }).replace(/\x1b\[[0-9;]*m/g, '');
    const m = out.match(/All files\s*\|\s*[\d.]+\s*\|\s*[\d.]+\s*\|\s*[\d.]+\s*\|\s*([\d.]+)/);
    if (m) measured.push({ pkg, linesPct: Number(m[1]) });
  } catch (e) {
    // A coverage failure must not fabricate a number — just omit the package.
    console.error(`coverage failed for ${pkg}: ${String(e).slice(0, 100)}`);
  }
}

const packagesWithTests = ['analyzers', 'adapters', 'db'].length; // measured empirically elsewhere
const snapshot = {
  generatedAt: new Date().toISOString(),
  packagesWithTests,
  runtimePackages: RUNTIME_PACKAGES.length,
  measured,
};
const outPath = join(here, '.coverage-snapshot.json');
writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
console.log(`coverage snapshot → ${outPath}\n`, JSON.stringify(snapshot, null, 2));
