/**
 * Deterministic insight detectors for the AI Visibility Intelligence Center.
 * Pure, threshold-based rules over already-synced GA4/GSC data — never an LLM
 * call. Every candidate carries all five required fields (requirement #11):
 * evidence, affectedPage, confidence, recommendedAction, verificationMethod.
 */

export type InsightType =
  | 'impressions_falling_on_issue_page'
  | 'high_impressions_low_ctr'
  | 'traffic_without_conversion'
  | 'ai_referral_reaching_page'
  | 'post_recommendation_improvement';

export interface InsightCandidate {
  type: InsightType;
  affectedPage: string;
  evidence: Record<string, unknown>;
  confidence: number;
  recommendedAction: string;
  verificationMethod: string;
}

// ── 1. Impressions falling on pages with unresolved audit issues ─────────────

export interface PageImpressionsDelta {
  page: string;
  currentImpressions: number;
  previousImpressions: number;
}
export interface PageIssueInfo {
  pageUrl: string;
  unresolvedIssueCount: number;
  topIssueMessage: string;
}

export function detectImpressionsFallingOnIssuePages(
  deltas: PageImpressionsDelta[],
  issuesByPage: PageIssueInfo[],
): InsightCandidate[] {
  const issueMap = new Map(issuesByPage.map((i) => [i.pageUrl, i]));
  const out: InsightCandidate[] = [];

  for (const d of deltas) {
    const decline = d.previousImpressions - d.currentImpressions;
    if (decline <= 0 || d.previousImpressions === 0) continue;
    const issue = issueMap.get(d.page);
    if (!issue || issue.unresolvedIssueCount === 0) continue;

    const declinePct = Math.round((decline / d.previousImpressions) * 100);
    out.push({
      type: 'impressions_falling_on_issue_page',
      affectedPage: d.page,
      evidence: { currentImpressions: d.currentImpressions, previousImpressions: d.previousImpressions, declinePct, unresolvedIssueCount: issue.unresolvedIssueCount, topIssueMessage: issue.topIssueMessage },
      confidence: Math.min(0.9, 0.4 + declinePct / 200 + Math.min(0.2, issue.unresolvedIssueCount * 0.05)),
      recommendedAction: `Resolve the ${issue.unresolvedIssueCount} unresolved issue(s) on this page, starting with: ${issue.topIssueMessage}`,
      verificationMethod: 'Re-run the audit after fixing the issue(s), then compare next week\'s Search Console impressions for this page.',
    });
  }
  return out;
}

// ── 2. High impressions but low CTR ──────────────────────────────────────────

export interface SearchPageStat { page: string; impressions: number; clicks: number; ctr: number }

export function detectHighImpressionsLowCtr(
  pages: SearchPageStat[],
  opts: { impressionsThreshold?: number; ctrThreshold?: number } = {},
): InsightCandidate[] {
  const impressionsThreshold = opts.impressionsThreshold ?? 500;
  const ctrThreshold = opts.ctrThreshold ?? 0.02;

  return pages
    .filter((p) => p.impressions >= impressionsThreshold && p.ctr < ctrThreshold)
    .map((p) => ({
      type: 'high_impressions_low_ctr' as const,
      affectedPage: p.page,
      evidence: { impressions: p.impressions, clicks: p.clicks, ctr: p.ctr },
      confidence: Math.min(0.9, 0.5 + (p.impressions / impressionsThreshold) * 0.1),
      recommendedAction: 'Rewrite the title tag and meta description to be more compelling and closely match searcher intent — this page is being shown often but rarely clicked.',
      verificationMethod: 'Compare this page\'s CTR in Search Console for two weeks after updating the title/meta description.',
    }));
}

// ── 3. Traffic without conversion ────────────────────────────────────────────

export interface LandingPageStat { pagePath: string; sessions: number; keyEvents: number }

export function detectTrafficWithoutConversion(
  pages: LandingPageStat[],
  opts: { sessionsThreshold?: number } = {},
): InsightCandidate[] {
  const sessionsThreshold = opts.sessionsThreshold ?? 50;

  return pages
    .filter((p) => p.sessions >= sessionsThreshold && p.keyEvents === 0)
    .map((p) => ({
      type: 'traffic_without_conversion' as const,
      affectedPage: p.pagePath,
      evidence: { sessions: p.sessions, keyEvents: p.keyEvents },
      confidence: Math.min(0.85, 0.4 + (p.sessions / sessionsThreshold) * 0.1),
      recommendedAction: 'Add a clear call-to-action to this page — it receives real traffic but records zero key events (conversions).',
      verificationMethod: 'Check whether key events on this page are non-zero in GA4 over the following two weeks.',
    }));
}

// ── 4. AI referral traffic reaching a page ───────────────────────────────────

export interface AiReferralStat { totalSessions: number; topSource: string }
export interface TopLandingPage { pagePath: string; sessions: number }

export function detectAiReferralReachingPage(
  aiReferral: AiReferralStat,
  topLandingPage: TopLandingPage | null,
): InsightCandidate[] {
  if (aiReferral.totalSessions === 0 || !topLandingPage) return [];

  return [{
    type: 'ai_referral_reaching_page',
    affectedPage: topLandingPage.pagePath,
    // Site-level attribution: GA4 sync does not cross landing-page with source
    // in v1, so the top overall landing page is used as the affected-page proxy —
    // documented approximation, not a per-page-exact join.
    evidence: { totalAiReferralSessions: aiReferral.totalSessions, topAiSource: aiReferral.topSource, topLandingPageSessions: topLandingPage.sessions },
    confidence: 0.6,
    recommendedAction: `Traffic is arriving from ${aiReferral.topSource}. Strengthen entity clarity and direct-answer structure on your top landing page so AI systems keep citing it.`,
    verificationMethod: 'Track AI-referral session counts in the Channels breakdown over the following weeks to confirm the trend continues or grows.',
  }];
}

// ── 5. Metrics improving after a recommendation was applied ─────────────────

export interface RecommendationImpactInput {
  page: string;
  appliedAt: Date;
  impressionsBefore: number;
  impressionsAfter: number;
  recommendationAction: string;
}

export function detectPostRecommendationImprovement(
  inputs: RecommendationImpactInput[],
  opts: { minImprovementPct?: number } = {},
): InsightCandidate[] {
  const minImprovementPct = opts.minImprovementPct ?? 10;

  return inputs
    .filter((i) => i.impressionsBefore > 0 && ((i.impressionsAfter - i.impressionsBefore) / i.impressionsBefore) * 100 >= minImprovementPct)
    .map((i) => {
      const improvementPct = Math.round(((i.impressionsAfter - i.impressionsBefore) / i.impressionsBefore) * 100);
      return {
        type: 'post_recommendation_improvement' as const,
        affectedPage: i.page,
        evidence: { appliedAt: i.appliedAt.toISOString(), impressionsBefore: i.impressionsBefore, impressionsAfter: i.impressionsAfter, improvementPct, recommendationAction: i.recommendationAction },
        confidence: Math.min(0.85, 0.5 + improvementPct / 200),
        recommendedAction: `This confirms the applied recommendation worked — apply the same pattern ("${i.recommendationAction}") to similar underperforming pages.`,
        verificationMethod: 'Continue monitoring impressions for 2-4 more weeks to confirm the improvement is sustained, not a short-term fluctuation.',
      };
    });
}
