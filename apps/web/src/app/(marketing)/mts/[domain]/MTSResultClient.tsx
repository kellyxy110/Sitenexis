'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, ArrowRight,
  Copy, CheckCheck, Globe, ExternalLink,
} from 'lucide-react';
import type { QuickMTSResult, MTSGrade } from '@/lib/quick-mts';
import { gradeColor } from '@/lib/quick-mts';

// ── Grade helpers ──────────────────────────────────────────────────────────────

const GRADE_CONFIG: Record<MTSGrade, { bg: string; border: string; text: string; verdict: string }> = {
  Authoritative: {
    bg: 'bg-green-500/[0.07]', border: 'border-green-500/20', text: 'text-green-400',
    verdict: 'Strong AI trust signals. This domain is well-positioned for citation across AI systems.',
  },
  Established: {
    bg: 'bg-teal-500/[0.07]', border: 'border-teal-500/20', text: 'text-teal-400',
    verdict: 'Solid trust foundation. A few targeted improvements would significantly increase AI citation probability.',
  },
  Developing: {
    bg: 'bg-amber-500/[0.07]', border: 'border-amber-500/20', text: 'text-amber-400',
    verdict: 'Trust signals are partial. AI systems can find this domain but citation probability is limited.',
  },
  Unverified: {
    bg: 'bg-red-500/[0.07]', border: 'border-red-500/20', text: 'text-red-400',
    verdict: 'Insufficient trust signals. Significant structural work is needed before AI systems will cite this domain.',
  },
};

const DIM_LABELS: Record<string, string> = {
  crawlability:       'Crawlability',
  content_trust:      'Content Trust',
  entity_clarity:     'Entity Clarity',
  citation_readiness: 'Citation Readiness',
};

