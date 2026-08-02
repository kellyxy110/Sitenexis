import { describe, it, expect } from 'vitest';
import { correlateScoresWithTraffic } from '../score-traffic-correlation';

function d(iso: string): Date { return new Date(iso); }

describe('correlateScoresWithTraffic', () => {
  it('returns exactly one point per audit, never interpolating between sparse audits', () => {
    const audits = [
      { auditId: 'a1', completedAt: d('2026-01-01'), aiVisibilityScore: 60 },
      { auditId: 'a2', completedAt: d('2026-02-01'), aiVisibilityScore: 70 },
    ];
    const result = correlateScoresWithTraffic(audits, [], []);
    expect(result).toHaveLength(2);
  });

  it('sums real traffic/search activity within the window around the audit date, not just the exact day', () => {
    const audits = [{ auditId: 'a1', completedAt: d('2026-01-10'), aiVisibilityScore: 65 }];
    const traffic = [
      { date: d('2026-01-08'), sessions: 100 },
      { date: d('2026-01-10'), sessions: 150 },
      { date: d('2026-01-12'), sessions: 120 },
      { date: d('2026-01-20'), sessions: 999 }, // outside the window — must not be counted
    ];
    const search = [
      { date: d('2026-01-09'), clicks: 10 },
      { date: d('2026-01-30'), clicks: 500 }, // outside the window
    ];
    const [point] = correlateScoresWithTraffic(audits, traffic, search, 3);
    expect(point!.sessions).toBe(100 + 150 + 120);
    expect(point!.clicks).toBe(10);
  });

  it('sorts points chronologically by audit completion date regardless of input order', () => {
    const audits = [
      { auditId: 'later', completedAt: d('2026-03-01'), aiVisibilityScore: 80 },
      { auditId: 'earlier', completedAt: d('2026-01-01'), aiVisibilityScore: 50 },
    ];
    const result = correlateScoresWithTraffic(audits, [], []);
    expect(result.map((p) => p.auditId)).toEqual(['earlier', 'later']);
  });

  it('reports 0 sessions/clicks (not a fabricated estimate) when no traffic data exists in the window', () => {
    const audits = [{ auditId: 'a1', completedAt: d('2026-01-10'), aiVisibilityScore: 65 }];
    const [point] = correlateScoresWithTraffic(audits, [], []);
    expect(point!.sessions).toBe(0);
    expect(point!.clicks).toBe(0);
  });

  it('carries the real aiVisibilityScore and auditId through untouched', () => {
    const audits = [{ auditId: 'audit-xyz', completedAt: d('2026-01-10'), aiVisibilityScore: 73 }];
    const [point] = correlateScoresWithTraffic(audits, [], []);
    expect(point!.auditId).toBe('audit-xyz');
    expect(point!.aiVisibilityScore).toBe(73);
  });

  it('respects a custom window size', () => {
    const audits = [{ auditId: 'a1', completedAt: d('2026-01-10'), aiVisibilityScore: 65 }];
    const traffic = [{ date: d('2026-01-15'), sessions: 200 }]; // 5 days out
    const withinWideWindow = correlateScoresWithTraffic(audits, traffic, [], 7);
    const withinNarrowWindow = correlateScoresWithTraffic(audits, traffic, [], 2);
    expect(withinWideWindow[0]!.sessions).toBe(200);
    expect(withinNarrowWindow[0]!.sessions).toBe(0);
  });
});
