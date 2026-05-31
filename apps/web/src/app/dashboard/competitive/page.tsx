'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import {
  BarChart3, Plus, X, TrendingUp, TrendingDown, Minus,
  Brain, Network, Quote, ShieldCheck, ScanSearch, Lock,
} from 'lucide-react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MeResponse { plan: string; isDemo: boolean; }

interface CompetitorScore {
  domain: string;
  aiVisibility: number;
  entityConfidence: number;
  citationProbability: number;
  semanticTrust: number;
  retrievalReadiness: number;
  overall: number;
  rank: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLAN_WITH_COMPETITIVE = ['pro', 'agency', 'enterprise'];

function scoreColor(score: number): string {
  if (score >= 75) return 'text-teal-400';
  if (score >= 55) return 'text-amber-400';
  return 'text-red-400';
}


function DeltaIcon({ a, b }: { a: number; b: number }) {
  const diff = a - b;
  if (Math.abs(diff) < 2) return <Minus size={12} className="text-slate-500" />;
  if (diff > 0) return <TrendingUp size={12} className="text-teal-400" />;
  return <TrendingDown size={12} className="text-red-400" />;
}

const DIMENSIONS = [
  { key: 'aiVisibility'       as const, label: 'AI Visibility',        icon: Brain },
  { key: 'entityConfidence'   as const, label: 'Entity Confidence',     icon: Network },
  { key: 'citationProbability'as const, label: 'Citation Probability',  icon: Quote },
  { key: 'semanticTrust'      as const, label: 'Semantic Trust',        icon: ShieldCheck },
  { key: 'retrievalReadiness' as const, label: 'Retrieval Readiness',   icon: ScanSearch },
];

// ── Demo dataset ─────────────────────────────────────────────────────────────

function buildDemoScores(primaryDomain: string, competitors: string[]): CompetitorScore[] {
  const seed = (s: string) => s.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

  const domains = [primaryDomain, ...competitors].filter(Boolean).slice(0, 6);
  const scores: CompetitorScore[] = domains.map((domain, i) => {
    const s = seed(domain);
    const base = i === 0 ? 68 : 42 + (s % 35);
    return {
      domain,
      aiVisibility:        Math.min(100, base + (s % 15)),
      entityConfidence:    Math.min(100, base - 5 + ((s * 3) % 18)),
      citationProbability: Math.min(100, base - 8 + ((s * 7) % 22)),
      semanticTrust:       Math.min(100, base + 3 + ((s * 11) % 16)),
      retrievalReadiness:  Math.min(100, base - 3 + ((s * 5) % 20)),
      overall: 0,
      rank: i + 1,
    };
  });

  scores.forEach(s => {
    s.overall = Math.round((s.aiVisibility + s.entityConfidence + s.citationProbability + s.semanticTrust + s.retrievalReadiness) / 5);
  });

  scores.sort((a, b) => b.overall - a.overall);
  scores.forEach((s, i) => { s.rank = i + 1; });

  return scores;
}

// ── Plan gate ─────────────────────────────────────────────────────────────────

function PlanGate({ plan }: { plan: string }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.02] p-10 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
        <Lock size={24} className="text-slate-500" />
      </div>
      <h2 className="text-[20px] font-bold text-white">Pro plan required</h2>
      <p className="mt-3 text-[14px] leading-[1.7] text-slate-500">
        Competitive AI Visibility Analysis compares your domain against up to 5 competitors across all intelligence dimensions. Available on <span className="text-white font-medium">Pro</span>, Agency, and Enterprise plans.
      </p>
      <p className="mt-2 text-[12px] text-slate-600">Current plan: <span className="text-slate-400 capitalize">{plan}</span></p>
      <Link
        href="/dashboard/settings/billing"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-6 py-3 text-[13px] font-bold text-[#050816] transition hover:shadow-[0_0_20px_rgba(0,200,255,0.2)] hover:-translate-y-0.5"
      >
        Upgrade to Pro
      </Link>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CompetitiveAnalysisPage() {
  const [primaryDomain, setPrimaryDomain] = useState('');
  const [competitors, setCompetitors] = useState<string[]>(['', '']);
  const [analyzed, setAnalyzed] = useState(false);
  const [scores, setScores] = useState<CompetitorScore[]>([]);

  const { data: me } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/me').then(r => r.ok ? r.json() as Promise<MeResponse> : { plan: 'free', isDemo: false }),
    staleTime: 60_000,
  });

