import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  getAuditsByUser: vi.fn(),
  getIssuesByAudit: vi.fn(),
  getAggregatedSearchPageMetrics: vi.fn(),
  getTopSearchPages: vi.fn(),
  getLandingPageMetrics: vi.fn(),
  getAiReferralMetrics: vi.fn(),
  getAppliedOptimizationSessionsForUser: vi.fn(),
  replaceAiVisibilityInsights: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@sitenexis/db', () => h);
// The 5 detectors already have a dedicated, passing unit suite in
// packages/analyzers — mocked here with faithful lightweight equivalents so
// this suite stays fast (avoids a slow first-time cold import under vitest)
// and focuses on verifying the orchestrator wires data into them correctly.
vi.mock('@sitenexis/analyzers', () => ({
  detectImpressionsFallingOnIssuePages: (
    deltas: Array<{ page: string; currentImpressions: number; previousImpressions: number }>,
    issues: Array<{ pageUrl: string; unresolvedIssueCount: number; topIssueMessage: string }>,
  ) => {
    const issueMap = new Map(issues.map((i) => [i.pageUrl, i]));
    return deltas
      .filter((d) => d.previousImpressions > d.currentImpressions && issueMap.has(d.page))
      .map((d) => ({ type: 'impressions_falling_on_issue_page', affectedPage: d.page, evidence: {}, confidence: 0.7, recommendedAction: 'x', verificationMethod: 'x' }));
  },
  detectHighImpressionsLowCtr: (pages: Array<{ page: string; impressions: number; ctr: number }>) =>
    pages.filter((p) => p.impressions >= 500 && p.ctr < 0.02)
      .map((p) => ({ type: 'high_impressions_low_ctr', affectedPage: p.page, evidence: {}, confidence: 0.7, recommendedAction: 'x', verificationMethod: 'x' })),
  detectTrafficWithoutConversion: (pages: Array<{ pagePath: string; sessions: number; keyEvents: number }>) =>
    pages.filter((p) => p.sessions >= 50 && p.keyEvents === 0)
      .map((p) => ({ type: 'traffic_without_conversion', affectedPage: p.pagePath, evidence: {}, confidence: 0.7, recommendedAction: 'x', verificationMethod: 'x' })),
  detectAiReferralReachingPage: (
    aiReferral: { totalSessions: number; topSource: string },
    topLandingPage: { pagePath: string; sessions: number } | null,
  ) => (aiReferral.totalSessions > 0 && topLandingPage
    ? [{ type: 'ai_referral_reaching_page', affectedPage: topLandingPage.pagePath, evidence: {}, confidence: 0.6, recommendedAction: 'x', verificationMethod: 'x' }]
    : []),
  detectPostRecommendationImprovement: (inputs: Array<{ page: string; impressionsBefore: number; impressionsAfter: number }>) =>
    inputs.filter((i) => i.impressionsBefore > 0 && ((i.impressionsAfter - i.impressionsBefore) / i.impressionsBefore) * 100 >= 10)
      .map((i) => ({ type: 'post_recommendation_improvement', affectedPage: i.page, evidence: {}, confidence: 0.7, recommendedAction: 'x', verificationMethod: 'x' })),
}));

const { generateInsightsForUser } = await import('../insights-runner');

beforeEach(() => {
  vi.clearAllMocks();
  h.getAuditsByUser.mockResolvedValue([]);
  h.getIssuesByAudit.mockResolvedValue([]);
  h.getAggregatedSearchPageMetrics.mockResolvedValue([]);
  h.getTopSearchPages.mockResolvedValue([]);
  h.getLandingPageMetrics.mockResolvedValue([]);
  h.getAiReferralMetrics.mockResolvedValue([]);
  h.getAppliedOptimizationSessionsForUser.mockResolvedValue([]);
  h.replaceAiVisibilityInsights.mockResolvedValue(undefined);
});

describe('generateInsightsForUser', () => {
  it('persists zero insights when there is no data at all', async () => {
    const result = await generateInsightsForUser('user-1');
    expect(result.generated).toBe(0);
    expect(h.replaceAiVisibilityInsights).toHaveBeenCalledWith('user-1', []);
  });

  it('detects high-impressions-low-ctr from aggregated top-page rows', async () => {
    h.getTopSearchPages.mockResolvedValue([{ page: '/blog/a', clicks: 2, impressions: 1000, ctr: 0.002, avgPosition: 8 }]);
    const result = await generateInsightsForUser('user-1');
    expect(result.generated).toBeGreaterThan(0);
    const saved = h.replaceAiVisibilityInsights.mock.calls[0][1];
    expect(saved.some((c: { type: string }) => c.type === 'high_impressions_low_ctr')).toBe(true);
  });

  it('detects traffic-without-conversion from landing page rows', async () => {
    h.getLandingPageMetrics.mockResolvedValue([{ date: new Date(), pagePath: '/pricing', sessions: 100, activeUsers: 90, avgEngagementTimeSec: 30, keyEvents: 0 }]);
    const result = await generateInsightsForUser('user-1');
    const saved = h.replaceAiVisibilityInsights.mock.calls[0][1];
    expect(saved.some((c: { type: string }) => c.type === 'traffic_without_conversion')).toBe(true);
    void result;
  });

  it('detects AI referral reaching a page when both signals are present', async () => {
    h.getAiReferralMetrics.mockResolvedValue([{ date: new Date(), channelGroup: 'Referral', source: 'chat.openai.com', sessions: 10, activeUsers: 8, isAiReferral: true }]);
    h.getLandingPageMetrics.mockResolvedValue([{ date: new Date(), pagePath: '/blog/a', sessions: 300, activeUsers: 280, avgEngagementTimeSec: 40, keyEvents: 2 }]);
    await generateInsightsForUser('user-1');
    const saved = h.replaceAiVisibilityInsights.mock.calls[0][1];
    expect(saved.some((c: { type: string }) => c.type === 'ai_referral_reaching_page')).toBe(true);
  });

  it('skips post-recommendation-improvement when not enough time has passed since applying', async () => {
    h.getAppliedOptimizationSessionsForUser.mockResolvedValue([{ id: 's1', page: '/blog/a', appliedAt: new Date(), recommendedAction: 'Add meta description' }]);
    await generateInsightsForUser('user-1');
    const saved = h.replaceAiVisibilityInsights.mock.calls[0][1];
    expect(saved.some((c: { type: string }) => c.type === 'post_recommendation_improvement')).toBe(false);
  });

  it('detects post-recommendation-improvement once enough time has passed and impressions rose', async () => {
    const appliedAt = new Date(Date.now() - 10 * 24 * 3_600_000); // 10 days ago
    h.getAppliedOptimizationSessionsForUser.mockResolvedValue([{ id: 's1', page: '/blog/a', appliedAt, recommendedAction: 'Add meta description' }]);
    h.getAggregatedSearchPageMetrics
      .mockResolvedValueOnce([]) // insight #1 current period (unused here since no issues)
      .mockResolvedValueOnce([]) // insight #1 previous period
      .mockResolvedValueOnce([{ page: '/blog/a', clicks: 5, impressions: 100 }]) // before window for #5
      .mockResolvedValueOnce([{ page: '/blog/a', clicks: 10, impressions: 200 }]); // after window for #5

    await generateInsightsForUser('user-1');
    const saved = h.replaceAiVisibilityInsights.mock.calls[0][1];
    const hit = saved.find((c: { type: string }) => c.type === 'post_recommendation_improvement');
    expect(hit).toBeDefined();
    expect(hit.affectedPage).toBe('/blog/a');
  });
});
