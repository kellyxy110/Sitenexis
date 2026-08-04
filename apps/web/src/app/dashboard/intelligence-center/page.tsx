'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useLatestAudit, useAuditSubReport } from '@/lib/use-audit-data';
import { Activity, TrendingUp, TrendingDown, Users, MousePointerClick, Eye, Search, Link2, Sparkles, Lightbulb } from 'lucide-react';
import {
  type DashboardData, StatCard, ConnectorBanner, INSIGHT_TYPE_LABELS, formatEvidence,
} from '@/components/intelligence-center/shared';
import { TrendSection } from '@/components/intelligence-center/TrendSection';
import { BreakdownCards } from '@/components/intelligence-center/BreakdownCards';
import { AiCorrelationSection } from '@/components/intelligence-center/AiCorrelationSection';
import { QueriesSection } from '@/components/intelligence-center/QueriesSection';
import { PagesSection } from '@/components/intelligence-center/PagesSection';
import { LandingPagesSection } from '@/components/intelligence-center/LandingPagesSection';
import { TrafficAcquisitionSection } from '@/components/intelligence-center/TrafficAcquisitionSection';

interface AiVisibilityScoreData {
  aiVisibilityScore: number;
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
          <h1 className="text-xl font-bold text-white">Traffic & Search Intelligence</h1>
        </div>

        {data && !isConnected && <ConnectorBanner status={data.connector.status} googleAccountEmail={data.connector.googleAccountEmail} />}

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={Activity} label="AI Visibility Score" value={aiVisibility ? String(Math.round(aiVisibility.aiVisibilityScore)) : '—'} />
          <StatCard icon={Users} label="Visitors (30d)" value={isConnected && data?.ga4Available ? String(data?.traffic?.totalVisitors ?? 0) : '—'} />
          <StatCard icon={Activity} label="Sessions (30d)" value={isConnected && data?.ga4Available ? String(data?.traffic?.totalSessions ?? 0) : '—'} />
          <StatCard icon={Sparkles} label="AI Referral Sessions" value={isConnected && data?.ga4Available ? String(data?.aiReferrals?.totalSessions ?? 0) : '—'} sub="Traffic from ChatGPT, Perplexity, Claude, Gemini…" />
          <StatCard icon={MousePointerClick} label="Clicks (30d)" value={isConnected ? String(data?.search?.totalClicks ?? 0) : '—'} />
          <StatCard icon={Eye} label="Impressions (30d)" value={isConnected ? String(data?.search?.totalImpressions ?? 0) : '—'} />
          <StatCard icon={Search} label="Avg CTR" value={isConnected ? `${((data?.search?.avgCtr ?? 0) * 100).toFixed(1)}%` : '—'} />
          <StatCard icon={Link2} label="Avg Position" value={isConnected ? (data?.search?.avgPosition ?? 0).toFixed(1) : '—'} />
        </div>

        {isConnected && (
          <>
            <TrendSection />

            <BreakdownCards />

            <AiCorrelationSection />

            <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <h2 className="mb-3 text-sm font-semibold text-white">Connector health</h2>
              <div className="space-y-1 text-xs text-[#7A9AB4]">
                <div>GA4: {data?.connector.ga4PropertyName ?? 'not selected'}</div>
                <div>Search Console: {data?.connector.gscSiteName ?? 'not selected'}</div>
                <div>Last synced: {data?.connector.lastSyncedAt ? new Date(data.connector.lastSyncedAt).toLocaleString() : 'never'}</div>
              </div>
            </div>

            <PagesSection />
            <QueriesSection />
            <TrafficAcquisitionSection />
            <LandingPagesSection />

            <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-white"><Lightbulb size={14} className="text-cyan" /> Recommendations</h2>
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
                  <p className="text-xs text-[#4A6280]">No recommendations yet — these are generated from your synced traffic and search data against your latest audit. Check back after the next sync.</p>
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
