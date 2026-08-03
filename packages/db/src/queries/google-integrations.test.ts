import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  findManyTraffic: vi.fn(),
  findManySearch: vi.fn(),
  findManySearchQuery: vi.fn(),
  findManySearchPage: vi.fn(),
  groupByLandingPage: vi.fn(),
  groupByAcquisition: vi.fn(),
}));

vi.mock('../client', () => ({
  db: {
    dailyTrafficMetric: { findMany: h.findManyTraffic },
    searchVisibilityMetric: { findMany: h.findManySearch },
    searchQueryMetric: { findMany: h.findManySearchQuery },
    searchPageMetric: { findMany: h.findManySearchPage },
    landingPageMetric: { groupBy: h.groupByLandingPage },
    acquisitionChannelMetric: { groupBy: h.groupByAcquisition },
  },
}));

import {
  getAggregatedBreakdowns, getAggregatedSearchQueryMetrics, getAggregatedSearchPageStats,
  getAggregatedLandingPageMetrics, getAggregatedAcquisitionMetrics,
} from './google-integrations';

beforeEach(() => {
  vi.clearAllMocks();
  h.findManyTraffic.mockResolvedValue([]);
  h.findManySearch.mockResolvedValue([]);
});

describe('getAggregatedBreakdowns', () => {
  it('sums device and country breakdowns across multiple days', async () => {
    h.findManyTraffic.mockResolvedValue([
      { deviceBreakdown: { mobile: 10, desktop: 5 }, countryBreakdown: { US: 8, UK: 7 } },
      { deviceBreakdown: { mobile: 3, desktop: 2 }, countryBreakdown: { US: 2 } },
    ]);

    const result = await getAggregatedBreakdowns('user-1', new Date('2026-01-01'), new Date('2026-01-31'));

    expect(result.traffic.device).toEqual({ mobile: 13, desktop: 7 });
    expect(result.traffic.country).toEqual({ US: 10, UK: 7 });
  });

  it('aggregates traffic and search breakdowns independently', async () => {
    h.findManyTraffic.mockResolvedValue([{ deviceBreakdown: { mobile: 10 }, countryBreakdown: {} }]);
    h.findManySearch.mockResolvedValue([{ deviceBreakdown: { desktop: 20 }, countryBreakdown: {} }]);

    const result = await getAggregatedBreakdowns('user-1', new Date(), new Date());

    expect(result.traffic.device).toEqual({ mobile: 10 });
    expect(result.search.device).toEqual({ desktop: 20 });
  });

  it('returns empty breakdown objects (not an error) when there are no rows in range', async () => {
    const result = await getAggregatedBreakdowns('user-1', new Date(), new Date());
    expect(result).toEqual({ traffic: { device: {}, country: {} }, search: { device: {}, country: {} } });
  });

  it('tolerates a null/malformed breakdown value without throwing', async () => {
    h.findManyTraffic.mockResolvedValue([{ deviceBreakdown: null, countryBreakdown: 'not-an-object' }]);

    await expect(getAggregatedBreakdowns('user-1', new Date(), new Date())).resolves.toEqual(
      expect.objectContaining({ traffic: { device: {}, country: {} } }),
    );
  });

  it('ignores non-numeric values inside a breakdown object rather than corrupting the sum', async () => {
    h.findManyTraffic.mockResolvedValue([{ deviceBreakdown: { mobile: 5, weird: 'oops' }, countryBreakdown: {} }]);

    const result = await getAggregatedBreakdowns('user-1', new Date(), new Date());

    expect(result.traffic.device).toEqual({ mobile: 5 });
  });
});

