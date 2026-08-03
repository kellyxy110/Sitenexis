/**
 * Canonical current-vs-previous-period comparison. Every GA4/GSC surface that
 * shows a delta (queries, pages, landing pages, acquisition, the AI-correlation
 * section) calls this instead of inlining its own subtraction — one place to
 * get zero-denominator handling and the "direction" label right.
 */

export type ComparisonDirection = 'up' | 'down' | 'stable' | 'unavailable';

export interface PeriodComparison {
  current: number;
  previous: number;
  absoluteDelta: number;
  /** null when previous is 0 — a percentage change from zero is not a real number, never displayed as one. */
  percentageDelta: number | null;
  direction: ComparisonDirection;
}

/**
 * `stableThreshold` is the minimum |percentageDelta| (as a fraction, e.g. 0.01
 * = 1%) before a change is called "up"/"down" rather than "stable" — without
 * it, noise-level fluctuation (49 clicks vs 50) would read as a trend.
 * When `previous` is 0 and `current` is also 0, there is nothing to compare:
 * direction is 'unavailable', not 'stable' — "stable" implies a real,
 * measured non-change, and there is no such measurement over two zeros.
 */
export function comparePeriodMetric(
  current: number,
  previous: number,
  opts: { stableThreshold?: number } = {},
): PeriodComparison {
  const stableThreshold = opts.stableThreshold ?? 0.01;
  const absoluteDelta = current - previous;

  if (previous === 0) {
    if (current === 0) {
      return { current, previous, absoluteDelta: 0, percentageDelta: null, direction: 'unavailable' };
    }
    // Real growth from a true zero baseline — a genuine, reportable event,
    // just not expressible as a finite percentage.
    return { current, previous, absoluteDelta, percentageDelta: null, direction: 'up' };
  }

  const percentageDelta = absoluteDelta / previous;
  const direction: ComparisonDirection =
    Math.abs(percentageDelta) < stableThreshold ? 'stable' : percentageDelta > 0 ? 'up' : 'down';

  return { current, previous, absoluteDelta, percentageDelta, direction };
}
