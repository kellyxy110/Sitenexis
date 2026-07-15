/**
 * Golden Evaluation metrics — pure, deterministic scoring of actual analyzer output
 * against a labelled expected output. Used by the certification's AI-accuracy gate so
 * SiteNexis can never silently regress in analytical quality.
 *
 * All functions are pure and unit-tested. Nothing here estimates: a metric that cannot
 * be computed (no labelled data) is simply absent, and the caller reports it UNKNOWN.
 */

export interface SetMetrics {
  tp: number;
  fp: number; // predicted but not expected → false positives
  fn: number; // expected but not predicted → false negatives
  precision: number; // tp / (tp + fp)
  recall: number; // tp / (tp + fn)
  f1: number; // harmonic mean
}

/** Precision/recall/F1 for a set-valued field (e.g. detected schema types, issue types). */
export function setMetrics(expected: Iterable<string>, actual: Iterable<string>): SetMetrics {
  const exp = new Set([...expected].map((s) => s.toLowerCase()));
  const act = new Set([...actual].map((s) => s.toLowerCase()));
  let tp = 0;
  for (const a of act) if (exp.has(a)) tp++;
  const fp = act.size - tp;
  const fn = exp.size - tp;
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { tp, fp, fn, precision, recall, f1 };
}

/** Numeric agreement within an absolute tolerance (e.g. a score expected 80 ± 5). */
export function numericMatch(expected: number, actual: number, tolerance: number): { match: boolean; absError: number } {
  const absError = Math.abs(expected - actual);
  return { match: absError <= tolerance, absError };
}

/** Population variance of a numeric series (0 = perfectly stable / reproducible). */
export function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
}

/** Spearman rank correlation between two equal-length ranked series (−1..1). */
export function spearman(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  const rank = (arr: number[]): number[] => {
    const idx = arr.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
    const r = new Array(arr.length);
    idx.forEach(([, i], pos) => (r[i] = pos + 1));
    return r;
  };
  const ra = rank(a);
  const rb = rank(b);
  const n = a.length;
  const d2 = ra.reduce((acc, r, i) => acc + (r - rb[i]) ** 2, 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
}

/**
 * Hallucination rate for a closed-set prediction: the fraction of PREDICTED items
 * that are not present anywhere in the expected/allowed universe (i.e. fabricated).
 */
export function hallucinationRate(predicted: Iterable<string>, allowedUniverse: Iterable<string>): number {
  const allowed = new Set([...allowedUniverse].map((s) => s.toLowerCase()));
  const pred = [...predicted].map((s) => s.toLowerCase());
  if (pred.length === 0) return 0;
  const fabricated = pred.filter((p) => !allowed.has(p)).length;
  return fabricated / pred.length;
}

export interface AggregatePrecisionRecall {
  precision: number;
  recall: number;
  f1: number;
  falsePositives: number;
  falseNegatives: number;
}

/** Micro-average precision/recall/F1 across many per-case SetMetrics. */
export function aggregate(cases: SetMetrics[]): AggregatePrecisionRecall {
  const tp = cases.reduce((a, c) => a + c.tp, 0);
  const fp = cases.reduce((a, c) => a + c.fp, 0);
  const fn = cases.reduce((a, c) => a + c.fn, 0);
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1, falsePositives: fp, falseNegatives: fn };
}
