/**
 * Assembles GA4/GSC + audit + Page Intelligence data for one user and runs the
 * five deterministic insight detectors, replacing that user's insight set.
 * Runs as part of the daily Google sync cron (same cadence, same per-user loop).
 */
import { logger } from '@/lib/logger';

const CURRENT_PERIOD_DAYS = 7;
const HIGH_IMPRESSIONS_LOOKBACK_DAYS = 30;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 3_600_000);
}

export async function generateInsightsForUser(userId: string): Promise<{ generated: number }> {
  const {
    getAuditsByUser, getIssuesByAudit, getAggregatedSearchPageMetrics, getTopSearchPages,
    getLandingPageMetrics, getAiReferralMetrics, getAppliedOptimizationSessionsForUser, replaceAiVisibilityInsights,
  } = await import('@sitenexis/db');

  const {
    detectImpressionsFallingOnIssuePages, detectHighImpressionsLowCtr, detectTrafficWithoutConversion,
    detectAiReferralReachingPage, detectPostRecommendationImprovement,
  } = await import('@sitenexis/analyzers');
  type RecommendationImpactInput = Parameters<typeof detectPostRecommendationImprovement>[0][number];

  const now = new Date();
  const currentStart = daysAgo(CURRENT_PERIOD_DAYS);
  const previousStart = daysAgo(CURRENT_PERIOD_DAYS * 2);
  const previousEnd = daysAgo(CURRENT_PERIOD_DAYS);
  const lookbackStart = daysAgo(HIGH_IMPRESSIONS_LOOKBACK_DAYS);

  const audits = await getAuditsByUser(userId, 10);
  const latestComplete = audits.find((a) => a.status === 'complete') ?? null;

  const [currentPages, previousPages, topPages, landingPages, aiReferral] = await Promise.all([
    getAggregatedSearchPageMetrics(userId, currentStart, now),
    getAggregatedSearchPageMetrics(userId, previousStart, previousEnd),
    getTopSearchPages(userId, lookbackStart, now, 50),
    getLandingPageMetrics(userId, lookbackStart, now),
    getAiReferralMetrics(userId, lookbackStart, now),
  ]);

  const candidates: Array<{ type: string; affectedPage: string; evidence: Record<string, unknown>; confidence: number; recommendedAction: string; verificationMethod: string }> = [];

  // 1. Impressions falling on pages with unresolved issues
  if (latestComplete) {
    const issues = await getIssuesByAudit(latestComplete.id);
    const issuesByPage = new Map<string, { count: number; topMessage: string }>();
    for (const issue of issues) {
      if (!issue.pageUrl) continue;
      const existing = issuesByPage.get(issue.pageUrl);
      if (existing) existing.count++;
      else issuesByPage.set(issue.pageUrl, { count: 1, topMessage: issue.message });
    }
    const previousByPage = new Map(previousPages.map((p) => [p.page, p.impressions]));
    const deltas = currentPages.map((p) => ({ page: p.page, currentImpressions: p.impressions, previousImpressions: previousByPage.get(p.page) ?? 0 }));
    candidates.push(...detectImpressionsFallingOnIssuePages(
      deltas,
      [...issuesByPage.entries()].map(([pageUrl, v]) => ({ pageUrl, unresolvedIssueCount: v.count, topIssueMessage: v.topMessage })),
    ));
  }

  // 2. High impressions, low CTR — aggregate per-page across the lookback window
  const perPageStats = new Map<string, { impressions: number; clicks: number }>();
  for (const row of topPages) {
    const existing = perPageStats.get(row.page) ?? { impressions: 0, clicks: 0 };
    existing.impressions += row.impressions;
    existing.clicks += row.clicks;
    perPageStats.set(row.page, existing);
  }
  const aggregatedPageStats = [...perPageStats.entries()].map(([page, v]) => ({ page, impressions: v.impressions, clicks: v.clicks, ctr: v.impressions > 0 ? v.clicks / v.impressions : 0 }));
  candidates.push(...detectHighImpressionsLowCtr(aggregatedPageStats));

  // 3. Traffic without conversion — aggregate landing page sessions/keyEvents across the lookback window
  const perLandingPageStats = new Map<string, { sessions: number; keyEvents: number }>();
  for (const row of landingPages) {
    const existing = perLandingPageStats.get(row.pagePath) ?? { sessions: 0, keyEvents: 0 };
    existing.sessions += row.sessions;
    existing.keyEvents += row.keyEvents;
    perLandingPageStats.set(row.pagePath, existing);
  }
  candidates.push(...detectTrafficWithoutConversion([...perLandingPageStats.entries()].map(([pagePath, v]) => ({ pagePath, ...v }))));

  // 4. AI referral traffic reaching a page
  const totalAiReferralSessions = aiReferral.reduce((s, r) => s + r.sessions, 0);
  const topSource = [...aiReferral].sort((a, b) => b.sessions - a.sessions)[0]?.source ?? '';
  const topLandingPage = [...landingPages].sort((a, b) => b.sessions - a.sessions)[0] ?? null;
  candidates.push(...detectAiReferralReachingPage(
    { totalSessions: totalAiReferralSessions, topSource },
    topLandingPage ? { pagePath: topLandingPage.pagePath, sessions: topLandingPage.sessions } : null,
  ));

  // 5. Metrics improving after a recommendation was applied — compare each
  // applied session's page impressions in the 7 days before vs after it was applied.
  const appliedSessions = await getAppliedOptimizationSessionsForUser(userId);
  const recommendationImpacts: RecommendationImpactInput[] = [];
  for (const session of appliedSessions) {
    const appliedAt = session.appliedAt;
    const beforeStart = new Date(appliedAt.getTime() - CURRENT_PERIOD_DAYS * 24 * 3_600_000);
    const afterEnd = new Date(Math.min(appliedAt.getTime() + CURRENT_PERIOD_DAYS * 24 * 3_600_000, now.getTime()));
    if (afterEnd.getTime() <= appliedAt.getTime()) continue; // not enough time has passed yet to measure "after"

    const [beforeAgg, afterAgg] = await Promise.all([
      getAggregatedSearchPageMetrics(userId, beforeStart, appliedAt),
      getAggregatedSearchPageMetrics(userId, appliedAt, afterEnd),
    ]);
    const beforeImpressions = beforeAgg.find((p) => p.page === session.page)?.impressions ?? 0;
    const afterImpressions = afterAgg.find((p) => p.page === session.page)?.impressions ?? 0;
    recommendationImpacts.push({ page: session.page, appliedAt, impressionsBefore: beforeImpressions, impressionsAfter: afterImpressions, recommendationAction: session.recommendedAction });
  }
  candidates.push(...detectPostRecommendationImprovement(recommendationImpacts));

  try {
    await replaceAiVisibilityInsights(userId, candidates as Parameters<typeof replaceAiVisibilityInsights>[1]);
  } catch (err) {
    logger.error({ userId, err: err instanceof Error ? err.message : String(err) }, 'Failed to persist AI visibility insights');
    throw err;
  }

  return { generated: candidates.length };
}
