'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  Search, CheckCircle2, XCircle, AlertTriangle, Info,
  ArrowRight, Clock, FileText, Hash, Code2, Globe,
  Loader2, BarChart3,
} from 'lucide-react';
import { Footer } from '@/components/marketing/Footer';

// ── Types ─────────────────────────────────────────────────────────────────────

type Issue = {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  recommendation: string;
};

type QuickAuditResult = {
  url: string;
  status: number;
  ttfbMs: number;
  quickScore: number;
  title: string;
  metaDescription: string;
  h1s: string[];
  schemaTypes: string[];
  wordCount: number;
  canonical: string | null;
  isNoindex: boolean;
  issues: Issue[];
  summary: { critical: number; warnings: number; info: number };
  note: string;
  error?: string;
};

// ── Score helpers ─────────────────────────────────────────────────────────────

function getGrade(score: number) {
  if (score >= 90) return {
    label: 'AI-Ready', verdict: 'Strong citation signal. AI systems can retrieve and cite this page reliably.',
    color: 'text-green-400', barFrom: '#22C55E', barTo: '#0BCEBC',
    bg: 'bg-green-500/[0.07]', border: 'border-green-500/20',
  };
  if (score >= 70) return {
    label: 'Good', verdict: 'Citation-eligible for most queries. A few gaps are limiting full AI visibility.',
    color: 'text-teal-400', barFrom: '#0BCEBC', barTo: '#00C8FF',
    bg: 'bg-teal-500/[0.07]', border: 'border-teal-500/20',
  };
  if (score >= 50) return {
    label: 'Needs Work', verdict: 'Retrieved but rarely cited. Key structural signals are missing.',
    color: 'text-amber-400', barFrom: '#F59E0B', barTo: '#F97316',
    bg: 'bg-amber-500/[0.07]', border: 'border-amber-500/20',
  };
  return {
    label: 'Critical', verdict: 'Below citation threshold. This page is unlikely to appear in AI-generated answers.',
    color: 'text-red-400', barFrom: '#EF4444', barTo: '#F97316',
    bg: 'bg-red-500/[0.07]', border: 'border-red-500/20',
  };
}

function severityIcon(s: Issue['severity']) {
  if (s === 'critical') return <XCircle size={15} className="text-red-400 shrink-0 mt-0.5" />;
  if (s === 'warning') return <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />;
  return <Info size={15} className="text-blue-400 shrink-0 mt-0.5" />;
}

function severityLabel(s: Issue['severity']) {
  if (s === 'critical') return 'bg-red-500/10 text-red-400 border-red-500/20';
  if (s === 'warning') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
}

function ttfbLabel(ms: number) {
  if (ms < 200) return 'text-green-400';
  if (ms < 600) return 'text-amber-400';
  return 'text-red-400';
}

// ── Signal row ────────────────────────────────────────────────────────────────

