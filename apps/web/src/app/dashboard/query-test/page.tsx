'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Search, ChevronDown, ExternalLink, Zap, FileText, AlertCircle } from 'lucide-react';
import type { QuerySimulateResponse, SimulatedResult } from '@/app/api/audit/[id]/query-simulate/route';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(n: number): string {
  if (n >= 70) return '#22C55E';
  if (n >= 45) return '#F59E0B';
  return '#EF4444';
}

function stabilityColor(s: SimulatedResult['chunkStability']): string {
  return s === 'high' ? '#22C55E' : s === 'medium' ? '#F59E0B' : '#EF4444';
}

// ─── Result row ──────────────────────────────────────────────────────────────

function ResultRow({ r, terms }: { r: SimulatedResult; terms: string[] }) {
  const [open, setOpen] = useState(false);

  const highlightExcerpt = (text: string) => {
    if (!text) return text;
    let out = text;
    for (const t of terms) {
      out = out.replace(new RegExp(`(${t})`, 'gi'), '[[HL]]$1[[/HL]]');
    }
    return out.split(/\[\[HL\]\]|\[\[\/HL\]\]/).map((part, i) =>
      i % 2 === 1
        ? <mark key={i} className="bg-cyan/20 text-cyan rounded px-0.5">{part}</mark>
        : <span key={i}>{part}</span>
    );
  };

  const cleanUrl = r.url.replace(/^https?:\/\//, '');

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] overflow-hidden">
      {/* Main row */}
      <div className="flex items-start gap-4 p-4">
        {/* Rank */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs font-black tabular-nums text-[#4A6280]">
          {r.rank}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <p className="text-sm font-semibold text-white leading-snug truncate max-w-lg">
                {r.title ?? cleanUrl}
              </p>
              <p className="text-[11px] text-[#4A6280] truncate max-w-xs mt-0.5">{cleanUrl}</p>
            </div>
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-1.5 text-[#4A6280] hover:text-white transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border"
              style={{ color: scoreColor(r.retrievalScore), borderColor: `${scoreColor(r.retrievalScore)}40`, background: `${scoreColor(r.retrievalScore)}12` }}
            >
              <Zap className="h-2.5 w-2.5" />{r.retrievalScore} retrieval score
            </span>

            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold border"
              style={{ color: stabilityColor(r.chunkStability), borderColor: `${stabilityColor(r.chunkStability)}40`, background: `${stabilityColor(r.chunkStability)}12` }}
            >
              {r.chunkStability} stability
            </span>

            {r.citationEligible ? (
              <span className="rounded-full border border-teal/30 bg-teal/10 px-2 py-0.5 text-[10px] font-semibold text-teal">
                citation eligible
              </span>
            ) : (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-[#4A6280]">
                not citation eligible
              </span>
            )}

            <span className="text-[10px] text-[#4A6280]">
              {Math.round(r.termCoverage * 100)}% term coverage
            </span>
          </div>

          {/* Excerpt */}
          {r.excerpt && (
            <p className="text-xs text-[#4A6280] leading-relaxed line-clamp-2">
              {highlightExcerpt(r.excerpt)}
            </p>
          )}
        </div>

        {/* Expand */}
        <button
          onClick={() => setOpen(!open)}
          className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-1.5 text-[#4A6280] hover:text-white transition-all"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-white/5 px-4 py-3 bg-white/[0.015]">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4A6280] mb-2">Matched Terms</p>
              <div className="flex flex-wrap gap-1.5">
                {r.matchedTerms.length > 0
                  ? r.matchedTerms.map((t) => (
                      <span key={t} className="rounded-md bg-cyan/10 border border-cyan/20 px-2 py-0.5 text-[11px] text-cyan">{t}</span>
                    ))
                  : <span className="text-xs text-[#4A6280]">No terms matched</span>
                }
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4A6280] mb-2">Scoring Signals</p>
              <ul className="space-y-0.5">
                {r.reasons.map((reason) => (
                  <li key={reason} className="flex items-center gap-1.5 text-xs text-[#4A6280]">
                    <span className="h-1 w-1 rounded-full bg-[#4A6280] shrink-0" />
                    {reason}
                  </li>
                ))}
                {r.reasons.length === 0 && <li className="text-xs text-[#4A6280]">No specific signals</li>}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QueryTestPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [auditId, setAuditId] = useState('');

  const { data: me } = useQuery<{ email: string; plan: string }>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/me').then((r) => r.json() as Promise<{ email: string; plan: string }>),
    staleTime: 60_000,
  });

  const { data: audits, isLoading: auditsLoading } = useQuery<{ id: string; domain: string; status: string; createdAt: string }[]>({
    queryKey: ['audits-list'],
    queryFn: () =>
      fetch('/api/audits?page=1&limit=50').then((r) =>
        r.json().then((d: { data: { id: string; domain: string; status: string; createdAt: string }[] }) => d.data)
      ),
    staleTime: 60_000,
  });

  const { mutate: simulate, data: result, isPending, error, reset } = useMutation<
    QuerySimulateResponse,
    Error,
    { id: string; query: string }
  >({
    mutationFn: ({ id, query: q }) =>
      fetch(`/api/audit/${id}/query-simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({ error: 'Unknown error' })) as { error: string };
          throw new Error(body.error ?? 'Simulation failed');
        }
        return r.json() as Promise<QuerySimulateResponse>;
      }),
  });

  const completedAudits = audits?.filter((a) => a.status === 'complete') ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !auditId) return;
    reset();
    simulate({ id: auditId, query: query.trim() });
  };

  const selectedAudit = completedAudits.find((a) => a.id === auditId);

  return (
    <DashboardLayout userName={me?.email} plan={me?.plan}>
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Page header */}
        <div className="border-b border-white/8 px-6 py-5 md:px-8">
          <div className="flex items-center gap-2.5">
            <Search className="h-5 w-5 text-cyan" />
            <h1 className="text-base font-semibold text-white">Query Simulation</h1>
          </div>
        </div>

        <div className="flex-1 p-6 md:p-8 max-w-4xl">

          {/* Intro card */}
          <div className="mb-8 rounded-xl border border-cyan/20 bg-cyan/5 px-5 py-4">
            <p className="text-sm font-semibold text-cyan mb-1">How it works</p>
            <p className="text-xs text-[#4A6280] leading-relaxed">
              Enter any natural language query to simulate how an AI retrieval system would rank pages from your audit. Scoring is algorithmic — TF-IDF term weighting, PageRank authority, and coverage bonuses. No AI API calls are made.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mb-8">
            <div className="space-y-4">
              {/* Audit selector */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-[#4A6280]">
                  Select Audit
                </label>
                {auditsLoading ? (
                  <div className="h-10 w-full rounded-lg bg-white/5 animate-pulse" />
                ) : completedAudits.length === 0 ? (
                  <div className="rounded-lg border border-amber/20 bg-amber/5 px-4 py-3 text-xs text-amber-400">
                    No completed audits found.{' '}
                    <button type="button" onClick={() => router.push('/dashboard/audits/live')} className="underline">
                      Run an audit first.
                    </button>
                  </div>
                ) : (
                  <select
                    value={auditId}
                    onChange={(e) => { setAuditId(e.target.value); reset(); }}
                    className="w-full rounded-lg border border-white/10 bg-[#0C2030] px-3 py-2.5 text-sm text-white focus:border-cyan/40 focus:outline-none focus:ring-1 focus:ring-cyan/20"
                  >
                    <option value="">— Choose an audit —</option>
                    {completedAudits.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.domain} · {new Date(a.createdAt).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Query input */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-[#4A6280]">
                  Query
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4A6280] pointer-events-none" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. best AI visibility tools for enterprise"
                    className="w-full rounded-lg border border-white/10 bg-[#0C2030] pl-9 pr-4 py-2.5 text-sm text-white placeholder-[#4A6280] focus:border-cyan/40 focus:outline-none focus:ring-1 focus:ring-cyan/20"
                    maxLength={300}
                  />
                </div>
                <p className="mt-1 text-[10px] text-[#4A6280]">{query.length}/300 characters</p>
              </div>

              <button
                type="submit"
                disabled={!query.trim() || !auditId || isPending}
                className="flex items-center gap-2 rounded-lg bg-cyan px-5 py-2.5 text-sm font-semibold text-navy hover:bg-cyan/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-navy/30 border-t-navy animate-spin" />
                    Simulating…
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Run Simulation
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Error */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <p className="text-sm text-red-400">{error.message}</p>
            </div>
          )}

          {/* Results */}
          {result && (
            <div>
              {/* Result header */}
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold text-white">
                    {result.results.length > 0 ? `${result.results.length} pages matched` : 'No pages matched'}
                  </p>
                  <p className="text-xs text-[#4A6280] mt-0.5">
                    Analyzed {result.pagesAnalyzed} pages from{' '}
                    <span className="text-white">{selectedAudit?.domain}</span>
                    {' '}· Terms extracted:{' '}
                    {result.terms.map((t) => (
                      <span key={t} className="mx-0.5 rounded bg-white/5 px-1 py-0.5 text-[11px] font-mono text-[#4A6280]">{t}</span>
                    ))}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-[#4A6280]" />
                  <span className="text-[10px] text-[#4A6280]">{new Date(result.simulatedAt).toLocaleTimeString()}</span>
                </div>
              </div>

              {result.results.length === 0 ? (
                <div className="rounded-xl border border-white/8 bg-white/[0.025] p-12 text-center">
                  <Search className="mx-auto h-10 w-10 text-[#4A6280] mb-3" />
                  <p className="text-sm font-semibold text-white mb-1">No pages matched this query</p>
                  <p className="text-xs text-[#4A6280]">Try a different query or check that the audit contains relevant content.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {result.results.map((r) => (
                    <ResultRow key={r.url} r={r} terms={result.terms} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!result && !isPending && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Search className="h-10 w-10 text-[#4A6280] mb-4" />
              <p className="text-sm font-semibold text-white mb-1">Enter a query to start</p>
              <p className="text-xs text-[#4A6280]">Simulate how AI retrieval systems would rank your pages for any natural language query.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
