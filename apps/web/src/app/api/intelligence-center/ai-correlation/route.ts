export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';

const AUDIT_HISTORY_LIMIT = 50;
const CORRELATION_WINDOW_DAYS = 3;

/**
 * Correlates AI Visibility Score history with real traffic/search activity
 * around each audit's completion date. Audits are infrequent — this never
 * fabricates a trend between sparse points; the client is expected to handle
 * as few as 1-2 correlation points gracefully.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  const { getGoogleConnection, listAuditsByUser, getDailyTrafficMetrics, getSearchVisibilityMetrics } = await import('@sitenexis/db');
  const { correlateScoresWithTraffic } = await import('@sitenexis/analyzers');
  const { matchAuditDomainToConnection } = await import('@/lib/google/domain-match');

  const connection = await getGoogleConnection(user.id);
  if (!connection) return NextResponse.json({ connector: { status: 'not_connected' } });
  if (connection.status !== 'connected') {
    return NextResponse.json({ connector: { status: connection.status } });
  }

  const { data: audits } = await listAuditsByUser(user.id, 1, AUDIT_HISTORY_LIMIT);
  const completeAudits = audits.filter((a) => a.status === 'complete' && a.completedAt != null && a.aiVisibilityScores != null);

  if (completeAudits.length === 0) {
    return NextResponse.json({
      connector: { status: connection.status },
      state: 'empty',
      reason: 'No complete audits with AI Visibility scores yet.',
      points: [],
    });
  }

  const auditedDomains = [...new Set(completeAudits.map((a) => a.domain))];
  const match = matchAuditDomainToConnection(auditedDomains, connection.gscSiteUrl);

  if (match.confidence === 'none') {
    return NextResponse.json({
      connector: { status: connection.status },
      state: 'empty',
      reason: 'Could not match any audited domain to the connected GA4/Search Console property.',
      points: [],
    });
  }

  const matchedAudits = completeAudits.filter((a) => a.domain === match.domain);
  const earliestCompletion = matchedAudits.reduce(
    (min, a) => (a.completedAt! < min ? a.completedAt! : min),
    matchedAudits[0]!.completedAt!,
  );
  const from = new Date(earliestCompletion.getTime() - CORRELATION_WINDOW_DAYS * 24 * 3_600_000);
  const to = new Date();

  const [trafficRows, searchRows] = await Promise.all([
    connection.ga4PropertyId ? getDailyTrafficMetrics(user.id, from, to) : Promise.resolve([]),
    connection.gscSiteUrl ? getSearchVisibilityMetrics(user.id, from, to) : Promise.resolve([]),
  ]);

  const points = correlateScoresWithTraffic(
    matchedAudits.map((a) => ({
      auditId: a.id,
      completedAt: a.completedAt!,
      aiVisibilityScore: a.aiVisibilityScores!.aiVisibilityScore,
    })),
    trafficRows.map((r) => ({ date: r.date, sessions: r.sessions })),
    searchRows.map((r) => ({ date: r.date, clicks: r.clicks })),
    CORRELATION_WINDOW_DAYS,
  );

  return NextResponse.json({
    connector: { status: connection.status },
    state: points.length >= 2 ? 'complete' : 'partial',
    matchedDomain: match.domain,
    matchConfidence: match.confidence,
    points,
  });
}
