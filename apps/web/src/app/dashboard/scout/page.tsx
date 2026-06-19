'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useLatestAudit, useAuditSubReport, useMe } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Radar,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Layers,
  Brain,
  Target,
  Compass,
} from 'lucide-react';
import type {
  ScoutAnalysisResult,
  ScoutPageIntent,
  ScoutIntentType,
  ScoutPipelineStage,
} from '@sitenexis/shared';

// ── Color helpers ─────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 70) return '#0BCEBC';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

function intentColor(intent: ScoutIntentType): string {
  const colors: Record<ScoutIntentType, string> = {
    informational: '#60A5FA',
    commercial: '#0BCEBC',
    navigational: '#A78BFA',
    research: '#F59E0B',
    creation: '#00C8FF',
    learn_and_solve: '#34D399',
    local: '#F472B6',
  };
  return colors[intent] ?? '#4A6280';
}

function intentLabel(intent: ScoutIntentType): string {
  const labels: Record<ScoutIntentType, string> = {
    informational: 'Informational',
    commercial: 'Commercial',
    navigational: 'Navigational',
    research: 'Research',
    creation: 'Creation',
    learn_and_solve: 'Learn & Solve',
    local: 'Local',
  };
  return labels[intent] ?? intent;
}

function confidenceLabel(c: number): string {
  if (c >= 0.8) return 'High';
  if (c >= 0.5) return 'Medium';
  return 'Low';
}

function pipelineStatusColor(status: ScoutPipelineStage['status']): string {
  if (status === 'complete') return '#0BCEBC';
  if (status === 'partial') return '#F59E0B';
  return '#4A6280';
}

// ── GTL Badge ────────────────────────────────────────────────────────────────

function GTLStateBadge({ state }: { state: string }) {
  const colors: Record<string, string> = {
    complete: '#0BCEBC',
    partial: '#F59E0B',
    empty: '#EF4444',
  };
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{
        color: colors[state] ?? '#4A6280',
        backgroundColor: `${colors[state] ?? '#4A6280'}20`,
        border: `1px solid ${colors[state] ?? '#4A6280'}40`,
      }}
    >
      {state}
    </span>
  );
}

// ── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, label }: { score: number; label: string }) {
  const color = scoreColor(score);
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const dash = (score / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        <circle
          cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={circumference / 4} strokeLinecap="round"
        />
        <text x="44" y="44" textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="18" fontWeight="700">
          {score}
        </text>
      </svg>
      <span className="text-xs text-[#4A6280]">{label}</span>
    </div>
  );
}

// ── Intent Bar Chart ────────────────────────────────────────────────────────

