import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  findManyTraffic: vi.fn(),
  findManySearch: vi.fn(),
}));

vi.mock('../client', () => ({
  db: {
    dailyTrafficMetric: { findMany: h.findManyTraffic },
    searchVisibilityMetric: { findMany: h.findManySearch },
  },
}));

import { getAggregatedBreakdowns } from './google-integrations';

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
