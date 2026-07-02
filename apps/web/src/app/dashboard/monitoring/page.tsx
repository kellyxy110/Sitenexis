'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { TrendingUp, TrendingDown, Minus, Clock, CheckCircle2, AlertTriangle, BarChart3 } from 'lucide-react';
import type { MonitoringData } from '@/app/api/monitoring/route';
import type { ScoreSnapshot } from '@sitenexis/loop-os';

// ── Inline sparkline ──────────────────────────────────────────────────────────

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <span className="text-slate-700 text-[11px]">—</span>;
  const W = 120, H = 36, pad = 2;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + ((W - pad * 2) * i) / (values.length - 1);
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x},${y}`;
  });
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.at(-1)!.split(',')[0]} cy={pts.at(-1)!.split(',')[1]} r="3" fill={color} />
    </svg>
  );
}

// ── ScoreSnapshot numeric keys (excludes string fields) ──────────────────────

type SnapshotNumericKey = keyof {
  [K in keyof ScoreSnapshot as ScoreSnapshot[K] extends number | null ? K : never]: ScoreSnapshot[K]
};

// ── Score color helpers ───────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 90) return '#22C55E';
  if (s >= 70) return '#0BCEBC';
  if (s >= 50) return '#F59E0B';
  return '#EF4444';
}

function DeltaBadge({ delta }: { delta: number }) {
  if (Math.abs(delta) < 1) return <span className="text-slate-600 flex items-center gap-0.5 text-[11px]"><Minus size={10} /> Stable</span>;
  const up = delta > 0;
  return (
    <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${up ? 'text-green-400' : 'text-red-400'}`}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {up ? '+' : ''}{delta.toFixed(1)}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type ScoreKey = Extract<SnapshotNumericKey, 'overall' | 'aiVisibilityScore' | 'citationProbabilityScore' | 'machineTrustScore' | 'entityConfidenceScore'>;

const TRACKED_SCORES: { key: ScoreKey; label: string; color: string }[] = [
  { key: 'overall',                  label: 'Overall',           color: '#00C8FF' },
  { key: 'aiVisibilityScore',        label: 'AI Visibility',     color: '#0BCEBC' },
  { key: 'citationProbabilityScore', label: 'Citation Prob.',    color: '#F59E0B' },
  { key: 'machineTrustScore',        label: 'Machine Trust',     color: '#A855F7' },
  { key: 'entityConfidenceScore',    label: 'Entity Confidence', color: '#6366F1' },
];