function IntentBar({ intent, percentage, count }: { intent: ScoutIntentType; percentage: number; count: number }) {
  const color = intentColor(intent);
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-28 text-xs text-white truncate">{intentLabel(intent)}</span>
      <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, percentage)}%`, backgroundColor: color }} />
      </div>
      <span className="w-12 text-right text-[10px] tabular-nums" style={{ color }}>{percentage}%</span>
      <span className="w-8 text-right text-[10px] text-[#4A6280] tabular-nums">{count}</span>
    </div>
  );
}

// ── Page Intent Row ─────────────────────────────────────────────────────────

function PageIntentRow({ page }: { page: ScoutPageIntent }) {
  const [expanded, setExpanded] = useState(false);
  const color = intentColor(page.primaryIntent);
  return (
    <div className="border-b border-white/[0.04] last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-white/[0.02] transition-colors px-2 -mx-2 rounded"
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white truncate">{page.title || page.url}</p>
          <p className="text-[10px] text-[#4A6280] truncate">{page.url}</p>
        </div>
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0"
          style={{ color, backgroundColor: `${color}20` }}
        >
          {intentLabel(page.primaryIntent)}
        </span>
        <span className="text-[10px] tabular-nums w-8 text-right" style={{ color }}>
          {Math.round(page.primaryConfidence * 100)}%
        </span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-[#4A6280]" /> : <ChevronDown className="h-3.5 w-3.5 text-[#4A6280]" />}
      </button>
      {expanded && (
        <div className="mb-3 ml-2 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 text-xs text-[#4A6280] space-y-2">
          {page.secondaryIntents.length > 0 && (
            <div>
              <span className="font-semibold text-[#7A9AB4]">Secondary: </span>
              {page.secondaryIntents.map((s, i) => (
                <span key={i} className="mr-2">
                  {intentLabel(s.intent)} ({Math.round(s.confidence * 100)}%)
                </span>
              ))}
            </div>
          )}
          {page.intentSignals.length > 0 && (
            <div>
              <span className="font-semibold text-[#7A9AB4]">Signals: </span>
              {page.intentSignals.join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Pipeline Stage Row ──────────────────────────────────────────────────────

function PipelineStageRow({ label, icon, stage }: { label: string; icon: React.ReactNode; stage: ScoutPipelineStage }) {
  const color = pipelineStatusColor(stage.status);
  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
      <span className="text-[#4A6280]">{icon}</span>
      <span className="w-28 text-xs font-medium text-white">{label}</span>
      <span
        className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
        style={{ color, backgroundColor: `${color}20` }}
      >
        {stage.status}
      </span>
      <span className="flex-1 text-[10px] text-[#4A6280] truncate">{stage.detail}</span>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function ScoutPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { audit, isLoading: auditLoading } = useLatestAudit();
  const { data, gtlState, isLoading } = useAuditSubReport<ScoutAnalysisResult>(
    audit?.id ?? null,
    'scout'
  );

  const [activeTab, setActiveTab] = useState<'distribution' | 'pages' | 'pipeline' | 'recommendations'>('distribution');

  const loading = auditLoading || isLoading;

  return (
    <DashboardLayout>
      <TopCommandBar
        onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)}
        userName={me?.email?.split('@')[0] ?? null}
        plan={me?.plan}
      />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 flex-wrap">
              <Radar className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">SiteNexis Scout</h1>
              {gtlState && <GTLStateBadge state={gtlState} />}
            </div>
            <p className="text-sm text-[#4A6280]">
              {audit
                ? <>AI Visibility Intelligence for <span className="text-[#7A9AB4]">{audit.domain}</span> — <a href={`/audit/${encodeURIComponent(audit.domain)}?auditId=${audit.id}`} className="text-cyan hover:underline inline-flex items-center gap-1">full report <ExternalLink className="h-3 w-3" /></a></>
                : 'Cognitive execution layer — Intent classification and visibility intelligence'}
            </p>
          </div>
          {data && (
            <div className="flex items-center gap-4">
              <ScoreRing score={data.intentCoverageScore} label="Coverage" />
              <ScoreRing score={data.intentAlignmentScore} label="Alignment" />
            </div>
          )}
        </div>

        {/* No audit */}
        {!audit && !auditLoading && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <Radar className="h-8 w-8 text-[#4A6280] mx-auto mb-3" />
            <p className="text-white font-semibold">No completed audits yet</p>
            <p className="mt-1 text-sm text-[#4A6280]">Run an audit to activate Scout analysis.</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.03]" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && audit && !data && gtlState === 'empty' && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <Info className="h-8 w-8 text-[#4A6280] mx-auto mb-3" />
            <p className="text-white font-semibold">Scout analysis not yet available</p>
            <p className="mt-1 text-sm text-[#4A6280]">
              Scout runs after audit completion. Check back after your next full audit.
            </p>
          </div>
        )}

        {/* Partial warning */}
        {data && data.state === 'partial' && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-sm text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <span className="font-semibold">Partial analysis</span>
              {data.reason ? ` — ${data.reason}` : ' — Some pages could not be classified.'}
            </div>
          </div>
        )}

        {/* Main content */}
        {data && (
          <div className="space-y-5">

            {/* Hero stats */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Pages Analyzed"
                value={String(data.pagesAnalyzed)}
                sub="Intent classified"
                color="#7A9AB4"
              />
              <StatCard
                label="Dominant Intent"
                value={intentLabel(data.dominantIntent)}
                sub="Most common classification"
                color={intentColor(data.dominantIntent)}
              />
              <StatCard
                label="Coverage Score"
                value={String(data.intentCoverageScore)}
                sub="Intent diversity"
                color={scoreColor(data.intentCoverageScore)}
              />
              <StatCard
                label="Alignment Score"
                value={String(data.intentAlignmentScore)}
                sub="Structure matches intent"
                color={scoreColor(data.intentAlignmentScore)}
              />
            </div>

            {/* Tab navigation */}
            <div className="flex gap-1 overflow-x-auto">
              {(['distribution', 'pages', 'pipeline', 'recommendations'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
                  style={{
                    backgroundColor: activeTab === tab ? 'rgba(255,255,255,0.07)' : 'transparent',
                    color: activeTab === tab ? '#fff' : '#4A6280',
                  }}
                >
                  {tab === 'distribution' ? 'Intent Distribution'
                    : tab === 'pages' ? 'Page Intents'
                    : tab === 'pipeline' ? 'Pipeline Status'
                    : 'Recommendations'}
                </button>
              ))}
            </div>

            {/* Distribution tab */}
            {activeTab === 'distribution' && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Intent Distribution</h2>
                <p className="mb-4 text-xs text-[#4A6280]">
                  How AI systems classify your content by search intent. Balanced distribution increases retrieval surface across query types.
                </p>
                {data.intentDistribution.length > 0 ? (
                  <div className="space-y-0.5">
                    {data.intentDistribution.map((d) => (
                      <IntentBar key={d.intent} intent={d.intent} percentage={d.percentage} count={d.pageCount} />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#4A6280]">No intent distribution data available.</p>
                )}

                {data.intentDistribution.length > 0 && (
                  <div className="mt-5 rounded-lg border border-white/[0.04] bg-white/[0.02] p-4">
                    <h3 className="mb-2 text-xs font-semibold text-[#7A9AB4]">Confidence Breakdown</h3>
                    <div className="grid gap-2 sm:grid-cols-3 text-center text-xs">
                      {data.intentDistribution.slice(0, 3).map((d) => (
                        <div key={d.intent} className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                          <div className="text-lg font-bold" style={{ color: intentColor(d.intent) }}>
                            {Math.round(d.averageConfidence * 100)}%
                          </div>
                          <div className="text-[10px] text-[#4A6280]">
                            {intentLabel(d.intent)} — {confidenceLabel(d.averageConfidence)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pages tab */}
            {activeTab === 'pages' && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[#C8DFE8]">Per-Page Intent Classification</h2>
                  <span className="text-xs text-[#4A6280]">{data.pageIntents.length} pages</span>
                </div>
                {data.pageIntents.length > 0 ? (
                  <div>
                    {data.pageIntents.slice(0, 50).map((page, i) => (
                      <PageIntentRow key={i} page={page} />
                    ))}
                    {data.pageIntents.length > 50 && (
                      <p className="mt-2 text-[10px] text-[#4A6280]">Showing 50 of {data.pageIntents.length} pages</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[#4A6280]">No page intents classified.</p>
                )}
              </div>
            )}

            {/* Pipeline tab */}
            {activeTab === 'pipeline' && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Scout Pipeline Status</h2>
                <p className="mb-4 text-xs text-[#4A6280]">
                  End-to-end cognition loop: Ingest → Embed → Reason → Write. Each stage reports its status independently.
                </p>
                <PipelineStageRow label="Ingestion" icon={<Layers className="h-3.5 w-3.5" />} stage={data.pipeline.ingestion} />
                <PipelineStageRow label="Embedding" icon={<Compass className="h-3.5 w-3.5" />} stage={data.pipeline.embedding} />
                <PipelineStageRow label="Reasoning" icon={<Brain className="h-3.5 w-3.5" />} stage={data.pipeline.reasoning} />
                <PipelineStageRow label="Memory" icon={<Target className="h-3.5 w-3.5" />} stage={data.pipeline.memoryWriteback} />
              </div>
            )}

            {/* Recommendations tab */}
            {activeTab === 'recommendations' && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h2 className="mb-1 text-sm font-semibold text-[#C8DFE8]">Scout Recommendations</h2>
                <p className="mb-4 text-xs text-[#4A6280]">
                  Actionable insights based on intent analysis — generated from crawled content signals.
                </p>
                {data.recommendations.length > 0 ? (
                  <ul className="space-y-3">
                    {data.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-3 rounded-lg border border-cyan/10 bg-cyan/[0.03] p-3 text-xs text-[#C8DFE8]">
                        <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[#4A6280]">No recommendations generated.</p>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
      <div className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</div>
      <div className="mt-0.5 text-[10px] font-semibold text-[#4A6280] uppercase tracking-wide">{label}</div>
      <div className="mt-0.5 text-[10px] text-[#4A6280]">{sub}</div>
    </div>
  );
}
