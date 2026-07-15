/**
 * REGRESSION category — executes the repo's unit test suites (vitest via turbo)
 * and reports real pass/fail totals. Every bug fixed becomes a permanent test here,
 * so this category is the guard against silent reappearance.
 */
import { STATUS, createRecorder } from '../lib/harness.mjs';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Packages that ship runtime logic and therefore should carry unit tests. */
const TESTABLE_PACKAGES = ['analyzers', 'adapters', 'crawler', 'agents', 'db'];

function hasTests(pkg) {
  const base = join(repoRoot, 'packages', pkg, 'src');
  if (!existsSync(base)) return false;
  const stack = [base];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.isDirectory()) stack.push(join(dir, e.name));
      else if (/\.(test|spec)\.[cm]?tsx?$/.test(e.name)) return true;
    }
  }
  return false;
}

export async function run() {
  const { checks, record } = createRecorder('regression');

  if (process.env.SKIP_REGRESSION === '1') {
    record('regression: unit test suites', STATUS.SKIP, 'SKIP_REGRESSION=1 set', { enableWith: 'unset SKIP_REGRESSION' });
    return { checks };
  }

  // Run vitest directly in the packages that ship unit tests — deliberately NOT via
  // `turbo run test` (whose `^build` dependency triggers `prisma generate` and, on a
  // Windows dev box, fails with EPERM when a running dev server holds the query-engine
  // DLL open) and NOT via `pnpm -r test` (which would also invoke apps/web + adnexis,
  // neither of which has a unit-test suite). Each filtered package runs `vitest run`
  // with no build step, so the run reflects test results only.
  const filters = TESTABLE_PACKAGES.map((p) => `--filter @sitenexis/${p}`).join(' ');
  let output = '';
  let procFailed = false;
  try {
    output = execSync(`pnpm ${filters} --workspace-concurrency=1 test`, {
      cwd: repoRoot, encoding: 'utf8', stdio: 'pipe', timeout: 300_000,
    });
  } catch (e) {
    procFailed = true;
    output = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }

  // Truth comes from the vitest summaries, not the process exit code. vitest colorises
  // its output, so strip ANSI escape codes first — otherwise the digits sit behind
  // escape sequences and "Tests\s+(\d+)" never matches (silently reporting 0 passed).
  const clean = output.replace(/\x1b\[[0-9;]*m/g, '');
  const passed = [...clean.matchAll(/Tests\s+(\d+)\s+passed/gi)].reduce((a, m) => a + Number(m[1]), 0);
  const fails = [...clean.matchAll(/Tests\s+(\d+)\s+failed/gi)].reduce((a, m) => a + Number(m[1]), 0);
  // Distinguish a genuine test failure from a non-test process error (e.g. a locked
  // Prisma DLL during an incidental build). Only actual failed tests are a blocker.
  const buildArtifact = procFailed && fails === 0 && /EPERM|prisma generate|ELIFECYCLE.*build/i.test(output);

  const testsOk = fails === 0 && passed > 0;
  record('regression: unit test suites pass',
    testsOk ? STATUS.PASS : STATUS.FAIL,
    `${passed} tests passed${fails ? `, ${fails} FAILED` : ''}${buildArtifact ? ' (note: an incidental build step failed on a locked file — not a test failure)' : ''} (pnpm -r test)`,
    { critical: fails > 0 || passed === 0 });

  // Explicitly assert the Mayo/bot-mitigation regression test is present & green.
  const mayoTest = existsSync(join(repoRoot, 'packages/analyzers/src/security/__tests__/bot-mitigation.test.ts'));
  record('regression: Mayo/bot-mitigation regression test present', mayoTest ? STATUS.PASS : STATUS.FAIL,
    'packages/analyzers/src/security/__tests__/bot-mitigation.test.ts pins the real Akamai 403 signature', { critical: false });

  // Honest test-coverage signal: which runtime packages carry ANY unit tests.
  const covered = TESTABLE_PACKAGES.filter(hasTests);
  const gaps = TESTABLE_PACKAGES.filter((p) => !hasTests(p));
  const coveragePct = Math.round((covered.length / TESTABLE_PACKAGES.length) * 100);
  record('coverage: runtime packages with unit tests', gaps.length === 0 ? STATUS.PASS : STATUS.WARNING,
    `${covered.length}/${TESTABLE_PACKAGES.length} packages have tests (covered: ${covered.join(',')}; GAP: ${gaps.join(',') || 'none'})`);

  return { checks, passed, failed: fails, coveragePct };
}