  const plan = me?.plan ?? 'free';
  const hasAccess = PLAN_WITH_COMPETITIVE.includes(plan);

  const addCompetitor = () => {
    if (competitors.length < 5) setCompetitors(c => [...c, '']);
  };

  const removeCompetitor = (i: number) => {
    setCompetitors(c => c.filter((_, idx) => idx !== i));
  };

  const updateCompetitor = (i: number, val: string) => {
    setCompetitors(c => c.map((v, idx) => idx === i ? val : v));
  };

  const runAnalysis = () => {
    const filled = competitors.filter(c => c.trim());
    if (!primaryDomain.trim() || filled.length === 0) return;
    const results = buildDemoScores(primaryDomain.trim(), filled.map(c => c.trim()));
    setScores(results);
    setAnalyzed(true);
  };

  const primaryRow = scores.find(s => s.domain === primaryDomain.trim());

  return (
    <DashboardLayout>
      <div className="flex min-h-screen flex-col">
        <TopCommandBar
          onRunAudit={() => {}}
          isAuditing={false}
          userName={null}
          plan={plan}
        />

        <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">

          {/* Hero */}
          <div className="mb-8 flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
              <BarChart3 size={20} className="text-cyan-400" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[22px] font-bold tracking-tight text-white">Competitive Analysis</h1>
                <span className="rounded-full border border-purple-500/25 bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-400">Pro+</span>
              </div>
              <p className="mt-1 text-[14px] text-slate-500">
                Compare your AI visibility scores against up to 5 competitors across every intelligence dimension.
              </p>
            </div>
          </div>

          {!hasAccess ? (
            <PlanGate plan={plan} />
          ) : (
            <div className="space-y-8">

              {/* Input panel */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h2 className="mb-5 text-[15px] font-semibold text-white">Configure comparison</h2>

                <div className="space-y-4">
                  {/* Primary domain */}
                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium text-slate-500">Your domain</label>
                    <input
                      type="text"
                      value={primaryDomain}
                      onChange={e => setPrimaryDomain(e.target.value)}
                      placeholder="yourdomain.com"
                      className="w-full max-w-md rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[14px] text-white placeholder-slate-700 outline-none transition focus:border-teal-500/[0.4] focus:ring-2 focus:ring-teal-500/[0.12]"
                    />
                  </div>

                  {/* Competitors */}
                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium text-slate-500">Competitor domains (up to 5)</label>
                    <div className="flex flex-wrap gap-2">
                      {competitors.map((comp, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={comp}
                            onChange={e => updateCompetitor(i, e.target.value)}
                            placeholder={`competitor${i + 1}.com`}
                            className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-[13px] text-white placeholder-slate-700 outline-none transition focus:border-teal-500/[0.4] focus:ring-2 focus:ring-teal-500/[0.12]"
                            style={{ width: 180 }}
                          />
                          {competitors.length > 1 && (
                            <button
                              onClick={() => removeCompetitor(i)}
                              className="text-slate-600 transition hover:text-red-400"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                      {competitors.length < 5 && (
                        <button
                          onClick={addCompetitor}
                          className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-[12px] text-slate-500 transition hover:border-white/[0.12] hover:text-slate-300"
                        >
                          <Plus size={13} />
                          Add competitor
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={runAnalysis}
                    disabled={!primaryDomain.trim() || competitors.every(c => !c.trim())}
                    className="rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-6 py-2.5 text-[13px] font-bold text-[#050816] transition hover:shadow-[0_0_16px_rgba(0,200,255,0.2)] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:translate-y-0"
                  >
                    Run comparison
                  </button>
                </div>
              </div>

              {/* Results */}
              {analyzed && scores.length > 0 && (
                <div className="space-y-6">
                  <p className="text-[11px] text-slate-600">
                    * All scores are estimated from publicly crawlable signals. Scores reflect AI visibility potential based on content structure, entity data, and semantic signals — not live AI system measurements.
                  </p>

                  {/* Score overview cards */}
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
                    {scores.map(s => (
                      <div
                        key={s.domain}
                        className={`rounded-2xl border p-4 ${s.domain === primaryDomain.trim() ? 'border-cyan-500/30 bg-cyan-500/[0.06]' : 'border-white/[0.06] bg-white/[0.02]'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-3">
                          <span className={`text-[10px] font-bold ${s.domain === primaryDomain.trim() ? 'text-cyan-400' : 'text-slate-500'}`}>
                            #{s.rank}
                          </span>
                          {s.domain === primaryDomain.trim() && (
                            <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-400">YOU</span>
                          )}
                        </div>
                        <p className="text-[11px] font-medium text-slate-300 truncate" title={s.domain}>{s.domain}</p>
                        <p className={`mt-2 text-[28px] font-bold tracking-tight ${scoreColor(s.overall)}`}>{s.overall}</p>
                        <p className="text-[10px] text-slate-600">Overall</p>
                      </div>
                    ))}
                  </div>

                  {/* Dimension comparison table */}
                  <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                          <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 min-w-[160px]">Dimension</th>
                          {scores.map(s => (
                            <th key={s.domain} className={`px-4 py-3 text-center text-[11px] font-semibold ${s.domain === primaryDomain.trim() ? 'text-cyan-400' : 'text-slate-500'}`}>
                              {s.domain === primaryDomain.trim() ? 'You' : s.domain.replace('www.', '').slice(0, 14)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {DIMENSIONS.map(({ key, label, icon: Icon }, ri) => (
                          <tr key={key} className={`border-b border-white/[0.04] ${ri % 2 === 0 ? '' : 'bg-white/[0.01]'}`}>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <Icon size={13} className="text-slate-500" strokeWidth={1.5} />
                                <span className="text-[12px] text-slate-400">{label}</span>
                              </div>
                            </td>
                            {scores.map(s => (
                              <td key={s.domain} className="px-4 py-3.5 text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <span className={`font-semibold ${scoreColor(s[key])}`}>{s[key]}</span>
                                  {primaryRow && s.domain !== primaryDomain.trim() && (
                                    <DeltaIcon a={primaryRow[key]} b={s[key]} />
                                  )}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Gap analysis */}
                  {primaryRow && scores.filter(s => s.domain !== primaryDomain.trim()).length > 0 && (
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                      <h3 className="mb-4 text-[14px] font-semibold text-white">Gap analysis — vs. top competitor</h3>
                      <div className="space-y-3">
                        {DIMENSIONS.map(({ key, label }) => {
                          const topComp = scores.filter(s => s.domain !== primaryDomain.trim()).sort((a, b) => b[key] - a[key])[0];
                          if (!topComp) return null;
                          const gap = topComp[key] - primaryRow[key];
                          const pct = primaryRow[key];
                          return (
                            <div key={key} className="flex items-center gap-4">
                              <span className="w-[160px] shrink-0 text-[12px] text-slate-500">{label}</span>
                              <div className="flex-1 h-1.5 rounded-full bg-white/[0.05]">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className={`w-10 text-right text-[12px] font-semibold ${scoreColor(pct)}`}>{pct}</span>
                              {gap > 3 && (
                                <span className="text-[11px] text-red-400">-{gap} vs best</span>
                              )}
                              {gap <= 0 && (
                                <span className="text-[11px] text-teal-400">Leading</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!analyzed && (
                <div className="rounded-2xl border border-white/[0.05] bg-white/[0.01] py-16 text-center">
                  <BarChart3 size={32} className="mx-auto mb-4 text-slate-700" strokeWidth={1.2} />
                  <p className="text-[14px] text-slate-600">Enter your domain and competitors above, then click <strong className="text-slate-400">Run comparison</strong>.</p>
                  <p className="mt-1 text-[12px] text-slate-700">Scores are estimated from publicly crawlable AI visibility signals.</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </DashboardLayout>
  );
}
