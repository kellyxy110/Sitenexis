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
  }));
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

  const [dailyRes, queryRes, pageRes] = await Promise.all([
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
  ]);

  return {
    daily: parseGscDailyReport(dailyRes.data.rows ?? []),
    queries: parseGscQueryReport(queryRes.data.rows ?? []),
    pages: parseGscPageReport(pageRes.data.rows ?? []),
  };
}
