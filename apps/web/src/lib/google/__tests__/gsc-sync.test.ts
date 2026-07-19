import { describe, it, expect } from 'vitest';
import { parseGscDailyReport, parseGscQueryReport, parseGscPageReport } from '../gsc-sync';

describe('parseGscDailyReport', () => {
  it('maps a site-wide daily row', () => {
    const [result] = parseGscDailyReport([{ keys: ['2026-07-15'], clicks: 42, impressions: 900, ctr: 0.0467, position: 8.3 }]);
    expect(result!.date.toISOString().slice(0, 10)).toBe('2026-07-15');
    expect(result).toMatchObject({ clicks: 42, impressions: 900, ctr: 0.0467, avgPosition: 8.3 });
  });

  it('defaults missing fields to 0', () => {
    const [result] = parseGscDailyReport([{ keys: ['2026-07-15'] }]);
    expect(result).toMatchObject({ clicks: 0, impressions: 0, ctr: 0, avgPosition: 0 });
  });
});

describe('parseGscQueryReport', () => {
  it('maps a per-query row with the query as the second dimension key', () => {
    const [result] = parseGscQueryReport([{ keys: ['2026-07-15', 'ai visibility score'], clicks: 5, impressions: 80, ctr: 0.0625, position: 4.2 }]);
    expect(result).toMatchObject({ query: 'ai visibility score', clicks: 5, impressions: 80 });
  });
});

describe('parseGscPageReport', () => {
  it('maps a per-page row with the page as the second dimension key', () => {
    const [result] = parseGscPageReport([{ keys: ['2026-07-15', 'https://example.com/blog/post'], clicks: 12, impressions: 300, ctr: 0.04, position: 6.1 }]);
    expect(result).toMatchObject({ page: 'https://example.com/blog/post', clicks: 12, impressions: 300 });
  });

  it('handles a row with no keys gracefully', () => {
    const [result] = parseGscPageReport([{}]);
    expect(result!.page).toBe('');
    expect(result!.clicks).toBe(0);
  });
});
