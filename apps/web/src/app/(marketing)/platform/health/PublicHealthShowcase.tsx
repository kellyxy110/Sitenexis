'use client';

import Link from 'next/link';
import { Activity, CheckCircle2, AlertCircle, ArrowRight, Zap } from 'lucide-react';
import { HealthScoreRing } from '@/components/health/HealthScoreRing';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HealthRun {
  healthScore: number | null;
  technicalSeoScore: number | null;
  aiVisibilityScore: number | null;
  entityCoverageScore: number | null;
  citationReadinessScore: number | null;
  knowledgeGraphScore: number | null;
  trustSignalsScore: number | null;
  performanceScore: number | null;
  geoScore: number | null;
  completedAt: string | null;
  crawlRun: {
    pagesFound: number;
    pagesCrawled: number;
    pagesIndexable: number;
    brokenLinksCount: number;
    crawlHealthScore: number;
  } | null;
  visibilityRun: {
    aiVisibilityScore: number;
    retrievalReadinessScore: number;
    citationProbability: number;
    semanticTrustScore: number;
    recommendationConfidence: number;
    providerBreakdown: Record<string, unknown>;
  } | null;
  entityRun: {
    entitiesDetected: number;
    primaryEntityName: string | null;
    entityConfidenceScore: number;
    sameAsLinksCount: number;
  } | null;
}

interface Props {
  data: { run: HealthRun | null };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 90) return '#22C55E';
  if (score >= 70) return '#0BCEBC';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs Work';
  return 'Critical';
}

function formatAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface MetricRowProps {
  label: string;
  score: number | null;
  description: string;
}

