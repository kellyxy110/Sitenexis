import { describe, it, expect } from 'vitest';
import {
  setMetrics,
  numericMatch,
  variance,
  spearman,
  hallucinationRate,
  aggregate,
} from '../metrics';

describe('setMetrics (precision/recall/F1, FP/FN)', () => {
  it('perfect match → P=R=F1=1, no FP/FN', () => {
    const m = setMetrics(['Organization', 'FAQPage'], ['organization', 'faqpage']);
    expect(m).toMatchObject({ fp: 0, fn: 0, precision: 1, recall: 1, f1: 1 });
  });
  it('counts false positives and false negatives', () => {
    // expected {A,B,C}, actual {A,B,D}: tp=2, fp=1 (D), fn=1 (C)
    const m = setMetrics(['A', 'B', 'C'], ['A', 'B', 'D']);
    expect(m.tp).toBe(2);
    expect(m.fp).toBe(1);
    expect(m.fn).toBe(1);
    expect(m.precision).toBeCloseTo(2 / 3);
    expect(m.recall).toBeCloseTo(2 / 3);
  });
  it('empty expected and actual → vacuously perfect', () => {
    expect(setMetrics([], []).f1).toBe(1);
  });
});

describe('numericMatch', () => {
  it('within tolerance', () => {
    expect(numericMatch(80, 83, 5)).toEqual({ match: true, absError: 3 });
  });
  it('outside tolerance', () => {
    expect(numericMatch(80, 90, 5)).toEqual({ match: false, absError: 10 });
  });
});

describe('variance (score stability / reproducibility)', () => {
  it('is zero for a constant series (deterministic)', () => {
    expect(variance([72, 72, 72])).toBe(0);
  });
  it('is positive when scores drift', () => {
    expect(variance([70, 75, 80])).toBeGreaterThan(0);
  });
});

describe('spearman rank correlation', () => {
  it('is 1 for identical ordering', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
  });
  it('is -1 for reversed ordering', () => {
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1);
  });
});

describe('hallucinationRate', () => {
  it('is 0 when every prediction is in the allowed universe', () => {
    expect(hallucinationRate(['A', 'B'], ['A', 'B', 'C'])).toBe(0);
  });
  it('is the fraction of fabricated predictions', () => {
    // predicted {A, X}; universe {A,B,C} → X fabricated → 0.5
    expect(hallucinationRate(['A', 'X'], ['A', 'B', 'C'])).toBe(0.5);
  });
});

describe('aggregate (micro-average across cases)', () => {
  it('sums tp/fp/fn across cases', () => {
    const a = setMetrics(['A', 'B'], ['A']); // tp1 fn1
    const b = setMetrics(['C'], ['C', 'D']); // tp1 fp1
    const agg = aggregate([a, b]);
    expect(agg.falsePositives).toBe(1);
    expect(agg.falseNegatives).toBe(1);
    expect(agg.precision).toBeCloseTo(2 / 3);
    expect(agg.recall).toBeCloseTo(2 / 3);
  });
});
