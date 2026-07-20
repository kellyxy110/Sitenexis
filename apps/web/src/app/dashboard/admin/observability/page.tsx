'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { Activity, Zap, DollarSign, AlertTriangle, CheckCircle2, Gauge } from 'lucide-react';

interface AiObservabilitySummary {
  windowHours: number;
  totalCalls: number;
  successCount: number;
  errorCount: number;
  successRate: number | null;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  totalEstimatedCostUsd: number;
  byProvider: Array<{ provider: string; calls: number; errorRate: number; avgLatencyMs: number; costUsd: number }>;
  topErrors: Array<{ errorCode: string; count: number }>;
}

interface RecentAiCall {
  id: string;
  provider: string;
  model: string;
  skillId: string | null;
  latencyMs: number;
  success: boolean;
  errorCode: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  auditId: string | null;
  createdAt: string;
}

interface ObservabilityResponse {
  summary: AiObservabilitySummary;
  recentCalls: RecentAiCall[];
}

const WINDOW_OPTIONS = [
  { label: '1h', hours: 1 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
];

function StatCard({ icon: Icon, label, value, sub, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <div className={`rounded-xl border p-4 ${tone === 'danger' ? 'border-red-500/20 bg-red-500/[0.04]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
      <div className={`mb-2 flex items-center gap-2 ${tone === 'danger' ? 'text-red-400' : 'text-[#4A6280]'}`}>
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold tabular-nums text-white">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-[#7A9AB4]">{sub}</div>}
    </div>
  );
}

function formatMs(ms: number | null): string {
  if (ms === null) return '—';
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function formatCost(usd: number): string {
  if (usd === 0) return '$0.00';
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  return `$${usd.toFixed(2)}`;
}

export default function AdminObservabilityPage() {
  const router = useRouter();
  const [windowHours, setWindowHours] = useState(24);

  const query = useQuery({
    queryKey: ['admin-observability-overview', windowHours],
    queryFn: async () => {
      const res = await fetch(`/api/admin/observability/overview?windowHours=${windowHours}`);
      if (res.status === 403) throw new Error('forbidden');
      if (!res.ok) throw new Error('Failed to load observability data');
      return res.json() as Promise<ObservabilityResponse>;
    },
    retry: false,
    refetchInterval: 30_000,
  });

  const isForbidden = query.error instanceof Error && query.error.message === 'forbidden';
  const summary = query.data?.summary;
  const recentCalls = query.data?.recentCalls ?? [];

  const chartData = (summary?.byProvider ?? []).map((p) => ({
    provider: p.provider,
    'Cost (USD)': Number(p.costUsd.toFixed(4)),
    'Avg Latency (ms)': Math.round(p.avgLatencyMs),
  }));

  return (
    <DashboardLayout>
      <TopCommandBar onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)} />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-cyan" />
            <h1 className="text-xl font-bold text-white">AI Observability</h1>
          </div>
          <div className="flex gap-1 rounded-lg border border-white/[0.07] bg-white/[0.02] p-1">
            {WINDOW_OPTIONS.map((opt) => (
              <button
                key={opt.hours}
                onClick={() => setWindowHours(opt.hours)}
                className={`rounded-md px-3 py-1 text-[12px] font-medium transition-colors ${
                  windowHours === opt.hours ? 'bg-cyan-500/15 text-cyan-300' : 'text-[#7A9AB4] hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {isForbidden && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-5 text-sm text-red-400">
            This view is restricted to the SiteNexis owner account.
          </div>
        )}

        {summary && (
          <>
            <p className="mb-4 text-xs text-[#4A6280]">
              Every AI provider call across the last {windowHours >= 24 ? `${windowHours / 24}d` : `${windowHours}h`} — model, latency,
              tokens, and estimated cost, recorded natively (no third-party observability service).
            </p>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <StatCard icon={Activity} label="Total Calls" value={String(summary.totalCalls)} />
              <StatCard
                icon={CheckCircle2}
                label="Success Rate"
                value={summary.successRate !== null ? `${(summary.successRate * 100).toFixed(1)}%` : '—'}
              />
              <StatCard
                icon={AlertTriangle}
                label="Errors"
                value={String(summary.errorCount)}
                tone={summary.errorCount > 0 ? 'danger' : 'default'}
              />
              <StatCard icon={Zap} label="Avg Latency" value={formatMs(summary.avgLatencyMs)} />
              <StatCard icon={Gauge} label="P95 Latency" value={formatMs(summary.p95LatencyMs)} />
              <StatCard icon={DollarSign} label="Est. Cost" value={formatCost(summary.totalEstimatedCostUsd)} sub="Informational estimate, not billed value" />
            </div>

            {chartData.length > 0 && (
              <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-[#4A6280]">Cost by provider</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="provider" stroke="#4A6280" fontSize={11} />
                    <YAxis stroke="#4A6280" fontSize={11} />
                    <Tooltip contentStyle={{ background: '#0A1628', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="Cost (USD)" fill="#00C8FF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {summary.byProvider.length > 0 && (
              <div className="mt-6 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <div className="border-b border-white/[0.06] px-5 py-3">
                  <h2 className="text-[12px] font-semibold uppercase tracking-widest text-[#4A6280]">By provider</h2>
                </div>
                <table className="w-full text-left text-[12px]">
                  <thead className="border-b border-white/[0.05] text-[#4A6280]">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Provider</th>
                      <th className="px-4 py-2.5 font-medium">Calls</th>
                      <th className="px-4 py-2.5 font-medium">Error Rate</th>
                      <th className="px-4 py-2.5 font-medium">Avg Latency</th>
                      <th className="px-4 py-2.5 font-medium">Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {summary.byProvider.map((p) => (
                      <tr key={p.provider} className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3 font-mono text-slate-300">{p.provider}</td>
                        <td className="px-4 py-3 text-slate-400">{p.calls}</td>
                        <td className={`px-4 py-3 ${p.errorRate > 0.1 ? 'text-red-400' : 'text-slate-400'}`}>
                          {(p.errorRate * 100).toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-slate-400">{formatMs(p.avgLatencyMs)}</td>
                        <td className="px-4 py-3 text-slate-400">{formatCost(p.costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {summary.topErrors.length > 0 && (
              <div className="mt-6 rounded-xl border border-red-500/15 bg-red-500/[0.03] p-5">
                <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-widest text-red-400/80">Top error codes</h2>
                <div className="space-y-1.5">
                  {summary.topErrors.map((e) => (
                    <div key={e.errorCode} className="flex items-center justify-between text-[12px]">
                      <span className="font-mono text-slate-400">{e.errorCode}</span>
                      <span className="text-slate-500">{e.count}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <div className="border-b border-white/[0.06] px-5 py-3">
                <h2 className="text-[12px] font-semibold uppercase tracking-widest text-[#4A6280]">Recent calls</h2>
              </div>
              {recentCalls.length === 0 ? (
                <p className="px-5 py-8 text-center text-[13px] text-slate-600">No AI calls recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[12px]">
                    <thead className="border-b border-white/[0.05] text-[#4A6280]">
                      <tr>
                        <th className="px-5 py-2.5 font-medium">Time</th>
                        <th className="px-4 py-2.5 font-medium">Provider / Model</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 font-medium">Latency</th>
                        <th className="px-4 py-2.5 font-medium">Tokens</th>
                        <th className="px-4 py-2.5 font-medium">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {recentCalls.map((c) => (
                        <tr key={c.id} className="hover:bg-white/[0.02]">
                          <td className="px-5 py-3 font-mono text-slate-500">{new Date(c.createdAt).toLocaleTimeString()}</td>
                          <td className="px-4 py-3 text-slate-300">
                            {c.provider} <span className="text-slate-600">/ {c.model}</span>
                          </td>
                          <td className="px-4 py-3">
                            {c.success
                              ? <span className="text-green-400">OK</span>
                              : <span className="font-mono text-red-400" title={c.errorCode ?? undefined}>error</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-400">{formatMs(c.latencyMs)}</td>
                          <td className="px-4 py-3 text-slate-500">
                            {c.inputTokens != null || c.outputTokens != null
                              ? `${c.inputTokens ?? 0}→${c.outputTokens ?? 0}`
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{c.estimatedCostUsd != null ? formatCost(c.estimatedCostUsd) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </DashboardLayout>
  );
}
