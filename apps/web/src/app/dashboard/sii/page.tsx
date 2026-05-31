'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useLatestAudit, useAuditSubReport } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Layers, ExternalLink, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface SIIBreakdown {
  seo_readability: number | null;
  ai_visibility: number | null;
  semantic_structure: number | null;
  entity_clarity: number | null;
  retrieval_friendliness: number | null;
  citation_potential: number | null;
}

interface SIIRecommendation {
  area: string;
  action: string;
  expected_gain: string;
}

interface SIIData {
  auditId: string;
  url: string;
  sii_score: number;
  confidence: number;
  breakdown: SIIBreakdown;
  weighted_contributions: SIIBreakdown;
  insights: string[];
  critical_gaps: string[];
  recommendation_priority: SIIRecommendation[];
}

// ── Dimension metadata ──────────────────────────────────────────────────────

const DIMENSION_META: Record<keyof SIIBreakdown, {
  label: string;
  weight: string;
  desc: string;
  href: string;
}> = {
  seo_readability:       { label: 'SEO Readability',        weight: '20%', desc: 'Technical crawlability, metadata completeness, sitemap health', href: '/dashboard/ai-visibility' },
  ai_visibility:         { label: 'AI Visibility',           weight: '25%', desc: 'Machine extraction quality, semantic trust, readability fidelity', href: '/dashboard/ai-visibility' },
  semantic_structure:    { label: 'Semantic Structure',      weight: '20%', desc: 'Schema markup completeness and machine readability pipeline', href: '/dashboard/ai-visibility' },
  entity_clarity:        { label: 'Entity Clarity',          weight: '15%', desc: 'Entity confidence, consistency, disambiguation, sameAs coverage', href: '/dashboard/entity' },
  retrieval_friendliness: { label: 'Retrieval Friendliness', weight: '10%', desc: 'Chunk quality, query-answer alignment, context window positioning', href: '/dashboard/retrieval' },
  citation_potential:    { label: 'Citation Potential',      weight: '10%', desc: 'Factual density, claim specificity, temporal freshness signals', href: '/dashboard/citation' },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

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
function pct(n: number) { return `${Math.round(n)}%`; }

// ── SII ring gauge ───────────────────────────────────────────────────────────

function SIIGauge({ score, confidence }: { score: number; confidence: number }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const filled = (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140" className="-rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tabular-nums" style={{ color }}>{score}</span>
        <span className="text-[10px] text-[#4A6280] uppercase tracking-widest">SII Score</span>
        <span className="mt-0.5 text-[10px] text-[#334155]">{pct(confidence * 100)} confidence</span>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SIIPage() {
  const router = useRouter();
  const { audit, isLoading: auditLoading } = useLatestAudit();
  const { data, isLoading } = useAuditSubReport<SIIData>(audit?.id ?? null, 'sii');

  const loading = auditLoading || isLoading;

  return (
    <DashboardLayout>
      <TopCommandBar onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)} />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Layers className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">Intelligence Index</h1>
              <span className="rounded-full border border-cyan/25 bg-cyan/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan">SII</span>
            </div>
            <p className="text-sm text-[#4A6280]">
              {audit
                ? <>For <span className="text-[#7A9AB4]">{audit.domain}</span> — <a href={`/audit/${encodeURIComponent(audit.domain)}?auditId=${audit.id}`} className="text-cyan hover:underline inline-flex items-center gap-1">full report <ExternalLink className="h-3 w-3" /></a></>
                : 'Unified composite score across SEO readability, AI visibility, entity clarity, and retrieval performance'}
            </p>
          </div>
        </div>

        {!audit && !auditLoading && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <p className="text-white font-semibold">No completed audits yet</p>
            <p className="mt-1 text-sm text-[#4A6280]">Run an audit to compute your SiteNexis Intelligence Index score.</p>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[1,2,3].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-white/[0.03]" />)}
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Hero: gauge + score label */}
            <div className="flex flex-col items-center gap-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 sm:flex-row sm:items-start">
              <SIIGauge score={data.sii_score} confidence={data.confidence} />
              <div className="flex-1 min-w-0">
                <div className="mb-2 flex items-center gap-3">
                  <span className="text-3xl font-bold text-white">{scoreLabel(data.sii_score)}</span>
                  <span className="text-sm font-semibold" style={{ color: scoreColor(data.sii_score) }}>SII {data.sii_score}</span>
                </div>
                <p className="text-sm text-[#4A6280] max-w-md">
                  The SiteNexis Intelligence Index measures how understandable your website is across both
                  search engines and AI systems — combining 6 orthogonal dimensions into a single composite score.
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-[#4A6280]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-teal" />
                  Confidence: {Math.round(data.confidence * 100)}% — based on {Object.values(data.breakdown).filter(v => v !== null).length}/6 dimensions with complete data
                </div>
              </div>
            </div>

            {/* Dimension breakdown */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h2 className="mb-5 text-sm font-semibold text-[#C8DFE8]">Dimension Breakdown</h2>
              <div className="space-y-4">
                {(Object.keys(DIMENSION_META) as Array<keyof SIIBreakdown>).map((dim) => {
                  const meta  = DIMENSION_META[dim];
                  const score = data.breakdown[dim];
                  const wc    = data.weighted_contributions[dim];
                  return (
                    <div key={dim}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <Link href={meta.href} className="text-sm font-medium text-white hover:text-cyan transition-colors truncate">{meta.label}</Link>
                          <span className="shrink-0 text-[10px] text-[#334155] font-semibold">{meta.weight}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          {wc !== null && (
                            <span className="text-[10px] text-[#4A6280] tabular-nums">+{wc} pts</span>
                          )}
                          <span className="text-sm font-bold tabular-nums w-8 text-right" style={{ color: score !== null ? scoreColor(score) : '#334155' }}>
                            {score !== null ? score : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.06]">
                        {score !== null ? (
                          <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: scoreColor(score) }} />
                        ) : (
                          <div className="h-full rounded-full bg-white/[0.08] animate-pulse" style={{ width: '100%' }} />
                        )}
                      </div>
                      <div className="mt-1 text-[10px] text-[#334155]">{meta.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* Insights */}
              {data.insights.length > 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#C8DFE8]">
                    <TrendingUp className="h-4 w-4 text-cyan" /> Insights
                  </h2>
                  <ul className="space-y-2">
                    {data.insights.map((insight, i) => (
                      <li key={i} className="text-xs text-[#4A6280] font-mono leading-relaxed">{insight}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Critical gaps */}
              {data.critical_gaps.length > 0 && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-5">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-400">
                    <AlertTriangle className="h-4 w-4" /> Critical Gaps
                  </h2>
                  <ul className="space-y-2">
                    {data.critical_gaps.map((gap, i) => (
                      <li key={i} className="text-xs text-[#4A6280] font-mono leading-relaxed">{gap}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Recommendation priority */}
            {data.recommendation_priority.length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Recommendation Priority</h2>
                <div className="space-y-3">
                  {data.recommendation_priority.map((rec, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] p-4">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan/20 bg-cyan/10 text-[11px] font-bold text-cyan">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-white">{rec.area}</span>
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-teal/10 text-teal border border-teal/20">{rec.expected_gain}</span>
                        </div>
                        <p className="text-xs text-[#4A6280]">{rec.action}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weight table */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h2 className="mb-1 text-sm font-semibold text-[#C8DFE8]">Score Composition</h2>
              <p className="mb-4 text-xs text-[#4A6280]">Default weight model — 6 orthogonal dimensions, no double-counting</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {(Object.keys(DIMENSION_META) as Array<keyof SIIBreakdown>).map((dim) => {
                  const { label, weight } = DIMENSION_META[dim];
                  return (
                    <div key={dim} className="flex items-center justify-between rounded border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-xs">
                      <span className="text-[#4A6280]">{label}</span>
                      <span className="font-semibold text-[#7A9AB4]">{weight}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
