'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useAudits } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { FileText, Download, ExternalLink, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface ReportGenState {
  [auditId: string]: 'idle' | 'generating' | 'done' | 'error';
}

export default function ReportsPage() {
  const router = useRouter();
  const { data, isLoading } = useAudits(50);
  const [reportState, setReportState] = useState<ReportGenState>({});

  const completedAudits = (data?.data ?? []).filter((a) => a.status === 'complete');

  const handleGenerate = async (auditId: string) => {
    setReportState((prev) => ({ ...prev, [auditId]: 'generating' }));
    try {
      const res = await fetch(`/api/audit/${auditId}/report`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReportState((prev) => ({ ...prev, [auditId]: 'done' }));
    } catch {
      setReportState((prev) => ({ ...prev, [auditId]: 'error' }));
    }
  };

  return (
    <DashboardLayout>
      <TopCommandBar onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)} />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">

        <div className="mb-6">
          <div className="mb-1 flex items-center gap-2">
            <FileText className="h-5 w-5 text-cyan" />
            <h1 className="text-xl font-bold text-white">Reports</h1>
          </div>
          <p className="text-sm text-[#4A6280]">
            Download enterprise PDF reports for completed audits — full score breakdown, issue inventory, executive summary
          </p>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1,2,3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-white/[0.03]" />)}
          </div>
        )}

        {!isLoading && completedAudits.length === 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
            <FileText className="mx-auto mb-3 h-8 w-8 text-[#4A6280]" />
            <p className="text-white font-semibold">No completed audits</p>
            <p className="mt-1 text-sm text-[#4A6280]">Run an audit to generate a PDF report.</p>
          </div>
        )}

        {!isLoading && completedAudits.length > 0 && (
          <div className="space-y-3">
            {completedAudits.map((audit) => {
              const state = reportState[audit.id] ?? 'idle';
              const date = new Date(audit.completedAt ?? audit.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
              return (
                <div key={audit.id} className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white">{audit.domain}</div>
                    <div className="mt-0.5 text-xs text-[#4A6280]">Completed {date}</div>
                  </div>
                  {audit.scores && (
                    <div className="hidden sm:block text-right">
                      <div className="text-sm font-bold tabular-nums" style={{ color: audit.scores.overall >= 70 ? '#0BCEBC' : audit.scores.overall >= 50 ? '#F59E0B' : '#EF4444' }}>
                        {audit.scores.overall}
                      </div>
                      <div className="text-[10px] text-[#4A6280]">Overall</div>
                    </div>
                  )}
                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={`/audit/${encodeURIComponent(audit.domain)}?auditId=${audit.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-[#7A9AB4] hover:text-white transition-colors"
                    >
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                    <button
                      onClick={() => handleGenerate(audit.id)}
                      disabled={state === 'generating'}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-cyan/20 bg-cyan/10 px-3 py-1.5 text-xs font-semibold text-cyan hover:bg-cyan/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {state === 'generating' ? (
                        <><Loader2 className="h-3 w-3 animate-spin" />Generating…</>
                      ) : state === 'done' ? (
                        <><Download className="h-3 w-3" />Requested</>
                      ) : state === 'error' ? (
                        'Retry'
                      ) : (
                        <><Download className="h-3 w-3" />Generate PDF</>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="mb-2 text-sm font-semibold text-[#C8DFE8]">Report Contents</h2>
          <ul className="space-y-1 text-xs text-[#4A6280]">
            <li>• Executive summary with composite Machine Trust Intelligence Score</li>
            <li>• All 12 dimensional scores with sub-score breakdowns</li>
            <li>• Full issue inventory sorted by severity and score impact</li>
            <li>• AI Perception Graph snapshot (static render)</li>
            <li>• Entity intelligence report with sameAs coverage map</li>
            <li>• Prioritised recommendations for each intelligence layer</li>
            <li>• White-label reports available on Agency and Enterprise plans</li>
          </ul>
        </div>
      </main>
    </DashboardLayout>
  );
}
