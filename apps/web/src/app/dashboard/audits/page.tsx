'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useAudits, type AuditSummary } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Zap, Clock, CheckCircle2, XCircle, Loader2, ExternalLink, History } from 'lucide-react';

function scoreColor(s: number) {
  if (s >= 90) return '#22C55E';
  if (s >= 70) return '#0BCEBC';
  if (s >= 50) return '#F59E0B';
  return '#EF4444';
}

function StatusBadge({ status }: { status: AuditSummary['status'] }) {
  const configs = {
    complete:  { icon: CheckCircle2, color: '#22C55E', bg: '#22C55E15', label: 'Complete' },
    running:   { icon: Loader2,      color: '#00C8FF', bg: '#00C8FF15', label: 'Running'  },
    queued:    { icon: Clock,        color: '#F59E0B', bg: '#F59E0B15', label: 'Queued'   },
    failed:    { icon: XCircle,      color: '#EF4444', bg: '#EF444415', label: 'Failed'   },
  };
  const cfg = configs[status];
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold" style={{ color: cfg.color, backgroundColor: cfg.bg }}>
      <Icon className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {cfg.label}
    </span>
  );
}

function AuditRow({ audit }: { audit: AuditSummary }) {
  const date = new Date(audit.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="flex items-center gap-4 border-b border-white/[0.04] py-3 last:border-0 hover:bg-white/[0.01] transition-colors px-2 -mx-2 rounded">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white truncate">{audit.domain}</span>
          {audit.status === 'complete' && (
            <a
              href={`/audit/${encodeURIComponent(audit.domain)}?auditId=${audit.id}`}
              className="shrink-0 text-[#4A6280] hover:text-cyan transition-colors"
              title="Open full report"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <div className="mt-0.5 text-xs text-[#4A6280]">{date} · {audit._count?.issues ?? 0} issues</div>
      </div>
      <div className="shrink-0">
        <StatusBadge status={audit.status} />
      </div>
      {audit.scores ? (
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold tabular-nums" style={{ color: scoreColor(audit.scores.overall) }}>{audit.scores.overall}</div>
          <div className="text-[10px] text-[#4A6280]">Overall</div>
        </div>
      ) : (
        <div className="shrink-0 w-10" />
      )}
    </div>
  );
}

export default function AuditsPage() {
  const router = useRouter();
  const { data, isLoading, error } = useAudits(50);

  const audits = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <DashboardLayout>
      <TopCommandBar onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)} />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">

        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Zap className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">Audits</h1>
            </div>
            <p className="text-sm text-[#4A6280]">
              {total > 0 ? `${total} audit${total !== 1 ? 's' : ''} total` : 'No audits yet — run your first domain audit'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/audits/history"
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs font-semibold text-[#7A9AB4] hover:text-white hover:border-white/[0.15] transition-colors"
            >
              <History className="h-3.5 w-3.5" /> History
            </Link>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1,2,3,4,5].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-white/[0.03]" />)}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-6 text-center">
            <p className="text-sm text-red-400">Failed to load audits. Please try again.</p>
          </div>
        )}

        {!isLoading && !error && audits.length === 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
            <Zap className="mx-auto mb-3 h-8 w-8 text-[#4A6280]" />
            <p className="text-white font-semibold">No audits yet</p>
            <p className="mt-1 text-sm text-[#4A6280]">Enter a domain in the command bar above to run your first audit.</p>
          </div>
        )}

        {!isLoading && audits.length > 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <div className="mb-4 hidden sm:grid grid-cols-[1fr,auto,auto] gap-4 border-b border-white/[0.06] pb-2 text-[10px] font-semibold uppercase tracking-widest text-[#334155]">
              <span>Domain</span>
              <span>Status</span>
              <span className="text-right">Score</span>
            </div>
            <div>
              {audits.map((a) => <AuditRow key={a.id} audit={a} />)}
            </div>
            {data?.hasMore && (
              <p className="mt-4 text-center text-xs text-[#4A6280]">Showing {audits.length} of {total}. Older audits not shown.</p>
            )}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
