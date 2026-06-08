'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useAudits } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { FileText, Download, ExternalLink, Loader2, Calendar, Bell, Trash2, Plus } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ReportGenState {
  [auditId: string]: 'idle' | 'generating' | 'done' | 'error';
}

interface ScheduledReport {
  id: string;
  domain: string | null;
  frequency: 'daily' | 'weekly' | 'monthly';
  email: string;
  enabled: boolean;
  nextSendAt: string;
  lastSentAt: string | null;
}

const FREQ_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export default function ReportsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data, isLoading } = useAudits(50);
  const [reportState, setReportState] = useState<ReportGenState>({});

  // ── Scheduled reports state ──────────────────────────────────────────────────
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [schedEmail, setSchedEmail]     = useState('');
  const [schedFreq, setSchedFreq]       = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [schedDomain, setSchedDomain]   = useState('');
  const [schedError, setSchedError]     = useState<string | null>(null);

  const { data: scheduled = [] } = useQuery<ScheduledReport[]>({
    queryKey: ['scheduled-reports'],
    queryFn: () => fetch('/api/reports/scheduled').then((r) => r.ok ? r.json() as Promise<ScheduledReport[]> : []),
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (body: { email: string; frequency: string; domain?: string }) =>
      fetch('/api/reports/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        if (!r.ok) { const j = await r.json() as { error?: string }; throw new Error(j.error ?? 'Failed'); }
        return r.json();
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['scheduled-reports'] });
      setShowScheduleForm(false);
      setSchedEmail('');
      setSchedError(null);
    },
    onError: (e: Error) => setSchedError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/reports/scheduled/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['scheduled-reports'] }),
  });

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

  const handleDownloadCSV = (auditId: string) => {
    window.location.href = `/api/audit/${auditId}/export`;
  };

  const handleSchedule = () => {
    if (!schedEmail.trim()) { setSchedError('Email is required'); return; }
    createMutation.mutate({
      email: schedEmail.trim(),
      frequency: schedFreq,
      ...(schedDomain.trim() ? { domain: schedDomain.trim() } : {}),
    });
  };

  return (
    <DashboardLayout>
      <TopCommandBar onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)} />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">

        {/* ── Header ── */}
        <div className="mb-6">
          <div className="mb-1 flex items-center gap-2">
            <FileText className="h-5 w-5 text-cyan" />
            <h1 className="text-xl font-bold text-white">Reports</h1>
          </div>
          <p className="text-sm text-[#4A6280]">
            PDF reports, CSV data exports, and scheduled delivery for completed audits
          </p>
        </div>

        {/* ── Audit list ── */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-white/[0.03]" />)}
          </div>
        )}

        {!isLoading && completedAudits.length === 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
            <FileText className="mx-auto mb-3 h-8 w-8 text-[#4A6280]" />
            <p className="text-white font-semibold">No completed audits</p>
            <p className="mt-1 text-sm text-[#4A6280]">Run an audit to generate reports.</p>
          </div>
        )}

        {!isLoading && completedAudits.length > 0 && (
          <div className="space-y-3">
            {completedAudits.map((audit) => {
              const state = reportState[audit.id] ?? 'idle';
              const date = new Date(audit.completedAt ?? audit.createdAt).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
              });
              return (
                <div key={audit.id} className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white">{audit.domain}</div>
                    <div className="mt-0.5 text-xs text-[#4A6280]">Completed {date}</div>
                  </div>
                  {audit.scores && (
                    <div className="hidden sm:block text-right">
                      <div
                        className="text-sm font-bold tabular-nums"
                        style={{ color: audit.scores.overall >= 70 ? '#0BCEBC' : audit.scores.overall >= 50 ? '#F59E0B' : '#EF4444' }}
                      >
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
                    {/* CSV export */}
                    <button
                      onClick={() => handleDownloadCSV(audit.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/20 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-400 hover:bg-teal-500/20 transition-colors"
                      title="Download CSV"
                    >
                      <Download className="h-3 w-3" /> CSV
                    </button>
                    {/* PDF report */}
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
                        <><Download className="h-3 w-3" />PDF Report</>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Scheduled Reports ── */}
        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-cyan" />
              <h2 className="text-base font-bold text-white">Scheduled Reports</h2>
            </div>
            <button
              onClick={() => setShowScheduleForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan/20 bg-cyan/10 px-3 py-1.5 text-xs font-semibold text-cyan hover:bg-cyan/20 transition-colors"
            >
              <Plus className="h-3 w-3" /> Schedule
            </button>
          </div>

          {/* Schedule form */}
          {showScheduleForm && (
            <div className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
              <h3 className="text-sm font-semibold text-[#C8DFE8]">New Scheduled Report</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  type="email"
                  value={schedEmail}
                  onChange={(e) => setSchedEmail(e.target.value)}
                  placeholder="report@yourcompany.com"
                  className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-[#334155] outline-none focus:border-cyan/40"
                />
                <select
                  value={schedFreq}
                  onChange={(e) => setSchedFreq(e.target.value as 'daily' | 'weekly' | 'monthly')}
                  className="rounded-lg border border-white/[0.08] bg-[#0A1628] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan/40"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly (Monday 8am)</option>
                  <option value="monthly">Monthly (1st)</option>
                </select>
                <input
                  type="text"
                  value={schedDomain}
                  onChange={(e) => setSchedDomain(e.target.value)}
                  placeholder="example.com (optional)"
                  className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-[#334155] outline-none focus:border-cyan/40"
                />
              </div>
              {schedError && <p className="text-xs text-red-400">{schedError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleSchedule}
                  disabled={createMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan/10 border border-cyan/20 px-4 py-2 text-sm font-semibold text-cyan hover:bg-cyan/20 disabled:opacity-50 transition-colors"
                >
                  {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calendar className="h-3.5 w-3.5" />}
                  Create Schedule
                </button>
                <button onClick={() => setShowScheduleForm(false)} className="px-4 py-2 text-sm text-[#4A6280] hover:text-white transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {scheduled.length === 0 && !showScheduleForm && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
              <Calendar className="mx-auto mb-2 h-6 w-6 text-[#4A6280]" />
              <p className="text-sm text-white font-medium">No scheduled reports</p>
              <p className="mt-1 text-xs text-[#4A6280]">Get audit summaries delivered automatically to your inbox.</p>
            </div>
          )}

          {scheduled.length > 0 && (
            <div className="space-y-2">
              {scheduled.map((s) => (
                <div key={s.id} className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <Calendar className="h-4 w-4 shrink-0 text-cyan/60" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">
                      {FREQ_LABELS[s.frequency]} report → {s.email}
                    </div>
                    <div className="mt-0.5 text-xs text-[#4A6280]">
                      {s.domain ? `Domain: ${s.domain} · ` : ''}
                      Next: {new Date(s.nextSendAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      {s.lastSentAt ? ` · Last sent: ${new Date(s.lastSentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.enabled ? 'bg-teal-500/10 text-teal-400' : 'bg-white/[0.04] text-[#4A6280]'}`}>
                      {s.enabled ? 'Active' : 'Paused'}
                    </span>
                    <button
                      onClick={() => deleteMutation.mutate(s.id)}
                      className="rounded-lg p-1.5 text-[#4A6280] hover:bg-red-500/10 hover:text-red-400 transition-colors"
                      title="Delete schedule"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Report contents info ── */}
        <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="mb-2 text-sm font-semibold text-[#C8DFE8]">Report Contents</h2>
          <ul className="space-y-1 text-xs text-[#4A6280]">
            <li>• PDF: Executive summary, all 12 dimensional scores, full issue inventory, AI Perception Graph snapshot</li>
            <li>• CSV: Domain, scores, issue counts, individual issue rows — ready for spreadsheets</li>
            <li>• Scheduled: Audit summaries delivered automatically at your chosen frequency</li>
            <li>• White-label reports available on Agency and Enterprise plans</li>
          </ul>
        </div>
      </main>
    </DashboardLayout>
  );
}
