'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useAudits, type AuditSummary } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { History, TrendingUp, TrendingDown, Minus, ExternalLink, ArrowLeft } from 'lucide-react';

function scoreColor(s: number) {
  if (s >= 90) return '#22C55E';
  if (s >= 70) return '#0BCEBC';
  if (s >= 50) return '#F59E0B';
  return '#EF4444';
}

function ScoreBar({ score, maxScore = 100 }: { score: number; maxScore?: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${(score / maxScore) * 100}%`, backgroundColor: scoreColor(score) }} />
      </div>
      <span className="text-xs font-semibold tabular-nums" style={{ color: scoreColor(score) }}>{score}</span>
    </div>
  );
}

function ScoreDelta({ current, previous }: { current: number; previous: number }) {
  const delta = current - previous;
  if (delta > 0) return <span className="flex items-center gap-0.5 text-xs text-green-500"><TrendingUp className="h-3 w-3" />+{delta}</span>;
  if (delta < 0) return <span className="flex items-center gap-0.5 text-xs text-red-400"><TrendingDown className="h-3 w-3" />{delta}</span>;
  return <span className="flex items-center gap-0.5 text-xs text-[#4A6280]"><Minus className="h-3 w-3" />0</span>;
}

function groupByDomain(audits: AuditSummary[]): Map<string, AuditSummary[]> {
  const map = new Map<string, AuditSummary[]>();
  for (const a of audits) {
    const list = map.get(a.domain) ?? [];
    list.push(a);
    map.set(a.domain, list);
  }
  return map;
}

export default function AuditHistoryPage() {
  const router = useRouter();
  const { data, isLoading, error } = useAudits(50);

  const completedAudits = (data?.data ?? []).filter((a) => a.status === 'complete');
  const byDomain = groupByDomain(completedAudits);

  return (
    <DashboardLayout>
      <TopCommandBar onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)} />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">

        <div className="mb-6 flex items-center gap-4">
          <Link href="/dashboard/audits" className="flex items-center gap-1.5 text-sm text-[#4A6280] hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> Audits
          </Link>
          <span className="text-[#334155]">/</span>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-cyan" />
            <h1 className="text-xl font-bold text-white">Audit History</h1>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-4">
            {[1,2,3].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-white/[0.03]" />)}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-6 text-center">
            <p className="text-sm text-red-400">Failed to load audit history.</p>
          </div>
        )}

        {!isLoading && !error && completedAudits.length === 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
            <History className="mx-auto mb-3 h-8 w-8 text-[#4A6280]" />
            <p className="text-white font-semibold">No completed audits yet</p>
            <p className="mt-1 text-sm text-[#4A6280]">Score trends and delta tracking will appear here once you have multiple completed audits.</p>
          </div>
        )}

        {!isLoading && byDomain.size > 0 && (
          <div className="space-y-6">
            {Array.from(byDomain.entries()).map(([domain, domainAudits]) => {
              const sorted = [...domainAudits].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              const latest = sorted[0];
              const previous = sorted[1];

              return (
                <div key={domain} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-white">{domain}</h2>
                      <p className="text-xs text-[#4A6280]">{domainAudits.length} audit{domainAudits.length !== 1 ? 's' : ''}</p>
                    </div>
                    {latest?.scores && (
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold tabular-nums" style={{ color: scoreColor(latest.scores.overall) }}>{latest.scores.overall}</span>
                          {previous?.scores && (
                            <ScoreDelta current={latest.scores.overall} previous={previous.scores.overall} />
                          )}
                        </div>
                        <div className="text-xs text-[#4A6280]">Overall Score</div>
                      </div>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          <th className="pb-2 text-left text-[#4A6280] font-medium">Date</th>
                          <th className="pb-2 text-left text-[#4A6280] font-medium">Overall</th>
                          <th className="pb-2 text-left text-[#4A6280] font-medium hidden sm:table-cell">SEO</th>
                          <th className="pb-2 text-left text-[#4A6280] font-medium hidden md:table-cell">AI</th>
                          <th className="pb-2 text-left text-[#4A6280] font-medium hidden lg:table-cell">Schema</th>
                          <th className="pb-2 text-right text-[#4A6280] font-medium">Report</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.03]">
                        {sorted.map((audit, idx) => {
                          const prevAudit = sorted[idx + 1];
                          return (
                            <tr key={audit.id} className="hover:bg-white/[0.01]">
                              <td className="py-2.5 pr-4 text-[#4A6280]">
                                {new Date(audit.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="py-2.5 pr-4">
                                {audit.scores ? (
                                  <div className="flex items-center gap-2">
                                    <ScoreBar score={audit.scores.overall} />
                                    {prevAudit?.scores && idx === 0 && (
                                      <ScoreDelta current={audit.scores.overall} previous={prevAudit.scores.overall} />
                                    )}
                                  </div>
                                ) : '—'}
                              </td>
                              <td className="py-2.5 pr-4 hidden sm:table-cell">
                                {audit.scores ? <ScoreBar score={audit.scores.seoScore} /> : '—'}
                              </td>
                              <td className="py-2.5 pr-4 hidden md:table-cell">
                                {audit.scores ? <ScoreBar score={audit.scores.aiScore} /> : '—'}
                              </td>
                              <td className="py-2.5 pr-4 hidden lg:table-cell">
                                {audit.scores ? <ScoreBar score={audit.scores.schemaScore} /> : '—'}
                              </td>
                              <td className="py-2.5 text-right">
                                <a
                                  href={`/audit/${encodeURIComponent(domain)}?auditId=${audit.id}`}
                                  className="inline-flex items-center gap-1 text-cyan hover:underline"
                                >
                                  View <ExternalLink className="h-3 w-3" />
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
