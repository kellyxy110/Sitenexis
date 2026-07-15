/**
 * Loads a coverage snapshot if one was produced by `pnpm certify:coverage`
 * (scripts/launch-validation/coverage.mjs), which runs vitest --coverage and writes
 * scripts/launch-validation/.coverage-snapshot.json. If absent, coverage is UNKNOWN —
 * the scorer will NOT invent a number.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = join(here, '..', '.coverage-snapshot.json');

export function loadCoverageSnapshot() {
  if (!existsSync(SNAPSHOT)) return null;
  try {
    return JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
  } catch {
    return null;
  }
}
