'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Globe, Loader2, CheckCircle2, XCircle, ArrowRight,
  MessageSquare, Search, AlertTriangle, Zap,
} from 'lucide-react';
import type { CitationCheckResult, CitationQuery } from '@/app/api/citation-check/route';

export default function CitationCheckPage() {
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('');
  const [result, setResult] = useState<CitationCheckResult | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim()) return;
    setLoading(true);
    setResult(null);
    setError('');
    setStage('Crawling domain to understand topic…');

    const t1 = setTimeout(() => setStage('Generating representative queries…'), 4000);
    const t2 = setTimeout(() => setStage('Querying AI systems with live web search…'), 8000);
    const t3 = setTimeout(() => setStage('Checking citations in AI responses…'), 18000);

    try {
      const res = await fetch('/api/citation-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '') }),
      });
      const data = (await res.json()) as CitationCheckResult;
      if (!res.ok) { setError((data as { error?: string }).error ?? 'Something went wrong'); return; }
      setResult(data);
    } catch {
      setError('Request failed — check the domain and try again.');
    } finally {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      setLoading(false); setStage('');
    }
  }

  const rateColor = !result ? '' :
    result.citationRate >= 0.75 ? 'text-green-400' :
    result.citationRate >= 0.5  ? 'text-teal-400' :
    result.citationRate > 0     ? 'text-amber-400' : 'text-red-400';

  const rateBg = !result ? '' :
    result.citationRate >= 0.75 ? 'bg-green-500/[0.07] border-green-500/20' :
    result.citationRate >= 0.5  ? 'bg-teal-500/[0.07] border-teal-500/20' :
    result.citationRate > 0     ? 'bg-amber-500/[0.07] border-amber-500/20' :
    'bg-red-500/[0.07] border-red-500/20';

  return (
    <main className="min-h-screen bg-[#0A1628] text-slate-200">

      {/* Hero */}
      <section className="border-b border-white/[0.06] px-6 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-cyan-400">
            <Zap size={11} /> Live AI Check · Uses Real Web Search
          </span>
          <h1 className="mb-4 font-serif text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Is AI Citing You?
          </h1>
          <p className="mb-2 text-lg leading-relaxed text-slate-400">
            We query AI systems with live web search using representative questions about your domain —
            and check if they cite you in their answers.
          </p>
          <p className="text-[13px] text-slate-600">
            4 queries · real AI responses · actual citation detection · not simulated
          </p>
        </div>
      </section>

      {/* Input */}
      <section className="px-6 py-10">
        <div className="mx-auto max-w-xl">
          <form onSubmit={(e) => void handleSubmit(e)} className="flex gap-3">
            <div className="relative flex-1">
              <Globe size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="yourdomain.com"
                autoCapitalize="off"
                spellCheck={false}
                className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] py-3.5 pl-11 pr-4 text-[15px] text-slate-200 placeholder-slate-600 outline-none transition focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !domain.trim()}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-cyan-500 px-5 py-3.5 text-[14px] font-semibold text-[#0A1628] transition hover:opacity-90 disabled:opacity-40"
            >
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> Checking…</>
                : <><Search size={15} /> Check now</>}
            </button>
          </form>

          {loading && stage && (
            <div className="mt-4 flex items-center gap-2 text-[13px] text-slate-500">
              <Loader2 size={12} className="animate-spin text-cyan-500" />
              <span className="animate-pulse">{stage}</span>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3">
              <XCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
              <p className="text-[13px] text-red-300">{error}</p>
            </div>
          )}

          <p className="mt-3 text-[11px] text-slate-700">
            Takes 15–30 seconds. This makes real AI queries — not simulated. Limit: 10/hr per IP.
          </p>
        </div>
      </section>

      {/* Results */}
      {result && (
        <section className="px-6 pb-20">
          <div className="mx-auto max-w-3xl space-y-5">

            {/* Summary card */}
            <div className={`rounded-2xl border p-6 ${rateBg}`}>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                Citation Rate
              </div>
              <div className={`text-7xl font-bold tabular-nums leading-none ${rateColor}`}>
                {result.citedCount}<span className="text-4xl text-slate-600">/{result.queriesRun}</span>
              </div>
              <div className={`mt-2 text-[15px] font-semibold ${rateColor}`}>
                {Math.round(result.citationRate * 100)}% of queries cited {result.domain}
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-current transition-all duration-700"
                  style={{ width: `${result.citationRate * 100}%`, color: rateColor.replace('text-', '') }}
                />
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-slate-400">{result.verdict}</p>
            </div>

            {/* Per-query breakdown */}
            <div className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                Queries tested
              </h2>
              {result.queries.map((q: CitationQuery, i) => (
                <div key={i} className={`rounded-xl border px-5 py-4 ${q.cited ? 'border-green-500/15 bg-green-500/[0.04]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                  <div className="flex items-start gap-3">
                    {q.cited
                      ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-green-400" />
                      : <XCircle size={15} className="mt-0.5 shrink-0 text-slate-600" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${q.cited ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-white/5 text-slate-500 border-white/10'}`}>
                          {q.cited ? 'Cited' : 'Not cited'}
                        </span>
                        <span className="font-mono text-[11px] text-slate-600">Query {i + 1}</span>
                      </div>
                      <p className="text-[14px] font-medium text-slate-200">"{q.query}"</p>
                      {q.excerpt && (
                        <p className="mt-2 rounded-lg bg-white/[0.03] px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-400">
                          …{q.excerpt}…
                        </p>
                      )}
                      {q.citedUrls.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {q.citedUrls.slice(0, 3).map((url) => (
                            <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                              className="truncate max-w-[260px] rounded bg-green-500/10 px-2 py-0.5 font-mono text-[10px] text-green-400 hover:text-green-300 transition">
                              {url.replace(/^https?:\/\//, '').slice(0, 50)}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* How it works */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-5 py-4">
              <div className="flex items-start gap-3">
                <MessageSquare size={14} className="mt-0.5 shrink-0 text-slate-600" />
                <p className="text-[12px] leading-relaxed text-slate-500">
                  <span className="text-slate-400 font-medium">How this works:</span>{' '}
                  We crawl your homepage, derive 4 representative queries, and run them through an AI system with live web search enabled. We then parse the response for citations that include your domain. This reflects what AI-powered search looks like for real users asking about your topic area.
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.07] to-teal-500/[0.04] px-6 py-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {result.citedCount === 0
                    ? <><h3 className="mb-1 font-semibold text-white">Not being cited? Here's why.</h3>
                       <p className="text-[12px] leading-relaxed text-slate-400">A full SiteNexis audit identifies exactly which signals are blocking AI citation — entity clarity, retrieval quality, trust formation, and more.</p></>
                    : <><h3 className="mb-1 font-semibold text-white">Being cited — now optimise your coverage.</h3>
                       <p className="text-[12px] leading-relaxed text-slate-400">See which additional query clusters you're missing and get a prioritised roadmap to expand your AI citation surface.</p></>}
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <Link href={`/mts/${encodeURIComponent(result.domain)}`} className="flex items-center gap-2 rounded-xl bg-white/[0.08] border border-white/[0.12] px-5 py-2.5 text-[13px] font-medium text-slate-200 transition hover:bg-white/[0.12]">
                    Check Machine Trust Score
                  </Link>
                  <Link href={`/signup?from=citation-check&domain=${encodeURIComponent(result.domain)}`} className="flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-[13px] font-semibold text-[#0A1628] transition hover:opacity-90">
                    Full audit <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Pre-result explainer */}
      {!result && !loading && (
        <section className="px-6 pb-20">
          <div className="mx-auto max-w-2xl">
            <div className="mb-8 grid gap-3 sm:grid-cols-3">
              {[
                { n: '1', label: 'We crawl your domain', detail: 'Extract topic, entity, and content signals from your homepage' },
                { n: '2', label: 'Generate real queries', detail: 'Derive 4 questions that represent how users ask about your topic' },
                { n: '3', label: 'Check live AI responses', detail: 'Query AI with web search and detect if your domain appears in citations' },
              ].map(({ n, label, detail }) => (
                <div key={n} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
                  <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 font-mono text-[13px] font-bold text-cyan-400">{n}</div>
                  <p className="text-[13px] font-medium text-slate-200">{label}</p>
                  <p className="mt-0.5 text-[11px] text-slate-600">{detail}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.05] px-5 py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
                <p className="text-[12px] leading-relaxed text-amber-300/70">
                  This uses real AI inference with live web search. It takes 15–30 seconds and consumes API credits. Queries are derived automatically from your domain — you cannot specify the exact queries in the free version.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