const DIM_COLORS: Record<string, string> = {
  crawlability:       '#00C8FF',
  content_trust:      '#0BCEBC',
  entity_clarity:     '#6366F1',
  citation_readiness: '#F59E0B',
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function SubScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[12px] text-slate-400">{label}</span>
        <span className="font-mono text-[12px]" style={{ color }}>{score}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

export function MTSResultClient({ result, domain }: { result: QuickMTSResult; domain: string }) {
  const [copied, setCopied] = useState(false);
  const [badgeCopied, setBadgeCopied] = useState(false);
  const cfg = GRADE_CONFIG[result.grade];
  const color = gradeColor(result.grade);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sitenexis.vercel.app';
  const shareUrl = `${appUrl}/mts/${encodeURIComponent(domain)}`;
  const badgeUrl = `${appUrl}/api/badge/${encodeURIComponent(domain)}`;
  const badgeMd = `[![Machine Trust Score](${badgeUrl})](${shareUrl})`;

  function copyShare() {
    void navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }
  function copyBadge() {
    void navigator.clipboard.writeText(badgeMd).then(() => {
      setBadgeCopied(true); setTimeout(() => setBadgeCopied(false), 2000);
    });
  }

  // Group signals by dimension
  const byDim = result.signals.reduce<Record<string, typeof result.signals>>((acc, s) => {
    (acc[s.dimension] ??= []).push(s);
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-[#0A1628] text-slate-200">

      {/* Top bar */}
      <div className="border-b border-white/[0.05] px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-[12px] text-slate-600">
            <Globe size={12} />
            <span className="text-slate-400">{result.url}</span>
            <span>·</span>
            <span>{result.ttfbMs}ms</span>
            <span>·</span>
            <span>{result.wordCount.toLocaleString()} words</span>
          </div>
          <div className="flex gap-2">
            <button onClick={copyShare} className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] text-slate-400 transition hover:text-slate-200">
              {copied ? <CheckCheck size={12} className="text-teal-400" /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Share'}
            </button>
            <Link href="/mts" className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] text-slate-400 transition hover:text-slate-200">
              Score another domain
            </Link>
          </div>
        </div>
      </div>

      <div className="px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">

            {/* Left — score card */}
            <div className="space-y-4">

              {/* Main score */}
              <div className={`rounded-2xl border p-6 ${cfg.border} ${cfg.bg}`}>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  Machine Trust Score
                </div>
                <div className="text-8xl font-bold tabular-nums leading-none" style={{ color }}>
                  {result.quickMTS}
                </div>
                <div className="mt-1 text-base font-semibold" style={{ color }}>{result.grade}</div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${result.quickMTS}%`, backgroundColor: color }} />
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-slate-500">{cfg.verdict}</p>
              </div>

              {/* Sub-scores */}
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4 space-y-4">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Score breakdown</div>
                <SubScoreBar label="Crawlability" score={result.subScores.crawlability} color={DIM_COLORS.crawlability!} />
                <SubScoreBar label="Content Trust" score={result.subScores.contentTrust} color={DIM_COLORS.content_trust!} />
                <SubScoreBar label="Entity Clarity" score={result.subScores.entityClarity} color={DIM_COLORS.entity_clarity!} />
                <SubScoreBar label="Citation Readiness" score={result.subScores.citationReadiness} color={DIM_COLORS.citation_readiness!} />
              </div>

              {/* Schema types */}
              {result.schemaTypes.length > 0 && (
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Schema detected</div>
                  <div className="flex flex-wrap gap-2">
                    {result.schemaTypes.map((t) => (
                      <span key={t} className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 font-mono text-[11px] text-cyan-400">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Badge embed */}
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Embed badge</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/badge/${encodeURIComponent(domain)}`} alt="Machine Trust Score badge" className="mb-3 rounded" />
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-white/[0.04] px-2 py-1.5 font-mono text-[10px] text-slate-500">
                    {badgeMd}
                  </code>
                  <button onClick={copyBadge} className="shrink-0 rounded border border-white/[0.08] p-1.5 text-slate-500 transition hover:text-slate-200">
                    {badgeCopied ? <CheckCheck size={12} className="text-teal-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Right — signal breakdown */}
            <div className="space-y-5">
              {(['crawlability', 'content_trust', 'entity_clarity', 'citation_readiness'] as const).map((dim) => {
                const dimSignals = byDim[dim] ?? [];
                const dimColor = DIM_COLORS[dim] ?? '#ffffff';
                const passing = dimSignals.filter((s: typeof result.signals[0]) => s.ok).length;
                return (
                  <div key={dim} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
                    <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: dimColor }} />
                        <span className="text-[13px] font-semibold text-slate-200">{DIM_LABELS[dim]}</span>
                      </div>
                      <span className="font-mono text-[12px] text-slate-500">{passing}/{dimSignals.length} passing</span>
                    </div>
                    <div className="divide-y divide-white/[0.04] px-5">
                      {dimSignals.map((sig: typeof result.signals[0]) => (
                        <div key={sig.label} className="flex items-start gap-3 py-3">
                          {sig.ok
                            ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-green-400" />
                            : sig.partial
                            ? <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
                            : <XCircle size={14} className="mt-0.5 shrink-0 text-red-400/70" />}
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] font-medium ${sig.ok ? 'text-slate-200' : 'text-slate-400'}`}>{sig.label}</p>
                            <p className="mt-0.5 text-[11px] text-slate-600">{sig.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* CTA */}
              <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.07] to-teal-500/[0.04] px-6 py-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="mb-1 font-semibold text-white">Get the full Machine Trust analysis</h3>
                    <p className="text-[12px] leading-relaxed text-slate-400">
                      Quick MTS covers 16 signals on one page. A full SiteNexis audit runs 16 agents across your entire domain — entity graph, retrieval simulation, temporal authority, recommendation surface mapping, and more.
                    </p>
                  </div>
                  <Link
                    href={`/signup?from=mts&domain=${encodeURIComponent(domain)}`}
                    className="flex shrink-0 items-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 text-[13px] font-semibold text-[#0A1628] transition hover:opacity-90"
                  >
                    Full audit <ArrowRight size={13} />
                  </Link>
                </div>
              </div>

              {/* Share */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-5 py-4">
                <p className="mb-2 text-[11px] text-slate-600">Shareable link for this result:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-white/[0.04] px-3 py-2 font-mono text-[12px] text-slate-400">
                    {shareUrl}
                  </code>
                  <button onClick={copyShare} className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-slate-400 transition hover:text-slate-200">
                    {copied ? <CheckCheck size={12} className="text-teal-400" /> : <Copy size={12} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-slate-500 transition hover:text-slate-300">
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer note */}
      <div className="border-t border-white/[0.05] px-6 py-5 text-center">
        <p className="text-[11px] text-slate-700">
          Quick MTS · 16 signals · 4 dimensions · crawls live domain ·{' '}
          <Link href="/methodology" className="transition hover:text-slate-500">Methodology →</Link>
        </p>
      </div>
    </main>
  );
}