export default function MonitoringPage() {
  const router = useRouter();
  const { data, isLoading } = useQuery<MonitoringData>({
    queryKey: ['monitoring'],
    queryFn: async () => {
      const res = await fetch('/api/monitoring');
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<MonitoringData>;
    },
    staleTime: 30_000,
  });

  const history: ScoreSnapshot[] = data?.scoreHistory ?? [];
  const hasHistory = history.length >= 2;
  const latest = history.at(-1);
  const previous = history.at(-2);

  return (
    <DashboardLayout>
      <TopCommandBar onRunAudit={(domain) => { router.push(`/dashboard/audits/live?domain=${encodeURIComponent(domain)}`); }} />
      <div className="px-6 py-8">
        <div className="mx-auto max-w-6xl space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="mb-1 text-2xl font-semibold text-white">Score Monitoring</h1>
              <p className="text-[13px] text-slate-500">
                {data?.domain
                  ? <>Tracking <span className="font-mono text-slate-300">{data.domain}</span> across {history.length} audit{history.length !== 1 ? 's' : ''}</>
                  : 'Run an audit to start tracking score history.'}
              </p>
            </div>
            {data?.lastAuditCompletedAt && (
              <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2">
                <Clock size={13} className="text-slate-500" />
                <span className="text-[12px] text-slate-500">
                  Last audit: {new Date(data.lastAuditCompletedAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {isLoading && (
            <div className="flex items-center gap-3 text-[13px] text-slate-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-500" />
              Loading monitoring data…
            </div>
          )}

          {!isLoading && !data?.domain && (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-8 py-12 text-center">
              <BarChart3 size={32} className="mx-auto mb-4 text-slate-600" />
              <p className="mb-1 text-[15px] font-medium text-slate-300">No history yet</p>
              <p className="text-[13px] text-slate-600">Complete your first audit to start tracking score trends over time.</p>
            </div>
          )}

          {!isLoading && data?.domain && (
            <>
              {/* Issue counts */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-4 rounded-xl border border-red-500/15 bg-red-500/[0.04] px-5 py-4">
                  <AlertTriangle size={18} className="shrink-0 text-amber-400" />
                  <div>
                    <div className="text-2xl font-bold text-white">{data.openIssueCount}</div>
                    <div className="text-[12px] text-slate-500">Open issues</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 rounded-xl border border-green-500/15 bg-green-500/[0.04] px-5 py-4">
                  <CheckCircle2 size={18} className="shrink-0 text-green-400" />
                  <div>
                    <div className="text-2xl font-bold text-white">{data.resolvedIssueCount}</div>
                    <div className="text-[12px] text-slate-500">Resolved issues (lifetime)</div>
                  </div>
                </div>
              </div>

              {/* Score trend cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {TRACKED_SCORES.map(({ key, label, color }) => {
                  const vals = history.map((s) => (s[key as keyof ScoreSnapshot] as number | null) ?? 0).filter((v) => v > 0);
                  const cur = latest ? ((latest[key as keyof ScoreSnapshot] as number | null) ?? 0) : 0;
                  const prev = previous ? ((previous[key as keyof ScoreSnapshot] as number | null) ?? 0) : 0;
                  const delta = cur - prev;
                  return (
                    <div key={key} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-[12px] font-medium text-slate-400">{label}</span>
                        <DeltaBadge delta={delta} />
                      </div>
                      <div className="mb-3 text-4xl font-bold tabular-nums" style={{ color: cur > 0 ? scoreColor(cur) : '#4A5568' }}>
                        {cur > 0 ? Math.round(cur) : '—'}
                      </div>
                      {vals.length >= 2
                        ? <Sparkline values={vals} color={color} />
                        : <p className="text-[11px] text-slate-700">Need 2+ audits to show trend</p>}
                    </div>
                  );
                })}
              </div>

              {/* History table */}
              {hasHistory && (
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
                  <div className="border-b border-white/[0.06] px-5 py-3">
                    <h2 className="text-[12px] font-semibold uppercase tracking-widest text-slate-500">Audit history</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[12px]">
                      <thead className="border-b border-white/[0.05] text-slate-600">
                        <tr>
                          <th className="px-5 py-2.5 font-medium">Date</th>
                          <th className="px-4 py-2.5 font-medium">Overall</th>
                          <th className="px-4 py-2.5 font-medium">AI Visibility</th>
                          <th className="px-4 py-2.5 font-medium">Citation</th>
                          <th className="px-4 py-2.5 font-medium">Machine Trust</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {[...history].reverse().map((snap) => (
                          <tr key={snap.auditId} className="hover:bg-white/[0.02]">
                            <td className="px-5 py-3 font-mono text-slate-500">
                              {new Date(snap.capturedAt).toLocaleDateString()}
                            </td>
                            {(['overall', 'aiVisibilityScore', 'citationProbabilityScore', 'machineTrustScore'] as const).map((k) => {
                              const v = ((snap[k as keyof ScoreSnapshot]) as number | null) ?? 0;
                              return (
                                <td key={k} className="px-4 py-3">
                                  {v > 0
                                    ? <span className="font-semibold" style={{ color: scoreColor(v) }}>{Math.round(v)}</span>
                                    : <span className="text-slate-700">—</span>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!hasHistory && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-5 py-4 text-center">
                  <p className="text-[13px] text-slate-500">
                    Run a second audit to see score trends and velocity tracking. History is stored automatically after each completed audit.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
