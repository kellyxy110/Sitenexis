/**
 * GA4 Data API sync — fetches users/sessions/engagement/landing-pages/channels/
 * devices/countries/key-events and normalizes them into the Phase 2 row shapes.
 * Parsing is kept pure and separate from the API calls themselves so it's
 * testable without live Google credentials.
 */
import { google } from 'googleapis';
import { clientWithAccessToken } from './oauth-client';
import type { DailyTrafficRow, AcquisitionChannelRow, LandingPageRow } from '@sitenexis/db';

/** Domains that indicate traffic referred by an AI system, not a human search/direct visit. */
export const AI_REFERRER_DOMAINS = [
  'chat.openai.com', 'chatgpt.com', 'perplexity.ai', 'gemini.google.com',
  'bard.google.com', 'claude.ai', 'copilot.microsoft.com', 'you.com',
] as const;

export function isAiReferrerSource(source: string): boolean {
  const s = source.toLowerCase();
  return AI_REFERRER_DOMAINS.some((d) => s.includes(d));
}

/** GA4 dates come back as YYYYMMDD strings. */
export function parseGa4Date(yyyymmdd: string): Date {
  const y = Number(yyyymmdd.slice(0, 4));
  const m = Number(yyyymmdd.slice(4, 6));
  const d = Number(yyyymmdd.slice(6, 8));
  return new Date(Date.UTC(y, m - 1, d));
}

interface Ga4ReportRow {
  dimensionValues?: Array<{ value?: string | null }>;
  metricValues?: Array<{ value?: string | null }>;
}

function num(row: Ga4ReportRow, metricIndex: number): number {
  const raw = row.metricValues?.[metricIndex]?.value;
  return raw ? Number(raw) : 0;
}
function dim(row: Ga4ReportRow, dimIndex: number): string {
  return row.dimensionValues?.[dimIndex]?.value ?? '';
}

/** dimensions=[date], metrics=[sessions, activeUsers, newUsers, engagedSessions, userEngagementDuration, keyEvents] */
export function parseGa4DailyReport(rows: Ga4ReportRow[]): DailyTrafficRow[] {
  return rows.map((row) => ({
    date: parseGa4Date(dim(row, 0)),
    sessions: num(row, 0),
    activeUsers: num(row, 1),
    newUsers: num(row, 2),
    engagedSessions: num(row, 3),
    avgEngagementTimeSec: num(row, 4),
    keyEvents: num(row, 5),
    deviceBreakdown: {},
    countryBreakdown: {},
  }));
}

/** Merge device/country breakdown reports into an existing set of daily rows (matched by date). */
export function mergeGa4DeviceCountryBreakdowns(
  daily: DailyTrafficRow[],
  deviceRows: Ga4ReportRow[], // dimensions=[date, deviceCategory], metrics=[sessions]
  countryRows: Ga4ReportRow[], // dimensions=[date, country], metrics=[sessions]
): DailyTrafficRow[] {
  const byDate = new Map(daily.map((d) => [d.date.toISOString().slice(0, 10), d]));

  for (const row of deviceRows) {
    const dateKey = parseGa4Date(dim(row, 0)).toISOString().slice(0, 10);
    const entry = byDate.get(dateKey);
    if (!entry) continue;
    const device = dim(row, 1) || 'unknown';
    (entry.deviceBreakdown as Record<string, number>)[device] = num(row, 0);
  }
  for (const row of countryRows) {
    const dateKey = parseGa4Date(dim(row, 0)).toISOString().slice(0, 10);
    const entry = byDate.get(dateKey);
    if (!entry) continue;
    const country = dim(row, 1) || 'unknown';
    (entry.countryBreakdown as Record<string, number>)[country] = num(row, 0);
  }
  return daily;
}

/** dimensions=[date, sessionDefaultChannelGroup, sessionSource], metrics=[sessions, activeUsers] */
export function parseGa4ChannelReport(rows: Ga4ReportRow[]): AcquisitionChannelRow[] {
  return rows.map((row) => {
    const source = dim(row, 2);
    return {
      date: parseGa4Date(dim(row, 0)),
      channelGroup: dim(row, 1) || 'Unassigned',
      source: source || '(direct)',
      sessions: num(row, 0),
      activeUsers: num(row, 1),
      isAiReferral: isAiReferrerSource(source),
    };
  });
}

/** dimensions=[date, landingPage], metrics=[sessions, activeUsers, userEngagementDuration, keyEvents] */
export function parseGa4LandingPageReport(rows: Ga4ReportRow[]): LandingPageRow[] {
  return rows.map((row) => ({
    date: parseGa4Date(dim(row, 0)),
    pagePath: dim(row, 1) || '/',
    sessions: num(row, 0),
    activeUsers: num(row, 1),
    avgEngagementTimeSec: num(row, 2),
    keyEvents: num(row, 3),
  }));
}

export interface Ga4SyncResult {
  daily: DailyTrafficRow[];
  channels: AcquisitionChannelRow[];
  landingPages: LandingPageRow[];
}

export async function fetchGa4Metrics(
  propertyId: string,
  accessToken: string,
  range: { startDate: string; endDate: string },
): Promise<Ga4SyncResult> {
  const auth = clientWithAccessToken(accessToken);
  const analyticsData = google.analyticsdata({ version: 'v1beta', auth });
  const property = `properties/${propertyId}`;
  const dateRanges = [{ startDate: range.startDate, endDate: range.endDate }];

  const [dailyRes, deviceRes, countryRes, channelRes, landingRes] = await Promise.all([
    analyticsData.properties.runReport({
      property,
      requestBody: { dateRanges, dimensions: [{ name: 'date' }], metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'newUsers' }, { name: 'engagedSessions' }, { name: 'userEngagementDuration' }, { name: 'keyEvents' }] },
    }),
    analyticsData.properties.runReport({
      property,
      requestBody: { dateRanges, dimensions: [{ name: 'date' }, { name: 'deviceCategory' }], metrics: [{ name: 'sessions' }] },
    }),
    analyticsData.properties.runReport({
      property,
      requestBody: { dateRanges, dimensions: [{ name: 'date' }, { name: 'country' }], metrics: [{ name: 'sessions' }] },
    }),
    analyticsData.properties.runReport({
      property,
      requestBody: { dateRanges, dimensions: [{ name: 'date' }, { name: 'sessionDefaultChannelGroup' }, { name: 'sessionSource' }], metrics: [{ name: 'sessions' }, { name: 'activeUsers' }] },
    }),
    analyticsData.properties.runReport({
      property,
      requestBody: { dateRanges, dimensions: [{ name: 'date' }, { name: 'landingPage' }], metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'userEngagementDuration' }, { name: 'keyEvents' }], limit: '100' },
    }),
  ]);

  const daily = parseGa4DailyReport(dailyRes.data.rows ?? []);
  mergeGa4DeviceCountryBreakdowns(daily, deviceRes.data.rows ?? [], countryRes.data.rows ?? []);
  const channels = parseGa4ChannelReport(channelRes.data.rows ?? []);
  const landingPages = parseGa4LandingPageReport(landingRes.data.rows ?? []);

  return { daily, channels, landingPages };
}
