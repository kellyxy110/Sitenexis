import { describe, it, expect } from 'vitest';
import { bucketKeyForDate, bucketTrafficSeries, bucketSearchSeries } from '../trend-bucketing';

const d = (iso: string): Date => new Date(iso);

describe('bucketKeyForDate', () => {
  it('daily passes the date through unchanged', () => {
    expect(bucketKeyForDate(d('2026-03-11T00:00:00Z'), 'daily')).toBe('2026-03-11');
  });

  it('weekly buckets to the Monday of that ISO week', () => {
    // 2026-03-11 is a Wednesday; the Monday of that week is 2026-03-09.
    expect(bucketKeyForDate(d('2026-03-11T00:00:00Z'), 'weekly')).toBe('2026-03-09');
    // Sunday belongs to the week that started the preceding Monday.
    expect(bucketKeyForDate(d('2026-03-15T00:00:00Z'), 'weekly')).toBe('2026-03-09');
    // A Monday buckets to itself.
    expect(bucketKeyForDate(d('2026-03-09T00:00:00Z'), 'weekly')).toBe('2026-03-09');
  });

  it('monthly buckets to the first of the month', () => {
    expect(bucketKeyForDate(d('2026-03-27T00:00:00Z'), 'monthly')).toBe('2026-03-01');
  });

  it('quarterly buckets to the first day of the quarter', () => {
    expect(bucketKeyForDate(d('2026-05-15T00:00:00Z'), 'quarterly')).toBe('2026-04-01'); // Q2
    expect(bucketKeyForDate(d('2026-01-01T00:00:00Z'), 'quarterly')).toBe('2026-01-01'); // Q1
    expect(bucketKeyForDate(d('2026-12-31T00:00:00Z'), 'quarterly')).toBe('2026-10-01'); // Q4
  });
});

describe('bucketTrafficSeries', () => {
  it('daily is a pass-through, sorted chronologically', () => {
    const rows = [
      { date: d('2026-03-02'), sessions: 20, activeUsers: 15 },
      { date: d('2026-03-01'), sessions: 10, activeUsers: 8 },
    ];
    expect(bucketTrafficSeries(rows, 'daily')).toEqual([
      { date: '2026-03-01', sessions: 10, activeUsers: 8 },
      { date: '2026-03-02', sessions: 20, activeUsers: 15 },
    ]);
  });

  it('sums sessions/activeUsers within a weekly bucket', () => {
    const rows = [
      { date: d('2026-03-09'), sessions: 10, activeUsers: 8 }, // Monday
      { date: d('2026-03-11'), sessions: 5, activeUsers: 4 },  // same week
      { date: d('2026-03-16'), sessions: 7, activeUsers: 6 },  // next week
    ];
    expect(bucketTrafficSeries(rows, 'weekly')).toEqual([
      { date: '2026-03-09', sessions: 15, activeUsers: 12 },
      { date: '2026-03-16', sessions: 7, activeUsers: 6 },
    ]);
  });

  it('omits buckets with no underlying rows rather than zero-filling', () => {
    const rows = [
      { date: d('2026-01-05'), sessions: 10, activeUsers: 8 },
      { date: d('2026-03-05'), sessions: 20, activeUsers: 15 },
    ];
    const result = bucketTrafficSeries(rows, 'monthly');
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.date)).toEqual(['2026-01-01', '2026-03-01']);
  });
});

describe('bucketSearchSeries', () => {
  it('recomputes ctr from summed clicks/impressions, not an average of daily ctrs', () => {
    const rows = [
      // day 1: tiny traffic, ctr looks huge (1/2 = 0.5)
      { date: d('2026-03-09'), clicks: 1, impressions: 2, ctr: 0.5, avgPosition: 10 },
      // day 2: real traffic, ctr modest (10/1000 = 0.01)
      { date: d('2026-03-10'), clicks: 10, impressions: 1000, ctr: 0.01, avgPosition: 8 },
    ];
    const [bucket] = bucketSearchSeries(rows, 'weekly');
    // naive average-of-averages would give 0.255 — misleadingly high.
    // correct: (1+10) / (2+1000) = 11/1002
    expect(bucket!.clicks).toBe(11);
    expect(bucket!.impressions).toBe(1002);
    expect(bucket!.ctr).toBeCloseTo(11 / 1002, 6);
  });

  it('computes avgPosition as an impressions-weighted mean', () => {
    const rows = [
      { date: d('2026-03-09'), clicks: 1, impressions: 100, ctr: 0.01, avgPosition: 2 },
      { date: d('2026-03-10'), clicks: 1, impressions: 900, ctr: 0.001, avgPosition: 20 },
    ];
    const [bucket] = bucketSearchSeries(rows, 'weekly');
    // weighted: (2*100 + 20*900) / 1000 = (200 + 18000) / 1000 = 18.2
    expect(bucket!.avgPosition).toBeCloseTo(18.2, 6);
  });

  it('handles a zero-impressions bucket without dividing by zero', () => {
    const rows = [{ date: d('2026-03-09'), clicks: 0, impressions: 0, ctr: 0, avgPosition: 0 }];
    const [bucket] = bucketSearchSeries(rows, 'weekly');
    expect(bucket!.ctr).toBe(0);
    expect(bucket!.avgPosition).toBe(0);
  });
});
