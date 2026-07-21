'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import NextLink from 'next/link';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useLatestAudit, useAuditSubReport } from '@/lib/use-audit-data';
import { Activity, TrendingUp, TrendingDown, Users, MousePointerClick, Eye, Search, Link2, AlertCircle, Sparkles, Lightbulb } from 'lucide-react';

interface DashboardData {
  connector: {
    status: 'not_connected' | 'pending' | 'permission_expired' | 'sync_failed' | 'sync_pending' | 'no_data' | 'connected';
    googleAccountEmail?: string;
    ga4PropertyName?: string | null;
    gscSiteName?: string | null;
    lastSyncedAt?: string | null;
    lastError?: string | null;
  };
  traffic?: { totalVisitors: number; totalSessions: number };
  channels?: Array<{ channelGroup: string; sessions: number }>;
  aiReferrals?: { totalSessions: number };
  search?: { totalClicks: number; totalImpressions: number; avgCtr: number; avgPosition: number };
  topQueries?: Array<{ query: string; clicks: number; impressions: number; ctr: number; avgPosition: number }>;
  topPages?: Array<{ page: string; clicks: number; impressions: number; ctr: number; avgPosition: number }>;
  visibilityGains?: Array<{ page: string; deltaImpressions: number; current: number; previous: number }>;
  visibilityLosses?: Array<{ page: string; deltaImpressions: number; current: number; previous: number }>;
  insights?: AiVisibilityInsight[];
}

interface AiVisibilityInsight {
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

const INSIGHT_TYPE_LABELS: Record<string, string> = {
  impressions_falling_on_issue_page: 'Impressions falling on a flagged page',
  high_impressions_low_ctr: 'High impressions, low click-through',
  traffic_without_conversion: 'Traffic without conversion',
  ai_referral_reaching_page: 'AI referral traffic detected',
  post_recommendation_improvement: 'Recommendation confirmed working',
};

function formatEvidence(type: string, evidence: Record<string, unknown>): string {
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
    default:
      return '';
  }
}

interface AiVisibilityScoreData {
  aiVisibilityScore: number;
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
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

const CONNECTOR_STATE_COPY: Record<string, { title: string; body: string; tone: 'neutral' | 'warning' | 'error' }> = {
  not_connected: { title: 'Connect Google Analytics + Search Console', body: 'See real traffic and search data alongside your AI visibility scores.', tone: 'neutral' },
  pending: { title: 'Finish setup', body: 'Your Google account is connected — select a GA4 property and Search Console site in Integrations to start syncing.', tone: 'warning' },
  permission_expired: { title: 'Google permission expired', body: 'Reconnect your Google account in Integrations to resume syncing.', tone: 'error' },
  sync_failed: { title: 'Sync failed', body: 'The last sync attempt failed. Check Integrations for details, or reconnect if the problem persists.', tone: 'error' },
  sync_pending: { title: 'First sync pending', body: 'Your connection is set up — data will appear here after the next daily sync.', tone: 'neutral' },
  no_data: { title: 'No data yet', body: 'The connection is synced, but no traffic or search data was found for this period.', tone: 'neutral' },
};

function ConnectorBanner({ status, googleAccountEmail }: { status: string; googleAccountEmail?: string | undefined }) {
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

export default function IntelligenceCenterPage() {
  const router = useRouter();
  const { audit } = useLatestAudit();
  const { data: aiVisibility } = useAuditSubReport<AiVisibilityScoreData>(audit?.id ?? null, 'ai-visibility');

  const dashboardQuery = useQuery({
    queryKey: ['intelligence-center-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/intelligence-center/dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard');
      return res.json() as Promise<DashboardData>;
    },
    staleTime: 60_000,
  });

  const data = dashboardQuery.data;
  const isConnected = data?.connector.status === 'connected';

  return (
    <DashboardLayout>
      <TopCommandBar onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)} />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">
        <div className="mb-6 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-cyan" />
          <h1 className="text-xl font-bold text-white">AI Visibility Intelligence Center</h1>
        </div>

        {data && !isConnected && <ConnectorBanner status={data.connector.status} googleAccountEmail={data.connector.googleAccountEmail} />}

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={Activity} label="AI Visibility Score" value={aiVisibility ? String(Math.round(aiVisibility.aiVisibilityScore)) : '—'} />
          <StatCard icon={Users} label="Visitors (30d)" value={isConnected ? String(data?.traffic?.totalVisitors ?? 0) : '—'} />
          <StatCard icon={Activity} label="Sessions (30d)" value={isConnected ? String(data?.traffic?.totalSessions ?? 0) : '—'} />
          <StatCard icon={Sparkles} label="AI Referral Sessions" value={isConnected ? String(data?.aiReferrals?.totalSessions ?? 0) : '—'} sub="Traffic from ChatGPT, Perplexity, Claude, Gemini…" />
          <StatCard icon={MousePointerClick} label="Clicks (30d)" value={isConnected ? String(data?.search?.totalClicks ?? 0) : '—'} />
          <StatCard icon={Eye} label="Impressions (30d)" value={isConnected ? String(data?.search?.totalImpressions ?? 0) : '—'} />
          <StatCard icon={Search} label="Avg CTR" value={isConnected ? `${((data?.search?.avgCtr ?? 0) * 100).toFixed(1)}%` : '—'} />
          <StatCard icon={Link2} label="Avg Position" value={isConnected ? (data?.search?.avgPosition ?? 0).toFixed(1) : '—'} />
        </div>

