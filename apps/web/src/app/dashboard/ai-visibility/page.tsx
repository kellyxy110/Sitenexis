'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useLatestAudit, useAuditSubReport, useMe } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { Brain, ExternalLink } from 'lucide-react';

interface AIVisData {
  auditId: string;
  aiVisibilityScore: number;
  machineReadabilityScore: number;
  entityConfidenceScore: number;
  retrievalReadinessScore: number;
  citationProbabilityScore: number;
  semanticTrustScore: number;
  recommendationConfidence: number;
  providerScores: Record<string, number>;
  breakdown: {
    machineReadability?: Record<string, number>;
    entityIntelligence?: Record<string, number>;
    citationFactors?: Array<{ url: string; score: number }>;
    semanticTrust?: Record<string, number>;
  };
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

const PROVIDER_LABELS: Record<string, string> = {
  googleAIOverviews: 'Google AI Overviews',
  chatGPT: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  claude: 'Claude',
};

export default function AIVisibilityPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { audit, isLoading: auditLoading } = useLatestAudit();
  const { data, isLoading } = useAuditSubReport<AIVisData>(audit?.id ?? null, 'ai-visibility');

  const loading = auditLoading || isLoading;

  const coreScores = data ? [
    { label: 'Machine Readability', score: data.machineReadabilityScore, desc: 'How well AI systems extract meaning from raw HTML across 7 extraction stages' },
    { label: 'Entity Confidence', score: data.entityConfidenceScore, desc: 'How confidently AI systems identify and anchor your primary entities' },
    { label: 'Retrieval Readiness', score: data.retrievalReadinessScore, desc: 'Probability that content is selected during semantic retrieval for relevant queries' },
    { label: 'Citation Probability', score: data.citationProbabilityScore, desc: 'Likelihood that AI systems select this content as a citation source' },
    { label: 'Semantic Trust', score: data.semanticTrustScore, desc: 'Credibility signals: authorship, organisation, content accuracy, structural trust' },
    { label: 'Recommendation Confidence', score: data.recommendationConfidence, desc: 'Probability AI systems recommend this domain unprompted in a relevant response' },
  ] : [];

  return (
    <DashboardLayout>
      <TopCommandBar
        onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)}
        userName={me?.email?.split('@')[0] ?? null}
        plan={me?.plan}
      />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Brain className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">AI Visibility</h1>
            </div>
            <p className="text-sm text-[#4A6280]">
              {audit ? <>For <span className="text-[#7A9AB4]">{audit.domain}</span> — <a href={`/audit/${encodeURIComponent(audit.domain)}?auditId=${audit.id}`} className="text-cyan hover:underline inline-flex items-center gap-1">full report <ExternalLink className="h-3 w-3" /></a></> : 'How AI systems extract, interpret, and rank your content'}
            </p>
          </div>
          {data && (
            <div className="text-right">
              <div className="text-4xl font-bold tabular-nums" style={{ color: scoreColor(data.aiVisibilityScore) }}>{data.aiVisibilityScore}</div>
              <div className="text-xs text-[#4A6280]">AI Visibility Score</div>
              <div className="mt-0.5 text-xs font-semibold" style={{ color: scoreColor(data.aiVisibilityScore) }}>{scoreLabel(data.aiVisibilityScore)}</div>
            </div>
          )}
        </div>

        {!audit && !auditLoading && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <p className="text-white font-semibold">No completed audits yet</p>
            <p className="mt-1 text-sm text-[#4A6280]">Run an audit from the dashboard to see AI visibility analysis.</p>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[1,2,3,4,5,6].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-white/[0.03]" />)}
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Core scores grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {coreScores.map(({ label, score, desc }) => (
                <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{label}</span>
                    <span className="text-xl font-bold tabular-nums" style={{ color: scoreColor(score) }}>{Math.round(score)}</span>
                  </div>
                  <p className="mb-3 text-xs text-[#4A6280]">{desc}</p>
                  <div className="h-1.5 rounded-full bg-white/10">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, score)}%`, backgroundColor: scoreColor(score) }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Provider breakdown */}
            {data.providerScores && Object.keys(data.providerScores).length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Estimated Provider Inclusion</h2>
                <p className="mb-4 text-xs text-[#4A6280]">Probabilistic estimates based on content signals — not measured data</p>
                <div className="space-y-3">
                  {Object.entries(data.providerScores).map(([key, score]) => (
                    <div key={key}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-[#7A9AB4]">{PROVIDER_LABELS[key] ?? key}</span>
                        <span className="font-semibold tabular-nums" style={{ color: scoreColor(score) }}>{Math.round(score)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, score)}%`, backgroundColor: scoreColor(score) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Machine readability breakdown */}
            {data.breakdown?.machineReadability && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h2 className="mb-1 text-sm font-semibold text-[#C8DFE8]">Extraction Pipeline Breakdown</h2>
                <p className="mb-4 text-xs text-[#4A6280]">7-stage extraction quality — each stage is a potential failure point in AI retrieval</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(data.breakdown.machineReadability).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between py-1 border-b border-white/[0.04]">
                      <span className="text-xs capitalize text-[#4A6280]">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="text-xs font-semibold tabular-nums" style={{ color: scoreColor(val) }}>{Math.round(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top citation candidates */}
            {data.breakdown?.citationFactors && data.breakdown.citationFactors.length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Top Citation Candidates</h2>
                <div className="space-y-2">
                  {data.breakdown.citationFactors.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="truncate max-w-xs text-[#4A6280]">{f.url}</span>
                      <span className="ml-4 font-semibold tabular-nums" style={{ color: scoreColor(f.score) }}>{Math.round(f.score)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
