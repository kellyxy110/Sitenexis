'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, RefreshCw, Clock, Globe, CheckCircle2, AlertCircle, Play } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { HealthScoreRing } from '@/components/health/HealthScoreRing';
import { TrendChart } from '@/components/health/TrendChart';
import { RecommendationCard, type RecommendationItem } from '@/components/health/RecommendationCard';
import { DimensionTab } from '@/components/health/DimensionTab';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LatestRun {
  id: string;
  domain: string;
  triggeredBy: string;
  status: string;
  healthScore: number | null;
  technicalSeoScore: number | null;
  aiVisibilityScore: number | null;
  entityCoverageScore: number | null;
  citationReadinessScore: number | null;
  knowledgeGraphScore: number | null;
  trustSignalsScore: number | null;
  performanceScore: number | null;
  geoScore: number | null;
  startedAt: string;
  completedAt: string | null;
  crawlRun: {
    pagesFound: number; pagesCrawled: number; pagesIndexable: number;
    crawlDurationMs: number; brokenLinksCount: number; redirectChainCount: number;
    crawlHealthScore: number;
  } | null;
  visibilityRun: {
    aiVisibilityScore: number; machineReadabilityScore: number;
    retrievalReadinessScore: number; citationProbability: number;
    semanticTrustScore: number; recommendationConfidence: number;
    retrievalQualityScore: number; surfaceCoverageScore: number;
    providerBreakdown: Record<string, number>;
  } | null;
  entityRun: {
    entitiesDetected: number; primaryEntityName: string | null;
    entityConfidenceScore: number; entityConsistencyScore: number;
    entityCoverageScore: number; disambiguationScore: number;
    sameAsLinksCount: number; authenticityScore: number;
    topEntities: Array<{ name: string; type: string; confidence: number }>;
  } | null;
  knowledgeGraphRun: {
    nodeCount: number; edgeCount: number; topicClusters: number;
    avgNodeConfidence: number; graphStrengthScore: number;
    topNodes: Array<{ label: string; type: string; confidence: number; citationReadiness: number }>;
  } | null;
  recommendations: RecommendationItem[] | null;
}

interface HistorySeries {
  date: string;
  healthScore: number | null;
  technicalSeoScore: number | null;
  aiVisibilityScore: number | null;
  entityCoverageScore: number | null;
  citationReadinessScore: number | null;
  knowledgeGraphScore: number | null;
  trustSignalsScore: number | null;
  performanceScore: number | null;
  geoScore: number | null;
}

// ─── Dimension config ─────────────────────────────────────────────────────────

const DIMENSIONS = [
  { key: 'technicalSeoScore',      label: 'Technical SEO',    color: '#00C8FF', chartKey: 'technicalSeoScore' },
  { key: 'aiVisibilityScore',      label: 'AI Visibility',    color: '#0BCEBC', chartKey: 'aiVisibilityScore' },
  { key: 'geoScore',               label: 'GEO',              color: '#A78BFA', chartKey: 'geoScore' },
  { key: 'entityCoverageScore',    label: 'Entity Coverage',  color: '#60A5FA', chartKey: 'entityCoverageScore' },
  { key: 'knowledgeGraphScore',    label: 'Knowledge Graph',  color: '#34D399', chartKey: 'knowledgeGraphScore' },
  { key: 'citationReadinessScore', label: 'Citation Ready',   color: '#FBBF24', chartKey: 'citationReadinessScore' },
  { key: 'trustSignalsScore',      label: 'Trust Signals',    color: '#F87171', chartKey: 'trustSignalsScore' },
  { key: 'performanceScore',       label: 'Performance',      color: '#FB923C', chartKey: 'performanceScore' },
] as const;

type DimensionKey = typeof DIMENSIONS[number]['key'];

// ─── Health label + color ─────────────────────────────────────────────────────

