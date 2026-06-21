'use client';

import { Suspense } from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion, useInView } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts';
import { IssuesTable } from '@/components/IssuesTable';
import { AuditProgress } from '@/components/AuditProgress';
import { LinkGraph } from '@/components/LinkGraph';
import type { SEOIssue, InternalLinkGraph } from '@sitenexis/shared';

// ─── Lazy tab content helpers ─────────────────────────────────────────────────

// (Tabs are defined inline below — heavy charting is deferred via lazy)

// ─── Types (from API response) ────────────────────────────────────────────────

interface AuditData {
  id: string;
  domain: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  pageCount: number | null;
  completedAt: string | null;
  scores: {
    overall: number;
    seoScore: number;
    aiScore: number;
    schemaScore: number;
    linkGraphScore: number;
    performanceScore: number;
    breakdown: {
      seo: {
        titleOptimisation: number;
        metaOptimisation: number;
        headingStructure: number;
        canonicalisation: number;
        crawlability: number;
        imageOptimisation: number;
      };
      ai: {
        entityClarity: number;
        conversationalReadiness: number;
        aiExtractability: number;
        knowledgeGraphStructure: number;
      };
      machineReadability?: {
        renderingFidelity: number;
        boilerplateRatio: number;
        chunkBoundaryQuality: number;
        signalToNoiseRatio: number;
        headingHierarchy: number;
        readingOrderConsistency: number;
        linkAnchorQuality: number;
      };
      entityIntelligence?: {
        entityConfidenceScore: number;
        entityConsistencyScore: number;
        entityCoverageScore: number;
        disambiguationScore: number;
      };
      citationAnalysis?: {
        citationProbabilityScore: number;
      };
      semanticTrust?: {
        score: number;
        breakdown: {
          authorshipTrust: number;
          organisationalTrust: number;
          contentTrust: number;
          structuralTrust: number;
        };
      };
      performance: {
        lcp: number | null;
        cls: number | null;
        ttfb: number | null;
      };
    };
  } | null;
  issues: Array<SEOIssue & { module?: string }>;
  pages: Array<{
    url: string;
    statusCode: number;
    title: string | null;
    metaDescription: string | null;
    h1: string | null;
    canonicalUrl: string | null;
    wordCount: number;
    isIndexable: boolean;
    internalLinks: number;
    externalLinks: number;
    seoScore: number | null;
    aiScore: number | null;
    responseTimeMs?: number;
    schemaData?: unknown[];
  }>;
  linkGraph?: InternalLinkGraph | null;
  aiVisibilityScores?: {
    aiVisibilityScore: number;
    entityConfidenceScore: number;
    citationProbabilityScore: number;
    machineReadabilityScore: number;
    semanticTrustScore: number;
    retrievalReadinessScore: number;
    recommendationConfidenceScore: number;
  } | null;
}

const TAB_IDS = [
  'pages',
  'action-plan',
  'seo', 'ai', 'machine-readability', 'entity', 'citation', 'semantic-trust',
  'schema', 'links', 'content', 'performance',
  'retrieval', 'machine-trust', 'temporal', 'surfaces', 'authenticity', 'perception-graph',
] as const;
type TabId = typeof TAB_IDS[number];
const TAB_LABELS: Record<TabId, string> = {
  pages: 'Pages',
  'action-plan': 'Action Plan',
  seo: 'SEO',
  ai: 'AI Readability',
  'machine-readability': 'Machine Readability',
  entity: 'Entity Intelligence',
  citation: 'Citation Probability',
  'semantic-trust': 'Semantic Trust',
  schema: 'Schema',
  links: 'Link Graph',
  content: 'Content',
  performance: 'Performance',
  retrieval: 'Retrieval Simulation',
  'machine-trust': 'Machine Trust',
  temporal: 'Temporal Authority',
  surfaces: 'Recommendation Surfaces',
  authenticity: 'Entity Authenticity',
  'perception-graph': 'Perception Graph',
};


// ─── v3 data types ───────────────────────────────────────────────────────────

interface RetrievalData {
  auditId: string;
  avgRetrievalQualityScore: number | null;
  pagesSimulated: number;
  results: Array<{
    pageUrl: string; simulated: boolean;
    retrievalQualityScore: number | null; chunkStabilityIndex: number | null;
    answerFormationProbability: number | null; summarisationLossScore: number | null;
    citationEligibilityScore: number | null; fragileClaimsCount: number;
    retrievalFailureReasons: Array<{ stage: string; description: string; severity: string; recommendation: string }>;
    truncationZoneWarnings: string[];
  }>;
}

interface MachineTrustData {
  auditId: string; overall: number;
  entityCredibilityScore: number; schemaTrustAlignmentScore: number;
  externalValidationScore: number; contradictionAbsenceScore: number | null;
  trustDegradationResistance: number; crossSourceValidationIndex: number;
  trustIssues: Array<{ type: string; severity: string; entity: string; description: string; recommendation: string }>;
  degradationSignals: Array<{ signalType: string; entity: string; previousValue: string; currentValue: string; severityImpact: number }>;
}

interface TemporalData {
  auditId: string; isBaseline: boolean;
  authorityVelocityScore: number | null; trustStabilityIndex: number;
  contentFreshnessImpactFactor: number; semanticDriftIndex: number;
  updateFrequencyClassification: string; stalePagesAtRisk: string[];
  driftedPages: Array<{ pageUrl: string; driftScore: number; previousTopicCluster: string; currentTopicCluster: string }>;
  temporalIssues: Array<{ type: string; severity: string; pageUrl: string; description: string; recommendation: string }>;
}

interface SurfacesData {
  auditId: string; overallSurfaceScore: number;
  surfaces: {
    aiOverviews: { inclusionProbability: number; status: string; blockers: Array<{ type: string; description: string; recommendation: string }>; recommendations: string[] };
    chatRecommendation: { inclusionProbability: number; status: string; blockers: Array<{ type: string; description: string; recommendation: string }>; recommendations: string[] };
    voiceRetrieval: { inclusionProbability: number; status: string; blockers: Array<{ type: string; description: string; recommendation: string }>; recommendations: string[] };
    agentDiscovery: { inclusionProbability: number; status: string; blockers: Array<{ type: string; description: string; recommendation: string }>; recommendations: string[] };
  };
  coverageGaps: Array<{ surface: string; missedOpportunity: string; requiredSignals: string[]; estimatedImpact: string }>;
  missingVisibilityChannels: string[];
}

interface AuthenticityData {
  auditId: string; syntheticRiskScore: number;
  entityAuthenticityConfidence: number; networkIntegrityScore: number;
  detectedPatterns: Array<{ patternType: string; confidence: number; evidence: string[]; affectedEntities: string[]; severity: string }>;
  flaggedEntities: Array<{ entityName: string; flagReason: string; confidence: number }>;
  recommendations: string[];
}

interface PerceptionGraphData {
  auditId: string;
  nodes: Array<{ id: string; type: string; label: string; confidence: number; citationReadiness: number; disambiguationStrength: number; supportingPages: string[] }>;
  edges: Array<{ source: string; target: string; relationshipType: string; strength: number; evidencedBy: string[] }>;
}

interface SchemaApiData {
  schemaScore: number | null;
  coverage: number | null;
  snippets: Array<{ url: string; schemaType: string; snippet: string; isNew: boolean }>;
  totalPages: number;
  pagesWithSchema: number;
}

interface SseData {
  auditId: string;
  topicalAuthorityScore: number;
  taBreakdown: { depth: number; breadth: number; interlinking: number; freshness: number };
  semanticDensityScore: number;
  sdsRawDensity: number;
  sdsBreakdown: { entityCount: number; factCount: number; relationshipCount: number; totalWords: number };
  aiCrawlabilityScore: number;
  aciBreakdown: { robots: number; sitemap: number; renderability: number; indexability: number };
  geoScore: number;
  snsMasterScore: number;
  snsLabel: string;
}

// ─── Score helpers ────────────────────────────────────────────────────────────

function scoreColor(score: number | null | undefined): string {
  if (score == null) return '#4A6280';
  if (score >= 80)   return '#22C55E';
  if (score >= 50)   return '#F59E0B';
  return '#EF4444';
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Good';
  if (score >= 50) return 'Needs Work';
  return 'Critical';
}

// ─── Animated gauge ───────────────────────────────────────────────────────────

function ScoreGauge({ label, score }: { label: string; score: number | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);
  const s = score ?? 0;

  useEffect(() => {
    if (!inView) return;
    let v = 0;
    const step = s / 60;
    const id = setInterval(() => {
      v += step;
      if (v >= s) { setCount(s); clearInterval(id); } else setCount(Math.round(v));
    }, 16);
    return () => clearInterval(id);
  }, [inView, s]);

  const r = 46;
  const circ = 2 * Math.PI * r;
  const color = scoreColor(score);

  return (
    <div ref={ref} className="flex flex-col items-center gap-1.5 sm:gap-2">
      <div className="relative flex h-20 w-20 sm:h-28 sm:w-28 items-center justify-center">
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 112 112">
          <circle cx="56" cy="56" r={r} fill="none" stroke={color} strokeWidth="5" strokeOpacity="0.15" />
          <motion.circle
            cx="56" cy="56" r={r}
            fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={inView ? { strokeDashoffset: circ * (1 - s / 100) } : {}}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="relative text-center">
          <span className="block text-lg sm:text-2xl font-bold text-white tabular-nums">{count}</span>
          {score != null && (
            <span className="block text-[9px] sm:text-[10px] font-medium" style={{ color }}>
              {scoreLabel(score)}
            </span>
          )}
        </div>
      </div>
      <span className="text-xs text-[#4A6280] text-center">{label}</span>
    </div>
  );
}

// ─── CWV indicator ────────────────────────────────────────────────────────────

function CwvBadge({ label, value, unit, good, needsWork }: {
  label: string; value: number | null; unit: string; good: number; needsWork: number;
}) {
  const status = value == null ? 'n/a' : value <= good ? 'good' : value <= needsWork ? 'needs-improvement' : 'poor';
  const colors = { good: 'text-green-400 bg-green-500/10', 'needs-improvement': 'text-amber-400 bg-amber-500/10', poor: 'text-red-400 bg-red-500/10', 'n/a': 'text-[#4A6280] bg-white/5' };
  const labels = { good: 'Good', 'needs-improvement': 'Needs Work', poor: 'Poor', 'n/a': 'N/A' };

  return (
    <div className={`flex flex-col items-center rounded-xl border border-white/10 p-5 ${colors[status]}`}>
      <span className="text-3xl font-bold tabular-nums">
        {value != null ? `${typeof value === 'number' && unit === 's' ? value.toFixed(1) : Math.round(value)}${unit}` : '—'}
      </span>
      <span className="mt-1 text-sm font-semibold">{label}</span>
      <span className="mt-1 text-xs opacity-70">{labels[status]}</span>
    </div>
  );
}

// ─── SSE sub-metric bar ───────────────────────────────────────────────────────

