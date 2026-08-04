'use client';

import NextLink from 'next/link';
import { AlertCircle } from 'lucide-react';

export interface AiVisibilityInsight {
  id: string;
  type: string;
  affectedPage: string;
  evidence: Record<string, unknown>;
  confidence: number;
  recommendedAction: string;
  verificationMethod: string;
  severity: 'critical' | 'warning' | 'info';
  createdAt: string;
}

export interface DashboardData {
  connector: {
    status: 'not_connected' | 'pending' | 'permission_expired' | 'sync_failed' | 'sync_pending' | 'no_data' | 'connected';
    googleAccountEmail?: string;
    ga4PropertyName?: string | null;
    gscSiteName?: string | null;
    lastSyncedAt?: string | null;
    lastError?: string | null;
  };
  /** True only when GA4's most recent sync attempt succeeded — false/undefined means GA4-derived fields below are not yet trustworthy and must render as unavailable, never as 0 (unavailable ≠ zero). */
  ga4Available?: boolean;
  traffic?: { totalVisitors: number; totalSessions: number; dailySeries?: Array<{ date: string; sessions: number; activeUsers: number }> };
  channels?: Array<{ channelGroup: string; sessions: number }>;
  aiReferrals?: { totalSessions: number };
  search?: { totalClicks: number; totalImpressions: number; avgCtr: number; avgPosition: number; dailySeries?: Array<{ date: string; clicks: number; impressions: number; ctr: number; avgPosition: number }> };
  topQueries?: Array<{ query: string; clicks: number; impressions: number; ctr: number; avgPosition: number }>;
  topPages?: Array<{ page: string; clicks: number; impressions: number; ctr: number; avgPosition: number }>;
  visibilityGains?: Array<{ page: string; deltaImpressions: number; current: number; previous: number }>;
  visibilityLosses?: Array<{ page: string; deltaImpressions: number; current: number; previous: number }>;
  insights?: AiVisibilityInsight[];
}

export const INSIGHT_TYPE_LABELS: Record<string, string> = {
  impressions_falling_on_issue_page: 'Impressions falling on a flagged page',
  high_impressions_low_ctr: 'High impressions, low click-through',
  traffic_without_conversion: 'Traffic without conversion',
  ai_referral_reaching_page: 'AI referral traffic detected',
  post_recommendation_improvement: 'Recommendation confirmed working',
  citation_opportunity: 'Citation-strengthening opportunity',
};

export function formatEvidence(type: string, evidence: Record<string, unknown>): string {
  switch (type) {
    case 'impressions_falling_on_issue_page':
      return `Impressions down ${String(evidence.declinePct)}% (${String(evidence.previousImpressions)} → ${String(evidence.currentImpressions)}) · ${String(evidence.unresolvedIssueCount)} unresolved issue(s)`;
    case 'high_impressions_low_ctr':
      return `${String(evidence.impressions)} impressions, ${String(evidence.clicks)} clicks (${(Number(evidence.ctr) * 100).toFixed(1)}% CTR)`;
    case 'traffic_without_conversion':
      return `${String(evidence.sessions)} sessions, 0 key events recorded`;
    case 'ai_referral_reaching_page':
      return `${String(evidence.totalAiReferralSessions)} sessions from ${String(evidence.topAiSource)}`;
    case 'post_recommendation_improvement':
      return `Impressions up ${String(evidence.improvementPct)}% since the fix was applied (${String(evidence.impressionsBefore)} → ${String(evidence.impressionsAfter)})`;
    case 'citation_opportunity':
      return `${String(evidence.clicks)} organic clicks · site Citation Probability score: ${String(evidence.siteWideCitationProbabilityScore)}/100`;
    default:
      return '';
  }
}

export function StatCard({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="mb-2 flex items-center gap-2 text-[#4A6280]">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold tabular-nums text-white">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-[#7A9AB4]">{sub}</div>}
    </div>
  );
}

export const CONNECTOR_STATE_COPY: Record<string, { title: string; body: string; tone: 'neutral' | 'warning' | 'error' }> = {
  not_connected: { title: 'Connect Google Analytics + Search Console', body: 'See real traffic and search data alongside your AI visibility scores.', tone: 'neutral' },
  pending: { title: 'Finish setup', body: 'Your Google account is connected — select a GA4 property and Search Console site in Integrations to start syncing.', tone: 'warning' },
  permission_expired: { title: 'Google permission expired', body: 'Reconnect your Google account in Integrations to resume syncing.', tone: 'error' },
  sync_failed: { title: 'Sync failed', body: 'The last sync attempt failed. Check Integrations for details, or reconnect if the problem persists.', tone: 'error' },
  sync_pending: { title: 'First sync pending', body: 'Your connection is set up — data will appear here after the next daily sync.', tone: 'neutral' },
  no_data: { title: 'No data yet', body: 'The connection is synced, but no traffic or search data was found for this period.', tone: 'neutral' },
};

export function ConnectorBanner({ status, googleAccountEmail }: { status: string; googleAccountEmail?: string | undefined }) {
  const copy = CONNECTOR_STATE_COPY[status];
  if (!copy) return null;
  const toneClass = copy.tone === 'error' ? 'border-red-500/25 bg-red-500/10' : copy.tone === 'warning' ? 'border-amber-500/25 bg-amber-500/10' : 'border-white/[0.06] bg-white/[0.02]';
  return (
    <div className={`mb-6 rounded-xl border p-5 ${toneClass}`}>
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-[#7A9AB4]" />
        <span className="font-semibold text-white">{copy.title}</span>
      </div>
      <p className="mt-1 text-sm text-[#7A9AB4]">{copy.body}</p>
      {googleAccountEmail && <p className="mt-1 text-xs text-[#4A6280]">{googleAccountEmail}</p>}
      {status === 'not_connected' && (
        <NextLink href="/dashboard/settings/integrations" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-3 py-1.5 text-xs font-semibold text-[#050816]">
          Go to Integrations
        </NextLink>
      )}
    </div>
  );
}