function MetricRow({ label, score, description }: MetricRowProps) {
  const color = score !== null ? scoreColor(score) : '#3A5568';
  return (
    <div className="flex items-center gap-4 py-3 border-b border-white/[0.04] last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-[#C8DFE8]">{label}</p>
        <p className="text-xs text-[#4A6280] mt-0.5">{description}</p>
      </div>
      {score !== null ? (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${score}%`, backgroundColor: color }}
            />
          </div>
          <span className="w-8 text-right text-sm font-bold tabular-nums" style={{ color }}>
            {score}
          </span>
        </div>
      ) : (
        <span className="text-sm text-[#3A5568]">—</span>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PublicHealthShowcase({ data }: Props) {
  const run = data.run;
  const score = run?.healthScore ?? null;

  const METRICS: MetricRowProps[] = [
    {
      label: 'Crawlability',
      score: run?.crawlRun?.crawlHealthScore ?? null,
      description: 'Pages correctly crawled, indexed, and sitemapped',
    },
    {
      label: 'AI Visibility',
      score: run?.aiVisibilityScore ?? null,
      description: 'How clearly AI systems can extract and use this content',
    },
    {
      label: 'AI Retrievability',
      score: run?.visibilityRun?.retrievalReadinessScore ?? null,
      description: 'Probability of retrieval under query pressure',
    },
    {
      label: 'Entity Coverage',
      score: run?.entityCoverageScore ?? null,
      description: 'Completeness and consistency of entity signals',
    },
    {
      label: 'Citation Readiness',
      score: run?.citationReadinessScore ?? null,
      description: 'Likelihood of being selected as an AI citation source',
    },
    {
      label: 'Schema Health',
      score: run?.technicalSeoScore ?? null,
      description: 'Schema markup accuracy, completeness, and trust alignment',
    },
    {
      label: 'Knowledge Graph Strength',
      score: run?.knowledgeGraphScore ?? null,
      description: 'Density and coherence of the AI perception graph',
    },
    {
      label: 'GEO Score',
      score: run?.geoScore ?? null,
      description: 'Generative Engine Optimisation — AI recommendation probability',
    },
  ];

  return (
    <div className="min-h-screen bg-midnight text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] bg-deepspace">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <polygon points="12,2 22,8.5 18.5,20 5.5,20 2,8.5" stroke="#00C8FF" strokeWidth="1.5" fill="rgba(0,200,255,0.08)" strokeLinejoin="round" />
                <polygon points="12,6 18,10 15.5,17 8.5,17 6,10" fill="rgba(0,200,255,0.15)" stroke="rgba(0,200,255,0.4)" strokeWidth="0.75" strokeLinejoin="round" />
              </svg>
              <span className="font-bold text-white text-[15px] tracking-tight">
                Site<span className="text-cyan">Nexis</span>
              </span>
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-lg border border-cyan/30 bg-cyan/[0.08] px-3 py-1.5 text-sm font-medium text-cyan transition-all hover:bg-cyan/[0.15]"
            >
              Audit your site <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-12">

        {/* Title section */}
        <div className="mb-10 text-center">
          <div className="mb-3 flex items-center justify-center gap-2">
            <Activity className="h-5 w-5 text-cyan" />
            <span className="text-sm font-semibold uppercase tracking-wider text-cyan">Live Self-Audit</span>
          </div>
          <h1 className="mb-3 text-3xl font-bold tracking-tight lg:text-4xl">
            SiteNexis monitors itself
          </h1>
          <p className="mx-auto max-w-xl text-base text-[#7A9AB4] leading-relaxed">
            Every deployment automatically triggers a full audit of{' '}
            <span className="text-white font-medium">sitenexis.com</span>.
            This page shows the live results — the same report any customer gets for their domain.
          </p>
          {run?.completedAt && (
            <p className="mt-3 text-xs text-[#3A5568]">
              Last audit: <span className="text-[#4A6280]">{formatAge(run.completedAt)}</span> · Updates on every deploy
            </p>
          )}
        </div>

        {/* Score hero */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Ring */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02] py-8">
            <HealthScoreRing
              score={score}
              label="SiteNexis Health Score"
              color={score !== null ? scoreColor(score) : '#3A5568'}
              size={180}
            />
            {score !== null && (
              <span
                className="mt-4 rounded-full px-3 py-1 text-sm font-semibold"
                style={{ backgroundColor: `${scoreColor(score)}20`, color: scoreColor(score) }}
              >
                {scoreLabel(score)}
              </span>
            )}
          </div>

          {/* Quick stats */}
          <div className="lg:col-span-2 space-y-3">
            {/* Crawl */}
            {run?.crawlRun && (
              <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div className="flex items-center gap-2">
                  {run.crawlRun.brokenLinksCount === 0
                    ? <CheckCircle2 className="h-4 w-4 text-teal-400" />
                    : <AlertCircle className="h-4 w-4 text-amber-400" />
                  }
                  <span className="text-sm text-[#C8DFE8]">Crawl Health</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#4A6280]">{run.crawlRun.pagesIndexable}/{run.crawlRun.pagesFound} pages indexable</span>
                  <span className="text-sm font-bold" style={{ color: scoreColor(run.crawlRun.crawlHealthScore) }}>
                    {run.crawlRun.crawlHealthScore}/100
                  </span>
                </div>
              </div>
            )}

            {/* Entity */}
            {run?.entityRun && (
              <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-teal-400" />
                  <span className="text-sm text-[#C8DFE8]">Primary Entity</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#4A6280]">
                    {run.entityRun.entitiesDetected} entities · {run.entityRun.sameAsLinksCount} sameAs
                  </span>
                  <span className="text-sm font-medium text-white">{run.entityRun.primaryEntityName ?? '—'}</span>
                </div>
              </div>
            )}

            {/* Citation */}
            {run?.visibilityRun && (
              <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span className="text-sm text-[#C8DFE8]">Citation Readiness</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#4A6280]">
                    Rec. Confidence: {run.visibilityRun.recommendationConfidence}
                  </span>
                  <span className="text-sm font-bold" style={{ color: scoreColor(run.visibilityRun.citationProbability) }}>
                    {run.visibilityRun.citationProbability}/100
                  </span>
                </div>
              </div>
            )}

            {/* Provider scores */}
            {run?.visibilityRun?.providerBreakdown && Object.keys(run.visibilityRun.providerBreakdown).length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wide text-[#3A5568]">
                  AI Provider Visibility (estimated)
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(run.visibilityRun.providerBreakdown).map(([provider, val]) => {
                    const numVal = typeof val === 'number' ? val : 0;
                    return (
                      <div key={provider} className="flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1">
                        <span className="text-[11px] text-[#7A9AB4] capitalize">{provider.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="text-[11px] font-bold tabular-nums" style={{ color: scoreColor(numVal) }}>{numVal}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Metric breakdown */}
        <div className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
          <h2 className="mb-1 text-sm font-semibold text-[#C8DFE8]">Full Breakdown</h2>
          <p className="mb-4 text-xs text-[#4A6280]">The same 8-dimension audit every SiteNexis customer receives.</p>
          <div>
            {METRICS.map((m) => (
              <MetricRow key={m.label} {...m} />
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-2xl border border-cyan/20 bg-cyan/[0.04] p-8 text-center">
          <h2 className="mb-2 text-xl font-bold">Audit your own site</h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-[#7A9AB4]">
            See how your domain performs across all 8 dimensions. Get the same depth of analysis SiteNexis applies to itself.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="flex items-center gap-2 rounded-xl bg-cyan px-6 py-2.5 text-sm font-semibold text-[#0A1628] transition-all hover:bg-cyan/90"
            >
              Start free audit <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="rounded-xl border border-white/10 px-6 py-2.5 text-sm font-medium text-[#7A9AB4] transition-all hover:border-white/20 hover:text-white"
            >
              View pricing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
