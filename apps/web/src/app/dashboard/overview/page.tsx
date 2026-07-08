'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useLatestAudit, useAuditSubReport, useMe } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Brain, ExternalLink, Network, ScanSearch, Quote,
  ShieldCheck, ArrowRight, TrendingUp, BookOpen,
} from 'lucide-react';

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

interface ModuleCard {
  label: string;
  score: number;
  desc: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export default function OverviewPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { audit, isLoading: auditLoading } = useLatestAudit();
  const { data, isLoading } = useAuditSubReport<AIVisData>(audit?.id ?? null, 'ai-visibility');

  const loading = auditLoading || isLoading;

  const modules: ModuleCard[] = data ? [
    { label: 'AI Visibility', score: data.aiVisibilityScore, desc: 'Composite AI visibility across all dimensions', href: '/dashboard/ai-visibility', icon: Brain },
    { label: 'Machine Readability', score: data.machineReadabilityScore, desc: '7-stage extraction pipeline quality', href: '/dashboard/ai-visibility', icon: Brain },
    { label: 'Entity Confidence', score: data.entityConfidenceScore, desc: 'Entity detection, consistency, and disambiguation', href: '/dashboard/entity', icon: Network },
    { label: 'Retrieval Readiness', score: data.retrievalReadinessScore, desc: 'Semantic retrieval selection probability', href: '/dashboard/retrieval', icon: ScanSearch },
    { label: 'Citation Probability', score: data.citationProbabilityScore, desc: 'Likelihood AI uses your content as a citation', href: '/dashboard/citation', icon: Quote },
    { label: 'Semantic Trust', score: data.semanticTrustScore, desc: 'Credibility signals across 4 trust dimensions', href: '/dashboard/semantic-trust', icon: ShieldCheck },
    { label: 'Recommendation Confidence', score: data.recommendationConfidence, desc: 'Probability AI recommends this domain unprompted', href: '/dashboard/ai-visibility', icon: TrendingUp },
  ] : [];

  const lowestModule = modules.length > 0
    ? modules.reduce((min, m) => m.score < min.score ? m : min)
    : null;

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
              <Brain className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">AI Visibility Overview</h1>
            </div>
            <p className="text-sm text-[#4A6280]">
              {audit
                ? <>For <span className="text-[#7A9AB4]">{audit.domain}</span> — <a href={`/audit/${encodeURIComponent(audit.domain)}?auditId=${audit.id}`} className="text-cyan hover:underline inline-flex items-center gap-1">full report <ExternalLink className="h-3 w-3" /></a></>
                : 'Consolidated AI visibility across all intelligence layers'}
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
            <p className="mt-1 text-sm text-[#4A6280]">
              Run a domain audit to see your AI visibility overview.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 rounded-lg bg-cyan/10 border border-cyan/20 px-4 py-2 text-sm font-semibold text-cyan hover:bg-cyan/20 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[1,2,3,4].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-white/[0.03]" />)}
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Priority action */}
            {lowestModule && lowestModule.score < 70 && (
              <div className="rounded-xl border border-amber/20 bg-amber/[0.04] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-amber">Lowest scoring dimension</p>
                    <p className="mt-0.5 text-xs text-[#4A6280]">{lowestModule.label} — score {lowestModule.score} · {lowestModule.desc}</p>
                  </div>
                  <Link href={lowestModule.href} className="shrink-0 rounded-lg border border-amber/20 bg-amber/10 px-3 py-1.5 text-xs font-semibold text-amber hover:bg-amber/20 transition-colors flex items-center gap-1">
                    Analyse <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            )}

            {/* Module grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map(({ label, score, desc, href, icon: Icon }) => (
                <Link key={label} href={href} className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:border-white/[0.12] hover:bg-white/[0.04]">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[#4A6280] group-hover:text-cyan transition-colors" />
                      <span className="text-sm font-semibold text-white">{label}</span>
                    </div>
                    <span className="text-xl font-bold tabular-nums" style={{ color: scoreColor(score) }}>{Math.round(score)}</span>
                  </div>
                  <p className="mb-3 text-xs text-[#4A6280]">{desc}</p>
                  <div className="h-1.5 rounded-full bg-white/10">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, score)}%`, backgroundColor: scoreColor(score) }} />
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs text-[#4A6280] group-hover:text-cyan transition-colors">
                    View detail <ArrowRight className="h-3 w-3" />
                  </div>
                </Link>
              ))}
            </div>

            {/* Intelligence Report CTA */}
            <Link
              href="/dashboard/narrative-report"
              className="group flex items-center justify-between rounded-xl border border-cyan/20 bg-cyan/[0.04] p-5 transition-all hover:border-cyan/40 hover:bg-cyan/[0.07]"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan/10 border border-cyan/20">
                  <BookOpen className="h-5 w-5 text-cyan" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">AI Intelligence Report</p>
                  <p className="text-xs text-[#4A6280]">Grok-style prose executive summary — scores, narrative, strengths, and competitive trajectory</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-cyan opacity-60 group-hover:opacity-100 transition-opacity" />
            </Link>

            {/* Provider scores */}
            {data.providerScores && Object.keys(data.providerScores).length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h2 className="mb-1 text-sm font-semibold text-[#C8DFE8]">Estimated Provider Inclusion</h2>
                <p className="mb-4 text-xs text-[#4A6280]">Probabilistic estimates based on content signals — not measured live data</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(data.providerScores).map(([key, score]) => (
                    <div key={key}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-[#7A9AB4] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
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
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
