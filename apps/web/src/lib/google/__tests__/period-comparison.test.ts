import { describe, it, expect } from 'vitest';
import { comparePeriodMetric } from '../period-comparison';

describe('comparePeriodMetric', () => {
  it('computes absolute and percentage delta for a normal increase', () => {
    const r = comparePeriodMetric(120, 100);
    expect(r.absoluteDelta).toBe(20);
    expect(r.percentageDelta).toBeCloseTo(0.2);
    expect(r.direction).toBe('up');
  });

  it('computes a decrease', () => {
    const r = comparePeriodMetric(80, 100);
    expect(r.absoluteDelta).toBe(-20);
    expect(r.percentageDelta).toBeCloseTo(-0.2);
    expect(r.direction).toBe('down');
  });

  it('classifies a sub-threshold change as stable, not up/down', () => {
    const r = comparePeriodMetric(100.5, 100);
    expect(r.direction).toBe('stable');
  });

  it('respects a custom stableThreshold', () => {
    const r = comparePeriodMetric(105, 100, { stableThreshold: 0.1 });
    expect(r.direction).toBe('stable');
  });

  it('never returns a finite percentage from a zero denominator', () => {
    const r = comparePeriodMetric(50, 0);
    expect(r.percentageDelta).toBeNull();
    expect(Number.isFinite(r.percentageDelta)).toBe(false);
  });

  it('treats real growth from zero as "up", not "unavailable"', () => {
    const r = comparePeriodMetric(50, 0);
    expect(r.direction).toBe('up');
    expect(r.absoluteDelta).toBe(50);
  });

  it('treats zero vs zero as unavailable, not stable — there is no measurement to compare', () => {
    const r = comparePeriodMetric(0, 0);
    expect(r.direction).toBe('unavailable');
    expect(r.percentageDelta).toBeNull();
  });

  it('is deterministic — same inputs always produce the same output', () => {
    const a = comparePeriodMetric(342, 219);
    const b = comparePeriodMetric(342, 219);
    expect(a).toEqual(b);
  });
});
