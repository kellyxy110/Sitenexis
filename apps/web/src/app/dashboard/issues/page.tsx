'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useAudits } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ExternalLink } from 'lucide-react';

export default function IssuesPage() {
  const router = useRouter();
  const { data: auditsData, isLoading } = useAudits(20);

  const issuesSummary = (auditsData?.data ?? [])
    .filter((a) => a.status === 'complete' && (a._count?.issues ?? 0) > 0)
    .map((a) => ({
      domain: a.domain,
      auditId: a.id,
      issueCount: a._count?.issues ?? 0,
      overallScore: a.scores?.overall ?? null,
      href: `/audit/${encodeURIComponent(a.domain)}?auditId=${a.id}#issues`,
    }));

  return (
    <DashboardLayout>
      <TopCommandBar onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)} />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">

        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">Issues Center</h1>
            </div>
            <p className="text-sm text-[#4A6280]">
              Issues detected across all audits — prioritised by severity and score impact
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1,2,3,4].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.03]" />)}
          </div>
        )}

        {!isLoading && issuesSummary.length === 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-[#4A6280]" />
            <p className="text-white font-semibold">No issues found</p>
            <p className="mt-1 text-sm text-[#4A6280]">Run an audit to detect issues across all intelligence dimensions.</p>
          </div>
        )}

        {!isLoading && issuesSummary.length > 0 && (
          <div className="space-y-4">
            <p className="text-xs text-[#4A6280]">
              Detailed issue breakdowns are available in each audit report.
            </p>
            {issuesSummary.map((s) => (
              <div key={s.auditId} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">{s.domain}</div>
                    <div className="mt-0.5 text-xs text-[#4A6280]">{s.issueCount} issue{s.issueCount !== 1 ? 's' : ''} detected</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {s.overallScore != null && (
                      <div className="text-right">
                        <div className="text-sm font-bold tabular-nums" style={{ color: s.overallScore >= 70 ? '#0BCEBC' : s.overallScore >= 50 ? '#F59E0B' : '#EF4444' }}>
                          {s.overallScore}
                        </div>
                        <div className="text-[10px] text-[#4A6280]">Score</div>
                      </div>
                    )}
                    <a
                      href={s.href}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-[#7A9AB4] hover:text-white hover:border-white/[0.15] transition-colors"
                    >
                      View Issues <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
