'use client';

import { Brain, ScanSearch, Quote, ShieldCheck, Network } from 'lucide-react';
import { ScoreRing } from '@/components/dashboard/ScoreRing';
import { MetricCard } from '@/components/dashboard/MetricCard';

export interface IntelligenceScores {
  aiVisibility: number | null;
  retrievalReadiness: number | null;
  citationProbability: number | null;
  semanticTrust: number | null;
  entityConfidence: number | null;
}

interface IntelligenceHeroProps {
  scores: IntelligenceScores;
  domain?: string | null | undefined;
  loading?: boolean | undefined;
}

const METRICS = [
  { key: 'retrievalReadiness'  as const, label: 'Retrieval Readiness',   icon: ScanSearch,  description: 'How reliably AI systems extract and rank content from this site' },
  { key: 'citationProbability' as const, label: 'Citation Probability',  icon: Quote,       description: 'Likelihood this site is cited in AI-generated responses' },
  { key: 'semanticTrust'       as const, label: 'Semantic Trust',        icon: ShieldCheck, description: 'Credibility and coherence as perceived by AI systems' },
  { key: 'entityConfidence'    as const, label: 'Entity Confidence',     icon: Network,     description: 'Clarity and consistency of named entity signals' },
];

function HeroSkeleton() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="h-[200px] w-[200px] animate-pulse rounded-full bg-white/5" />
      <div className="h-4 w-28 animate-pulse rounded bg-white/5" />
    </div>
  );
}

export function IntelligenceHero({ scores, domain, loading }: IntelligenceHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-deepspace">
      {/* Subtle radial background */}
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan/5 blur-3xl" />
      </div>

      <div className="relative px-4 py-6 sm:px-8 sm:py-10">
        {/* Section header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 sm:mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan/10">
              <Brain className="h-4 w-4 text-cyan" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">AI Visibility Intelligence</h2>
              {domain && (
                <p className="text-xs text-[#4A6280]">{domain}</p>
              )}
            </div>
          </div>
          <span className="rounded-full border border-white/5 bg-white/[0.03] px-3 py-1 text-xs text-[#4A6280]">
            Composite score
          </span>
        </div>

        {/* Primary score + secondary metrics */}
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[auto_1fr]">
          {/* Score ring */}
          <div className="flex justify-center">
            {loading ? (
              <HeroSkeleton />
            ) : (
              <div className="flex flex-col items-center gap-3">
                <ScoreRing
                  score={scores.aiVisibility}
                  size={200}
                  strokeWidth={10}
                  animated
                />
                <p className="text-xs font-medium uppercase tracking-widest text-[#4A6280]">
                  AI Visibility Score
                </p>
              </div>
            )}
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {METRICS.map(({ key, label, icon, description }) => (
              <MetricCard
                key={key}
                label={label}
                score={scores[key]}
                icon={icon}
                description={description}
                loading={loading}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
