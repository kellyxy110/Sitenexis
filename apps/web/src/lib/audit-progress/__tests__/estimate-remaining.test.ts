import { describe, it, expect } from 'vitest';
import { estimateRemaining } from '../estimate-remaining';

describe('estimateRemaining', () => {
  it('returns "Estimating..." when too little time has elapsed, regardless of reported progress', () => {
    expect(estimateRemaining({ elapsedMs: 1_000, progress: 50 })).toBe('Estimating...');
  });

  it('returns "Estimating..." when progress is too low to extrapolate from, even after a while', () => {
    expect(estimateRemaining({ elapsedMs: 20_000, progress: 5 })).toBe('Estimating...');
  });

  it('returns "Estimating..." at exactly 100 progress (the caller should use the empty/finished label instead)', () => {
    expect(estimateRemaining({ elapsedMs: 20_000, progress: 100 })).toBe('Estimating...');
  });

  it('derives a conservative seconds-based estimate once there is enough signal', () => {
    const label = estimateRemaining({ elapsedMs: 10_000, progress: 50 });
    expect(label).toMatch(/^~\d+s remaining$/);
  });

  it('derives a minutes-based estimate for longer remaining durations', () => {
    const label = estimateRemaining({ elapsedMs: 60_000, progress: 20 });
    expect(label).toMatch(/^~\d+ min remaining$/);
  });

  it('never returns a negative or nonsensical duration as progress approaches 100', () => {
    const label = estimateRemaining({ elapsedMs: 50_000, progress: 99 });
    expect(label).toMatch(/remaining$/);
    expect(label).not.toMatch(/-/);
  });
});