function healthColor(score: number): string {
  if (score >= 90) return '#22C55E';
  if (score >= 70) return '#0BCEBC';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

function healthLabel(score: number): string {
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type WindowOption = '7' | '30' | '90';

export default function HealthDashboardPage() {
  const [activeDimension, setActiveDimension] = useState<DimensionKey>('aiVisibilityScore');
  const [window, setWindow] = useState<WindowOption>('30');

  const { data: latestData, isLoading: latestLoading, refetch: refetchLatest } = useQuery<{ run: LatestRun | null }>({
    queryKey: ['self-audit-latest'],
    queryFn: () => fetch('/api/self-audit/latest').then((r) => r.json() as Promise<{ run: LatestRun | null }>),
    staleTime: 60_000,
    refetchInterval: 30_000,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<{ window: number; series: HistorySeries[] }>({
    queryKey: ['self-audit-history', window],
    queryFn: () => fetch(`/api/self-audit/history?window=${window}`).then((r) => r.json() as Promise<{ window: number; series: HistorySeries[] }>),
    staleTime: 120_000,
  });

  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);

  const triggerSelfAudit = useCallback(async () => {
    setTriggering(true);
    setTriggerMsg(null);
    try {
      const res = await fetch('/api/self-audit/run', { method: 'POST' });
      const data = await res.json() as { auditId?: string; error?: string; executionMode?: string };
      if (res.ok) {
        setTriggerMsg(`Self-audit started (${data.executionMode ?? 'serverless'})`);
        setTimeout(() => void refetchLatest(), 5000);
      } else {
        setTriggerMsg(data.error ?? 'Failed to trigger');
      }
    } catch {
      setTriggerMsg('Network error — could not reach API');
    } finally {
      setTriggering(false);
    }
  }, [refetchLatest]);

  const run = latestData?.run ?? null;
  const score = run?.healthScore ?? null;
  const series = historyData?.series ?? [];

  // Calculate trend vs previous data point
  const trends = useMemo(() => {
    if (series.length < 2) return {} as Record<DimensionKey, number | null>;
    const last = series[series.length - 1];
    const prev = series[series.length - 2];
    const result = {} as Record<DimensionKey, number | null>;
    for (const dim of DIMENSIONS) {
      const lastVal = last[dim.chartKey as keyof HistorySeries] as number | null;
      const prevVal = prev[dim.chartKey as keyof HistorySeries] as number | null;
      if (lastVal !== null && prevVal !== null && prevVal > 0) {
        result[dim.key] = Math.round(((lastVal - prevVal) / prevVal) * 100);
      } else {
        result[dim.key] = null;
      }
    }
    return result;
  }, [series]);

  const activeDim = DIMENSIONS.find((d) => d.key === activeDimension)!;

  // Chart series — show health score + active dimension
  const chartSeries = [
    { key: 'healthScore', label: 'Health Score', color: score !== null ? healthColor(score) : '#0BCEBC' },
    { key: activeDim.chartKey, label: activeDim.label, color: activeDim.color },
  ];

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">SiteNexis Health Monitor</h1>
              <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-400 border border-teal-500/20">LIVE</span>
            </div>
            <p className="text-sm text-[#4A6280]">
              Continuous self-audit of{' '}
              <a href="https://sitenexis.vercel.app" target="_blank" rel="noreferrer" className="text-cyan hover:underline">
                sitenexis.vercel.app
              </a>
              {' '}— the first property monitored by SiteNexis.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void triggerSelfAudit()}
              disabled={triggering}
              className="flex items-center gap-2 rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-2 text-sm font-medium text-cyan hover:bg-cyan/20 transition-colors disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              {triggering ? 'Starting...' : 'Run Self-Audit'}
            </button>
            <button
              onClick={() => void refetchLatest()}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[#7A9AB4] hover:border-white/20 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>
        {triggerMsg && (
          <p className="mb-4 text-sm text-[#7A9AB4]">{triggerMsg}</p>
        )}

        {/* Hero: Health Score + Status */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Health Score Ring */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
            <HealthScoreRing
              score={score}
              label="SiteNexis Health Score"
              color={score !== null ? healthColor(score) : '#3A5568'}
              size={200}
              loading={latestLoading}
            />
            {score !== null && (
              <div className="mt-4 flex items-center gap-2">
                <span
                  className="rounded-full px-3 py-1 text-sm font-semibold"
                  style={{ backgroundColor: `${healthColor(score)}20`, color: healthColor(score) }}
                >
                  {healthLabel(score)}
                </span>
              </div>
            )}
          </div>

          {/* Status cards */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">

            {/* Last Audit */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#4A6280]">
                <Clock className="h-3.5 w-3.5" />
                Last Audit
              </div>
              {latestLoading ? (
                <div className="space-y-2">
                  <div className="h-4 w-20 animate-pulse rounded bg-white/5" />
                  <div className="h-3 w-28 animate-pulse rounded bg-white/5" />
                </div>
              ) : run ? (
                <>
                  <p className="text-lg font-semibold text-white">
                    {run.completedAt ? formatAge(run.completedAt) : 'Running…'}
                  </p>
                  <p className="mt-0.5 text-xs text-[#4A6280]">
                    Triggered by: <span className="text-[#7A9AB4]">{run.triggeredBy}</span>
                  </p>
                </>
              ) : (
                <p className="text-sm text-[#3A5568]">No audits yet</p>
              )}
            </div>

            {/* Domain Status */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#4A6280]">
                <Globe className="h-3.5 w-3.5" />
                Domain
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-400" />
                <p className="text-sm font-semibold text-white">sitenexis.vercel.app</p>
              </div>
              {run?.crawlRun && (
                <p className="mt-1 text-xs text-[#4A6280]">
                  {run.crawlRun.pagesIndexable}/{run.crawlRun.pagesFound} pages indexable
                </p>
              )}
            </div>

            {/* Crawl Health */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#4A6280]">
                <Activity className="h-3.5 w-3.5" />
                Crawl Health
              </div>
              {run?.crawlRun ? (
                <>
                  <p className="text-lg font-bold" style={{ color: healthColor(run.crawlRun.crawlHealthScore) }}>
                    {run.crawlRun.crawlHealthScore}/100
                  </p>
                  {run.crawlRun.brokenLinksCount > 0 && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-amber-400">
                      <AlertCircle className="h-3 w-3" />
                      {run.crawlRun.brokenLinksCount} broken link{run.crawlRun.brokenLinksCount !== 1 ? 's' : ''}
                    </div>
                  )}
                </>
              ) : latestLoading ? (
                <div className="h-6 w-12 animate-pulse rounded bg-white/5" />
              ) : (
                <p className="text-sm text-[#3A5568]">—</p>
              )}
            </div>

            {/* AI Retrievability */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#4A6280]">
                <Activity className="h-3.5 w-3.5" />
                AI Retrievability
              </div>
              {run?.visibilityRun ? (
                <>
                  <p className="text-lg font-bold" style={{ color: healthColor(run.visibilityRun.retrievalReadinessScore) }}>
                    {run.visibilityRun.retrievalReadinessScore}/100
                  </p>
                  <p className="mt-0.5 text-xs text-[#4A6280]">
                    Rec. Confidence: <span className="text-[#7A9AB4]">{run.visibilityRun.recommendationConfidence}</span>
                  </p>
                </>
              ) : latestLoading ? (
                <div className="h-6 w-12 animate-pulse rounded bg-white/5" />
              ) : (
                <p className="text-sm text-[#3A5568]">—</p>
              )}
            </div>
          </div>
        </div>

        {/* Dimension tabs */}
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#C8DFE8]">Audit Dimensions</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {DIMENSIONS.map((dim) => (
              <DimensionTab
                key={dim.key}
                label={dim.label}
                score={run?.[dim.key] ?? null}
                trend={trends[dim.key]}
                active={activeDimension === dim.key}
                onClick={() => setActiveDimension(dim.key)}
                loading={latestLoading}
              />
            ))}
          </div>
        </div>

        {/* Trend chart + Historical comparison */}
        <div className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#C8DFE8]">
              Historical Trend — Health Score vs {activeDim.label}
            </h2>
            <div className="flex rounded-lg border border-white/[0.06] overflow-hidden">
              {(['7', '30', '90'] as WindowOption[]).map((w) => (
                <button
                  key={w}
                  onClick={() => setWindow(w)}
                  className={[
                    'px-3 py-1.5 text-xs font-medium transition-colors',
                    window === w
                      ? 'bg-white/[0.08] text-white'
                      : 'text-[#4A6280] hover:text-white hover:bg-white/[0.04]',
                  ].join(' ')}
                >
                  {w}d
                </button>
              ))}
            </div>
          </div>
          <TrendChart
            data={(series as unknown) as Array<{ date: string; [key: string]: number | string | null }>}
            series={chartSeries}
            height={220}
            loading={historyLoading}
          />
        </div>

        {/* Entity Intelligence + Knowledge Graph */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Entity Intelligence */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Entity Intelligence</h2>
            {run?.entityRun ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                  <span className="text-xs text-[#4A6280]">Primary Entity</span>
                  <span className="text-sm font-medium text-white">{run.entityRun.primaryEntityName ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                  <span className="text-xs text-[#4A6280]">Entities Detected</span>
                  <span className="text-sm font-medium text-white">{run.entityRun.entitiesDetected}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                  <span className="text-xs text-[#4A6280]">Confidence Score</span>
                  <span className="text-sm font-bold" style={{ color: healthColor(run.entityRun.entityConfidenceScore) }}>
                    {run.entityRun.entityConfidenceScore}/100
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                  <span className="text-xs text-[#4A6280]">Consistency Score</span>
                  <span className="text-sm font-bold" style={{ color: healthColor(run.entityRun.entityConsistencyScore) }}>
                    {run.entityRun.entityConsistencyScore}/100
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-[#4A6280]">sameAs Links</span>
                  <span className="text-sm font-medium text-white">{run.entityRun.sameAsLinksCount}</span>
                </div>
                {Array.isArray(run.entityRun.topEntities) && run.entityRun.topEntities.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/[0.04]">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#3A5568]">Top Entities</p>
                    <div className="flex flex-wrap gap-1.5">
                      {run.entityRun.topEntities.slice(0, 6).map((e) => (
                        <span key={e.name} className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[11px] text-[#7A9AB4] border border-white/[0.06]">
                          {e.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : latestLoading ? (
              <div className="space-y-2">
                {[1,2,3,4].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-white/[0.03]" />
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#3A5568]">No entity data yet</p>
            )}
          </div>

          {/* Knowledge Graph */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Knowledge Graph</h2>
            {run?.knowledgeGraphRun ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                  <span className="text-xs text-[#4A6280]">Graph Strength</span>
                  <span className="text-sm font-bold" style={{ color: healthColor(run.knowledgeGraphRun.graphStrengthScore) }}>
                    {run.knowledgeGraphRun.graphStrengthScore}/100
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                  <span className="text-xs text-[#4A6280]">Nodes</span>
                  <span className="text-sm font-medium text-white">{run.knowledgeGraphRun.nodeCount}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                  <span className="text-xs text-[#4A6280]">Edges</span>
                  <span className="text-sm font-medium text-white">{run.knowledgeGraphRun.edgeCount}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                  <span className="text-xs text-[#4A6280]">Topic Clusters</span>
                  <span className="text-sm font-medium text-white">{run.knowledgeGraphRun.topicClusters}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-[#4A6280]">Avg. Confidence</span>
                  <span className="text-sm font-medium text-white">
                    {Math.round(run.knowledgeGraphRun.avgNodeConfidence * 100)}%
                  </span>
                </div>
                {Array.isArray(run.knowledgeGraphRun.topNodes) && run.knowledgeGraphRun.topNodes.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/[0.04]">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#3A5568]">Top Nodes</p>
                    <div className="space-y-1">
                      {run.knowledgeGraphRun.topNodes.slice(0, 4).map((n) => (
                        <div key={n.label} className="flex items-center justify-between text-xs">
                          <span className="text-[#7A9AB4]">{n.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[#3A5568]">{n.type}</span>
                            <span className="tabular-nums font-medium text-white">{Math.round(n.confidence * 100)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : latestLoading ? (
              <div className="space-y-2">
                {[1,2,3,4].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-white/[0.03]" />
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#3A5568]">No graph data yet</p>
            )}
          </div>
        </div>

        {/* Recommendations */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#C8DFE8]">Recommendations</h2>
              <p className="mt-0.5 text-xs text-[#4A6280]">Every fix includes: issue · impact · action · estimated gain</p>
            </div>
            {run?.recommendations && (
              <span className="rounded-full bg-white/[0.06] px-2 py-1 text-xs text-[#7A9AB4]">
                {run.recommendations.length} finding{run.recommendations.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {latestLoading ? (
            <div className="space-y-3">
              {[1,2,3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.03]" />
              ))}
            </div>
          ) : run?.recommendations && run.recommendations.length > 0 ? (
            <div className="space-y-2">
              {run.recommendations.map((rec, i) => (
                <RecommendationCard key={rec.issue} rec={rec} index={i} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#3A5568]">
              {run ? 'No recommendations — this site is performing well.' : 'No data yet. Trigger a self-audit to generate recommendations.'}
            </p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