describe('getAggregatedSearchQueryMetrics', () => {
  it('computes an impressions-weighted average position, not a plain average-of-averages', async () => {
    // Day 1: position 5 on 900 impressions. Day 2: position 20 on 100 impressions.
    // A naive average would be 12.5; the correct impressions-weighted average is 6.5.
    h.findManySearchQuery.mockResolvedValue([
      { query: 'ai audit', clicks: 40, impressions: 900, avgPosition: 5 },
      { query: 'ai audit', clicks: 2, impressions: 100, avgPosition: 20 },
    ]);

    const [result] = await getAggregatedSearchQueryMetrics('user-1', new Date(), new Date());

    expect(result!.impressions).toBe(1000);
    expect(result!.clicks).toBe(42);
    expect(result!.avgPosition).toBeCloseTo(6.5);
    expect(result!.ctr).toBeCloseTo(0.042);
  });

  it('sums clicks/impressions independently per query', async () => {
    h.findManySearchQuery.mockResolvedValue([
      { query: 'a', clicks: 10, impressions: 100, avgPosition: 5 },
      { query: 'b', clicks: 20, impressions: 200, avgPosition: 8 },
    ]);

    const result = await getAggregatedSearchQueryMetrics('user-1', new Date(), new Date());

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.query === 'a')!.clicks).toBe(10);
    expect(result.find((r) => r.query === 'b')!.clicks).toBe(20);
  });

  it('returns 0 ctr/avgPosition (not NaN) for zero impressions', async () => {
    h.findManySearchQuery.mockResolvedValue([{ query: 'zero', clicks: 0, impressions: 0, avgPosition: 0 }]);

    const [result] = await getAggregatedSearchQueryMetrics('user-1', new Date(), new Date());

    expect(result!.ctr).toBe(0);
    expect(result!.avgPosition).toBe(0);
    expect(Number.isNaN(result!.ctr)).toBe(false);
  });
});

describe('getAggregatedSearchPageStats', () => {
  it('computes an impressions-weighted average position per page', async () => {
    h.findManySearchPage.mockResolvedValue([
      { page: '/a', clicks: 40, impressions: 900, avgPosition: 5 },
      { page: '/a', clicks: 2, impressions: 100, avgPosition: 20 },
    ]);

    const [result] = await getAggregatedSearchPageStats('user-1', new Date(), new Date());

    expect(result!.avgPosition).toBeCloseTo(6.5);
  });
});

describe('getAggregatedLandingPageMetrics', () => {
  it('sums sessions/activeUsers/keyEvents per page path', async () => {
    h.groupByLandingPage.mockResolvedValue([
      { pagePath: '/', _sum: { sessions: 100, activeUsers: 62, keyEvents: 5 }, _avg: { avgEngagementTimeSec: 45.5 } },
    ]);

    const [result] = await getAggregatedLandingPageMetrics('user-1', new Date(), new Date());

    expect(result).toEqual({ pagePath: '/', sessions: 100, activeUsers: 62, keyEvents: 5, avgEngagementTimeSec: 45.5 });
  });

  it('defaults null sums to 0 rather than propagating null into the response', async () => {
    h.groupByLandingPage.mockResolvedValue([{ pagePath: '/', _sum: { sessions: null, activeUsers: null, keyEvents: null }, _avg: { avgEngagementTimeSec: null } }]);

    const [result] = await getAggregatedLandingPageMetrics('user-1', new Date(), new Date());

    expect(result).toEqual({ pagePath: '/', sessions: 0, activeUsers: 0, keyEvents: 0, avgEngagementTimeSec: 0 });
  });
});

describe('getAggregatedAcquisitionMetrics', () => {
  it('sums sessions/activeUsers per channelGroup + source, preserving the isAiReferral flag', async () => {
    h.groupByAcquisition.mockResolvedValue([
      { channelGroup: 'Referral', source: 'chatgpt.com', isAiReferral: true, _sum: { sessions: 50, activeUsers: 40 } },
    ]);

    const [result] = await getAggregatedAcquisitionMetrics('user-1', new Date(), new Date());

    expect(result).toEqual({ channelGroup: 'Referral', source: 'chatgpt.com', isAiReferral: true, sessions: 50, activeUsers: 40 });
  });
});
