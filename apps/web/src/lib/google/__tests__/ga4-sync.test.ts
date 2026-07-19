import { describe, it, expect } from 'vitest';
import {
  parseGa4Date, isAiReferrerSource, parseGa4DailyReport,
  parseGa4ChannelReport, parseGa4LandingPageReport, mergeGa4DeviceCountryBreakdowns,
} from '../ga4-sync';

describe('parseGa4Date', () => {
  it('parses a GA4 YYYYMMDD string into the correct UTC date', () => {
    const d = parseGa4Date('20260715');
    expect(d.toISOString().slice(0, 10)).toBe('2026-07-15');
  });
});

describe('isAiReferrerSource', () => {
  it('flags known AI referrer domains', () => {
    expect(isAiReferrerSource('chat.openai.com')).toBe(true);
    expect(isAiReferrerSource('www.perplexity.ai')).toBe(true);
    expect(isAiReferrerSource('claude.ai')).toBe(true);
  });

  it('does not flag ordinary sources', () => {
    expect(isAiReferrerSource('google')).toBe(false);
    expect(isAiReferrerSource('(direct)')).toBe(false);
    expect(isAiReferrerSource('facebook.com')).toBe(false);
  });
});

describe('parseGa4DailyReport', () => {
  it('maps a GA4 daily report row to a DailyTrafficRow', () => {
    const rows = [{
      dimensionValues: [{ value: '20260715' }],
      metricValues: [{ value: '120' }, { value: '95' }, { value: '30' }, { value: '80' }, { value: '45.5' }, { value: '5' }],
    }];
    const [result] = parseGa4DailyReport(rows);
    expect(result).toMatchObject({ sessions: 120, activeUsers: 95, newUsers: 30, engagedSessions: 80, avgEngagementTimeSec: 45.5, keyEvents: 5 });
    expect(result!.date.toISOString().slice(0, 10)).toBe('2026-07-15');
  });

  it('defaults missing metric values to 0', () => {
    const rows = [{ dimensionValues: [{ value: '20260715' }], metricValues: [] }];
    const [result] = parseGa4DailyReport(rows);
    expect(result!.sessions).toBe(0);
  });
});

describe('parseGa4ChannelReport', () => {
  it('flags an AI-referral session correctly', () => {
    const rows = [{
      dimensionValues: [{ value: '20260715' }, { value: 'Referral' }, { value: 'chat.openai.com' }],
      metricValues: [{ value: '10' }, { value: '8' }],
    }];
    const [result] = parseGa4ChannelReport(rows);
    expect(result).toMatchObject({ channelGroup: 'Referral', source: 'chat.openai.com', sessions: 10, activeUsers: 8, isAiReferral: true });
  });

  it('does not flag organic search as AI referral', () => {
    const rows = [{
      dimensionValues: [{ value: '20260715' }, { value: 'Organic Search' }, { value: 'google' }],
      metricValues: [{ value: '50' }, { value: '40' }],
    }];
    const [result] = parseGa4ChannelReport(rows);
    expect(result!.isAiReferral).toBe(false);
  });

  it('defaults an empty source to (direct)', () => {
    const rows = [{ dimensionValues: [{ value: '20260715' }, { value: 'Direct' }, { value: '' }], metricValues: [{ value: '5' }, { value: '5' }] }];
    const [result] = parseGa4ChannelReport(rows);
    expect(result!.source).toBe('(direct)');
  });
});

describe('parseGa4LandingPageReport', () => {
  it('maps a landing page report row', () => {
    const rows = [{
      dimensionValues: [{ value: '20260715' }, { value: '/blog/post' }],
      metricValues: [{ value: '20' }, { value: '18' }, { value: '60' }, { value: '2' }],
    }];
    const [result] = parseGa4LandingPageReport(rows);
    expect(result).toMatchObject({ pagePath: '/blog/post', sessions: 20, activeUsers: 18, avgEngagementTimeSec: 60, keyEvents: 2 });
  });
});

describe('mergeGa4DeviceCountryBreakdowns', () => {
  it('merges device and country session counts into the matching daily row', () => {
    const daily = parseGa4DailyReport([{ dimensionValues: [{ value: '20260715' }], metricValues: [{ value: '100' }] }]);
    const deviceRows = [
      { dimensionValues: [{ value: '20260715' }, { value: 'mobile' }], metricValues: [{ value: '60' }] },
      { dimensionValues: [{ value: '20260715' }, { value: 'desktop' }], metricValues: [{ value: '40' }] },
    ];
    const countryRows = [{ dimensionValues: [{ value: '20260715' }, { value: 'United States' }], metricValues: [{ value: '80' }] }];

    const merged = mergeGa4DeviceCountryBreakdowns(daily, deviceRows, countryRows);
    expect(merged[0]!.deviceBreakdown).toEqual({ mobile: 60, desktop: 40 });
    expect(merged[0]!.countryBreakdown).toEqual({ 'United States': 80 });
  });

  it('ignores breakdown rows for a date with no matching daily row', () => {
    const daily = parseGa4DailyReport([{ dimensionValues: [{ value: '20260715' }], metricValues: [{ value: '100' }] }]);
    const deviceRows = [{ dimensionValues: [{ value: '20260716' }, { value: 'mobile' }], metricValues: [{ value: '10' }] }];
    const merged = mergeGa4DeviceCountryBreakdowns(daily, deviceRows, []);
    expect(merged[0]!.deviceBreakdown).toEqual({});
  });
});
