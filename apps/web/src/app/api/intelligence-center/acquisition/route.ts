export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';

const DEFAULT_PERIOD_DAYS = 30;
const MIN_PERIOD_DAYS = 1;
const MAX_PERIOD_DAYS = 90;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 3_600_000);
}

function clampPeriodDays(raw: string | null): number {
  const n = raw ? Number.parseInt(raw, 10) : DEFAULT_PERIOD_DAYS;
  if (!Number.isFinite(n)) return DEFAULT_PERIOD_DAYS;
  return Math.min(MAX_PERIOD_DAYS, Math.max(MIN_PERIOD_DAYS, n));
}

/**
 * GA4 Traffic Acquisition — channelGroup × source breakdown with the
 * AI-referral flag preserved. GA4's `sessionMedium`/`sessionSourceMedium`
 * dimensions are not currently requested by the sync job (only
 * channelGroup + source), so "medium" is intentionally absent here rather
 * than fabricated — see docs for the follow-up sync change needed to add it.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  const periodDays = clampPeriodDays(req.nextUrl.searchParams.get('days'));

  const { getGoogleConnection, getAggregatedAcquisitionMetrics } = await import('@sitenexis/db');

  const connection = await getGoogleConnection(user.id);
  if (!connection) return NextResponse.json({ connector: { status: 'not_connected' } });
  if (connection.status !== 'connected') return NextResponse.json({ connector: { status: connection.status } });
  if (!connection.ga4PropertyId) {
    return NextResponse.json({ connector: { status: connection.status }, periodDays, channels: [] });
  }

  const from = daysAgo(periodDays);
  const to = new Date();

  const rows = await getAggregatedAcquisitionMetrics(user.id, from, to);
  const totalSessions = rows.reduce((s, r) => s + r.sessions, 0);

  const channels = [...rows]
    .sort((a, b) => b.sessions - a.sessions)
    .map((r) => ({
      channelGroup: r.channelGroup,
      source: r.source,
      isAiReferral: r.isAiReferral,
      sessions: r.sessions,
      activeUsers: r.activeUsers,
      shareOfSessions: totalSessions > 0 ? r.sessions / totalSessions : 0,
    }));

  return NextResponse.json({
    connector: { status: connection.status },
    periodDays,
    totalSessions,
    channels,
  });
}