        {isConnected && (
          <>
            <div className="mb-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <h2 className="mb-3 text-sm font-semibold text-white">Channels</h2>
                <div className="space-y-2">
                  {(data?.channels ?? []).map((c) => (
                    <div key={c.channelGroup} className="flex items-center justify-between text-xs">
                      <span className="text-[#7A9AB4]">{c.channelGroup}</span>
                      <span className="font-semibold tabular-nums text-white">{c.sessions}</span>
                    </div>
                  ))}
                  {(data?.channels ?? []).length === 0 && <p className="text-xs text-[#4A6280]">No channel data yet.</p>}
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <h2 className="mb-3 text-sm font-semibold text-white">Connector health</h2>
                <div className="space-y-1 text-xs text-[#7A9AB4]">
                  <div>GA4: {data?.connector.ga4PropertyName ?? 'not selected'}</div>
                  <div>Search Console: {data?.connector.gscSiteName ?? 'not selected'}</div>
                  <div>Last synced: {data?.connector.lastSyncedAt ? new Date(data.connector.lastSyncedAt).toLocaleString() : 'never'}</div>
                </div>
              </div>
            </div>

            <div className="mb-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <h2 className="mb-3 text-sm font-semibold text-white">Top pages</h2>
                <table className="w-full text-xs">
                  <thead><tr className="text-[#4A6280]"><th className="text-left font-normal">Page</th><th className="text-right font-normal">Clicks</th><th className="text-right font-normal">Impr.</th></tr></thead>
                  <tbody>
                    {(data?.topPages ?? []).map((p) => (
                      <tr key={p.page} className="border-t border-white/[0.04]">
                        <td className="max-w-[200px] truncate py-1.5 text-[#C8DFE8]">{p.page}</td>
                        <td className="py-1.5 text-right tabular-nums text-white">{p.clicks}</td>
                        <td className="py-1.5 text-right tabular-nums text-white">{p.impressions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(data?.topPages ?? []).length === 0 && <p className="text-xs text-[#4A6280]">No page data yet.</p>}
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <h2 className="mb-3 text-sm font-semibold text-white">Top queries</h2>
                <table className="w-full text-xs">
                  <thead><tr className="text-[#4A6280]"><th className="text-left font-normal">Query</th><th className="text-right font-normal">Clicks</th><th className="text-right font-normal">Impr.</th></tr></thead>
                  <tbody>
                    {(data?.topQueries ?? []).map((q) => (
                      <tr key={q.query} className="border-t border-white/[0.04]">
                        <td className="max-w-[200px] truncate py-1.5 text-[#C8DFE8]">{q.query}</td>
                        <td className="py-1.5 text-right tabular-nums text-white">{q.clicks}</td>
                        <td className="py-1.5 text-right tabular-nums text-white">{q.impressions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(data?.topQueries ?? []).length === 0 && <p className="text-xs text-[#4A6280]">No query data yet.</p>}
              </div>
            </div>

            <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-white"><Lightbulb size={14} className="text-cyan" /> AI Visibility Insights</h2>
              <div className="space-y-2">
                {(data?.insights ?? []).map((insight) => (
                  <div key={insight.id} className="rounded-lg border border-white/[0.05] bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#C8DFE8]">{INSIGHT_TYPE_LABELS[insight.type] ?? insight.type}</span>
                      <span className="shrink-0 text-[10px] tabular-nums text-[#4A6280]">{Math.round(insight.confidence * 100)}% confidence</span>
                    </div>
                    <p className="mt-1 max-w-[520px] truncate text-[11px] text-[#7A9AB4]">{insight.affectedPage}</p>
                    <p className="mt-1.5 text-xs text-[#C8DFE8]">{formatEvidence(insight.type, insight.evidence)}</p>
                    <p className="mt-1.5 text-xs text-white">{insight.recommendedAction}</p>
                    <p className="mt-1.5 text-[11px] italic text-[#4A6280]">How to verify: {insight.verificationMethod}</p>
                  </div>
                ))}
                {(data?.insights ?? []).length === 0 && (
                  <p className="text-xs text-[#4A6280]">No insights yet — these are generated from your synced traffic and search data against your latest audit. Check back after the next sync.</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-teal-500/20 bg-teal-500/[0.04] p-4">
                <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-teal-400"><TrendingUp size={14} /> Visibility gains (7d vs prior 7d)</h2>
                <div className="space-y-1.5">
                  {(data?.visibilityGains ?? []).map((g) => (
                    <div key={g.page} className="flex items-center justify-between text-xs">
                      <span className="max-w-[220px] truncate text-[#C8DFE8]">{g.page}</span>
                      <span className="font-semibold tabular-nums text-teal-400">+{g.deltaImpressions}</span>
                    </div>
                  ))}
                  {(data?.visibilityGains ?? []).length === 0 && <p className="text-xs text-[#4A6280]">No significant gains this period.</p>}
                </div>
              </div>
              <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4">
                <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-red-400"><TrendingDown size={14} /> Visibility losses (7d vs prior 7d)</h2>
                <div className="space-y-1.5">
                  {(data?.visibilityLosses ?? []).map((l) => (
                    <div key={l.page} className="flex items-center justify-between text-xs">
                      <span className="max-w-[220px] truncate text-[#C8DFE8]">{l.page}</span>
                      <span className="font-semibold tabular-nums text-red-400">{l.deltaImpressions}</span>
                    </div>
                  ))}
                  {(data?.visibilityLosses ?? []).length === 0 && <p className="text-xs text-[#4A6280]">No significant losses this period.</p>}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </DashboardLayout>
  );
}
