'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useLatestAudit, useAuditSubReport, useMe } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  TrendingUp,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Eye,
  Database,
} from 'lucide-react';
import type {
  InformationGainResult,
  IGEQuestionCoverage,
  IGEEvidenceBlock,
} from '@sitenexis/shared';

// ── Color helpers ─────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 70) return '#0BCEBC';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

function scoreLabel(score: number): string {
  if (score >= 70) return 'Excellent';
  if (score >= 50) return 'Moderate';
  return 'Low Gain';
}

function confidenceColor(c: number): string {
  if (c >= 0.7) return '#0BCEBC';
  if (c >= 0.4) return '#F59E0B';
  return '#EF4444';
}

function retrievalColor(v: string): string {
  if (v === 'high') return '#0BCEBC';
  if (v === 'medium') return '#F59E0B';
  return '#EF4444';
}

function tierColor(tier: string): string {
  if (tier === 'unclaimed') return '#00C8FF';
  if (tier === 'rare') return '#0BCEBC';
  if (tier === 'common') return '#F59E0B';
  return '#4A6280';
}

function opportunityColor(opp: string): string {
  if (opp === 'critical') return '#EF4444';
  if (opp === 'high') return '#F59E0B';
  if (opp === 'medium') return '#0BCEBC';
  return '#4A6280';
}

// ── GTL State Badge ───────────────────────────────────────────────────────────

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

// ── Score Ring ────────────────────────────────────────────────────────────────

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
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
        />
        <text x="44" y="44" textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="18" fontWeight="700">
          {score}
        </text>
      </svg>
      <span className="text-xs text-[#4A6280]">{label}</span>
    </div>
  );
}

// ── Collapsible Question Row ──────────────────────────────────────────────────

function QuestionRow({ q }: { q: IGEQuestionCoverage }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-b border-white/[0.04] last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 py-3 text-left hover:bg-white/[0.02] transition-colors px-2 -mx-2 rounded"
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white leading-relaxed">{q.question}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: tierColor(q.tier), backgroundColor: `${tierColor(q.tier)}20` }}
          >
            {q.tier}
          </span>
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ color: opportunityColor(q.opportunity), backgroundColor: `${opportunityColor(q.opportunity)}15` }}
          >
            {q.opportunity}
          </span>
          {q.coveredByTarget
            ? <CheckCircle className="h-3.5 w-3.5 text-teal-400 shrink-0" />
            : <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
          <span className="text-[10px] text-[#4A6280]">{Math.round(q.coveragePercent)}%</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-[#4A6280]" /> : <ChevronDown className="h-3.5 w-3.5 text-[#4A6280]" />}
        </div>
      </button>
      {expanded && (
        <div className="mb-3 ml-2 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 text-xs text-[#4A6280]">
          <p>Coverage: {q.coverageCount} of {Math.round(q.coveragePercent > 0 ? q.coverageCount / (q.coveragePercent / 100) : 0)} cohort pages</p>
          <p className="mt-1">Covered by target: {q.coveredByTarget ? 'Yes' : 'No — opportunity to address'}</p>
        </div>
      )}
    </div>
  );
}

// ── Evidence Badge ─────────────────────────────────────────────────────────────

function EvidenceTypeBadge({ type }: { type: IGEEvidenceBlock['type'] }) {
  const colors: Record<string, string> = {
    statistic: '#00C8FF',
    benchmark: '#0BCEBC',
    case_study: '#F59E0B',
    experiment: '#A78BFA',
    dataset: '#60A5FA',
    framework: '#34D399',
    example: '#94A3B8',
  };
  const color = colors[type] ?? '#4A6280';
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ color, backgroundColor: `${color}20` }}
    >
      {type.replace(/_/g, ' ')}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type ViewMode = 'fact' | 'perception';

