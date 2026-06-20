'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useLatestAudit, useAuditSubReport, useMe } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { Clock, ExternalLink, AlertTriangle, Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TemporalData {
  auditId: string;
  isBaseline: boolean;
  authorityVelocityScore: number | null;
  trustStabilityIndex: number;
  contentFreshnessImpactFactor: number;
  semanticDriftIndex: number;
  updateFrequencyClassification: string;
  stalePagesAtRisk: string[];
  driftedPages: Array<{ pageUrl: string; driftScore: number; previousTopicCluster: string; currentTopicCluster: string }>;
  temporalIssues: Array<{ type: string; severity: string; pageUrl: string; description: string; recommendation: string }>;
}

function scoreColor(s: number) {
  if (s >= 70) return '#22C55E';
  if (s >= 40) return '#F59E0B';
  return '#EF4444';
}

function velocityIcon(score: number | null) {
  if (score == null) return <Minus className="h-4 w-4 text-[#4A6280]" />;
  if (score >= 70) return <TrendingUp className="h-4 w-4 text-green-400" />;
  if (score >= 40) return <Minus className="h-4 w-4 text-amber-400" />;
  return <TrendingDown className="h-4 w-4 text-red-400" />;
}

function velocityLabel(score: number | null) {
  if (score == null) return 'Baseline';
  if (score >= 70) return 'Growing';
  if (score >= 40) return 'Stable';
  return 'Declining';
}

const FREQ_COLORS: Record<string, string> = {
  active: 'text-green-400 bg-green-500/10',
  periodic: 'text-cyan bg-cyan/10',
  stale: 'text-amber-400 bg-amber-500/10',
  abandoned: 'text-red-400 bg-red-500/10',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'border-red-500/20 bg-red-500/[0.04] text-red-400',
  warning: 'border-amber-500/20 bg-amber-500/[0.04] text-amber-400',
  info: 'border-blue-500/20 bg-blue-500/[0.04] text-blue-400',
};

export default function TemporalAuthorityPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { audit, isLoading: auditLoading } = useLatestAudit();
  const { data, isLoading } = useAuditSubReport<TemporalData>(audit?.id ?? null, 'temporal');

  const loading = auditLoading || isLoading;

  return (
    <DashboardLayout>
      <TopCommandBar
        onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)}
        userName={me?.email?.split('@')[0] ?? null}
        plan={me?.plan}
      />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">
        <div className="mb-6">
          <div className="mb-1 flex items-center gap-2">
            <Clock className="h-5 w-5 text-cyan" />
            <h1 className="text-xl font-bold text-white">Temporal Authority</h1>
          </div>
          <p className="text-sm text-[#4A6280]">
            {audit
              ? <>Authority velocity and content freshness for <span className="text-[#7A9AB4]">{audit.domain}</span> — <a href={`/audit/${encodeURIComponent(audit.domain)}?auditId=${audit.id}`} className="text-cyan hover:underline inline-flex items-center gap-1">full report <ExternalLink className="h-3 w-3" /></a></>
              : 'How AI trust changes over time — velocity, drift, and decay'}
          </p>
        </div>

        {loading && (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-white/[0.03]" />)}</div>
        )}

        {!loading && !data && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <Clock className="h-8 w-8 text-[#4A6280] mx-auto mb-3" />
            <p className="text-white font-semibold">No temporal data available</p>
            <p className="mt-1 text-sm text-[#4A6280]">Run an audit to establish a baseline for temporal authority tracking.</p>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {data.isBaseline && (
              <div className="flex items-start gap-2 rounded-xl border border-cyan/20 bg-cyan/[0.04] p-4 text-sm text-cyan">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <span className="font-semibold">Baseline established.</span> Authority velocity and semantic drift require at least 2 audits to compute. Run another audit to see trends.
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  {velocityIcon(data.authorityVelocityScore)}
                  <span className="text-2xl font-bold tabular-nums" style={{ color: data.authorityVelocityScore != null ? scoreColor(data.authorityVelocityScore) : '#4A6280' }}>
                    {data.authorityVelocityScore ?? '—'}
                  </span>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#4A6280]">Authority Velocity</span>
                <p className="mt-1 text-[10px] text-[#4A6280]">{velocityLabel(data.authorityVelocityScore)}</p>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-center">
                <span className="text-2xl font-bold tabular-nums" style={{ color: scoreColor(data.trustStabilityIndex * 100) }}>
                  {Math.round(data.trustStabilityIndex * 100)}%
                </span>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#4A6280]">Trust Stability</div>
                <p className="mt-1 text-[10px] text-[#4A6280]">1.0 = no decay detected</p>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-center">
                <span className="text-2xl font-bold tabular-nums" style={{ color: scoreColor((1 - data.semanticDriftIndex) * 100) }}>
                  {Math.round(data.semanticDriftIndex * 100)}%
                </span>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#4A6280]">Semantic Drift</div>
                <p className="mt-1 text-[10px] text-[#4A6280]">0% = no meaning shift</p>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-center">
                <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase ${FREQ_COLORS[data.updateFrequencyClassification] ?? 'text-[#4A6280] bg-white/5'}`}>
                  {data.updateFrequencyClassification}
                </span>
                <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-[#4A6280]">Update Frequency</div>
                <p className="mt-1 text-[10px] text-[#4A6280]">Freshness: {Math.round(data.contentFreshnessImpactFactor * 100)}%</p>
              </div>
            </div>

            {data.stalePagesAtRisk.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
                <h2 className="mb-3 text-sm font-semibold text-amber-400">Stale Pages at Risk ({data.stalePagesAtRisk.length})</h2>
                <ul className="space-y-1">
                  {data.stalePagesAtRisk.slice(0, 15).map((url, i) => (
                    <li key={i} className="text-xs text-[#4A6280] truncate">{url}</li>
                  ))}
                  {data.stalePagesAtRisk.length > 15 && <li className="text-[10px] text-[#4A6280]">+ {data.stalePagesAtRisk.length - 15} more</li>}
                </ul>
              </div>
            )}

            {data.driftedPages.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">Semantic Drift Detected ({data.driftedPages.length})</h2>
                <div className="space-y-2">
                  {data.driftedPages.slice(0, 10).map((page, i) => (
                    <div key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs">
                      <p className="text-white truncate mb-1">{page.pageUrl}</p>
                      <div className="flex items-center gap-2 text-[#4A6280]">
                        <span>{page.previousTopicCluster}</span>
                        <span className="text-amber-400">→</span>
                        <span>{page.currentTopicCluster}</span>
                        <span className="ml-auto tabular-nums font-semibold" style={{ color: scoreColor((1 - page.driftScore) * 100) }}>
                          {Math.round(page.driftScore * 100)}% drift
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.temporalIssues.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">Temporal Issues ({data.temporalIssues.length})</h2>
                <div className="space-y-2">
                  {data.temporalIssues.map((issue, i) => (
                    <div key={i} className={`flex items-start gap-3 rounded-lg border p-3 text-xs ${SEVERITY_COLORS[issue.severity] ?? SEVERITY_COLORS.info}`}>
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{issue.description}</p>
                        {issue.pageUrl && <p className="mt-0.5 text-[#4A6280] truncate">{issue.pageUrl}</p>}
                        <p className="mt-1 text-[#4A6280]">{issue.recommendation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
