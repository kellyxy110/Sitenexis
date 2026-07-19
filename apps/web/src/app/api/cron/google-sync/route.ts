export const dynamic = 'force-dynamic';
export const maxDuration = 300;
import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';
import { getValidAccessToken, GoogleTokenError } from '@/lib/google/token-manager';
import { fetchGa4Metrics } from '@/lib/google/ga4-sync';
import { fetchGscMetrics } from '@/lib/google/gsc-sync';
import { generateInsightsForUser } from '@/lib/google/insights-runner';

const SYNC_WINDOW_DAYS = 3; // rolling window — re-upserts recent days to absorb GSC's ~2-3 day data lag

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function ga4Date(d: Date): string {
  return isoDate(d).replace(/-/g, '');
}

/**
 * Daily GA4 + Search Console sync for every connected user. Vercel Cron-triggered
 * (no BullMQ worker exists), authorized via CRON_SECRET. Partial failure design:
 * one user's sync error never blocks another user's, and one provider's failure
 * (GA4 vs GSC) never blocks the other for the same user.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const {
    getAllSyncableGoogleConnections, logGoogleSync, touchGoogleConnectionSynced, setGoogleConnectionError,
    upsertDailyTrafficMetrics, upsertAcquisitionChannelMetrics, upsertLandingPageMetrics,
    upsertSearchVisibilityMetrics, upsertSearchQueryMetrics, upsertSearchPageMetrics,
  } = await import('@sitenexis/db');

  const connections = await getAllSyncableGoogleConnections();

  const end = new Date();
  const start = new Date(end.getTime() - SYNC_WINDOW_DAYS * 24 * 3_600_000);

  let ga4Synced = 0;
  let gscSynced = 0;
  let failures = 0;

  for (const conn of connections) {
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(conn.userId);
    } catch (err) {
      failures++;
      logger.warn({ userId: conn.userId, err: err instanceof Error ? err.message : String(err) }, 'Google sync skipped — token unavailable');
      continue; // getValidAccessToken already marks the connection as expired/error internally
    }

    if (conn.ga4PropertyId) {
      const startedAt = new Date();
      try {
        const result = await fetchGa4Metrics(conn.ga4PropertyId, accessToken, { startDate: ga4Date(start), endDate: ga4Date(end) });
        await Promise.all([
          upsertDailyTrafficMetrics(conn.userId, result.daily),
          upsertAcquisitionChannelMetrics(conn.userId, result.channels),
          upsertLandingPageMetrics(conn.userId, result.landingPages),
        ]);
        const recordsSynced = result.daily.length + result.channels.length + result.landingPages.length;
        await logGoogleSync({ connectionId: conn.id, userId: conn.userId, provider: 'ga4', status: 'success', recordsSynced, startedAt, completedAt: new Date() });
        ga4Synced++;
      } catch (err) {
        failures++;
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ userId: conn.userId, err: message }, 'GA4 sync failed');
        await logGoogleSync({ connectionId: conn.id, userId: conn.userId, provider: 'ga4', status: 'failed', errorMessage: message.slice(0, 500), startedAt, completedAt: new Date() });
        if (err instanceof GoogleTokenError) await setGoogleConnectionError(conn.userId, 'error', message.slice(0, 500));
      }
    }

    if (conn.gscSiteUrl) {
      const startedAt = new Date();
      try {
        const result = await fetchGscMetrics(conn.gscSiteUrl, accessToken, { startDate: isoDate(start), endDate: isoDate(end) });
        await Promise.all([
          upsertSearchVisibilityMetrics(conn.userId, result.daily),
          upsertSearchQueryMetrics(conn.userId, result.queries),
          upsertSearchPageMetrics(conn.userId, result.pages),
        ]);
        const recordsSynced = result.daily.length + result.queries.length + result.pages.length;
        await logGoogleSync({ connectionId: conn.id, userId: conn.userId, provider: 'search_console', status: 'success', recordsSynced, startedAt, completedAt: new Date() });
        gscSynced++;
      } catch (err) {
        failures++;
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ userId: conn.userId, err: message }, 'Search Console sync failed');
        await logGoogleSync({ connectionId: conn.id, userId: conn.userId, provider: 'search_console', status: 'failed', errorMessage: message.slice(0, 500), startedAt, completedAt: new Date() });
      }
    }

    await touchGoogleConnectionSynced(conn.userId);

    // Insight generation depends on fresh data, so it runs right after this user's
    // sync — its own failure never blocks the sync result for this or other users.
    try {
      await generateInsightsForUser(conn.userId);
    } catch (err) {
      logger.warn({ userId: conn.userId, err: err instanceof Error ? err.message : String(err) }, 'Insight generation failed');
    }
  }

  logger.info({ totalConnections: connections.length, ga4Synced, gscSynced, failures }, 'Google sync cron completed');
  return NextResponse.json({ totalConnections: connections.length, ga4Synced, gscSynced, failures });
}
