'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TrendingUp, TrendingDown, Minus, Globe, AlertTriangle, RefreshCw, ExternalLink, FolderKanban } from 'lucide-react';
import type { PortfolioDomain } from '@/app/api/portfolio/route';

// ─── Score helpers ─────────────────────────────────────────────────────────────

function scoreColor(n: number | null): string {
  if (n === null) return '#4A6280';
  if (n >= 90) return '#22C55E';
  if (n >= 70) return '#0BCEBC';
  if (n >= 50) return '#F59E0B';
  return '#EF4444';
}

function scoreLabel(n: number | null): string {
  if (n === null) return '—';
  if (n >= 90) return 'Excellent';
  if (n >= 70) return 'Good';
  if (n >= 50) return 'Needs Work';
  return 'Critical';
}

// ─── Trend indicator ──────────────────────────────────────────────────────────

function TrendBadge({ trend, delta }: { trend: PortfolioDomain['trend']; delta: number | null }) {
  if (!trend || delta === null) return <span className="text-xs text-[#4A6280]">—</span>;
  if (trend === 'up') {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-green-400">
        <TrendingUp className="h-3.5 w-3.5" />+{delta}
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-red-400">
        <TrendingDown className="h-3.5 w-3.5" />{delta}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-[#4A6280]">
      <Minus className="h-3.5 w-3.5" />Flat
    </span>
  );
}

// ─── Domain card ─────────────────────────────────────────────────────────────

function DomainCard({ d, onView, onReaudit }: { d: PortfolioDomain; onView: () => void; onReaudit: () => void }) {
  const color = scoreColor(d.latestScore);
  const lastDate = new Date(d.lastAuditDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
  const isActive = d.status === 'running' || d.status === 'queued';

  return (
    <div className="group rounded-2xl border border-white/8 bg-white/[0.025] p-5 transition-all hover:border-white/15 hover:bg-white/[0.04]">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0C2030] border border-white/10">
            <Globe className="h-4 w-4 text-cyan" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white truncate max-w-[180px]">{d.domain}</p>
            <p className="text-[10px] text-[#4A6280]">{d.auditCount} audit{d.auditCount !== 1 ? 's' : ''} · {lastDate}</p>
          </div>
        </div>
        {isActive && (
          <span className="flex items-center gap-1 rounded-full bg-cyan/10 border border-cyan/20 px-2 py-0.5 text-[10px] font-medium text-cyan uppercase tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan animate-pulse" />
            {d.status}
          </span>
        )}
      </div>

      {/* Scores */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4A6280] mb-1">Overall</p>
          <p className="text-2xl font-black tabular-nums leading-none" style={{ color }}>
            {d.latestScore ?? '—'}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color }}>{scoreLabel(d.latestScore)}</p>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4A6280] mb-1">AI Visibility</p>
          <p className="text-2xl font-black tabular-nums leading-none" style={{ color: scoreColor(d.latestAiScore) }}>
            {d.latestAiScore ?? '—'}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: scoreColor(d.latestAiScore) }}>{scoreLabel(d.latestAiScore)}</p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <TrendBadge trend={d.trend} delta={d.trendDelta} />
          {d.criticalIssues > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-red-400">
              <AlertTriangle className="h-3 w-3" />{d.criticalIssues} critical
            </span>
          )}
        </div>
      </div>

      {/* Score bar */}
      {d.latestScore !== null && (
        <div className="mb-4">
          <div className="h-1 rounded-full bg-white/5">
            <div className="h-1 rounded-full transition-all" style={{ width: `${d.latestScore}%`, background: color }} />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onView}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-cyan/10 border border-cyan/20 px-3 py-2 text-xs font-semibold text-cyan hover:bg-cyan/20 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />View Audit
        </button>
        <button
          onClick={onReaudit}
          disabled={isActive}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-[#4A6280] hover:border-white/20 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw className="h-3.5 w-3.5" />Re-audit
        </button>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-5 animate-pulse">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="h-8 w-8 rounded-lg bg-white/5" />
        <div className="space-y-1.5">
          <div className="h-3 w-32 rounded bg-white/5" />
          <div className="h-2 w-20 rounded bg-white/5" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="h-20 rounded-xl bg-white/5" />
        <div className="h-20 rounded-xl bg-white/5" />
      </div>
      <div className="h-8 rounded-lg bg-white/5" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const router = useRouter();

  const { data: me } = useQuery<{ email: string; plan: string }>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/me').then((r) => r.json() as Promise<{ email: string; plan: string }>),
    staleTime: 60_000,
  });

  const { data: domains, isLoading, error } = useQuery<PortfolioDomain[]>({
    queryKey: ['portfolio'],
    queryFn: () => fetch('/api/portfolio').then((r) => r.json() as Promise<PortfolioDomain[]>),
    staleTime: 60_000,
    refetchInterval: 30_000,
  });

  const handleReaudit = async (domain: string) => {
    try {
      const res = await fetch('/api/audit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      if (res.ok) {
        const { auditId } = await res.json() as { auditId: string };
        router.push(`/audit/${encodeURIComponent(domain)}?auditId=${auditId}`);
      }
    } catch { /* silent */ }
  };

  const totalDomains  = domains?.length ?? 0;
  const avgScore      = domains && domains.length > 0
    ? Math.round(domains.filter(d => d.latestScore !== null).reduce((s, d) => s + (d.latestScore ?? 0), 0) / Math.max(domains.filter(d => d.latestScore !== null).length, 1))
    : null;
  const improving     = domains?.filter(d => d.trend === 'up').length ?? 0;
  const critical      = domains?.filter(d => (d.latestScore ?? 100) < 50).length ?? 0;

  return (
    <DashboardLayout userName={me?.email} plan={me?.plan}>
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Page header */}
        <div className="border-b border-white/8 px-6 py-5 md:px-8">
          <div className="flex items-center gap-2.5">
            <FolderKanban className="h-5 w-5 text-cyan" />
            <h1 className="text-base font-semibold text-white">Domain Portfolio</h1>
          </div>
        </div>

        <div className="flex-1 p-6 md:p-8">

          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Domains Tracked', value: totalDomains },
              { label: 'Avg Overall Score', value: avgScore ?? '—' },
              { label: 'Improving', value: improving },
              { label: 'Critical Score', value: critical },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-white/8 bg-white/[0.025] p-4 text-center">
                <p className="text-2xl font-black tabular-nums text-white">{value}</p>
                <p className="text-xs text-[#4A6280] mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Domain grid */}
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
              <p className="text-sm text-red-400">Failed to load portfolio. Please refresh.</p>
            </div>
          )}

          {!isLoading && !error && domains?.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Globe className="h-12 w-12 text-[#4A6280] mb-4" />
              <p className="text-lg font-semibold text-white mb-2">No domains audited yet</p>
              <p className="text-sm text-[#4A6280] mb-6">Run your first audit to start building your portfolio.</p>
              <button
                onClick={() => router.push('/dashboard/audits/live')}
                className="rounded-lg bg-cyan text-navy font-semibold px-5 py-2.5 text-sm hover:bg-cyan/90 transition-colors"
              >
                Start first audit
              </button>
            </div>
          )}

          {!isLoading && domains && domains.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {domains.map((d) => (
                <DomainCard
                  key={d.domain}
                  d={d}
                  onView={() => router.push(`/audit/${encodeURIComponent(d.domain)}`)}
                  onReaudit={() => handleReaudit(d.domain)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
