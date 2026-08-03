import { describe, it, expect } from 'vitest';
import {
  detectImpressionsFallingOnIssuePages,
  detectHighImpressionsLowCtr,
  detectTrafficWithoutConversion,
  detectAiReferralReachingPage,
  detectPostRecommendationImprovement,
  detectCitationOpportunity,
} from '../detectors';

describe('detectImpressionsFallingOnIssuePages', () => {
  it('flags a page whose impressions dropped and which has unresolved issues', () => {
    const result = detectImpressionsFallingOnIssuePages(
      [{ page: '/blog/a', currentImpressions: 60, previousImpressions: 100 }],
      [{ pageUrl: '/blog/a', unresolvedIssueCount: 2, topIssueMessage: 'Missing H1' }],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'impressions_falling_on_issue_page', affectedPage: '/blog/a' });
    expect(result[0]!.evidence.declinePct).toBe(40);
  });

  it('does not flag a page with no unresolved issues even if impressions dropped', () => {
    const result = detectImpressionsFallingOnIssuePages(
      [{ page: '/blog/a', currentImpressions: 60, previousImpressions: 100 }],
      [{ pageUrl: '/blog/a', unresolvedIssueCount: 0, topIssueMessage: '' }],
    );
    expect(result).toHaveLength(0);
  });

  it('does not flag a page whose impressions rose', () => {
    const result = detectImpressionsFallingOnIssuePages(
      [{ page: '/blog/a', currentImpressions: 120, previousImpressions: 100 }],
      [{ pageUrl: '/blog/a', unresolvedIssueCount: 3, topIssueMessage: 'x' }],
    );
    expect(result).toHaveLength(0);
  });
});

describe('detectHighImpressionsLowCtr', () => {
  it('flags a page above the impressions threshold with CTR below the threshold', () => {
    const result = detectHighImpressionsLowCtr([{ page: '/x', impressions: 1000, clicks: 5, ctr: 0.005 }]);
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('high_impressions_low_ctr');
  });

  it('does not flag a page with healthy CTR', () => {
    const result = detectHighImpressionsLowCtr([{ page: '/x', impressions: 1000, clicks: 100, ctr: 0.1 }]);
    expect(result).toHaveLength(0);
  });

  it('does not flag a low-impression page even with low CTR', () => {
    const result = detectHighImpressionsLowCtr([{ page: '/x', impressions: 10, clicks: 0, ctr: 0 }]);
    expect(result).toHaveLength(0);
  });
});

describe('detectTrafficWithoutConversion', () => {
  it('flags a page with real traffic and zero key events', () => {
    const result = detectTrafficWithoutConversion([{ pagePath: '/pricing', sessions: 200, keyEvents: 0 }]);
    expect(result).toHaveLength(1);
    expect(result[0]!.affectedPage).toBe('/pricing');
  });

  it('does not flag a page with conversions', () => {
    const result = detectTrafficWithoutConversion([{ pagePath: '/pricing', sessions: 200, keyEvents: 5 }]);
    expect(result).toHaveLength(0);
  });

  it('does not flag a low-traffic page', () => {
    const result = detectTrafficWithoutConversion([{ pagePath: '/pricing', sessions: 3, keyEvents: 0 }]);
    expect(result).toHaveLength(0);
  });
});

describe('detectAiReferralReachingPage', () => {
  it('flags the top landing page when AI referral sessions exist', () => {
    const result = detectAiReferralReachingPage({ totalSessions: 15, topSource: 'chat.openai.com' }, { pagePath: '/blog/a', sessions: 300 });
    expect(result).toHaveLength(1);
    expect(result[0]!.affectedPage).toBe('/blog/a');
  });

  it('returns nothing when there are zero AI referral sessions', () => {
    const result = detectAiReferralReachingPage({ totalSessions: 0, topSource: '' }, { pagePath: '/blog/a', sessions: 300 });
    expect(result).toHaveLength(0);
  });

  it('returns nothing when there is no landing page data at all', () => {
    const result = detectAiReferralReachingPage({ totalSessions: 10, topSource: 'claude.ai' }, null);
    expect(result).toHaveLength(0);
  });
});

describe('detectPostRecommendationImprovement', () => {
  it('flags a page whose impressions improved meaningfully after a recommendation was applied', () => {
    const result = detectPostRecommendationImprovement([
      { page: '/blog/a', appliedAt: new Date('2026-07-01'), impressionsBefore: 100, impressionsAfter: 150, recommendationAction: 'Add a meta description' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.evidence.improvementPct).toBe(50);
  });

  it('does not flag a page below the minimum improvement threshold', () => {
    const result = detectPostRecommendationImprovement([
      { page: '/blog/a', appliedAt: new Date('2026-07-01'), impressionsBefore: 100, impressionsAfter: 105, recommendationAction: 'x' },
    ]);
    expect(result).toHaveLength(0);
  });

  it('does not flag a page with zero prior impressions (no meaningful baseline)', () => {
    const result = detectPostRecommendationImprovement([
      { page: '/blog/a', appliedAt: new Date('2026-07-01'), impressionsBefore: 0, impressionsAfter: 50, recommendationAction: 'x' },
    ]);
    expect(result).toHaveLength(0);
  });
});

describe('detectCitationOpportunity', () => {
  it('flags a strong-organic page when the site-wide Citation Probability score is weak', () => {
    const result = detectCitationOpportunity(
      [{ page: '/blog/a', clicks: 120, impressions: 2000 }],
      35,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'citation_opportunity', affectedPage: '/blog/a' });
    expect(result[0]!.evidence.siteWideCitationProbabilityScore).toBe(35);
  });

  it('never flags anything when the citation score is strong, even with high organic clicks', () => {
    const result = detectCitationOpportunity(
      [{ page: '/blog/a', clicks: 500, impressions: 5000 }],
      85,
    );
    expect(result).toHaveLength(0);
  });

  it('never flags anything when the citation score is unknown (null) — no fabricated evidence', () => {
    const result = detectCitationOpportunity(
      [{ page: '/blog/a', clicks: 500, impressions: 5000 }],
      null,
    );
    expect(result).toHaveLength(0);
  });

  it('does not flag a low-traffic page even with a weak citation score', () => {
    const result = detectCitationOpportunity(
      [{ page: '/blog/tiny', clicks: 3, impressions: 40 }],
      30,
    );
    expect(result).toHaveLength(0);
  });

  it('caps results at maxResults, keeping the highest-click pages', () => {
    const pages = Array.from({ length: 10 }, (_, i) => ({ page: `/p${i}`, clicks: 100 - i, impressions: 1000 }));
    const result = detectCitationOpportunity(pages, 20, { maxResults: 3 });
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.affectedPage)).toEqual(['/p0', '/p1', '/p2']);
  });

  it('is deterministic for identical inputs', () => {
    const pages = [{ page: '/blog/a', clicks: 120, impressions: 2000 }];
    expect(detectCitationOpportunity(pages, 35)).toEqual(detectCitationOpportunity(pages, 35));
  });
});