function BarMini({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? '#22C55E' : value >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <div>
      <div className="flex justify-between mb-0.5">
        <span className="text-[10px] text-[#4A6280]">{label}</span>
        <span className="text-[10px] font-medium" style={{ color }}>{value}</span>
      </div>
      <div className="h-1 w-full rounded-full bg-white/10">
        <div className="h-1 rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

function InlineMetric({ label, value }: { label: string; value: number | null }) {
  const display = value != null ? Math.round(value) : '—';
  const color = value == null ? '#4A6280' : value >= 80 ? '#22C55E' : value >= 60 ? '#0BCEBC' : value >= 40 ? '#F59E0B' : '#EF4444';
  const pct = value != null ? Math.min(value, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-[#4A6280] min-w-[110px]">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/10">
        <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] font-semibold tabular-nums w-7 text-right" style={{ color }}>{display}</span>
    </div>
  );
}

// ─── Tab content components ───────────────────────────────────────────────────

function SeoTab({ data }: { data: AuditData }) {
  const breakdown = data.scores?.breakdown.seo;
  const barData = breakdown ? [
    { name: 'Title',       score: Math.round(breakdown.titleOptimisation) },
    { name: 'Meta',        score: Math.round(breakdown.metaOptimisation) },
    { name: 'Headings',    score: Math.round(breakdown.headingStructure) },
    { name: 'Canonical',   score: Math.round(breakdown.canonicalisation) },
    { name: 'Crawlability',score: Math.round(breakdown.crawlability) },
    { name: 'Images',      score: Math.round(breakdown.imageOptimisation) },
  ] : [];

  const seoIssues = data.issues.filter((i) => !i.module || i.module === 'seo') as SEOIssue[];
  const quickWins = seoIssues.filter((i) => i.severity === 'warning').slice(0, 3);

  return (
    <div className="space-y-8">
      {breakdown && (
        <div className="card-glass rounded-xl p-5">
          <h3 className="mb-4 font-semibold text-white">SEO Score Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} layout="vertical" barSize={16}>
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#4A6280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#4A6280', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                contentStyle={{ background: '#0A1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {barData.map((entry, i) => <Cell key={i} fill={scoreColor(entry.score)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {quickWins.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <h3 className="mb-3 font-semibold text-amber-400">⚡ Quick Wins</h3>
          <div className="space-y-2">
            {quickWins.map((issue, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="shrink-0 text-amber-400">→</span>
                <span className="text-white">{issue.recommendation}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <IssuesTable issues={seoIssues} auditId={data.id} pages={data.pages} />
    </div>
  );
}

function AiTab({ data }: { data: AuditData }) {
  const bd = data.scores?.breakdown.ai;
  const radarData = bd ? [
    { subject: 'Entity Clarity',   score: bd.entityClarity },
    { subject: 'Conversational',   score: bd.conversationalReadiness },
    { subject: 'Extractability',   score: bd.aiExtractability },
    { subject: 'Knowledge Graph',  score: bd.knowledgeGraphStructure },
  ] : [];

  return (
    <div className="space-y-8">
      {bd && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Radar */}
          <div className="card-glass rounded-xl p-5">
            <h3 className="mb-4 font-semibold text-white">Dimension Radar</h3>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1E3A5F" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#4A6280', fontSize: 10 }} />
                <Radar dataKey="score" fill="#00C8FF" fillOpacity={0.15} stroke="#00C8FF" strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Dimension scores */}
          <div className="card-glass rounded-xl p-5 space-y-3">
            <h3 className="mb-4 font-semibold text-white">Dimension Scores</h3>
            {radarData.map((d) => (
              <div key={d.subject}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-[#4A6280]">{d.subject}</span>
                  <span className="font-semibold text-white">{Math.round(d.score)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-cyan transition-all"
                    style={{ width: `${Math.min(100, d.score)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Page scores table */}
      <div className="card-glass rounded-xl overflow-hidden">
        <div className="border-b border-white/10 px-5 py-3">
          <h3 className="font-semibold text-white">Page AI Scores</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#4A6280]">Page URL</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#4A6280]">AI Score</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#4A6280]">SEO Score</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#4A6280]">Words</th>
              </tr>
            </thead>
            <tbody>
              {data.pages.slice(0, 20).map((p, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="max-w-xs truncate px-5 py-3 text-xs text-[#4A6280]">{p.url}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs font-semibold" style={{ color: scoreColor(p.aiScore) }}>
                      {p.aiScore != null ? Math.round(p.aiScore) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs font-semibold" style={{ color: scoreColor(p.seoScore) }}>
                      {p.seoScore != null ? Math.round(p.seoScore) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-[#4A6280]">{p.wordCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SchemaTab({ data, schemaApi, schemaApiLoading }: { data: AuditData; schemaApi?: SchemaApiData; schemaApiLoading?: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);
  const schemaIssues = (data.issues.filter((i) => i.module === 'schema') as SEOIssue[]);

  const detectedTypes = Array.from(new Set(
    data.pages.flatMap((p) =>
      (p.schemaData as Array<Record<string, unknown>> | undefined ?? [])
        .map((s) => String(s['@type'] ?? ''))
        .filter(Boolean)
    )
  ));

  // Real snippets from AI analysis, grouped by schema type
  const snippetsByType = (schemaApi?.snippets ?? []).reduce<Record<string, SchemaApiData['snippets']>>((acc, s) => {
    if (!acc[s.schemaType]) acc[s.schemaType] = [];
    acc[s.schemaType]!.push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {/* Coverage summary */}
      {schemaApi && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card-glass rounded-xl p-4 text-center">
            <span className="text-2xl font-bold text-white">{schemaApi.pagesWithSchema}</span>
            <p className="mt-1 text-xs text-[#4A6280]">Pages with schema</p>
          </div>
          <div className="card-glass rounded-xl p-4 text-center">
            <span className="text-2xl font-bold text-white">{schemaApi.totalPages}</span>
            <p className="mt-1 text-xs text-[#4A6280]">Total pages</p>
          </div>
          <div className="card-glass rounded-xl p-4 text-center">
            <span className="text-2xl font-bold" style={{ color: scoreColor(schemaApi.schemaScore) }}>
              {schemaApi.schemaScore ?? '—'}
            </span>
            <p className="mt-1 text-xs text-[#4A6280]">Schema score</p>
          </div>
        </div>
      )}

      {detectedTypes.length > 0 && (
        <div className="card-glass rounded-xl p-5">
          <h3 className="mb-3 font-semibold text-white">Detected Schema Types</h3>
          <div className="flex flex-wrap gap-2">
            {detectedTypes.map((t) => (
              <span key={t} className="rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-xs font-medium text-teal">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      <IssuesTable issues={schemaIssues} auditId={data.id} pages={data.pages} />

      {/* Real AI-generated snippets */}
      {schemaApiLoading ? (
        <div className="card-glass rounded-xl p-8 text-center">
          <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
          <p className="mt-3 text-sm text-[#4A6280]">Loading generated schema snippets…</p>
        </div>
      ) : Object.keys(snippetsByType).length > 0 ? (
        Object.entries(snippetsByType).map(([type, typeSnippets]) => (
          <div key={type} className="card-glass rounded-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{type}</span>
                {typeSnippets.some((s) => s.isNew) && (
                  <span className="rounded-full bg-cyan/10 border border-cyan/20 px-2 py-0.5 text-[10px] font-semibold text-cyan">NEW</span>
                )}
              </div>
              <button
                onClick={() => {
                  const snippet = typeSnippets[0]?.snippet ?? '';
                  void navigator.clipboard.writeText(snippet);
                  setCopied(type);
                  setTimeout(() => setCopied(null), 1500);
                }}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  copied === type ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-[#4A6280] hover:text-white'
                }`}
              >
                {copied === type ? 'Copied!' : 'Copy'}
              </button>
            </div>
            {typeSnippets.slice(0, 2).map((s, i) => (
              <div key={i} className="border-b border-white/[0.03] last:border-0">
                {typeSnippets.length > 1 && (
                  <p className="px-5 pt-3 text-[11px] text-[#4A6280] truncate">{s.url}</p>
                )}
                <pre className="overflow-x-auto p-5 text-xs text-[#6B9BB0] leading-relaxed font-mono">
                  {s.snippet}
                </pre>
              </div>
            ))}
          </div>
        ))
      ) : detectedTypes.length > 0 ? (
        // Fallback: show template snippets for detected types when no AI snippets available
        detectedTypes.slice(0, 3).map((type) => {
          const snippet = generateSnippetPreview(type);
          return (
            <div key={type} className="card-glass rounded-xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
                <span className="text-sm font-semibold text-white">{type} — Template</span>
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(snippet);
                    setCopied(type);
                    setTimeout(() => setCopied(null), 1500);
                  }}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                    copied === type ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-[#4A6280] hover:text-white'
                  }`}
                >
                  {copied === type ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="overflow-x-auto p-5 text-xs text-[#4A6280] leading-relaxed font-mono">
                {snippet}
              </pre>
            </div>
          );
        })
      ) : null}
    </div>
  );
}

function ContentTab({ data }: { data: AuditData }) {
  const thinPages = data.pages.filter((p) => p.wordCount < 300);

  return (
    <div className="space-y-8">
      <div className="card-glass rounded-xl overflow-hidden">
        <div className="border-b border-white/10 px-5 py-3">
          <h3 className="font-semibold text-white">Content Quality per Page</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-3 text-left text-xs font-semibold text-[#4A6280]">Page URL</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#4A6280]">Word Count</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[#4A6280]">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.pages.slice(0, 30).map((p, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="max-w-xs truncate px-5 py-3 text-xs text-[#4A6280]">{p.url}</td>
                  <td className="px-4 py-3 text-center text-xs text-white tabular-nums">{p.wordCount}</td>
                  <td className="px-4 py-3 text-center">
                    {p.wordCount < 300 ? (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-400">Thin</span>
                    ) : p.wordCount < 600 ? (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">Low</span>
                    ) : (
                      <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-400">Good</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {thinPages.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
          <h3 className="mb-3 font-semibold text-red-400">Thin Content Pages ({thinPages.length})</h3>
          <ul className="space-y-1">
            {thinPages.slice(0, 10).map((p, i) => (
              <li key={i} className="text-xs text-[#4A6280]">
                {p.url} — <span className="text-red-400">{p.wordCount} words</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Pages Tab — URL Inventory ───────────────────────────────────────────────

type PageRow = AuditData['pages'][number];

function statusBadge(code: number) {
  if (code >= 200 && code < 300) return 'text-green-400 bg-green-500/10';
  if (code >= 300 && code < 400) return 'text-amber-400 bg-amber-500/10';
  return 'text-red-400 bg-red-500/10';
}

function signalDot(ok: boolean) {
  return ok
    ? <span className="h-2 w-2 rounded-full bg-green-400 shrink-0" title="Present" />
    : <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" title="Missing" />;
}

function PageDrillDown({ page, issues }: { page: PageRow; issues: Array<SEOIssue & { module?: string }> }) {
  const pageIssues = issues.filter((i) => {
    const iUrl = (i.url ?? '').replace(/\/$/, '');
    const pUrl = page.url.replace(/\/$/, '');
    return iUrl === pUrl;
  });
  const critical = pageIssues.filter((i) => i.severity === 'critical');
  const warnings = pageIssues.filter((i) => i.severity === 'warning');
  const info = pageIssues.filter((i) => i.severity === 'info');

  return (
    <div className="border-t border-white/5 bg-[#070F1A] px-5 py-5 space-y-5">
      {/* SEO Signals */}
      <div>
        <h4 className="text-[10px] font-semibold uppercase tracking-widest text-[#4A6280] mb-3">SEO Signals</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-center gap-2 mb-1">
              {signalDot(!!page.title)}
              <span className="text-[10px] font-semibold uppercase text-[#4A6280]">Title</span>
            </div>
            {page.title
              ? <p className="text-xs text-white break-all">{page.title}</p>
              : <p className="text-xs text-red-400">Missing — no {'<title>'} tag detected</p>
            }
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-center gap-2 mb-1">
              {signalDot(!!page.h1)}
              <span className="text-[10px] font-semibold uppercase text-[#4A6280]">H1</span>
            </div>
            {page.h1
              ? <p className="text-xs text-white break-all">{page.h1}</p>
              : <p className="text-xs text-red-400">Missing — no {'<h1>'} tag detected</p>
            }
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-center gap-2 mb-1">
              {signalDot(!!page.metaDescription)}
              <span className="text-[10px] font-semibold uppercase text-[#4A6280]">Meta Description</span>
            </div>
            {page.metaDescription
              ? <p className="text-xs text-[#C8DFE8] line-clamp-2">{page.metaDescription}</p>
              : <p className="text-xs text-red-400">Missing</p>
            }
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-center gap-2 mb-1">
              {signalDot(!!page.canonicalUrl)}
              <span className="text-[10px] font-semibold uppercase text-[#4A6280]">Canonical</span>
            </div>
            {page.canonicalUrl
              ? <p className="text-xs text-[#C8DFE8] break-all">{page.canonicalUrl}</p>
              : <p className="text-xs text-red-400">Missing — no canonical tag</p>
            }
          </div>
        </div>
      </div>

      {/* Page Stats */}
      <div className="flex flex-wrap gap-4 text-xs text-[#4A6280]">
        <span>Words: <strong className="text-white">{page.wordCount}</strong></span>
        <span>Internal links: <strong className="text-white">{page.internalLinks}</strong></span>
        <span>External links: <strong className="text-white">{page.externalLinks}</strong></span>
        <span>Indexable: <strong className={page.isIndexable ? 'text-green-400' : 'text-red-400'}>{page.isIndexable ? 'Yes' : 'No'}</strong></span>
        <span>Schema: <strong className="text-white">{(page.schemaData as unknown[] ?? []).length > 0 ? 'Yes' : 'No'}</strong></span>
      </div>

      {/* Issues for this page */}
      {pageIssues.length > 0 ? (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-widest text-[#4A6280] mb-3">
            Issues on this page ({critical.length} critical · {warnings.length} warnings · {info.length} info)
          </h4>
          <div className="space-y-2">
            {pageIssues.map((issue, i) => {
              const sevStyle = issue.severity === 'critical'
                ? 'border-red-500/20 bg-red-500/[0.04]'
                : issue.severity === 'warning'
                ? 'border-amber-500/20 bg-amber-500/[0.04]'
                : 'border-blue-500/20 bg-blue-500/[0.04]';
              const sevColor = issue.severity === 'critical' ? 'text-red-400'
                : issue.severity === 'warning' ? 'text-amber-400' : 'text-blue-400';

              return (
                <div key={i} className={`rounded-lg border p-3 ${sevStyle}`}>
                  <div className="flex items-start gap-2">
                    <span className={`text-[10px] font-semibold uppercase shrink-0 mt-0.5 ${sevColor}`}>
                      {issue.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium">{issue.message}</p>
                      {issue.problem && (
                        <p className="mt-1.5 text-xs text-[#4A6280]">
                          <strong className="text-[#7A9AB4]">Problem:</strong> {issue.problem}
                        </p>
                      )}
                      {issue.solution && (
                        <p className="mt-1 text-xs text-[#4A6280]">
                          <strong className="text-[#7A9AB4]">Fix:</strong> {issue.solution}
                        </p>
                      )}
                      {!issue.solution && issue.recommendation && (
                        <p className="mt-1 text-xs text-[#4A6280]">
                          <strong className="text-[#7A9AB4]">Recommendation:</strong> {issue.recommendation}
                        </p>
                      )}
                      {issue.fixCode && (
                        <pre className="mt-2 overflow-x-auto rounded bg-[#020A16] p-2 text-[10px] text-[#6B9BB0] font-mono whitespace-pre-wrap max-h-24">
                          {issue.fixCode}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-green-400">
          <span className="h-2 w-2 rounded-full bg-green-400" />
          No issues detected on this page
        </div>
      )}

      {/* Open page link */}
      <a
        href={page.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-cyan hover:underline"
      >
        Open page ↗
      </a>
    </div>
  );
}

function PagesTab({ data }: { data: AuditData }) {
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'url' | 'seo' | 'ai' | 'issues' | 'words'>('issues');
  const [sortDesc, setSortDesc] = useState(true);

  const issuesByUrl = useMemo(() => {
    const map: Record<string, { critical: number; warning: number; info: number; total: number }> = {};
    for (const issue of data.issues) {
      const url = (issue.url ?? '').replace(/\/$/, '');
      if (!url) continue;
      if (!map[url]) map[url] = { critical: 0, warning: 0, info: 0, total: 0 };
      map[url]![issue.severity]++;
      map[url]!.total++;
    }
    return map;
  }, [data.issues]);

  const rows = useMemo(() => {
    let filtered = data.pages;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((p) => p.url.toLowerCase().includes(q));
    }
    const sorted = [...filtered].sort((a, b) => {
      const aUrl = a.url.replace(/\/$/, '');
      const bUrl = b.url.replace(/\/$/, '');
      let cmp = 0;
      switch (sortKey) {
        case 'url': cmp = aUrl.localeCompare(bUrl); break;
        case 'seo': cmp = (a.seoScore ?? -1) - (b.seoScore ?? -1); break;
        case 'ai': cmp = (a.aiScore ?? -1) - (b.aiScore ?? -1); break;
        case 'issues': cmp = (issuesByUrl[aUrl]?.total ?? 0) - (issuesByUrl[bUrl]?.total ?? 0); break;
        case 'words': cmp = a.wordCount - b.wordCount; break;
      }
      return sortDesc ? -cmp : cmp;
    });
    return sorted;
  }, [data.pages, search, sortKey, sortDesc, issuesByUrl]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  };

  const sortArrow = (key: typeof sortKey) => {
    if (sortKey !== key) return <span className="opacity-30 ml-0.5">↕</span>;
    return sortDesc ? <span className="ml-0.5">↓</span> : <span className="ml-0.5">↑</span>;
  };

  const totalCritical = data.issues.filter((i) => i.severity === 'critical').length;
  const totalWarnings = data.issues.filter((i) => i.severity === 'warning').length;
  const totalInfo = data.issues.filter((i) => i.severity === 'info').length;

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
          <span className="text-2xl font-bold text-white tabular-nums">{data.pages.length}</span>
          <div className="text-[10px] text-[#4A6280]">Pages Crawled</div>
        </div>
        <div className="rounded-xl border border-red-500/10 bg-red-500/[0.03] p-4 text-center">
          <span className="text-2xl font-bold text-red-400 tabular-nums">{totalCritical}</span>
          <div className="text-[10px] text-[#4A6280]">Critical Issues</div>
        </div>
        <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.03] p-4 text-center">
          <span className="text-2xl font-bold text-amber-400 tabular-nums">{totalWarnings}</span>
          <div className="text-[10px] text-[#4A6280]">Warnings</div>
        </div>
        <div className="rounded-xl border border-blue-500/10 bg-blue-500/[0.03] p-4 text-center">
          <span className="text-2xl font-bold text-blue-400 tabular-nums">{totalInfo}</span>
          <div className="text-[10px] text-[#4A6280]">Info</div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by URL..."
          className="flex-1 max-w-sm rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-[#4A6280] outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 transition-colors"
        />
        <span className="text-xs text-[#4A6280]">
          {rows.length === data.pages.length ? `${rows.length} pages` : `${rows.length} of ${data.pages.length}`}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-white/10">
        {/* Header */}
        <div className="flex items-center border-b border-white/10 bg-[#050B09] px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#4A6280]">
          <button onClick={() => toggleSort('url')} className="flex-1 min-w-0 text-left flex items-center gap-1 hover:text-white transition-colors">
            URL {sortArrow('url')}
          </button>
          <button onClick={() => toggleSort('seo')} className="w-14 text-center flex items-center justify-center gap-0.5 hover:text-white transition-colors">
            SEO {sortArrow('seo')}
          </button>
          <button onClick={() => toggleSort('ai')} className="w-14 text-center flex items-center justify-center gap-0.5 hover:text-white transition-colors">
            AI {sortArrow('ai')}
          </button>
          <button onClick={() => toggleSort('issues')} className="w-24 text-center flex items-center justify-center gap-0.5 hover:text-white transition-colors">
            Issues {sortArrow('issues')}
          </button>
          <button onClick={() => toggleSort('words')} className="w-16 text-center flex items-center justify-center gap-0.5 hidden sm:flex hover:text-white transition-colors">
            Words {sortArrow('words')}
          </button>
          <div className="w-28 text-center hidden md:block">Signals</div>
          <div className="w-14 text-center">Status</div>
        </div>

        {/* Rows */}
        <div>
          {rows.map((page, idx) => {
            const normalUrl = page.url.replace(/\/$/, '');
            const counts = issuesByUrl[normalUrl];
            const expanded = expandedUrl === page.url;
            return (
              <div key={page.url}>
                <div
                  onClick={() => setExpandedUrl(expanded ? null : page.url)}
                  className={[
                    'flex items-center px-4 py-3 cursor-pointer border-b border-white/5 transition-colors',
                    expanded ? 'bg-[#0A1628]' : idx % 2 === 1 ? 'bg-[#050B09]/50 hover:bg-white/[0.03]' : 'hover:bg-white/[0.03]',
                  ].join(' ')}
                >
                  {/* URL */}
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-xs text-white truncate" title={page.url}>
                      {page.url.replace(/^https?:\/\/[^/]+/, '')}
                    </span>
                    {!page.isIndexable && (
                      <span className="shrink-0 rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] text-red-400 font-semibold">NOINDEX</span>
                    )}
                  </div>

                  {/* SEO Score */}
                  <div className="w-14 text-center">
                    <span className="text-xs font-semibold tabular-nums" style={{ color: scoreColor(page.seoScore) }}>
                      {page.seoScore != null ? Math.round(page.seoScore) : '—'}
                    </span>
                  </div>

                  {/* AI Score */}
                  <div className="w-14 text-center">
                    <span className="text-xs font-semibold tabular-nums" style={{ color: scoreColor(page.aiScore) }}>
                      {page.aiScore != null ? Math.round(page.aiScore) : '—'}
                    </span>
                  </div>

                  {/* Issue counts */}
                  <div className="w-24 flex items-center justify-center gap-1">
                    {counts && counts.total > 0 ? (
                      <>
                        {counts.critical > 0 && <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">{counts.critical}</span>}
                        {counts.warning > 0 && <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">{counts.warning}</span>}
                        {counts.info > 0 && <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">{counts.info}</span>}
                      </>
                    ) : (
                      <span className="text-[10px] text-green-400">✓</span>
                    )}
                  </div>

                  {/* Word count */}
                  <div className="w-16 text-center hidden sm:block">
                    <span className={`text-xs tabular-nums ${page.wordCount < 300 ? 'text-red-400' : 'text-[#4A6280]'}`}>
                      {page.wordCount}
                    </span>
                  </div>

                  {/* SEO signals dots */}
                  <div className="w-28 hidden md:flex items-center justify-center gap-1.5" title={`Title: ${page.title ? '✓' : '✗'} | H1: ${page.h1 ? '✓' : '✗'} | Meta: ${page.metaDescription ? '✓' : '✗'} | Canonical: ${page.canonicalUrl ? '✓' : '✗'}`}>
                    {signalDot(!!page.title)}
                    {signalDot(!!page.h1)}
                    {signalDot(!!page.metaDescription)}
                    {signalDot(!!page.canonicalUrl)}
                  </div>

                  {/* Status code */}
                  <div className="w-14 text-center">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusBadge(page.statusCode)}`}>
                      {page.statusCode}
                    </span>
                  </div>
                </div>

                {/* Drill-down */}
                {expanded && <PageDrillDown page={page} issues={data.issues} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Signals legend */}
      <div className="flex items-center gap-4 text-[10px] text-[#4A6280]">
        <span className="font-semibold">Signal dots:</span>
        <span className="flex items-center gap-1">{signalDot(true)} Title</span>
        <span className="flex items-center gap-1">{signalDot(true)} H1</span>
        <span className="flex items-center gap-1">{signalDot(true)} Meta Desc</span>
        <span className="flex items-center gap-1">{signalDot(true)} Canonical</span>
      </div>
    </div>
  );
}

function PerformanceTab({ data }: { data: AuditData }) {
  const bd = data.scores?.breakdown.performance;
  const perfIssues = data.issues.filter((i) => i.module === 'performance') as SEOIssue[];

  const avgResponseMs = data.pages.length
    ? Math.round(data.pages.reduce((s, p) => s + (p.responseTimeMs ?? 0), 0) / data.pages.length)
    : null;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <CwvBadge label="LCP" value={bd?.lcp ?? null} unit="s" good={2.5} needsWork={4} />
        <CwvBadge label="CLS" value={bd?.cls ?? null} unit="" good={0.1} needsWork={0.25} />
        <CwvBadge label="TTFB" value={bd?.ttfb ?? null} unit="ms" good={800} needsWork={1800} />
        <CwvBadge label="Avg Response" value={avgResponseMs} unit="ms" good={800} needsWork={2000} />
      </div>

      <IssuesTable issues={perfIssues} auditId={data.id} pages={data.pages} />
    </div>
  );
}

// ─── Machine Readability Tab ──────────────────────────────────────────────────

function MachineReadabilityTab({ data }: { data: AuditData }) {
  const bd = data.scores?.breakdown.machineReadability;
  const mrIssues = data.issues.filter((i) => i.module === 'machine-readability') as SEOIssue[];

  const stageData = bd ? [
    { name: 'Rendering',    score: Math.round(bd.renderingFidelity) },
    { name: 'Boilerplate',  score: Math.round(bd.boilerplateRatio) },
    { name: 'Chunk Quality',score: Math.round(bd.chunkBoundaryQuality) },
    { name: 'Signal/Noise', score: Math.round(bd.signalToNoiseRatio) },
    { name: 'Headings',     score: Math.round(bd.headingHierarchy) },
    { name: 'Read Order',   score: Math.round(bd.readingOrderConsistency) },
    { name: 'Anchors',      score: Math.round(bd.linkAnchorQuality) },
  ] : [];

  if (!bd) {
    return (
      <div className="card-glass rounded-xl p-8 text-center">
        <p className="text-[#4A6280]">Machine readability analysis not yet available for this audit.</p>
        <p className="mt-2 text-xs text-[#4A6280]">Re-run the audit to generate extraction pipeline scores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="card-glass rounded-xl p-5">
        <h3 className="mb-1 font-semibold text-white">Extraction Pipeline Scores</h3>
        <p className="mb-4 text-xs text-[#4A6280]">How well AI systems can extract meaning from this site across 7 extraction stages</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stageData} layout="vertical" barSize={16}>
            <XAxis type="number" domain={[0, 100]} tick={{ fill: '#4A6280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#4A6280', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              contentStyle={{ background: '#0A1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#fff' }}
            />
            <Bar dataKey="score" radius={[0, 4, 4, 0]}>
              {stageData.map((entry, i) => <Cell key={i} fill={scoreColor(entry.score)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {mrIssues.length > 0 && <IssuesTable issues={mrIssues} auditId={data.id} pages={data.pages} />}
    </div>
  );
}

// ─── Entity Intelligence Tab ──────────────────────────────────────────────────

function EntityTab({ data }: { data: AuditData }) {
  const ei = data.scores?.breakdown.entityIntelligence;
  const entityIssues = data.issues.filter((i) => i.module === 'entity') as SEOIssue[];

  if (!ei) {
    return (
      <div className="card-glass rounded-xl p-8 text-center">
        <p className="text-[#4A6280]">Entity intelligence analysis not yet available for this audit.</p>
        <p className="mt-2 text-xs text-[#4A6280]">Re-run the audit to generate entity detection and confidence scores.</p>
      </div>
    );
  }

  const eiScores = [
    { label: 'Entity Confidence', score: ei.entityConfidenceScore, desc: 'Overall confidence AI systems have in entity identity on this site' },
    { label: 'Consistency Score', score: ei.entityConsistencyScore, desc: 'How consistently entities are described across all pages' },
    { label: 'Coverage Score', score: ei.entityCoverageScore, desc: 'How well key entities are referenced across the site' },
    { label: 'Disambiguation Score', score: ei.disambiguationScore, desc: 'How unambiguously entities can be identified by AI systems' },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        {eiScores.map(({ label, score, desc }) => (
          <div key={label} className="card-glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-white">{label}</span>
              <span className="text-xl font-bold tabular-nums" style={{ color: scoreColor(score) }}>{Math.round(score)}</span>
            </div>
            <p className="text-xs text-[#4A6280] mb-3">{desc}</p>
            <div className="h-1.5 rounded-full bg-white/10">
              <div className="h-full rounded-full bg-cyan transition-all" style={{ width: `${Math.min(100, score)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {entityIssues.length > 0 && <IssuesTable issues={entityIssues} auditId={data.id} pages={data.pages} />}
    </div>
  );
}

// ─── Citation Probability Tab ─────────────────────────────────────────────────

function CitationTab({ data }: { data: AuditData }) {
  const ca = data.scores?.breakdown.citationAnalysis;
  const citationIssues = data.issues.filter((i) => i.module === 'citation') as SEOIssue[];
  const score = ca?.citationProbabilityScore ?? null;

  if (!ca) {
    return (
      <div className="card-glass rounded-xl p-8 text-center">
        <p className="text-[#4A6280]">Citation probability analysis not yet available for this audit.</p>
        <p className="mt-2 text-xs text-[#4A6280]">Re-run the audit to generate citation probability scores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="card-glass rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <h3 className="font-semibold text-white">Citation Probability Score</h3>
            <p className="mt-1 text-xs text-[#4A6280]">Likelihood that AI systems select this content as a citation source</p>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-4xl font-bold tabular-nums" style={{ color: scoreColor(score) }}>{score != null ? Math.round(score) : '—'}</span>
            <span className="block text-xs text-[#4A6280]">/ 100</span>
          </div>
        </div>
        <div className="h-2 rounded-full bg-white/10">
          <div className="h-full rounded-full bg-cyan transition-all" style={{ width: `${Math.min(100, score ?? 0)}%` }} />
        </div>
        {score != null && score < 50 && (
          <p className="mt-4 text-xs text-amber-400">
            Low citation probability indicates AI systems are unlikely to reference this content in generated responses. Focus on factual density, direct-answer structures, and trust signal density.
          </p>
        )}
      </div>

      {citationIssues.length > 0 && <IssuesTable issues={citationIssues} auditId={data.id} pages={data.pages} />}
    </div>
  );
}

// ─── Semantic Trust Tab ───────────────────────────────────────────────────────

function SemanticTrustTab({ data }: { data: AuditData }) {
  const st = data.scores?.breakdown.semanticTrust;
  const trustIssues = data.issues.filter((i) => i.module === 'semantic-trust') as SEOIssue[];

  if (!st || !('breakdown' in st) || !st.breakdown) {
    return (
      <div className="card-glass rounded-xl p-8 text-center">
        <p className="text-[#4A6280]">Semantic trust analysis not yet available for this audit.</p>
        <p className="mt-2 text-xs text-[#4A6280]">Re-run the audit to generate trust signal scores.</p>
      </div>
    );
  }

  const trustBreakdown = [
    { label: 'Authorship Trust', score: st.breakdown.authorshipTrust, desc: 'Author identity and credential signals' },
    { label: 'Organisational Trust', score: st.breakdown.organisationalTrust, desc: 'Schema, contact info, and legal page signals' },
    { label: 'Content Trust', score: st.breakdown.contentTrust, desc: 'Date signals, citations, and claim verifiability' },
    { label: 'Structural Trust', score: st.breakdown.structuralTrust, desc: 'Schema coverage and site-wide structure signals' },
  ];

  return (
    <div className="space-y-8">
      <div className="card-glass rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h3 className="font-semibold text-white">Semantic Trust Score</h3>
            <p className="mt-1 text-xs text-[#4A6280]">How much credibility AI systems assign to content on this site</p>
          </div>
          <span className="shrink-0 text-4xl font-bold tabular-nums" style={{ color: scoreColor(st.score) }}>{Math.round(st.score)}</span>
        </div>
        <div className="space-y-4">
          {trustBreakdown.map(({ label, score, desc }) => (
            <div key={label}>
              <div className="flex items-center justify-between gap-2 text-xs mb-1">
                <div className="min-w-0">
                  <span className="text-white font-medium">{label}</span>
                  <span className="ml-2 text-[#4A6280] hidden sm:inline">{desc}</span>
                </div>
                <span className="shrink-0 font-semibold tabular-nums" style={{ color: scoreColor(score) }}>{Math.round(score)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${Math.min(100, score)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {trustIssues.length > 0 && <IssuesTable issues={trustIssues} auditId={data.id} pages={data.pages} />}
    </div>
  );
}

// ─── v3 Tab: Retrieval Simulation ─────────────────────────────────────────────

function RetrievalTab({ d }: { d: RetrievalData | undefined; loading: boolean }) {
  if (!d) return <V3Loading label="Retrieval Simulation" />;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Retrieval Quality', value: d.avgRetrievalQualityScore },
          { label: 'Pages Simulated', value: d.pagesSimulated, noColor: true },
        ].map(({ label, value, noColor }) => (
          <div key={label} className="card-glass rounded-xl p-4 text-center">
            <span className="text-2xl font-bold tabular-nums" style={{ color: noColor ? '#fff' : scoreColor(value as number | null) }}>{value ?? '—'}</span>
            <p className="mt-1 text-xs text-[#4A6280]">{label}</p>
          </div>
        ))}
      </div>
      <div className="card-glass rounded-xl overflow-hidden">
        <div className="border-b border-white/10 px-5 py-3">
          <h3 className="font-semibold text-white">Per-Page Retrieval Scores</h3>
          <p className="mt-0.5 text-xs text-[#4A6280]">Simulated — same content always produces the same result</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/5">
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#4A6280]">Page</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-[#4A6280]">Quality</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-[#4A6280]">Chunk Stability</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-[#4A6280]">Ans. Formation</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-[#4A6280]">Summ. Loss</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-[#4A6280]">Citation Elig.</th>
            </tr></thead>
            <tbody>
              {(d.results ?? []).slice(0, 20).map((r, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="max-w-[200px] truncate px-5 py-3 text-xs text-[#4A6280]">{r.pageUrl}</td>
                  <td className="px-3 py-3 text-center text-xs font-semibold tabular-nums" style={{ color: scoreColor(r.retrievalQualityScore) }}>{r.retrievalQualityScore ?? '—'}</td>
                  <td className="px-3 py-3 text-center text-xs tabular-nums text-[#7A9AB4]">{r.chunkStabilityIndex != null ? r.chunkStabilityIndex.toFixed(2) : '—'}</td>
                  <td className="px-3 py-3 text-center text-xs tabular-nums text-[#7A9AB4]">{r.answerFormationProbability != null ? `${Math.round(r.answerFormationProbability * 100)}%` : '—'}</td>
                  <td className="px-3 py-3 text-center text-xs font-semibold tabular-nums" style={{ color: scoreColor(r.summarisationLossScore) }}>{r.summarisationLossScore ?? '—'}</td>
                  <td className="px-3 py-3 text-center text-xs font-semibold tabular-nums" style={{ color: scoreColor(r.citationEligibilityScore) }}>{r.citationEligibilityScore ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── v3 Tab: Machine Trust ────────────────────────────────────────────────────

function MachineTrustTab({ d }: { d: MachineTrustData | undefined; loading: boolean }) {
  if (!d) return <V3Loading label="Machine Trust" />;
  const subScores = [
    { label: 'Entity Credibility', score: d.entityCredibilityScore, desc: 'Consistency of entity attributes across all pages and schema' },
    { label: 'Schema Trust Alignment', score: d.schemaTrustAlignmentScore, desc: 'Schema markup accurately describes page content — no over-claiming' },
    { label: 'External Validation', score: d.externalValidationScore, desc: 'Depth and quality of external signals that validate entity claims' },
    { label: 'Contradiction Absence', score: d.contradictionAbsenceScore, desc: 'No conflicting entity attributes detected across pages' },
    { label: 'Degradation Resistance', score: d.trustDegradationResistance, desc: 'No trust-damaging signals detected across audit history' },
  ];
  return (
    <div className="space-y-6">
      <div className="card-glass rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h3 className="font-semibold text-white">Machine Trust Score</h3>
            <p className="mt-1 text-xs text-[#4A6280]">Confidence an AI model would have in using this content as a reliable source</p>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-4xl font-bold tabular-nums" style={{ color: scoreColor(d.overall) }}>{d.overall}</span>
            <p className="mt-0.5 text-xs text-[#4A6280]">Cross-source validation: {Math.round(d.crossSourceValidationIndex * 100)}%</p>
          </div>
        </div>
        <div className="space-y-4">
          {subScores.map(({ label, score, desc }) => (
            <div key={label}>
              <div className="flex items-center justify-between gap-2 text-xs mb-1">
                <div className="min-w-0"><span className="text-white font-medium">{label}</span><span className="ml-2 text-[#4A6280] hidden sm:inline">{desc}</span></div>
                <span className="shrink-0 font-semibold tabular-nums" style={{ color: score != null ? scoreColor(score) : '#4A6280' }}>{score != null ? Math.round(score) : 'N/A'}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${Math.min(100, score ?? 0)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {(d.trustIssues ?? []).length > 0 && (
        <div className="card-glass rounded-xl overflow-hidden">
          <div className="border-b border-white/10 px-5 py-3"><h3 className="font-semibold text-white">Trust Issues ({(d.trustIssues ?? []).length})</h3></div>
          <div className="divide-y divide-white/[0.04]">
            {(d.trustIssues ?? []).map((issue, i) => (
              <div key={i} className="px-5 py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${issue.severity === 'critical' ? 'bg-red-500/15 text-red-400' : issue.severity === 'warning' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'}`}>{issue.severity}</span>
                  <span className="text-[10px] font-mono text-[#4A6280]">{(issue.type ?? '').replace(/_/g, ' ')}</span>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-red-400">Problem</p>
                  <p className="text-sm text-white leading-relaxed">{issue.description}</p>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-amber-400">Cause</p>
                  <p className="text-sm text-[#b0c4cc] leading-relaxed">{TRUST_CAUSE_MAP[issue.type] ?? 'This trust signal deficiency reduces AI confidence in this content as a reliable source across multiple retrieval interactions.'}</p>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-teal-400">Solution</p>
                  <p className="text-sm text-white leading-relaxed">{issue.recommendation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── v3 Tab: Temporal Authority ───────────────────────────────────────────────

function TemporalTab({ d }: { d: TemporalData | undefined; loading: boolean }) {
  if (!d) return <V3Loading label="Temporal Authority" />;
  const freqColors: Record<string, string> = { active: 'text-green-400 bg-green-500/10', periodic: 'text-teal-400 bg-teal-500/10', stale: 'text-amber-400 bg-amber-500/10', abandoned: 'text-red-400 bg-red-500/10' };
  const freqClass = freqColors[d.updateFrequencyClassification] ?? 'text-[#4A6280] bg-white/5';
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card-glass rounded-xl p-4 text-center">
          {d.isBaseline ? (
            <><span className="text-lg font-bold text-[#4A6280]">Baseline</span><p className="mt-1 text-xs text-[#4A6280]">Authority Velocity</p><p className="mt-1 text-[10px] text-[#3A5568]">Needs 2+ audits</p></>
          ) : (
            <><span className="text-2xl font-bold tabular-nums" style={{ color: scoreColor(d.authorityVelocityScore) }}>{d.authorityVelocityScore ?? '—'}</span><p className="mt-1 text-xs text-[#4A6280]">Authority Velocity</p></>
          )}
        </div>
        <div className="card-glass rounded-xl p-4 text-center">
          <span className="text-2xl font-bold tabular-nums" style={{ color: scoreColor(d.trustStabilityIndex * 100) }}>{Math.round(d.trustStabilityIndex * 100)}</span>
          <p className="mt-1 text-xs text-[#4A6280]">Trust Stability</p>
        </div>
        <div className="card-glass rounded-xl p-4 text-center">
          <span className="text-2xl font-bold tabular-nums" style={{ color: scoreColor(d.contentFreshnessImpactFactor * 100) }}>{Math.round(d.contentFreshnessImpactFactor * 100)}</span>
          <p className="mt-1 text-xs text-[#4A6280]">Freshness Factor</p>
        </div>
        <div className="card-glass rounded-xl p-4 text-center flex flex-col items-center justify-center">
          <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${freqClass}`}>{d.updateFrequencyClassification}</span>
          <p className="mt-1 text-xs text-[#4A6280]">Update Frequency</p>
        </div>
      </div>
      {(d.temporalIssues ?? []).length > 0 && (
        <div className="card-glass rounded-xl overflow-hidden">
          <div className="border-b border-white/10 px-5 py-3"><h3 className="font-semibold text-white">Temporal Issues ({(d.temporalIssues ?? []).length})</h3></div>
          <div className="divide-y divide-white/[0.04]">
            {(d.temporalIssues ?? []).map((issue, i) => (
              <div key={i} className="px-5 py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`shrink-0 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${issue.severity === 'critical' ? 'bg-red-500/15 text-red-400' : issue.severity === 'warning' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'}`}>{issue.severity}</span>
                  <span className="text-[10px] font-mono text-[#4A6280]">{(issue.type ?? '').replace(/_/g, ' ')}</span>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-red-400">Problem</p>
                  <p className="text-sm text-white leading-relaxed">{issue.description}</p>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-amber-400">Cause</p>
                  <p className="text-sm text-[#b0c4cc] leading-relaxed">{TEMPORAL_CAUSE_MAP[issue.type] ?? 'Temporal signals influence how AI systems weight content freshness and authority over time. Without them, content ages without a decay baseline.'}</p>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-teal-400">Solution</p>
                  <p className="text-sm text-white leading-relaxed">{issue.recommendation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {(d.stalePagesAtRisk ?? []).length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <h3 className="mb-3 font-semibold text-amber-400">Stale Pages at Risk ({(d.stalePagesAtRisk ?? []).length})</h3>
          <ul className="space-y-1">{(d.stalePagesAtRisk ?? []).map((url, i) => <li key={i} className="text-xs text-[#4A6280]">{url}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

// ─── v3 Tab: Recommendation Surfaces ─────────────────────────────────────────

function SurfacesTab({ d }: { d: SurfacesData | undefined; loading: boolean }) {
  if (!d) return <V3Loading label="Recommendation Surfaces" />;
  const statusColors: Record<string, string> = { visible: 'text-green-400 bg-green-500/10 border-green-500/20', partial: 'text-amber-400 bg-amber-500/10 border-amber-500/20', absent: 'text-red-400 bg-red-500/10 border-red-500/20' };
  const surfaces = [
    { key: 'aiOverviews', label: 'AI Overviews', desc: 'Search-integrated AI responses', data: d.surfaces.aiOverviews },
    { key: 'chatRecommendation', label: 'Chat Recommendation', desc: 'LLM assistant responses', data: d.surfaces.chatRecommendation },
    { key: 'voiceRetrieval', label: 'Voice Retrieval', desc: 'Voice assistant answers', data: d.surfaces.voiceRetrieval },
    { key: 'agentDiscovery', label: 'Agent Discovery', desc: 'Autonomous AI agents', data: d.surfaces.agentDiscovery },
  ] as const;
  return (
    <div className="space-y-6">
      <div className="card-glass rounded-xl p-4 flex items-center justify-between">
        <div><p className="text-xs text-[#4A6280]">Overall Surface Score</p><p className="mt-0.5 text-xs text-[#3A5568]">Estimated recommendation coverage across all AI surfaces</p></div>
        <span className="text-3xl font-bold tabular-nums" style={{ color: scoreColor(d.overallSurfaceScore) }}>{d.overallSurfaceScore}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {surfaces.map(({ key, label, desc, data }) => {
          const sc = statusColors[data.status] ?? 'text-[#4A6280] bg-white/5 border-white/10';
          return (
            <div key={key} className={`rounded-xl border p-5 ${sc}`}>
              <div className="flex items-start justify-between mb-3">
                <div><p className="text-sm font-semibold text-white">{label}</p><p className="text-xs text-[#4A6280]">{desc}</p></div>
                <div className="text-right"><span className="text-2xl font-bold tabular-nums">{data.inclusionProbability}</span><p className="text-[10px] opacity-70">est. inclusion %</p></div>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${sc}`}>{data.status}</span>
              {(data.blockers ?? []).length > 0 && (
                <div className="mt-3 space-y-1">
                  {(data.blockers ?? []).map((b, i) => <p key={i} className="text-xs text-[#4A6280]">⚠ {b.description}</p>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {(d.coverageGaps ?? []).length > 0 && (
        <div className="card-glass rounded-xl overflow-hidden">
          <div className="border-b border-white/10 px-5 py-3"><h3 className="font-semibold text-white">Coverage Gaps</h3></div>
          <div className="divide-y divide-white/[0.04]">
            {(d.coverageGaps ?? []).map((gap, i) => (
              <div key={i} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-white">{gap.surface}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${gap.estimatedImpact === 'high' ? 'bg-red-500/15 text-red-400' : gap.estimatedImpact === 'medium' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'}`}>{gap.estimatedImpact} impact</span>
                </div>
                <p className="text-xs text-[#4A6280]">{gap.missedOpportunity}</p>
                <div className="mt-2 flex flex-wrap gap-1">{gap.requiredSignals.map((s, j) => <span key={j} className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] text-[#7A9AB4] border border-white/[0.06]">{s}</span>)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── v3 Tab: Entity Authenticity ──────────────────────────────────────────────

function AuthenticityTab({ d }: { d: AuthenticityData | undefined; loading: boolean }) {
  if (!d) return <V3Loading label="Entity Authenticity" />;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="card-glass rounded-xl p-4 text-center">
          <span className="text-3xl font-bold tabular-nums" style={{ color: scoreColor(d.entityAuthenticityConfidence) }}>{d.entityAuthenticityConfidence}</span>
          <p className="mt-1 text-xs text-[#4A6280]">Entity Authenticity Confidence</p>
          <p className="mt-0.5 text-[10px] text-[#3A5568]">Higher is more authentic</p>
        </div>
        <div className="card-glass rounded-xl p-4 text-center">
          <span className="text-3xl font-bold tabular-nums" style={{ color: scoreColor(d.networkIntegrityScore) }}>{d.networkIntegrityScore}</span>
          <p className="mt-1 text-xs text-[#4A6280]">Network Integrity</p>
        </div>
        <div className="card-glass rounded-xl p-4 text-center">
          <span className="text-3xl font-bold tabular-nums" style={{ color: d.syntheticRiskScore < 20 ? '#22C55E' : d.syntheticRiskScore < 50 ? '#F59E0B' : '#EF4444' }}>{d.syntheticRiskScore}</span>
          <p className="mt-1 text-xs text-[#4A6280]">Synthetic Risk Score</p>
          <p className="mt-0.5 text-[10px] text-[#3A5568]">Lower is safer</p>
        </div>
      </div>
      {(d.detectedPatterns ?? []).length === 0 && (d.flaggedEntities ?? []).length === 0 ? (
        <div className="card-glass rounded-xl p-8 text-center">
          <p className="text-green-400 font-semibold">No synthetic patterns detected</p>
          <p className="mt-1 text-xs text-[#4A6280]">All entity signals appear organic and authentic.</p>
        </div>
      ) : (
        <div className="card-glass rounded-xl overflow-hidden">
          <div className="border-b border-white/10 px-5 py-3"><h3 className="font-semibold text-white">Detected Patterns ({(d.detectedPatterns ?? []).length})</h3></div>
          <div className="divide-y divide-white/[0.04]">
            {(d.detectedPatterns ?? []).map((p, i) => (
              <div key={i} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-white capitalize">{(p.patternType ?? '').replace(/_/g, ' ')}</span>
                  <span className="text-xs text-[#4A6280]">confidence: {Math.round(p.confidence * 100)}%</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${p.severity === 'critical' ? 'bg-red-500/15 text-red-400' : p.severity === 'warning' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'}`}>{p.severity}</span>
                </div>
                <ul className="mt-1 space-y-0.5">{(p.evidence ?? []).map((ev, j) => <li key={j} className="text-xs text-[#4A6280]">• {ev}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      )}
      {(d.recommendations ?? []).length > 0 && (
        <div className="rounded-xl border border-cyan/20 bg-cyan/5 p-5">
          <h3 className="mb-3 font-semibold text-cyan">Recommendations</h3>
          <ul className="space-y-2">{(d.recommendations ?? []).map((r, i) => <li key={i} className="flex gap-2 text-xs text-[#4A6280]"><span className="shrink-0 text-cyan">→</span>{r}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

// ─── v3 Tab: Perception Graph ─────────────────────────────────────────────────

function PerceptionGraphTab({ d }: { d: PerceptionGraphData | undefined; loading: boolean }) {
  if (!d) return <V3Loading label="Perception Graph" />;
  const nodeTypeColors: Record<string, string> = { entity: '#00C8FF', topic: '#0BCEBC', claim: '#F59E0B', page: '#7A9AB4' };
  const nodes = d.nodes ?? [];
  const edges = d.edges ?? [];
  const sorted = [...nodes].sort((a, b) => b.confidence - a.confidence);

  if (nodes.length === 0) {
    return (
      <div className="card-glass rounded-xl p-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.03]">
          <span className="text-2xl">🔮</span>
        </div>
        <p className="text-sm font-medium text-white">No perception graph data</p>
        <p className="mt-2 max-w-sm mx-auto text-xs leading-[1.7] text-[#4A6280]">
          The AI Perception Graph requires entity extraction to complete successfully.
          This typically means the entity intelligence pipeline found no named entities on this domain,
          or the AI API was unavailable during the audit. Re-run the audit to generate graph data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="card-glass rounded-xl p-4 text-center"><span className="text-2xl font-bold text-white">{nodes.length}</span><p className="mt-1 text-xs text-[#4A6280]">Nodes</p></div>
        <div className="card-glass rounded-xl p-4 text-center"><span className="text-2xl font-bold text-white">{edges.length}</span><p className="mt-1 text-xs text-[#4A6280]">Edges</p></div>
        <div className="card-glass rounded-xl p-4 text-center">
          <span className="text-2xl font-bold text-white">{nodes.length > 0 ? Math.round(nodes.reduce((s, n) => s + n.confidence, 0) / nodes.length * 100) : '—'}%</span>
          <p className="mt-1 text-xs text-[#4A6280]">Avg. Confidence</p>
        </div>
      </div>
      <div className="card-glass rounded-xl overflow-hidden">
        <div className="border-b border-white/10 px-5 py-3"><h3 className="font-semibold text-white">Perception Nodes</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/5">
              <th className="px-5 py-3 text-left text-xs font-semibold text-[#4A6280]">Label</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-[#4A6280]">Type</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-[#4A6280]">Confidence</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-[#4A6280]">Citation Ready</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-[#4A6280]">Disambiguation</th>
            </tr></thead>
            <tbody>
              {sorted.map((node, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="max-w-[200px] truncate px-5 py-3 text-xs text-white">{node.label}</td>
                  <td className="px-3 py-3">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium border" style={{ color: nodeTypeColors[node.type] ?? '#7A9AB4', borderColor: `${nodeTypeColors[node.type] ?? '#7A9AB4'}40`, backgroundColor: `${nodeTypeColors[node.type] ?? '#7A9AB4'}10` }}>{node.type}</span>
                  </td>
                  <td className="px-3 py-3 text-center text-xs tabular-nums" style={{ color: scoreColor(node.confidence * 100) }}>{Math.round(node.confidence * 100)}%</td>
                  <td className="px-3 py-3 text-center text-xs tabular-nums text-[#7A9AB4]">{Math.round(node.citationReadiness * 100)}%</td>
                  <td className="px-3 py-3 text-center text-xs tabular-nums text-[#7A9AB4]">{Math.round(node.disambiguationStrength * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {edges.length > 0 && (
        <div className="card-glass rounded-xl overflow-hidden">
          <div className="border-b border-white/10 px-5 py-3"><h3 className="font-semibold text-white">Top Relationships</h3></div>
          <div className="divide-y divide-white/[0.04]">
            {[...edges].sort((a, b) => b.strength - a.strength).slice(0, 10).map((edge, i) => {
              const src = nodes.find((n) => n.id === edge.source);
              const tgt = nodes.find((n) => n.id === edge.target);
              return (
                <div key={i} className="flex items-center gap-3 px-5 py-3 text-xs">
                  <span className="text-white">{src?.label ?? edge.source}</span>
                  <span className="text-cyan">—{edge.relationshipType}→</span>
                  <span className="text-white">{tgt?.label ?? edge.target}</span>
                  <span className="ml-auto text-[#4A6280]">{Math.round(edge.strength * 100)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Action Plan Tab ──────────────────────────────────────────────────────────

type AuditIssue = SEOIssue & { module?: string };

const SEV_ORDER_MAP: Record<string, number> = { critical: 0, warning: 1, info: 2 };

const SEV_STYLES_AP: Record<string, { ring: string; label: string; dot: string }> = {
  critical: { ring: 'border-red-500/30 bg-red-500/5',    label: 'bg-red-500/15 text-red-400 border border-red-500/30',    dot: 'bg-red-400' },
  warning:  { ring: 'border-amber-500/30 bg-amber-500/5', label: 'bg-amber-500/15 text-amber-400 border border-amber-500/30', dot: 'bg-amber-400' },
  info:     { ring: 'border-blue-500/30 bg-blue-500/5',   label: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',   dot: 'bg-blue-400' },
};

const SEO_CAUSE_MAP: Record<string, string> = {
  missing_title: "The <title> tag is the primary signal crawlers use to classify a page's topic. Without it, search engines and AI retrieval systems cannot confidently categorise or cite this page.",
  title_too_long: "Search engines display approximately 60–70 characters of a title. Text beyond this is cut off, hiding key information and reducing click-through rates.",
  title_too_short: "Short titles lack the semantic richness needed for accurate topic classification by search engines and AI systems.",
  missing_meta_description: "Without a description, search engines generate snippet text from body content, which is rarely optimised for user intent and reduces click-through rates.",
  meta_description_too_long: "Search engines truncate descriptions beyond approximately 155 characters, cutting off your message mid-sentence.",
  duplicate_meta_description: "Duplicate descriptions signal a lack of page differentiation, reducing click-through rates across all affected pages.",
  missing_h1: "The H1 is the most important on-page content signal. Search engines and AI systems use it to confirm what a page is about and to form retrievable answers.",
  multiple_h1: "Multiple H1 tags create ambiguity about the primary topic, weakening the page's ability to rank for any single query.",
  missing_canonical: "URL variations (www vs. non-www, query strings, trailing slashes) can make the same content appear at multiple addresses, fragmenting ranking signals.",
  broken_canonical: "A canonical tag pointing to a non-existent URL signals broken site architecture to crawlers and may cause the page to be de-prioritised.",
  noindex_page: "A robots meta noindex directive instructs all crawlers to exclude this page from their index, blocking any search or AI visibility.",
  missing_alt_text: "Screen readers and search engine image crawlers rely entirely on alt text to understand image content — without it, the image provides zero SEO or accessibility value.",
  broken_internal_link: "Broken links waste crawl budget, create a poor user experience, and signal to search engines that the site is poorly maintained.",
  redirect_chain: "Each redirect hop adds latency and loses a small percentage of link equity. Chains of three or more redirects can significantly dilute ranking signals.",
  low_word_count: "AI retrieval systems split content into semantic chunks of 300–600 tokens. Pages below 300 words cannot form a stable chunk, making them unreliable sources for AI-generated answers.",
  missing_robots_txt: "Without a robots.txt file, crawlers have no guidance on which parts of the site to crawl or avoid, risking wasted crawl budget on non-indexable pages.",
  missing_sitemap: "Without a sitemap, search engines must rely entirely on link discovery to find pages, which means newer or orphaned pages may never be crawled.",
  duplicate_title: "Duplicate title tags signal a lack of content differentiation. Search engines may choose which version to index, undermining your targeting strategy.",
};

const TRUST_CAUSE_MAP: Record<string, string> = {
  missing_entity_schema: "AI systems anchor all entity trust signals to a schema-defined Organisation record. Without it, the primary entity cannot be distinguished from any other text mention on the web and cannot be cross-validated.",
  missing_same_as: "sameAs links are the primary cross-source identity validation mechanism. Without them, an entity's identity cannot be confirmed against knowledge bases like Wikipedia or Wikidata, which AI systems check during trust resolution.",
  no_external_validation: "Self-referential trust signals carry lower weight. AI systems assign higher confidence to content whose claims are confirmed by independent external sources, not just by the site itself.",
  schema_trust_mismatch: "When schema claims cannot be verified from body text, AI systems detect a trust signal inconsistency and reduce confidence in all claims on the page.",
  contradiction_detected: "Conflicting entity attributes across pages signal unreliable content. When the same entity is described differently in different places, AI systems flag the domain for reduced trust.",
};

const TEMPORAL_CAUSE_MAP: Record<string, string> = {
  missing_date_schema: "AI systems use datePublished and dateModified as primary freshness signals. Without them, content age is unknown and the system defaults to treating it as potentially stale, applying trust decay earlier.",
  stale_thin_pages: "Thin pages with no schema provide no freshness signal and minimal content value. As they age without updates, AI retrieval models apply increasing trust decay to their contribution.",
  semantic_drift: "When a page's topic shifts between audits without a redirect or update signal, AI systems flag this as authority inconsistency, reducing retrieval confidence for affected content.",
  abandoned_content: "Content that has not been updated for 6+ months is classified as abandoned by temporal models, triggering an accelerated trust decay curve that reduces its retrieval probability.",
};

interface FixState {
  status: 'idle' | 'loading' | 'done' | 'error';
  problem?: string;
  solution?: string;
  fixCode?: string;
  fixLanguage?: string;
  expectedImpact?: string;
  effort?: string;
}

function ActionPlanIssueCard({ issue, auditId }: { issue: AuditIssue; auditId: string }) {
  const [open, setOpen] = useState(false);
  const [fix, setFix] = useState<FixState>({ status: 'idle' });
  const [copied, setCopied] = useState(false);

  const issueId: string | undefined = (issue as AuditIssue & { id?: string }).id;
  const styles = SEV_STYLES_AP[issue.severity] ?? SEV_STYLES_AP.info!;

  async function loadFix() {
    if (!issueId || fix.status === 'loading' || fix.status === 'done') return;
    setFix({ status: 'loading' });
    try {
      const res = await fetch(`/api/audit/${auditId}/fix/${issueId}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as Omit<FixState, 'status'> & { problem: string; solution: string; fixCode: string };
      setFix({ status: 'done', ...data });
    } catch {
      setFix({ status: 'error' });
    }
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && fix.status === 'idle') void loadFix();
  }

  function copyFix() {
    if (!fix.fixCode) return;
    void navigator.clipboard.writeText(fix.fixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const langLabel: Record<string, string> = {
    'json-ld': 'JSON-LD', html: 'HTML', typescript: 'TypeScript', text: 'Text',
  };

  return (
    <div className={`rounded-xl border overflow-hidden ${styles.ring}`}>
      <button
        className="w-full flex items-start gap-3 px-4 py-4 text-left hover:bg-white/[0.02] transition-colors"
        onClick={toggleOpen}
      >
        <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${styles.label}`}>
              {issue.severity}
            </span>
            {issue.module && (
              <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] text-[#4A6280] border border-white/[0.06]">
                {issue.module}
              </span>
            )}
            <span className="font-mono text-[10px] text-[#4A6280]">
              {(issue.type ?? '').replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-sm text-white leading-snug">{issue.message}</p>
          {issue.url && (
            <p className="mt-0.5 text-[11px] text-[#4A6280] truncate">{issue.url.replace(/^https?:\/\//, '')}</p>
          )}
        </div>
        <span className="shrink-0 text-xs text-[#4A6280] mt-1">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-white/[0.06] bg-[#050B16] px-4 pb-4 pt-3 space-y-3">
          {/* Problem — shown immediately from DB data */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-red-400">Problem</p>
            <p className="text-xs text-slate-300 leading-relaxed">
              {(issue as AuditIssue & { problem?: string }).problem ?? issue.message}
            </p>
          </div>

          {/* Cause — derived from issue type */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-amber-400">Cause</p>
            <p className="text-xs text-[#b0c4cc] leading-relaxed">
              {SEO_CAUSE_MAP[issue.type ?? ''] ?? TRUST_CAUSE_MAP[issue.type ?? ''] ?? TEMPORAL_CAUSE_MAP[issue.type ?? ''] ?? 'This issue degrades crawlability, AI retrievability, or machine trust — each of which contributes to overall visibility.'}
            </p>
          </div>

          {/* Solution — shown immediately from DB data */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-teal-400">Solution</p>
            <p className="text-xs text-slate-300 leading-relaxed">
              {(issue as AuditIssue & { solution?: string }).solution ?? issue.recommendation}
            </p>
          </div>

          {/* Fix code — loads async via AI API */}
          {issueId && (
            fix.status === 'idle' ? null : fix.status === 'loading' ? (
              <div className="flex items-center gap-2 pt-1 text-xs text-[#4A6280]">
                <div className="h-3 w-3 animate-spin rounded-full border border-cyan border-t-transparent" />
                Generating code fix…
              </div>
            ) : fix.status === 'error' ? (
              <p className="text-xs text-red-400 pt-1">Code fix generation failed.</p>
            ) : (
              <div className="pt-1">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan">
                    Code Fix · {fix.fixLanguage ? (langLabel[fix.fixLanguage] ?? fix.fixLanguage) : ''}
                  </p>
                  <div className="flex items-center gap-2">
                    {fix.expectedImpact && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                        fix.expectedImpact === 'high' ? 'border-red-500/30 bg-red-500/10 text-red-400' :
                        fix.expectedImpact === 'medium' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' :
                        'border-blue-500/30 bg-blue-500/10 text-blue-400'
                      }`}>{fix.expectedImpact} impact</span>
                    )}
                    <button
                      onClick={copyFix}
                      className={`rounded px-2.5 py-1 text-[10px] font-medium transition-colors ${
                        copied ? 'bg-green-500/20 text-green-400' : 'bg-white/[0.06] text-[#4A6280] hover:text-white'
                      }`}
                    >
                      {copied ? 'Copied!' : 'Copy fix'}
                    </button>
                  </div>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-[#020A16] p-3 text-[11px] leading-relaxed text-slate-300 font-mono whitespace-pre-wrap max-h-64">
                  {fix.fixCode}
                </pre>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

function ActionPlanTab({ data }: { data: AuditData }) {
  const [filterSev, setFilterSev] = useState<string>('all');
  const [filterMod, setFilterMod] = useState<string>('all');

  const issues = data.issues as AuditIssue[];
  const modules = [...new Set(issues.map((i) => i.module).filter(Boolean))].sort();

  const filtered = useMemo(() => {
    return issues
      .filter((i) => filterSev === 'all' || i.severity === filterSev)
      .filter((i) => filterMod === 'all' || i.module === filterMod)
      .sort((a, b) => (SEV_ORDER_MAP[a.severity] ?? 2) - (SEV_ORDER_MAP[b.severity] ?? 2));
  }, [issues, filterSev, filterMod]);

  const counts = useMemo(() => ({
    critical: issues.filter((i) => i.severity === 'critical').length,
    warning: issues.filter((i) => i.severity === 'warning').length,
    info: issues.filter((i) => i.severity === 'info').length,
  }), [issues]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-glass rounded-xl p-5">
        <h2 className="text-lg font-bold text-white mb-1">Action Plan</h2>
        <p className="text-xs text-[#4A6280]">
          Every detected issue with a ready-to-paste fix. Sorted by severity. Click any issue to expand the Problem → Solution → Fix.
        </p>
        <div className="mt-4 flex gap-4 text-sm">
          <span><span className="font-bold text-red-400">{counts.critical}</span> <span className="text-[#4A6280]">critical</span></span>
          <span><span className="font-bold text-amber-400">{counts.warning}</span> <span className="text-[#4A6280]">warnings</span></span>
          <span><span className="font-bold text-blue-400">{counts.info}</span> <span className="text-[#4A6280]">info</span></span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'critical', 'warning', 'info'] as const).map((sev) => (
          <button
            key={sev}
            onClick={() => setFilterSev(sev)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
              filterSev === sev
                ? sev === 'critical' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                  sev === 'warning'  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                  sev === 'info'     ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
                  'bg-white/10 text-white border-white/20'
                : 'border-white/10 text-[#4A6280] hover:text-white'
            }`}
          >
            {sev === 'all' ? `All (${issues.length})` : `${sev} (${counts[sev]})`}
          </button>
        ))}
        {modules.length > 1 && (
          <select
            value={filterMod}
            onChange={(e) => setFilterMod(e.target.value)}
            className="rounded-full border border-white/10 bg-[#050B09] px-3 py-1 text-xs text-[#4A6280] outline-none focus:border-cyan/30"
          >
            <option value="all">All modules</option>
            {modules.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
      </div>

      {/* Issue cards */}
      {filtered.length === 0 ? (
        <div className="card-glass rounded-xl p-10 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-semibold text-white">No issues in this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((issue, i) => (
            <ActionPlanIssueCard
              key={(issue as AuditIssue & { id?: string }).id ?? `${issue.type}-${i}`}
              issue={issue}
              auditId={data.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── v3 Loading placeholder ───────────────────────────────────────────────────

function V3Loading({ label }: { label: string }) {
  return (
    <div className="card-glass rounded-xl p-8 text-center">
      <div className="mb-4 h-6 w-6 animate-spin rounded-full border-2 border-cyan border-t-transparent mx-auto" />
      <p className="text-[#4A6280]">Loading {label} analysis…</p>
    </div>
  );
}

// ─── Schema snippet generator (client-side preview) ───────────────────────────

function generateSnippetPreview(type: string): string {
  const templates: Record<string, object> = {
    Organization: { '@context': 'https://schema.org', '@type': 'Organization', name: 'Your Organisation Name', url: 'https://example.com', logo: 'https://example.com/logo.png' },
    WebSite: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Your Site', url: 'https://example.com' },
    FAQPage: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Your question?', acceptedAnswer: { '@type': 'Answer', text: 'Your answer.' } }] },
  };
  const tpl = templates[type] ?? { '@context': 'https://schema.org', '@type': type };
  return JSON.stringify(tpl, null, 2);
}

// ─── Main page ────────────────────────────────────────────────────────────────

function AuditPageInner() {
  const params = useParams<{ domain: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const domain = decodeURIComponent(params.domain ?? '');
  const auditId = searchParams.get('auditId');
  const isDemo = searchParams.get('demo') === 'true';
  const [activeTab, setActiveTab] = useState<TabId>('pages');

  // ── Main audit query ───────────────────────────────────────────────────────
  const { data, isLoading, error } = useQuery<AuditData>({
    queryKey: ['audit', domain, isDemo ? 'demo' : 'live'],
    queryFn: async () => {
      if (isDemo) {
        const res = await fetch(`/api/demo/${encodeURIComponent(domain)}`);
        if (!res.ok) throw new Error('Demo audit not available');
        const envelope = await res.json() as { state?: string; data?: AuditData } | AuditData;
        return ('data' in envelope && envelope.data) ? envelope.data : envelope as AuditData;
      }
      const listRes = await fetch(`/api/audits?pageSize=50`);
      if (!listRes.ok) throw new Error(`Failed to load audits (${listRes.status})`);
      const list = await listRes.json() as { data: AuditData[] };
      const match = list.data.find((a) => a.domain === domain && a.status === 'complete');
      if (!match) {
        const anyMatch = list.data.find((a) => a.domain === domain);
        if (!anyMatch) throw new Error('Audit not found');
        if (anyMatch.status === 'failed') throw new Error('Audit failed — please try again.');
        throw Object.assign(new Error('Audit completing…'), { retriable: true });
      }
      const detail = await fetch(`/api/audit/${match.id}`);
      if (!detail.ok) throw new Error(`Failed to load audit results (${detail.status})`);
      const envelope = await detail.json() as { state?: string; data?: AuditData } | AuditData;
      return ('data' in envelope && envelope.data) ? envelope.data : envelope as AuditData;
    },
    enabled: isDemo || !auditId, // demo mode always enabled; live mode waits for auditId
    staleTime: 60_000,
    // Retry aggressively for in-progress audits (race condition after SSE redirect),
    // conservatively for genuine fetch failures.
    retry: (count, err) => {
      if ((err as Error & { retriable?: boolean }).retriable) return count < 12;
      return count < 2;
    },
    retryDelay: (count, err) => {
      if ((err as Error & { retriable?: boolean }).retriable) return 2000;
      return 1000 * (count + 1);
    },
  });

  // ── v3 lazy queries — only fetch when tab is active ───────────────────────
  const auditId2 = data?.id ?? null;

  function unwrapGTL<T>(json: unknown): T {
    const obj = json as Record<string, unknown>;
    return (obj && typeof obj === 'object' && 'data' in obj && obj.data != null ? obj.data : obj) as T;
  }

  const { data: retrievalData, isLoading: retrievalLoading } = useQuery<RetrievalData>({
    queryKey: ['audit-retrieval', auditId2],
    queryFn: () => fetch(`/api/audit/${auditId2}/retrieval`).then((r) => r.json()).then(unwrapGTL<RetrievalData>),
    enabled: activeTab === 'retrieval' && !!auditId2,
    staleTime: 120_000,
  });
  const { data: machineTrustData, isLoading: machineTrustLoading } = useQuery<MachineTrustData>({
    queryKey: ['audit-machine-trust', auditId2],
    queryFn: () => fetch(`/api/audit/${auditId2}/machine-trust`).then((r) => r.json()).then(unwrapGTL<MachineTrustData>),
    enabled: !!auditId2,
    staleTime: 120_000,
  });
  const { data: temporalData, isLoading: temporalLoading } = useQuery<TemporalData>({
    queryKey: ['audit-temporal', auditId2],
    queryFn: () => fetch(`/api/audit/${auditId2}/temporal`).then((r) => r.json()).then(unwrapGTL<TemporalData>),
    enabled: activeTab === 'temporal' && !!auditId2,
    staleTime: 120_000,
  });
  const { data: surfacesData, isLoading: surfacesLoading } = useQuery<SurfacesData>({
    queryKey: ['audit-surfaces', auditId2],
    queryFn: () => fetch(`/api/audit/${auditId2}/surfaces`).then((r) => r.json()).then(unwrapGTL<SurfacesData>),
    enabled: !!auditId2,
    staleTime: 120_000,
  });
  const { data: authenticityData, isLoading: authenticityLoading } = useQuery<AuthenticityData>({
    queryKey: ['audit-authenticity', auditId2],
    queryFn: () => fetch(`/api/audit/${auditId2}/authenticity`).then((r) => r.json()).then(unwrapGTL<AuthenticityData>),
    enabled: !!auditId2,
    staleTime: 120_000,
  });
  const { data: perceptionData, isLoading: perceptionLoading } = useQuery<PerceptionGraphData>({
    queryKey: ['audit-perception-graph', auditId2],
    queryFn: () => fetch(`/api/audit/${auditId2}/perception-graph`).then((r) => r.json()).then(unwrapGTL<PerceptionGraphData>),
    enabled: activeTab === 'perception-graph' && !!auditId2,
    staleTime: 120_000,
  });
  const { data: schemaApiData, isLoading: schemaApiLoading } = useQuery<SchemaApiData>({
    queryKey: ['audit-schema', auditId2],
    queryFn: () => fetch(`/api/audit/${auditId2}/schema`).then((r) => r.json()).then(unwrapGTL<SchemaApiData>),
    enabled: activeTab === 'schema' && !!auditId2,
    staleTime: 120_000,
  });

  // SSE scores — fetch as soon as the audit is complete (not tab-gated)
  // Returns null when scores don't exist yet (404) so the panel stays hidden
  const { data: sseData } = useQuery<SseData | null>({
    queryKey: ['audit-sse', auditId2],
    queryFn: async () => {
      const r = await fetch(`/api/audit/${auditId2}/sse`);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('Failed to load SSE scores');
      const json = await r.json();
      return unwrapGTL<SseData | null>(json);
    },
    enabled: !!auditId2 && data?.status === 'complete',
    staleTime: 300_000,
    retry: false,
  });

  // If audit is still running, show progress UI
  if (auditId && (!data || data.status === 'running' || data.status === 'queued')) {
    return <AuditProgress domain={domain} auditId={auditId} />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050B09]">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-cyan border-t-transparent mx-auto" />
          <p className="text-[#4A6280] text-sm">Loading audit results...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    // Retriable sentinel = audit is completing (race condition) — keep showing a spinner
    if (error && (error as Error & { retriable?: boolean }).retriable) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#050B09]">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-cyan border-t-transparent mx-auto" />
            <p className="text-[#4A6280] text-sm">Finalizing audit results…</p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050B09]">
        <div className="text-center">
          <p className="text-lg font-semibold text-white">
            {error instanceof Error ? error.message : 'Audit not found'}
          </p>
          <button onClick={() => router.push('/dashboard')} className="mt-4 text-sm text-cyan underline">
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const criticalIssues = data.issues.filter((i) => i.severity === 'critical').slice(0, 3) as SEOIssue[];
  const totalIssues = data.issues.length;
  const avgTtfb = data.scores?.breakdown.performance.ttfb;

  return (
    <div className="min-h-screen bg-[#050B09]">

      {/* ── Demo banner ────────────────────────────────────────────────────── */}
      {isDemo && (
        <div className="border-b border-cyan/20 bg-cyan/[0.04] px-4 py-2.5 text-center">
          <p className="text-xs text-cyan">
            <span className="font-semibold">Demo Audit</span> — Sample crawl of <span className="font-semibold">{domain}</span> demonstrating SiteNexis capabilities.{' '}
            <Link href="/dashboard" className="underline hover:text-white">Run your own audit →</Link>
          </p>
        </div>
      )}

      {/* ── Sticky nav ──────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#050B09]/95 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {/* Logo — click to go back to dashboard */}
          <button
            onClick={() => router.push('/dashboard')}
            className="shrink-0 text-base font-bold text-white hover:opacity-80 transition-opacity"
            aria-label="Back to dashboard"
          >
            Site<span className="text-cyan">Nexis</span>
          </button>
          <span className="text-white/20">/</span>
          <span className="truncate font-semibold text-white text-sm">{domain}</span>
          {data.status === 'complete' && (
            <span className="hidden sm:inline rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-400">Complete</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="hidden text-xs text-[#4A6280] md:flex items-center gap-3">
            <span>Web <span className="font-bold text-cyan">{data.scores?.seoScore ?? '—'}</span></span>
            <span className="text-white/10">·</span>
            <span>AI <span className="font-bold text-[#8B5CF6]">{data.scores?.aiScore ?? '—'}</span></span>
          </span>
          <button
            onClick={() => router.push(`/dashboard`)}
            className="rounded-lg bg-cyan px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-navy hover:bg-teal transition-colors"
          >
            Re-run
          </button>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-6 py-8">

        {/* ── Three-Layer Intelligence Hero ─────────────────────────────── */}
        {(() => {
          const bd = data.scores?.breakdown;
          const aiv = data.aiVisibilityScores;
          const mr = bd?.machineReadability;
          const mrScore = aiv?.machineReadabilityScore ?? (mr ? Math.round((mr.renderingFidelity + mr.boilerplateRatio + mr.chunkBoundaryQuality + mr.signalToNoiseRatio + mr.headingHierarchy + mr.readingOrderConsistency + mr.linkAnchorQuality) / 7) : null);
          const entityScore = aiv?.entityConfidenceScore ?? bd?.entityIntelligence?.entityConfidenceScore ?? null;
          const citationScore = aiv?.citationProbabilityScore ?? bd?.citationAnalysis?.citationProbabilityScore ?? null;
          const trustScore = aiv?.semanticTrustScore ?? bd?.semanticTrust?.score ?? null;

          const webHealthScore = data.scores ? Math.round(
            (data.scores.seoScore * 0.35) +
            ((data.scores.performanceScore ?? 70) * 0.25) +
            ((data.scores.schemaScore ?? 0) * 0.20) +
            ((data.scores.linkGraphScore ?? 50) * 0.20)
          ) : null;

          const aiVisScore = aiv?.aiVisibilityScore ?? (data.scores ? Math.round(
            ((mrScore ?? 0) * 0.15) +
            ((entityScore ?? 0) * 0.25) +
            ((data.scores.aiScore ?? 0) * 0.20) +
            ((citationScore ?? 0) * 0.20) +
            ((trustScore ?? 0) * 0.20)
          ) : null);

          const competitiveScore = machineTrustData && surfacesData ? Math.round(
            ((machineTrustData.overall ?? 0) * 0.40) +
            ((surfacesData.overallSurfaceScore ?? 0) * 0.35) +
            ((citationScore ?? 0) * 0.25)
          ) : null;

          const statusLabel = (s: number | null) => {
            if (s == null) return { text: 'No Data', color: '#4A6280' };
            if (s >= 80) return { text: 'Strong', color: '#22C55E' };
            if (s >= 60) return { text: 'Moderate', color: '#0BCEBC' };
            if (s >= 40) return { text: 'Needs Work', color: '#F59E0B' };
            return { text: 'Critical', color: '#EF4444' };
          };

          return (
            <div className="mb-8 grid gap-4 lg:grid-cols-3">

              {/* ── Card 1: Web Health ──────────────────────────────────────── */}
              <div className="rounded-2xl border border-cyan/10 bg-gradient-to-br from-[#0A1628] to-[#0C1E35] p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan/10">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00C8FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                  </div>
                  <h3 className="text-sm font-semibold text-white">Web Health</h3>
                  <span className="ml-auto text-[10px] font-medium uppercase tracking-widest" style={{ color: statusLabel(webHealthScore).color }}>
                    {statusLabel(webHealthScore).text}
                  </span>
                </div>
                <div className="flex items-end gap-4 mb-5">
                  <ScoreGauge label="" score={webHealthScore} />
                  <div className="flex-1 space-y-2">
                    <InlineMetric label="SEO" value={data.scores?.seoScore ?? null} />
                    <InlineMetric label="Performance" value={data.scores?.performanceScore ?? null} />
                    <InlineMetric label="Schema" value={data.scores?.schemaScore ?? null} />
                    <InlineMetric label="Link Strength" value={data.scores?.linkGraphScore ?? null} />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[#4A6280]">
                  {avgTtfb != null && <span>TTFB <strong className="text-white">{avgTtfb}ms</strong></span>}
                  {data.pageCount != null && <span className="ml-auto"><strong className="text-white">{data.pageCount}</strong> pages</span>}
                </div>
              </div>

              {/* ── Card 2: AI Visibility ───────────────────────────────────── */}
              <div className="rounded-2xl border border-[#8B5CF6]/15 bg-gradient-to-br from-[#0A1628] to-[#15102A] p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8B5CF6]/10">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                  </div>
                  <h3 className="text-sm font-semibold text-white">AI Visibility</h3>
                  <span className="ml-auto text-[10px] font-medium uppercase tracking-widest" style={{ color: statusLabel(aiVisScore).color }}>
                    {statusLabel(aiVisScore).text}
                  </span>
                </div>
                <div className="flex items-end gap-4 mb-5">
                  <ScoreGauge label="" score={aiVisScore} />
                  <div className="flex-1 space-y-2">
                    <InlineMetric label="Entity Confidence" value={entityScore} />
                    <InlineMetric label="Citation Probability" value={citationScore} />
                    <InlineMetric label="Semantic Trust" value={trustScore} />
                    <InlineMetric label="Machine Readability" value={mrScore} />
                  </div>
                </div>
                <div className="text-[11px] text-[#4A6280]">
                  AI Readability <strong className="text-white">{data.scores?.aiScore ?? '—'}</strong>
                  <span className="mx-2 text-white/10">·</span>
                  Retrieval Readiness <strong className="text-white">{mrScore ?? '—'}</strong>
                </div>
              </div>

              {/* ── Card 3: Competitive Position ───────────────────────────── */}
              <div className="rounded-2xl border border-amber-500/15 bg-gradient-to-br from-[#0A1628] to-[#1A1508] p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
                  </div>
                  <h3 className="text-sm font-semibold text-white">Competitive Position</h3>
                  <span className="ml-auto text-[10px] font-medium uppercase tracking-widest" style={{ color: statusLabel(competitiveScore).color }}>
                    {statusLabel(competitiveScore).text}
                  </span>
                </div>
                <div className="flex items-end gap-4 mb-5">
                  <ScoreGauge label="" score={competitiveScore} />
                  <div className="flex-1 space-y-2">
                    <InlineMetric label="Machine Trust" value={machineTrustData?.overall ?? null} />
                    <InlineMetric label="Surface Coverage" value={surfacesData?.overallSurfaceScore ?? null} />
                    <InlineMetric label="Citation Strength" value={citationScore} />
                    <InlineMetric label="Authenticity" value={authenticityData?.entityAuthenticityConfidence ?? null} />
                  </div>
                </div>
                <div className="text-[11px] text-[#4A6280]">
                  {competitiveScore == null
                    ? <span>Click <strong className="text-white">Machine Trust</strong> or <strong className="text-white">Surfaces</strong> tab to load</span>
                    : <>Displacement risk <strong className="text-white">{100 - competitiveScore}</strong></>
                  }
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Audit summary bar ────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-wrap justify-center gap-6 text-sm text-[#4A6280]">
          {data.pageCount != null && <span><strong className="text-white">{data.pageCount}</strong> pages crawled</span>}
          <span><strong className="text-white">{totalIssues}</strong> issues found</span>
          {data.completedAt && (
            <span>Completed {new Date(data.completedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          )}
        </div>

        {/* ── SSE — SiteNexis Scoring Engine panel ─────────────────────────── */}
        {sseData && (
          <div className="mb-8 card-glass rounded-2xl p-5 sm:p-8">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-white text-base sm:text-lg">SiteNexis Scoring Engine</h2>
                <p className="text-xs text-[#4A6280] mt-0.5">SSE v3.1 — AI-native authority intelligence</p>
              </div>
              {/* SNS Master Score */}
              <div className="text-right">
                <div className="text-3xl sm:text-4xl font-black tabular-nums" style={{ color: scoreColor(sseData.snsMasterScore) }}>
                  {sseData.snsMasterScore}
                </div>
                <div className="text-xs font-semibold mt-0.5" style={{ color: scoreColor(sseData.snsMasterScore) }}>
                  SNS · {sseData.snsLabel}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* GEO Score */}
              <div className="rounded-xl border border-white/10 bg-white/3 p-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-[#4A6280] mb-2">GEO Score</div>
                <div className="text-2xl font-bold tabular-nums" style={{ color: scoreColor(sseData.geoScore ?? 0) }}>{sseData.geoScore ?? 0}</div>
                <div className="mt-2 space-y-1">
                  <BarMini label="Citation Prob" value={sseData.taBreakdown?.depth ?? 0} />
                  <BarMini label="Retrieval" value={sseData.taBreakdown?.breadth ?? 0} />
                  <BarMini label="Semantic Trust" value={sseData.taBreakdown?.interlinking ?? 0} />
                </div>
              </div>

              {/* Topical Authority */}
              <div className="rounded-xl border border-white/10 bg-white/3 p-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-[#4A6280] mb-2">Topical Authority</div>
                <div className="text-2xl font-bold tabular-nums" style={{ color: scoreColor(sseData.topicalAuthorityScore ?? 0) }}>{sseData.topicalAuthorityScore ?? 0}</div>
                <div className="mt-2 space-y-1">
                  <BarMini label="Depth" value={sseData.taBreakdown?.depth ?? 0} />
                  <BarMini label="Breadth" value={sseData.taBreakdown?.breadth ?? 0} />
                  <BarMini label="Interlinking" value={sseData.taBreakdown?.interlinking ?? 0} />
                  <BarMini label="Freshness" value={sseData.taBreakdown?.freshness ?? 0} />
                </div>
              </div>

              {/* Semantic Density */}
              <div className="rounded-xl border border-white/10 bg-white/3 p-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-[#4A6280] mb-2">Semantic Density</div>
                <div className="text-2xl font-bold tabular-nums" style={{ color: scoreColor(sseData.semanticDensityScore ?? 0) }}>{sseData.semanticDensityScore ?? 0}</div>
                <div className="mt-3 space-y-1.5 text-xs text-[#4A6280]">
                  <div className="flex justify-between"><span>Entities</span><span className="font-medium text-white">{sseData.sdsBreakdown?.entityCount ?? 0}</span></div>
                  <div className="flex justify-between"><span>Facts</span><span className="font-medium text-white">{sseData.sdsBreakdown?.factCount ?? 0}</span></div>
                  <div className="flex justify-between"><span>Raw density</span><span className="font-medium text-white">{sseData.sdsRawDensity ?? 0}/1k</span></div>
                </div>
              </div>

              {/* AI Crawlability */}
              <div className="rounded-xl border border-white/10 bg-white/3 p-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-[#4A6280] mb-2">AI Crawlability</div>
                <div className="text-2xl font-bold tabular-nums" style={{ color: scoreColor(sseData.aiCrawlabilityScore ?? 0) }}>{sseData.aiCrawlabilityScore ?? 0}</div>
                <div className="mt-2 space-y-1">
                  <BarMini label="Robots" value={sseData.aciBreakdown?.robots ?? 0} />
                  <BarMini label="Sitemap" value={sseData.aciBreakdown?.sitemap ?? 0} />
                  <BarMini label="Renderability" value={sseData.aciBreakdown?.renderability ?? 0} />
                  <BarMini label="Indexability" value={sseData.aciBreakdown?.indexability ?? 0} />
                </div>
              </div>
            </div>

            {/* SNS formula legend */}
            <p className="mt-4 text-[10px] text-[#3A5568] leading-relaxed">
              SNS = AVS×15% + GEO×15% + RR×10% + EC×10% + CP×10% + ST×10% + TA×10% + KGS×5% + ACI×5% + Schema×10%
              &nbsp;·&nbsp;
              GEO = CP×25% + RR×20% + ST×20% + TA×15% + MR×10% + EC×10%
            </p>
          </div>
        )}

        {/* ── Critical issues banner ───────────────────────────────────────── */}
        {criticalIssues.length > 0 && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/8 p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-red-400 text-lg">⚠️</span>
              <h2 className="font-semibold text-red-400">Fix These First — {criticalIssues.length} Critical Issue{criticalIssues.length !== 1 ? 's' : ''}</h2>
            </div>
            <div className="space-y-2">
              {criticalIssues.map((issue, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="shrink-0 text-red-400 mt-0.5">→</span>
                  <div>
                    <span className="text-white">{issue.message}</span>
                    {issue.url && <span className="ml-2 text-xs text-[#4A6280]">({issue.url.replace(/^https?:\/\//, '')})</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab nav ──────────────────────────────────────────────────────── */}
        <div className="mb-6 flex overflow-x-auto border-b border-white/10 gap-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {TAB_IDS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                'shrink-0 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
                activeTab === tab
                  ? 'border-cyan text-white'
                  : 'border-transparent text-[#4A6280] hover:text-white',
              ].join(' ')}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* ── Tab content ──────────────────────────────────────────────────── */}
        <div>
          {activeTab === 'pages'              && <PagesTab data={data} />}
          {activeTab === 'action-plan'        && <ActionPlanTab data={data} />}
          {activeTab === 'seo'                && <SeoTab data={data} />}
          {activeTab === 'ai'                 && <AiTab data={data} />}
          {activeTab === 'machine-readability' && <MachineReadabilityTab data={data} />}
          {activeTab === 'entity'             && <EntityTab data={data} />}
          {activeTab === 'citation'           && <CitationTab data={data} />}
          {activeTab === 'semantic-trust'     && <SemanticTrustTab data={data} />}
          {activeTab === 'schema'             && <SchemaTab data={data} {...(schemaApiData ? { schemaApi: schemaApiData } : {})} schemaApiLoading={schemaApiLoading} />}
          {activeTab === 'content'            && <ContentTab data={data} />}
          {activeTab === 'performance'        && <PerformanceTab data={data} />}
          {activeTab === 'retrieval'        && <RetrievalTab d={retrievalData} loading={retrievalLoading} />}
          {activeTab === 'machine-trust'    && <MachineTrustTab d={machineTrustData} loading={machineTrustLoading} />}
          {activeTab === 'temporal'         && <TemporalTab d={temporalData} loading={temporalLoading} />}
          {activeTab === 'surfaces'         && <SurfacesTab d={surfacesData} loading={surfacesLoading} />}
          {activeTab === 'authenticity'     && <AuthenticityTab d={authenticityData} loading={authenticityLoading} />}
          {activeTab === 'perception-graph' && <PerceptionGraphTab d={perceptionData} loading={perceptionLoading} />}
          {activeTab === 'links'       && (
            <div className="space-y-6">
              {data.linkGraph ? (
                <LinkGraph graph={data.linkGraph} />
              ) : (
                <div className="card-glass rounded-xl p-8 text-center">
                  <p className="text-[#4A6280]">Link graph data not yet available for this audit.</p>
                </div>
              )}
              {/* Orphan list */}
              {data.linkGraph && (data.linkGraph.orphanPages ?? []).length > 0 && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
                  <h3 className="mb-3 font-semibold text-red-400">
                    Orphan Pages ({data.linkGraph.orphanPages.length})
                  </h3>
                  <ul className="space-y-1">
                    {data.linkGraph.orphanPages.slice(0, 15).map((url, i) => (
                      <li key={i} className="text-xs text-[#4A6280]">{url}</li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Link suggestions */}
              {data.linkGraph && (data.linkGraph.linkSuggestions ?? []).length > 0 && (
                <div className="rounded-xl border border-cyan/20 bg-cyan/5 p-5">
                  <h3 className="mb-3 font-semibold text-cyan">
                    Link Suggestions ({data.linkGraph.linkSuggestions.length})
                  </h3>
                  <div className="space-y-2">
                    {data.linkGraph.linkSuggestions.slice(0, 10).map((s, i) => (
                      <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-[#4A6280]">
                        {s.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Floating PDF button ──────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => {
            if (data?.id) {
              void fetch(`/api/audit/${data.id}/report`, { method: 'POST' });
            }
          }}
          className="flex items-center gap-2 rounded-full bg-navy border border-white/20 px-5 py-3 text-sm font-semibold text-white shadow-xl hover:border-cyan/40 hover:bg-[#0A1F14] transition-all"
        >
          <span>↓</span>
          Download PDF Report
        </button>
      </div>

    </div>
  );
}

function AuditPageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050B09]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
    </div>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<AuditPageFallback />}>
      <AuditPageInner />
    </Suspense>
  );
}
