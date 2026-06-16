'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useLatestAudit, useAuditSubReport, useMe } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { Quote, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';

interface PageBreakdownItem {
  url: string;
  score: number;
  topFactor: string;
}

interface CitationData {
  auditId: string;
  citationProbabilityScore: number;
  topCitationCandidates: string[];
  citationBlockers: string[];
  recommendations: string[];
  pageBreakdown: PageBreakdownItem[];
}

function scoreColor(s: number) {
  if (s >= 90) return '#22C55E';
  if (s >= 70) return '#0BCEBC';
  if (s >= 50) return '#F59E0B';
  return '#EF4444';
}
function scoreLabel(s: number) {
  if (s >= 90) return 'Excellent';
  if (s >= 70) return 'Good';
  if (s >= 50) return 'Needs Work';
  return 'Critical';
}

const FACTOR_LABELS: Record<string, string> = {
  factualDensity: 'Factual Density',
  claimSpecificity: 'Claim Specificity',
  primaryEntityAuthority: 'Primary Entity Authority',
  topicalAuthorityDepth: 'Topical Authority Depth',
  structuralCitationReadiness: 'Structural Citation Readiness',
  temporalFreshness: 'Temporal Freshness',
  trustSignalDensity: 'Trust Signal Density',
};

export default function CitationPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { audit, isLoading: auditLoading } = useLatestAudit();
  const { data, isLoading } = useAuditSubReport<CitationData>(audit?.id ?? null, 'citation');

  const loading = auditLoading || isLoading;

  const CITATION_FACTORS = [
    { key: 'factualDensity', weight: '20%' },
    { key: 'claimSpecificity', weight: '15%' },
    { key: 'primaryEntityAuthority', weight: '15%' },
    { key: 'topicalAuthorityDepth', weight: '15%' },
    { key: 'structuralCitationReadiness', weight: '15%' },
    { key: 'temporalFreshness', weight: '10%' },
    { key: 'trustSignalDensity', weight: '10%' },
  ];

  return (
    <DashboardLayout>
      <TopCommandBar
        onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)}
        userName={me?.email?.split('@')[0] ?? null}
        plan={me?.plan}
      />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">

        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Quote className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">Citation Probability</h1>
            </div>
            <p className="text-sm text-[#4A6280]">
              {audit
                ? <>For <span className="text-[#7A9AB4]">{audit.domain}</span> — <a href={`/audit/${encodeURIComponent(audit.domain)}?auditId=${audit.id}`} className="text-cyan hover:underline inline-flex items-center gap-1">full report <ExternalLink className="h-3 w-3" /></a></>
                : 'Likelihood AI systems select your content as a citation source — factual density, authority signals, structural readiness'}
            </p>
          </div>
          {data && (
            <div className="text-right">
              <div className="text-4xl font-bold tabular-nums" style={{ color: scoreColor(data.citationProbabilityScore) }}>{data.citationProbabilityScore}</div>
              <div className="text-xs text-[#4A6280]">Citation Probability</div>
              <div className="mt-0.5 text-xs font-semibold" style={{ color: scoreColor(data.citationProbabilityScore) }}>{scoreLabel(data.citationProbabilityScore)}</div>
            </div>
          )}
        </div>

        {!audit && !auditLoading && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <p className="text-white font-semibold">No completed audits yet</p>
            <p className="mt-1 text-sm text-[#4A6280]">Run an audit to see citation probability analysis.</p>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[1,2,3].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-white/[0.03]" />)}
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Score + factor weights */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Score bar */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Citation Probability Score</h2>
                <div className="mb-2 flex items-end gap-2">
                  <span className="text-5xl font-bold tabular-nums" style={{ color: scoreColor(data.citationProbabilityScore) }}>{data.citationProbabilityScore}</span>
                  <span className="mb-1 text-sm font-semibold" style={{ color: scoreColor(data.citationProbabilityScore) }}>{scoreLabel(data.citationProbabilityScore)}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${data.citationProbabilityScore}%`, backgroundColor: scoreColor(data.citationProbabilityScore) }} />
                </div>
              </div>

              {/* Factor weights */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Score Composition</h2>
                <div className="space-y-2">
                  {CITATION_FACTORS.map((f) => (
                    <div key={f.key} className="flex items-center justify-between text-xs">
                      <span className="text-[#4A6280]">{FACTOR_LABELS[f.key] ?? f.key}</span>
                      <span className="font-semibold text-[#7A9AB4]">{f.weight}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Page breakdown */}
            {(data.pageBreakdown ?? []).length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Per-Page Citation Scores</h2>
                <div className="space-y-2">
                  {(data.pageBreakdown ?? []).map((p, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-xs text-[#7A9AB4]">{p.url}</div>
                        {p.topFactor && (
                          <div className="text-[10px] text-[#4A6280]">Top factor: {FACTOR_LABELS[p.topFactor] ?? p.topFactor}</div>
                        )}
                      </div>
                      <div className="shrink-0 w-20">
                        <div className="mb-0.5 text-right text-xs font-semibold tabular-nums" style={{ color: scoreColor(p.score) }}>{p.score}</div>
                        <div className="h-1 rounded-full bg-white/10">
                          <div className="h-full rounded-full" style={{ width: `${p.score}%`, backgroundColor: scoreColor(p.score) }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              {/* Citation blockers */}
              {(data.citationBlockers ?? []).length > 0 && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-5">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-400">
                    <XCircle className="h-4 w-4" /> Citation Blockers
                  </h2>
                  <ul className="space-y-2">
                    {(data.citationBlockers ?? []).map((b, i) => (
                      <li key={i} className="text-xs text-[#4A6280]">{b}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {(data.recommendations ?? []).length > 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">Recommendations</h2>
                  <ul className="space-y-2">
                    {(data.recommendations ?? []).map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-[#4A6280]">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" />{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Top citation candidates */}
            {(data.topCitationCandidates ?? []).length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">Top Citation Candidates</h2>
                <ul className="space-y-1.5">
                  {(data.topCitationCandidates ?? []).map((url, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-[#4A6280]">#{i + 1}</span>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="truncate text-cyan hover:underline">{url}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