export default function InformationGainPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { audit, isLoading: auditLoading } = useLatestAudit();
  const { data, gtlState, isLoading } = useAuditSubReport<InformationGainResult>(
    audit?.id ?? null,
    'information-gain'
  );

  const [activeTab, setActiveTab] = useState<'shared' | 'questions' | 'entities' | 'evidence' | 'citations'>('shared');
  const [viewMode, setViewMode] = useState<ViewMode>('fact');

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
              <TrendingUp className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">Information Gain Engine</h1>
              {gtlState && <GTLStateBadge state={gtlState} />}
            </div>
            <p className="text-sm text-[#4A6280]">
              {audit
                ? <>For <span className="text-[#7A9AB4]">{audit.domain}</span> — <a href={`/audit/${encodeURIComponent(audit.domain)}?auditId=${audit.id}`} className="text-cyan hover:underline inline-flex items-center gap-1">full report <ExternalLink className="h-3 w-3" /></a></>
                : 'What is this page contributing that the internet does not already have?'}
            </p>
          </div>
          {data && (
            <div className="flex items-center gap-6">
              <ScoreRing score={data.informationGainScore} label={scoreLabel(data.informationGainScore)} />
            </div>
          )}
        </div>

        {/* No audit */}
        {!audit && !auditLoading && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <TrendingUp className="h-8 w-8 text-[#4A6280] mx-auto mb-3" />
            <p className="text-white font-semibold">No completed audits yet</p>
            <p className="mt-1 text-sm text-[#4A6280]">Run an audit to see Information Gain analysis.</p>
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

        {/* GTL states without data */}
        {!loading && audit && !data && gtlState === 'empty' && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <Info className="h-8 w-8 text-[#4A6280] mx-auto mb-3" />
            <p className="text-white font-semibold">No IGE data available yet</p>
            <p className="mt-1 text-sm text-[#4A6280]">
              Information Gain analysis requires a keyword + SERP_API_KEY configuration. Check your environment setup.
            </p>
          </div>
        )}

        {/* Partial state warning */}
        {data && data.state === 'partial' && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-sm text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <span className="font-semibold">Partial data</span>
              {data.reason ? ` — ${data.reason}` : ' — Some cohort pages could not be crawled.'}
              {' Confidence is reduced accordingly.'}
            </div>
          </div>
        )}

        {/* Main content */}
        {data && (
          <div className="space-y-5">

            {/* Hero stats */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="IGE Score"
                value={String(data.informationGainScore)}
                sub={scoreLabel(data.informationGainScore)}
                color={scoreColor(data.informationGainScore)}
              />
              <StatCard
                label="PCE Confidence"
                value={`${Math.round(data.confidence * 100)}%`}
                sub={data.confidence >= 0.7 ? 'High quality cohort' : data.confidence >= 0.4 ? 'Moderate quality' : 'Low cohort quality'}
                color={confidenceColor(data.confidence)}
              />
              <StatCard
                label="Retrieval Value"
                value={data.retrievalValue.toUpperCase()}
                sub="AI retrieval likelihood"
                color={retrievalColor(data.retrievalValue)}
              />
              <StatCard
                label="Cohort Pages"
                value={`${data.cohortPagesSuccessful}/${data.cohortSize}`}
                sub="Successfully crawled"
                color="#7A9AB4"
              />
            </div>

            {/* Score breakdown */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Score Breakdown</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {Object.entries(data.scoreBreakdown).map(([key, val]) => (
                  <div key={key} className="text-center">
                    <div className="text-2xl font-bold tabular-nums" style={{ color: scoreColor(val) }}>
                      {val}
                    </div>
                    <div className="mt-0.5 text-[10px] text-[#4A6280] capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* View mode toggle: Fact vs Perception */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('fact')}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: viewMode === 'fact' ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.03)',
                  color: viewMode === 'fact' ? '#00C8FF' : '#4A6280',
                  border: `1px solid ${viewMode === 'fact' ? 'rgba(0,200,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <Database className="h-3 w-3" />
                Fact Layer
              </button>
              <button
                onClick={() => setViewMode('perception')}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: viewMode === 'perception' ? 'rgba(11,206,188,0.15)' : 'rgba(255,255,255,0.03)',
                  color: viewMode === 'perception' ? '#0BCEBC' : '#4A6280',
                  border: `1px solid ${viewMode === 'perception' ? 'rgba(11,206,188,0.3)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <Eye className="h-3 w-3" />
                Perception Layer
              </button>
              <span className="text-[10px] text-[#4A6280] ml-2">
                {viewMode === 'fact'
                  ? 'Raw extracted data from crawled pages — zero inference'
                  : 'AI-inferred themes and opportunities — clearly labelled as estimates'}
              </span>
            </div>

            {/* Fact layer view */}
            {viewMode === 'fact' && (
              <div className="space-y-5">
                {/* Tab navigation */}
                <div className="flex gap-1 overflow-x-auto">
                  {(['shared', 'questions', 'entities', 'evidence', 'citations'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
                      style={{
                        backgroundColor: activeTab === tab ? 'rgba(255,255,255,0.07)' : 'transparent',
                        color: activeTab === tab ? '#fff' : '#4A6280',
                      }}
                    >
                      {tab === 'shared' ? 'Shared Knowledge'
                        : tab === 'questions' ? 'Question Gaps'
                        : tab === 'entities' ? 'Entity Gaps'
                        : tab === 'evidence' ? 'Evidence Gap'
                        : 'Citation Opportunities'}
                    </button>
                  ))}
                </div>

                {/* Shared Knowledge tab */}
                {activeTab === 'shared' && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-[#C8DFE8]">Shared Knowledge Coverage</h2>
                      <span className="text-sm font-bold tabular-nums" style={{ color: scoreColor(100 - data.sharedKnowledge.sharedCoveragePercent) }}>
                        {Math.round(data.sharedKnowledge.sharedCoveragePercent)}% shared
                      </span>
                    </div>
                    <p className="mb-4 text-xs text-[#4A6280]">
                      Topics covered by 60%+ of cohort pages. Higher shared coverage = more commoditised knowledge landscape.
                    </p>
                    <div className="space-y-1">
                      {data.sharedKnowledge.sharedTopics.slice(0, 20).map((t, i) => (
                        <div key={i} className="flex items-center gap-3 py-1">
                          <div className="flex-1 text-xs text-white">{t.topic}</div>
                          <div className="w-32 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, t.coveragePercent)}%`,
                                backgroundColor: t.coveragePercent >= 60 ? '#EF4444' : '#0BCEBC',
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-[#4A6280] w-10 text-right tabular-nums">
                            {Math.round(t.coveragePercent)}%
                          </span>
                        </div>
                      ))}
                      {data.sharedKnowledge.sharedTopics.length === 0 && (
                        <p className="text-xs text-[#4A6280]">No shared topics detected — cohort may have insufficient data.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Question Gaps tab */}
                {activeTab === 'questions' && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-[#C8DFE8]">Question Coverage Map</h2>
                      <span className="text-xs text-[#4A6280]">{data.questionGap.totalQuestionsExtracted} questions extracted</span>
                    </div>
                    <div className="mb-3 grid gap-2 sm:grid-cols-3 text-center">
                      <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                        <div className="text-lg font-bold text-red-400">{data.questionGap.unansweredQuestions.length}</div>
                        <div className="text-[10px] text-[#4A6280]">Missing from target</div>
                      </div>
                      <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                        <div className="text-lg font-bold text-amber-400">{data.questionGap.rareQuestions.length}</div>
                        <div className="text-[10px] text-[#4A6280]">Rare / unclaimed</div>
                      </div>
                      <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                        <div className="text-lg font-bold text-teal-400">{data.questionGap.coveredQuestions.filter((q) => q.coveredByTarget).length}</div>
                        <div className="text-[10px] text-[#4A6280]">Covered by target</div>
                      </div>
                    </div>
                    <div>
                      {[...data.questionGap.unansweredQuestions, ...data.questionGap.rareQuestions, ...data.questionGap.coveredQuestions]
                        .slice(0, 30)
                        .map((q, i) => (
                          <QuestionRow key={i} q={q} />
                        ))}
                      {data.questionGap.totalQuestionsExtracted === 0 && (
                        <p className="text-xs text-[#4A6280]">No questions detected in cohort pages.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Entity Gaps tab */}
                {activeTab === 'entities' && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                    <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Entity Coverage Analysis</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <EntityList
                        title="Missing from Target"
                        subtitle="In 50%+ of cohort pages but absent from your page"
                        items={data.entityGap.missingFromTarget}
                        color="#EF4444"
                        emptyMsg="No missing universal entities"
                      />
                      <EntityList
                        title="Target Unique Entities"
                        subtitle="Entities you cover that no competitor does — unique signals"
                        items={data.entityGap.targetUniqueEntities}
                        color="#0BCEBC"
                        emptyMsg="No unique entities detected"
                      />
                      <EntityList
                        title="Universal (70%+ cohort)"
                        subtitle="Entities mentioned across almost all competitors"
                        items={data.entityGap.universalEntities}
                        color="#F59E0B"
                        emptyMsg="No universal entities"
                      />
                      <EntityList
                        title="Rare (&lt;30% cohort)"
                        subtitle="Entities few competitors cover — potential differentiators"
                        items={data.entityGap.rareEntities}
                        color="#60A5FA"
                        emptyMsg="No rare entities"
                      />
                    </div>
                  </div>
                )}

                {/* Evidence Gap tab */}
                {activeTab === 'evidence' && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                    <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Evidence Density Analysis</h2>
                    <div className="mb-5 grid gap-3 sm:grid-cols-3 text-center">
                      <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-4">
                        <div className="text-2xl font-bold tabular-nums text-white">{data.evidenceGap.cohortAverageBlocks}</div>
                        <div className="mt-0.5 text-[10px] text-[#4A6280]">Cohort Avg Blocks</div>
                      </div>
                      <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-4">
                        <div className="text-2xl font-bold tabular-nums" style={{ color: data.evidenceGap.targetBlocks >= data.evidenceGap.cohortAverageBlocks ? '#0BCEBC' : '#EF4444' }}>
                          {data.evidenceGap.targetBlocks}
                        </div>
                        <div className="mt-0.5 text-[10px] text-[#4A6280]">Your Page Blocks</div>
                      </div>
                      <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-4">
                        <div className="text-2xl font-bold tabular-nums" style={{ color: data.evidenceGap.evidenceGap > 0 ? '#EF4444' : '#0BCEBC' }}>
                          {data.evidenceGap.evidenceGap > 0 ? `-${data.evidenceGap.evidenceGap.toFixed(1)}` : `+${Math.abs(data.evidenceGap.evidenceGap).toFixed(1)}`}
                        </div>
                        <div className="mt-0.5 text-[10px] text-[#4A6280]">Gap vs Cohort</div>
                      </div>
                    </div>

                    {data.evidenceGap.missingTypes.length > 0 && (
                      <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/[0.04] p-4">
                        <h3 className="mb-2 text-xs font-semibold text-red-400">Evidence Types Missing from Your Page</h3>
                        <div className="flex flex-wrap gap-2">
                          {data.evidenceGap.missingTypes.map((type) => (
                            <EvidenceTypeBadge key={type} type={type} />
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <TypeCountTable title="Cohort Evidence Types" counts={data.evidenceGap.cohortTypeCounts} />
                      <TypeCountTable title="Your Page Evidence Types" counts={data.evidenceGap.targetTypeCounts} />
                    </div>
                  </div>
                )}

                {/* Citation Opportunities tab */}
                {activeTab === 'citations' && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                    <h2 className="mb-1 text-sm font-semibold text-[#C8DFE8]">Citation Opportunities</h2>
                    <p className="mb-4 text-xs text-[#4A6280]">
                      Opportunities derived exclusively from crawled content — no invented signals (ZFDA compliant).
                    </p>
                    {data.citationOpportunities.length > 0 ? (
                      <ul className="space-y-3">
                        {data.citationOpportunities.map((opp, i) => (
                          <li key={i} className="flex items-start gap-3 rounded-lg border border-cyan/10 bg-cyan/[0.03] p-3 text-xs text-[#C8DFE8]">
                            <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan" />
                            {opp}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-[#4A6280]">
                        No citation opportunities detected. This may indicate the cohort lacked sufficient data or the target page already covers all detected gaps.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Perception layer view */}
            {viewMode === 'perception' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3 text-xs text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Perception layer data is AI-inferred and should be treated as directional guidance, not ground truth.
                    PCE Confidence: <strong>{Math.round(data.perceptionLayer.perceptionConfidence * 100)}%</strong>
                  </span>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">Inferred Theme Clusters</h2>
                  {data.perceptionLayer.inferredThemes.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {data.perceptionLayer.inferredThemes.map((theme, i) => (
                        <span
                          key={i}
                          className="rounded-full px-3 py-1 text-xs font-medium"
                          style={{ backgroundColor: 'rgba(0,200,255,0.1)', color: '#00C8FF', border: '1px solid rgba(0,200,255,0.2)' }}
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#4A6280]">No theme clusters inferred — insufficient shared content detected.</p>
                  )}
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">Inferred Opportunities</h2>
                  {data.perceptionLayer.inferredOpportunities.length > 0 ? (
                    <ul className="space-y-3">
                      {data.perceptionLayer.inferredOpportunities.map((opp, i) => (
                        <li key={i} className="flex items-start gap-3 rounded-lg border border-teal-500/10 bg-teal-500/[0.03] p-3 text-xs text-[#C8DFE8]">
                          <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-400" />
                          <span className="italic">{opp}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-[#4A6280]">No inferred opportunities — run with a richer keyword cohort for better inference.</p>
                  )}
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">Fact Layer Summary</h2>
                  <div className="grid gap-2 sm:grid-cols-3 text-center text-xs">
                    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                      <div className="text-lg font-bold text-white">{data.factLayer.extractedQuestions.length}</div>
                      <div className="text-[#4A6280]">Extracted Questions</div>
                    </div>
                    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                      <div className="text-lg font-bold text-white">{data.factLayer.extractedEntities.length}</div>
                      <div className="text-[#4A6280]">Extracted Entities</div>
                    </div>
                    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                      <div className="text-lg font-bold text-white">{data.factLayer.extractedEvidence.length}</div>
                      <div className="text-[#4A6280]">Evidence Blocks</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-[#4A6280] font-semibold">Sourced from URLs</p>
                    <ul className="space-y-1 max-h-40 overflow-y-auto">
                      {data.factLayer.sourcedFromUrls.map((url, i) => (
                        <li key={i} className="truncate text-[10px] text-[#4A6280]" title={url}>
                          {url}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
      <div className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</div>
      <div className="mt-0.5 text-[10px] font-semibold text-[#4A6280] uppercase tracking-wide">{label}</div>
      <div className="mt-0.5 text-[10px] text-[#4A6280]">{sub}</div>
    </div>
  );
}

function EntityList({
  title,
  subtitle,
  items,
  color,
  emptyMsg,
}: {
  title: string;
  subtitle: string;
  items: string[];
  color: string;
  emptyMsg: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-4">
      <h3 className="mb-0.5 text-xs font-semibold text-white">{title}</h3>
      <p className="mb-3 text-[10px] text-[#4A6280]">{subtitle}</p>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.slice(0, 15).map((name, i) => (
            <span
              key={i}
              className="rounded px-1.5 py-0.5 text-[11px]"
              style={{ color, backgroundColor: `${color}15`, border: `1px solid ${color}25` }}
            >
              {name}
            </span>
          ))}
          {items.length > 15 && (
            <span className="text-[10px] text-[#4A6280] py-0.5">+{items.length - 15} more</span>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-[#4A6280]">{emptyMsg}</p>
      )}
    </div>
  );
}

type EvidenceTypeCounts = Partial<Record<IGEEvidenceBlock['type'], number>>;

function TypeCountTable({ title, counts }: { title: string; counts: EvidenceTypeCounts }) {
  const entries = Object.entries(counts) as [IGEEvidenceBlock['type'], number][];
  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-4">
      <h3 className="mb-3 text-xs font-semibold text-white">{title}</h3>
      {entries.length > 0 ? (
        <ul className="space-y-1">
          {entries.map(([type, count]) => (
            <li key={type} className="flex items-center justify-between text-xs">
              <EvidenceTypeBadge type={type} />
              <span className="text-[#4A6280] tabular-nums">{count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[10px] text-[#4A6280]">No evidence blocks detected</p>
      )}
    </div>
  );
}