function Signal({ ok, label, value }: { ok: boolean; label: string; value?: string | undefined }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
      {ok
        ? <CheckCircle2 size={15} className="text-teal-400 shrink-0 mt-0.5" />
        : <XCircle size={15} className="text-red-400/70 shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0">
        <span className={`text-[13px] font-medium ${ok ? 'text-slate-200' : 'text-slate-500'}`}>
          {label}
        </span>
        {value && (
          <p className="mt-0.5 truncate text-[11px] text-slate-600 font-mono">{value}</p>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function QuickCheckPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [result, setResult] = useState<QuickAuditResult | null>(null);
  const [apiError, setApiError] = useState('');
  const resultsRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    const normalized = url.startsWith('http') ? url.trim() : `https://${url.trim()}`;

    setLoading(true);
    setResult(null);
    setApiError('');
    setLoadingStage('Fetching page…');

    const stageTimer = setTimeout(() => setLoadingStage('Analysing AI signals…'), 3500);

    try {
      const res = await fetch('/api/quick-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalized }),
      });

      clearTimeout(stageTimer);
      const data = (await res.json()) as QuickAuditResult;

      if (!res.ok) {
        setApiError((data as { error?: string }).error ?? 'Something went wrong — try again.');
        return;
      }

      setResult(data);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch {
      clearTimeout(stageTimer);
      setApiError('Could not reach that URL. Check the address and try again.');
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  }

  const grade = result ? getGrade(result.quickScore) : null;
  const sortedIssues = result
    ? [...result.issues].sort((a, b) => {
        const order = { critical: 0, warning: 1, info: 2 };
        return order[a.severity] - order[b.severity];
      })
    : [];

  return (
    <main className="min-h-screen bg-[#0A1628] text-slate-200">

      {/* ── Hero ── */}
      <section className="border-b border-white/[0.06] px-6 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-cyan-400">
            <BarChart3 size={11} />
            Free · No Account Required · Live Crawl
          </span>
          <h1 className="mb-4 font-serif text-4xl font-bold tracking-tight text-white sm:text-5xl">
            AI Citation Score
          </h1>
          <p className="mb-2 text-lg leading-relaxed text-slate-400">
            Paste any URL. Get an instant score for how likely ChatGPT, Perplexity, and
            Google AI Overviews are to cite that page — and a prioritised fix list.
          </p>
          <p className="text-[13px] text-slate-600">
            We crawl the live page, not pasted HTML. What AI sees is what we measure.
          </p>
        </div>
      </section>

      {/* ── Input ── */}
      <section className="px-6 py-10">
        <div className="mx-auto max-w-2xl">
          <form onSubmit={(e) => void handleSubmit(e)} className="flex gap-3">
            <div className="relative flex-1">
              <Globe size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yourdomain.com/page"
                spellCheck={false}
                autoCapitalize="off"
                className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] py-3.5 pl-10 pr-4 text-[15px] text-slate-200 placeholder-slate-600 outline-none transition focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-cyan-500 px-5 py-3.5 text-[14px] font-semibold text-[#0A1628] transition hover:opacity-90 disabled:opacity-40"
            >
              {loading ? (
                <><Loader2 size={15} className="animate-spin" /> Checking…</>
              ) : (
                <><Search size={15} /> Check Page</>
              )}
            </button>
          </form>

          {/* Loading stage */}
          {loading && loadingStage && (
            <p className="mt-3 text-center text-[13px] text-slate-500 animate-pulse">{loadingStage}</p>
          )}

          {/* API error */}
          {apiError && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3">
              <XCircle size={15} className="mt-0.5 shrink-0 text-red-400" />
              <p className="text-[13px] text-red-300">{apiError}</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Results ── */}
      {result && grade && (
        <section ref={resultsRef} className="px-6 pb-20">
          <div className="mx-auto max-w-5xl">

            {/* Scanned URL bar */}
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
              <Globe size={13} className="shrink-0 text-slate-600" />
              <span className="flex-1 truncate font-mono text-[12px] text-slate-500">{result.url}</span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[11px] text-slate-600">HTTP {result.status}</span>
                <span className={`font-mono text-[11px] ${ttfbLabel(result.ttfbMs)}`}>
                  {result.ttfbMs}ms
                </span>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[340px_1fr]">

              {/* Left — Score + signals */}
              <div className="space-y-4">

                {/* Score card */}
                <div className={`rounded-2xl border p-6 ${grade.border} ${grade.bg}`}>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    Quick Citation Score
                  </div>
                  <div className={`text-7xl font-bold tabular-nums leading-none ${grade.color}`}>
                    {result.quickScore}
                  </div>
                  <div className={`mt-1.5 text-base font-semibold ${grade.color}`}>
                    {grade.label}
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${result.quickScore}%`,
                        background: `linear-gradient(to right, ${grade.barFrom}, ${grade.barTo})`,
                      }}
                    />
                  </div>
                  <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
                    {grade.verdict}
                  </p>
                </div>

                {/* Issue tally */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Critical', count: result.summary.critical, color: 'text-red-400', bg: 'bg-red-500/[0.07] border-red-500/20' },
                    { label: 'Warnings', count: result.summary.warnings, color: 'text-amber-400', bg: 'bg-amber-500/[0.07] border-amber-500/20' },
                    { label: 'Info', count: result.summary.info, color: 'text-blue-400', bg: 'bg-blue-500/[0.07] border-blue-500/20' },
                  ].map(({ label, count, color, bg }) => (
                    <div key={label} className={`rounded-xl border px-3 py-3 text-center ${bg}`}>
                      <div className={`text-2xl font-bold ${color}`}>{count}</div>
                      <div className="mt-0.5 text-[11px] text-slate-600">{label}</div>
                    </div>
                  ))}
                </div>

                {/* Signals detected */}
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    Signals Found
                  </div>
                  <Signal ok={!!result.title} label="Title tag" {...(result.title ? { value: result.title } : {})} />
                  <Signal ok={!!result.metaDescription} label="Meta description" {...(result.metaDescription ? { value: result.metaDescription } : {})} />
                  <Signal ok={result.h1s.length === 1} label="Single H1 heading" {...(result.h1s[0] ? { value: result.h1s[0] } : {})} />
                  <Signal ok={result.schemaTypes.length > 0} label="Structured data (schema.org)" />
                  <Signal ok={result.wordCount >= 300} label={`Word count — ${result.wordCount} words`} />
                  <Signal ok={!!result.canonical} label="Canonical tag" />
                  <Signal ok={!result.isNoindex} label="Indexable (no noindex)" />
                </div>

                {/* Schema types */}
                {result.schemaTypes.length > 0 && (
                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
                    <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                      <Code2 size={11} /> Schema Types
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.schemaTypes.map((t) => (
                        <span key={t} className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 font-mono text-[11px] text-cyan-400">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick metrics */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-600 uppercase tracking-wider mb-1">
                      <FileText size={10} /> Word Count
                    </div>
                    <div className={`text-xl font-bold ${result.wordCount >= 500 ? 'text-teal-400' : result.wordCount >= 300 ? 'text-amber-400' : 'text-red-400'}`}>
                      {result.wordCount.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">
                      {result.wordCount >= 500 ? 'Good depth' : result.wordCount >= 300 ? 'Borderline' : 'Too thin'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-600 uppercase tracking-wider mb-1">
                      <Clock size={10} /> TTFB
                    </div>
                    <div className={`text-xl font-bold ${ttfbLabel(result.ttfbMs)}`}>
                      {result.ttfbMs}ms
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">
                      {result.ttfbMs < 200 ? 'Fast' : result.ttfbMs < 600 ? 'Acceptable' : 'Slow'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right — Issues */}
              <div className="space-y-3">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    Issues &amp; Fixes
                    <span className="ml-2 text-slate-600">({sortedIssues.length})</span>
                  </h2>
                  <span className="text-[11px] text-slate-600">Sorted by impact</span>
                </div>

                {sortedIssues.length === 0 ? (
                  <div className="rounded-2xl border border-green-500/20 bg-green-500/[0.07] px-6 py-8 text-center">
                    <CheckCircle2 size={28} className="mx-auto mb-3 text-green-400" />
                    <p className="text-sm font-semibold text-green-300">No issues detected</p>
                    <p className="mt-1 text-[12px] text-slate-500">
                      This page passes all quick-audit checks. Run a full audit to get the 12-dimension analysis.
                    </p>
                  </div>
                ) : (
                  sortedIssues.map((issue, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4"
                    >
                      <div className="flex items-start gap-3">
                        {severityIcon(issue.severity)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${severityLabel(issue.severity)}`}>
                              {issue.severity}
                            </span>
                            <span className="text-[12px] font-mono text-slate-600">{issue.type}</span>
                          </div>
                          <p className="text-[13px] text-slate-300 leading-relaxed">
                            {issue.description}
                          </p>
                          <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
                            <span className="text-slate-400 font-medium">Fix: </span>
                            {issue.recommendation}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {/* What quick-audit doesn't cover */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-5 py-4">
                  <p className="text-[12px] leading-relaxed text-slate-600">
                    <span className="text-slate-400 font-medium">This is a surface-level scan.</span>{' '}
                    It checks 7 technical signals on one page. A full SiteNexis audit covers 12 intelligence
                    dimensions across your entire domain — including entity graph analysis, retrieval simulation,
                    machine trust scoring, and citation probability across all AI providers.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-10 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.07] to-teal-500/[0.04] px-8 py-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="mb-1 text-lg font-semibold text-white">
                    Go deeper with a full audit
                  </h3>
                  <p className="max-w-lg text-[13px] leading-relaxed text-slate-400">
                    Quick score covers 7 checks on one page. A full SiteNexis audit runs 16 agents across
                    your entire domain — entity intelligence, retrieval simulation, machine trust,
                    recommendation surface mapping, and more. 10 free audits included.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                  <Link
                    href={`/signup?from=quick-check&url=${encodeURIComponent(result.url)}`}
                    className="flex items-center gap-2 rounded-xl bg-cyan-500 px-6 py-3 text-[14px] font-semibold text-[#0A1628] transition hover:opacity-90"
                  >
                    Start Full Audit <ArrowRight size={14} />
                  </Link>
                  <Link
                    href="/tools/citation-checklist"
                    className="text-center text-[12px] text-slate-500 transition hover:text-slate-300"
                  >
                    Try the manual citation checklist →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── How it works (pre-result state) ── */}
      {!result && !loading && (
        <section className="px-6 pb-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-8 text-center text-[11px] font-semibold uppercase tracking-widest text-slate-600">
              What we check
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {[
                { icon: <FileText size={16} />, label: 'Title & meta description', detail: 'Presence, length, and AI extractability' },
                { icon: <Hash size={16} />, label: 'Heading structure', detail: 'Single H1, hierarchy, query alignment' },
                { icon: <Code2 size={16} />, label: 'Structured data', detail: 'Schema types, AI-readable markup' },
                { icon: <Globe size={16} />, label: 'Canonical & indexability', detail: 'noindex, canonical mismatch signals' },
                { icon: <FileText size={16} />, label: 'Content depth', detail: 'Word count, thin content detection' },
                { icon: <Clock size={16} />, label: 'Page performance', detail: 'Time-to-first-byte measurement' },
              ].map(({ icon, label, detail }) => (
                <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
                  <div className="mb-2 text-cyan-500/70">{icon}</div>
                  <div className="text-[13px] font-medium text-slate-200">{label}</div>
                  <div className="mt-0.5 text-[12px] text-slate-600">{detail}</div>
                </div>
              ))}
            </div>

            <div className="mt-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-8 py-7 text-center">
              <p className="mb-1 text-sm text-slate-400">
                Want the 7-factor citation checklist you can fill in manually?
              </p>
              <Link
                href="/tools/citation-checklist"
                className="text-[13px] font-medium text-cyan-400 transition hover:text-cyan-300"
              >
                Citation Probability Checklist →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Footer note ── */}
      <div className="border-t border-white/[0.05] px-6 py-6 text-center">
        <p className="text-[11px] text-slate-700">
          Quick scan · 7 signals · single page · no account required ·{' '}
          <Link href="/methodology" className="text-slate-600 hover:text-slate-400 transition">
            See full scoring methodology →
          </Link>
        </p>
      </div>
      <Footer />
    </main>
  );
}
