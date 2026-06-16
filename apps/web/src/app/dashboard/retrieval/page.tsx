'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useLatestAudit, useAuditSubReport, useMe } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { ScanSearch, ExternalLink, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface RetrievalFailure {
  stage: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  affectedChunks: string[];
  recommendation: string;
}

interface SimulationResult {
  pageUrl: string;
  simulated: boolean;
  retrievalQualityScore: number | null;
  chunkStabilityIndex: number | null;
  answerFormationProbability: number | null;
  summarisationLossScore: number | null;
  citationEligibilityScore: number | null;
  fragileClaimsCount: number;
  retrievalFailureReasons: RetrievalFailure[];
  truncationZoneWarnings: string[];
}

interface RetrievalData {
  auditId: string;
  avgRetrievalQualityScore: number | null;
  pagesSimulated: number;
  results: SimulationResult[];
}

function scoreColor(s: number) {
  if (s >= 90) return '#22C55E';
  if (s >= 70) return '#0BCEBC';
  if (s >= 50) return '#F59E0B';
  return '#EF4444';
}
function sevColor(sev: string) {
  if (sev === 'critical') return '#EF4444';
  if (sev === 'warning') return '#F59E0B';
  return '#60A5FA';
}

function PageRow({ result }: { result: SimulationResult }) {
  const [expanded, setExpanded] = useState(false);
  const score = result.retrievalQualityScore;
  const hasIssues = (result.retrievalFailureReasons ?? []).length > 0 || (result.truncationZoneWarnings ?? []).length > 0;

  return (
    <div className="border-b border-white/[0.04] last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-4 py-3 text-left hover:bg-white/[0.02] transition-colors px-2 -mx-2 rounded"
      >
        <div className="flex-1 min-w-0">
          <div className="truncate text-xs font-medium text-[#7A9AB4]">{result.pageUrl}</div>
        </div>
        <div className="flex shrink-0 items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-[#4A6280]">Quality</div>
            <div className="text-sm font-bold tabular-nums" style={{ color: score != null ? scoreColor(score) : '#4A6280' }}>
              {score != null ? score : '—'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-[#4A6280]">Chunk Stability</div>
            <div className="text-sm font-semibold tabular-nums" style={{ color: result.chunkStabilityIndex != null ? scoreColor(Math.round(result.chunkStabilityIndex * 100)) : '#4A6280' }}>
              {result.chunkStabilityIndex != null ? `${Math.round(result.chunkStabilityIndex * 100)}%` : '—'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-[#4A6280]">Fragile Claims</div>
            <div className="text-sm font-semibold tabular-nums" style={{ color: result.fragileClaimsCount > 3 ? '#EF4444' : result.fragileClaimsCount > 0 ? '#F59E0B' : '#0BCEBC' }}>
              {result.fragileClaimsCount}
            </div>
          </div>
          {hasIssues
            ? expanded ? <ChevronUp className="h-4 w-4 text-[#4A6280]" /> : <ChevronDown className="h-4 w-4 text-[#4A6280]" />
            : <div className="h-4 w-4" />
          }
        </div>
      </button>

      {expanded && hasIssues && (
        <div className="mb-3 ml-2 space-y-2">
          {(result.retrievalFailureReasons ?? []).map((f, i) => (
            <div key={i} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: sevColor(f.severity), backgroundColor: `${sevColor(f.severity)}20` }}>{f.severity}</span>
                <span className="text-xs text-[#7A9AB4] uppercase tracking-wide">{f.stage.replace(/_/g, ' ')}</span>
              </div>
              <p className="text-xs text-[#4A6280]">{f.description}</p>
              <p className="mt-1 text-xs text-cyan">{f.recommendation}</p>
            </div>
          ))}
          {(result.truncationZoneWarnings ?? []).map((w, i) => (
            <div key={`tw-${i}`} className="flex items-start gap-2 rounded-lg border border-amber/20 bg-amber/[0.04] p-3 text-xs text-amber">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RetrievalPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { audit, isLoading: auditLoading } = useLatestAudit();
  const { data, isLoading } = useAuditSubReport<RetrievalData>(audit?.id ?? null, 'retrieval');

  const loading = auditLoading || isLoading;

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
              <ScanSearch className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">Retrieval Optimization</h1>
              <span className="rounded-pill border border-purple/25 bg-purple/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple">Layer 4</span>
            </div>
            <p className="text-sm text-[#4A6280]">
              {audit
                ? <>For <span className="text-[#7A9AB4]">{audit.domain}</span> — <a href={`/audit/${encodeURIComponent(audit.domain)}?auditId=${audit.id}`} className="text-cyan hover:underline inline-flex items-center gap-1">full report <ExternalLink className="h-3 w-3" /></a></>
                : 'Chunk extraction, summarisation degradation, and citation eligibility simulation'}
            </p>
          </div>
          {data?.avgRetrievalQualityScore != null && (
            <div className="text-right">
              <div className="text-4xl font-bold tabular-nums" style={{ color: scoreColor(data.avgRetrievalQualityScore) }}>{data.avgRetrievalQualityScore}</div>
              <div className="text-xs text-[#4A6280]">Avg Retrieval Quality</div>
            </div>
          )}
        </div>

        {!audit && !auditLoading && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <p className="text-white font-semibold">No completed audits yet</p>
            <p className="mt-1 text-sm text-[#4A6280]">Run an audit with a Pro or Agency plan to see retrieval simulation.</p>
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[1,2,3,4,5].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-white/[0.03]" />)}
          </div>
        )}

        {data && (
          <div className="space-y-5">
            {/* Stats bar */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                <div className="text-2xl font-bold tabular-nums" style={{ color: data.avgRetrievalQualityScore != null ? scoreColor(data.avgRetrievalQualityScore) : '#4A6280' }}>
                  {data.avgRetrievalQualityScore ?? '—'}
                </div>
                <div className="mt-0.5 text-xs text-[#4A6280]">Avg Retrieval Quality Score</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                <div className="text-2xl font-bold tabular-nums text-white">{data.pagesSimulated}</div>
                <div className="mt-0.5 text-xs text-[#4A6280]">Pages Simulated (top 30 by PageRank)</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                <div className="text-2xl font-bold tabular-nums text-white">
                  {(data.results ?? []).reduce((s, r) => s + (r.fragileClaimsCount ?? 0), 0)}
                </div>
                <div className="mt-0.5 text-xs text-[#4A6280]">Total Fragile Claims</div>
              </div>
            </div>

            {/* Per-page results */}
            {(data.results ?? []).length > 0 ? (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Per-Page Simulation Results</h2>
                <div>
                  {(data.results ?? []).map((r) => (
                    <PageRow key={r.pageUrl} result={r} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
                <p className="text-sm text-[#4A6280]">Retrieval simulation requires a Pro or Agency plan audit to generate results.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
