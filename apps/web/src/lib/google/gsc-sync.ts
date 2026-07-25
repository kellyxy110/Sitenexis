/**
 * Search Console Search Analytics API sync — clicks/impressions/CTR/average
 * position, site-wide daily plus top queries and top pages. Parsing is pure
 * and separate from the API calls, so it's testable without live credentials.
 */
import { google } from 'googleapis';
import { clientWithAccessToken } from './oauth-client';
import type { SearchVisibilityRow, SearchQueryRow, SearchPageRow } from '@sitenexis/db';

interface GscRow {
  keys?: string[] | null;
  clicks?: number | null;
  impressions?: number | null;
  ctr?: number | null;
  position?: number | null;
}

function parseGscDate(iso: string): Date {
  // Search Console dates are already ISO 'YYYY-MM-DD'.
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
}

/** dimensions=['date'] */
export function parseGscDailyReport(rows: GscRow[]): SearchVisibilityRow[] {
  return rows.map((row) => ({
    date: parseGscDate(row.keys?.[0] ?? ''),
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    avgPosition: row.position ?? 0,
    deviceBreakdown: {},
    countryBreakdown: {},
  }));
}

/** Merge country/device breakdown reports into existing daily rows (matched by date), same pattern as GA4's mergeGa4DeviceCountryBreakdowns. */
export function mergeGscDeviceCountryBreakdowns(
  daily: SearchVisibilityRow[],
  deviceRows: GscRow[],   // dimensions=['date', 'device']
  countryRows: GscRow[],  // dimensions=['date', 'country']
): SearchVisibilityRow[] {
  const byDate = new Map(daily.map((d) => [d.date.toISOString().slice(0, 10), d]));

  for (const row of deviceRows) {
    const dateKey = parseGscDate(row.keys?.[0] ?? '').toISOString().slice(0, 10);
    const entry = byDate.get(dateKey);
    if (!entry) continue;
    const device = row.keys?.[1] || 'unknown';
    (entry.deviceBreakdown as Record<string, number>)[device] = row.clicks ?? 0;
  }
  for (const row of countryRows) {
    const dateKey = parseGscDate(row.keys?.[0] ?? '').toISOString().slice(0, 10);
    const entry = byDate.get(dateKey);
    if (!entry) continue;
    const country = row.keys?.[1] || 'unknown';
    (entry.countryBreakdown as Record<string, number>)[country] = row.clicks ?? 0;
  }
  return daily;
}

/** dimensions=['date', 'query'] */
export function parseGscQueryReport(rows: GscRow[]): SearchQueryRow[] {
  return rows.map((row) => ({
    date: parseGscDate(row.keys?.[0] ?? ''),
    query: row.keys?.[1] ?? '',
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    avgPosition: row.position ?? 0,
  }));
}

/** dimensions=['date', 'page'] */
export function parseGscPageReport(rows: GscRow[]): SearchPageRow[] {
  return rows.map((row) => ({
    date: parseGscDate(row.keys?.[0] ?? ''),
    page: row.keys?.[1] ?? '',
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    avgPosition: row.position ?? 0,
  }));
}

export interface GscSyncResult {
  daily: SearchVisibilityRow[];
  queries: SearchQueryRow[];
  pages: SearchPageRow[];
}

export async function fetchGscMetrics(
  siteUrl: string,
  accessToken: string,
  range: { startDate: string; endDate: string },
): Promise<GscSyncResult> {
  const auth = clientWithAccessToken(accessToken);
  const searchConsole = google.searchconsole({ version: 'v1', auth });

  const [dailyRes, queryRes, pageRes, deviceRes, countryRes] = await Promise.all([
    searchConsole.searchanalytics.query({
      siteUrl,
      requestBody: { startDate: range.startDate, endDate: range.endDate, dimensions: ['date'] },
    }),
    searchConsole.searchanalytics.query({
      siteUrl,
      requestBody: { startDate: range.startDate, endDate: range.endDate, dimensions: ['date', 'query'], rowLimit: 100 },
    }),
    searchConsole.searchanalytics.query({
      siteUrl,
      requestBody: { startDate: range.startDate, endDate: range.endDate, dimensions: ['date', 'page'], rowLimit: 100 },
    }),
    searchConsole.searchanalytics.query({
      siteUrl,
      requestBody: { startDate: range.startDate, endDate: range.endDate, dimensions: ['date', 'device'] },
    }),
    searchConsole.searchanalytics.query({
      siteUrl,
      requestBody: { startDate: range.startDate, endDate: range.endDate, dimensions: ['date', 'country'] },
    }),
  ]);

  const daily = parseGscDailyReport(dailyRes.data.rows ?? []);
  mergeGscDeviceCountryBreakdowns(daily, deviceRes.data.rows ?? [], countryRes.data.rows ?? []);

  return {
    daily,
    queries: parseGscQueryReport(queryRes.data.rows ?? []),
    pages: parseGscPageReport(pageRes.data.rows ?? []),
  };
}
