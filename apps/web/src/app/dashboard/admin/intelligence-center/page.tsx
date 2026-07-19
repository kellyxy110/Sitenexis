'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { ShieldCheck, Users, PlayCircle, CheckCircle2, XCircle, Clock, FileDown, Sparkles, AlertTriangle } from 'lucide-react';

interface AdminOverview {
  windowDays: number;
  totalUsers: number;
  auditsStarted: number;
  auditsCompleted: number;
  auditsFailed: number;
  avgAuditDurationMs: number | null;
  reportsGenerated: number;
  recommendationsApplied: number;
  connectorFailures: number;
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

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  const minutes = ms / 60_000;
  return minutes < 1 ? `${Math.round(ms / 1000)}s` : `${minutes.toFixed(1)}m`;
}

export default function AdminIntelligenceCenterPage() {
  const router = useRouter();

  const query = useQuery({
    queryKey: ['admin-intelligence-center-overview'],
    queryFn: async () => {
      const res = await fetch('/api/admin/intelligence-center/overview');
      if (res.status === 403) throw new Error('forbidden');
      if (!res.ok) throw new Error('Failed to load admin overview');
      return res.json() as Promise<AdminOverview>;
    },
    retry: false,
  });

  const isForbidden = query.error instanceof Error && query.error.message === 'forbidden';

  return (
    <DashboardLayout>
      <TopCommandBar onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)} />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">
        <div className="mb-6 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-cyan" />
          <h1 className="text-xl font-bold text-white">Admin — Operations Overview</h1>
        </div>

        {isForbidden && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-5 text-sm text-red-400">
            This view is restricted to the SiteNexis owner account.
          </div>
        )}

        {query.data && (
          <>
            <p className="mb-4 text-xs text-[#4A6280]">Aggregated activity over the last {query.data.windowDays} days.</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard icon={Users} label="Total Users" value={String(query.data.totalUsers)} />
              <StatCard icon={PlayCircle} label="Audits Started" value={String(query.data.auditsStarted)} />
              <StatCard icon={CheckCircle2} label="Audits Completed" value={String(query.data.auditsCompleted)} />
              <StatCard icon={XCircle} label="Audits Failed" value={String(query.data.auditsFailed)} />
              <StatCard icon={Clock} label="Avg Audit Duration" value={formatDuration(query.data.avgAuditDurationMs)} />
              <StatCard icon={FileDown} label="Reports Generated" value={String(query.data.reportsGenerated)} sub="Generation count — download clicks aren't tracked server-side yet" />
              <StatCard icon={Sparkles} label="Recommendations Applied" value={String(query.data.recommendationsApplied)} sub="Page Intelligence sessions accepted/published" />
              <StatCard icon={AlertTriangle} label="Connector Failures" value={String(query.data.connectorFailures)} sub="Failed GA4/Search Console syncs" />
            </div>
          </>
        )}
      </main>
    </DashboardLayout>
  );
}
