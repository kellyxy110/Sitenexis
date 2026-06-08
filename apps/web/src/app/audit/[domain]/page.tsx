'use client';

import { useState, useEffect, useRef } from 'react';
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
    seoScore: number | null;
    aiScore: number | null;
    wordCount: number;
    responseTimeMs?: number;
    schemaData?: unknown[];
  }>;
  linkGraph?: InternalLinkGraph | null;
}

const TAB_IDS = [
  'seo', 'ai', 'machine-readability', 'entity', 'citation', 'semantic-trust',
  'schema', 'links', 'content', 'performance',
  'retrieval', 'machine-trust', 'temporal', 'surfaces', 'authenticity', 'perception-graph',
] as const;
type TabId = typeof TAB_IDS[number];
const TAB_LABELS: Record<TabId, string> = {
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

      <IssuesTable issues={seoIssues} />
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

function SchemaTab({ data }: { data: AuditData }) {
  const [copied, setCopied] = useState<number | null>(null);
  const schemaIssues = (data.issues.filter((i) => i.module === 'schema') as SEOIssue[]);

  // Gather detected schema types from pages
  const detectedTypes = Array.from(new Set(
    data.pages.flatMap((p) =>
      (p.schemaData as Array<Record<string, unknown>> | undefined ?? [])
        .map((s) => String(s['@type'] ?? ''))
        .filter(Boolean)
    )
  ));

  return (
    <div className="space-y-8">
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

      <IssuesTable issues={schemaIssues} />

      {/* Snippet copy area */}
      {detectedTypes.slice(0, 3).map((type, i) => {
        const snippet = generateSnippetPreview(type);
        return (
          <div key={type} className="card-glass rounded-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <span className="text-sm font-semibold text-white">{type} Schema Snippet</span>
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(snippet);
                  setCopied(i);
                  setTimeout(() => setCopied(null), 1500);
                }}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  copied === i ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-[#4A6280] hover:text-white'
                }`}
              >
                {copied === i ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="overflow-x-auto p-5 text-xs text-[#4A6280] leading-relaxed font-mono">
              {snippet}
            </pre>
          </div>
        );
      })}
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

      <IssuesTable issues={perfIssues} />
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

      {mrIssues.length > 0 && <IssuesTable issues={mrIssues} />}
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

      {entityIssues.length > 0 && <IssuesTable issues={entityIssues} />}
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-white">Citation Probability Score</h3>
            <p className="mt-1 text-xs text-[#4A6280]">Likelihood that AI systems select this content as a citation source</p>
          </div>
          <div className="text-right">
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

      {citationIssues.length > 0 && <IssuesTable issues={citationIssues} />}
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-white">Semantic Trust Score</h3>
            <p className="mt-1 text-xs text-[#4A6280]">How much credibility AI systems assign to content on this site</p>
          </div>
          <span className="text-4xl font-bold tabular-nums" style={{ color: scoreColor(st.score) }}>{Math.round(st.score)}</span>
        </div>
        <div className="space-y-4">
          {trustBreakdown.map(({ label, score, desc }) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1">
                <div>
                  <span className="text-white font-medium">{label}</span>
                  <span className="ml-2 text-[#4A6280]">{desc}</span>
                </div>
                <span className="font-semibold tabular-nums" style={{ color: scoreColor(score) }}>{Math.round(score)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${Math.min(100, score)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {trustIssues.length > 0 && <IssuesTable issues={trustIssues} />}
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
              {d.results.slice(0, 20).map((r, i) => (
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-white">Machine Trust Score</h3>
            <p className="mt-1 text-xs text-[#4A6280]">Confidence an AI model would have in using this content as a reliable source</p>
          </div>
          <div className="text-right">
            <span className="text-4xl font-bold tabular-nums" style={{ color: scoreColor(d.overall) }}>{d.overall}</span>
            <p className="mt-0.5 text-xs text-[#4A6280]">Cross-source validation: {Math.round(d.crossSourceValidationIndex * 100)}%</p>
          </div>
        </div>
        <div className="space-y-4">
          {subScores.map(({ label, score, desc }) => (
            <div key={label}>
              <div className="flex justify-between text-xs mb-1">
                <div><span className="text-white font-medium">{label}</span><span className="ml-2 text-[#4A6280]">{desc}</span></div>
                <span className="font-semibold tabular-nums" style={{ color: score != null ? scoreColor(score) : '#4A6280' }}>{score != null ? Math.round(score) : 'N/A'}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${Math.min(100, score ?? 0)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {d.trustIssues.length > 0 && (
        <div className="card-glass rounded-xl overflow-hidden">
          <div className="border-b border-white/10 px-5 py-3"><h3 className="font-semibold text-white">Trust Issues ({d.trustIssues.length})</h3></div>
          <div className="divide-y divide-white/[0.04]">
            {d.trustIssues.map((issue, i) => (
              <div key={i} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${issue.severity === 'critical' ? 'bg-red-500/15 text-red-400' : issue.severity === 'warning' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'}`}>{issue.severity}</span>
                  <div>
                    <p className="text-sm text-white">{issue.description}</p>
                    <p className="mt-1 text-xs text-[#4A6280]">→ {issue.recommendation}</p>
                  </div>
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
      {d.temporalIssues.length > 0 && (
        <div className="card-glass rounded-xl overflow-hidden">
          <div className="border-b border-white/10 px-5 py-3"><h3 className="font-semibold text-white">Temporal Issues ({d.temporalIssues.length})</h3></div>
          <div className="divide-y divide-white/[0.04]">
            {d.temporalIssues.map((issue, i) => (
              <div key={i} className="px-5 py-4">
                <span className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${issue.severity === 'critical' ? 'bg-red-500/15 text-red-400' : issue.severity === 'warning' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'}`}>{issue.severity}</span>
                <p className="text-sm text-white">{issue.description}</p>
                <p className="mt-1 text-xs text-[#4A6280]">→ {issue.recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {d.stalePagesAtRisk.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <h3 className="mb-3 font-semibold text-amber-400">Stale Pages at Risk ({d.stalePagesAtRisk.length})</h3>
          <ul className="space-y-1">{d.stalePagesAtRisk.map((url, i) => <li key={i} className="text-xs text-[#4A6280]">{url}</li>)}</ul>
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
              {data.blockers.length > 0 && (
                <div className="mt-3 space-y-1">
                  {data.blockers.map((b, i) => <p key={i} className="text-xs text-[#4A6280]">⚠ {b.description}</p>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {d.coverageGaps.length > 0 && (
        <div className="card-glass rounded-xl overflow-hidden">
          <div className="border-b border-white/10 px-5 py-3"><h3 className="font-semibold text-white">Coverage Gaps</h3></div>
          <div className="divide-y divide-white/[0.04]">
            {d.coverageGaps.map((gap, i) => (
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
      {d.detectedPatterns.length === 0 && d.flaggedEntities.length === 0 ? (
        <div className="card-glass rounded-xl p-8 text-center">
          <p className="text-green-400 font-semibold">No synthetic patterns detected</p>
          <p className="mt-1 text-xs text-[#4A6280]">All entity signals appear organic and authentic.</p>
        </div>
      ) : (
        <div className="card-glass rounded-xl overflow-hidden">
          <div className="border-b border-white/10 px-5 py-3"><h3 className="font-semibold text-white">Detected Patterns ({d.detectedPatterns.length})</h3></div>
          <div className="divide-y divide-white/[0.04]">
            {d.detectedPatterns.map((p, i) => (
              <div key={i} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-white capitalize">{p.patternType.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-[#4A6280]">confidence: {Math.round(p.confidence * 100)}%</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${p.severity === 'critical' ? 'bg-red-500/15 text-red-400' : p.severity === 'warning' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'}`}>{p.severity}</span>
                </div>
                <ul className="mt-1 space-y-0.5">{p.evidence.map((ev, j) => <li key={j} className="text-xs text-[#4A6280]">• {ev}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      )}
      {d.recommendations.length > 0 && (
        <div className="rounded-xl border border-cyan/20 bg-cyan/5 p-5">
          <h3 className="mb-3 font-semibold text-cyan">Recommendations</h3>
          <ul className="space-y-2">{d.recommendations.map((r, i) => <li key={i} className="flex gap-2 text-xs text-[#4A6280]"><span className="shrink-0 text-cyan">→</span>{r}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

// ─── v3 Tab: Perception Graph ─────────────────────────────────────────────────

function PerceptionGraphTab({ d }: { d: PerceptionGraphData | undefined; loading: boolean }) {
  if (!d) return <V3Loading label="Perception Graph" />;
  const nodeTypeColors: Record<string, string> = { entity: '#00C8FF', topic: '#0BCEBC', claim: '#F59E0B', page: '#7A9AB4' };
  const sorted = [...d.nodes].sort((a, b) => b.confidence - a.confidence);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="card-glass rounded-xl p-4 text-center"><span className="text-2xl font-bold text-white">{d.nodes.length}</span><p className="mt-1 text-xs text-[#4A6280]">Nodes</p></div>
        <div className="card-glass rounded-xl p-4 text-center"><span className="text-2xl font-bold text-white">{d.edges.length}</span><p className="mt-1 text-xs text-[#4A6280]">Edges</p></div>
        <div className="card-glass rounded-xl p-4 text-center">
          <span className="text-2xl font-bold text-white">{d.nodes.length > 0 ? Math.round(d.nodes.reduce((s, n) => s + n.confidence, 0) / d.nodes.length * 100) : '—'}%</span>
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
      {d.edges.length > 0 && (
        <div className="card-glass rounded-xl overflow-hidden">
          <div className="border-b border-white/10 px-5 py-3"><h3 className="font-semibold text-white">Top Relationships</h3></div>
          <div className="divide-y divide-white/[0.04]">
            {[...d.edges].sort((a, b) => b.strength - a.strength).slice(0, 10).map((edge, i) => {
              const src = d.nodes.find((n) => n.id === edge.source);
              const tgt = d.nodes.find((n) => n.id === edge.target);
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

export default function AuditPage() {
  const params = useParams<{ domain: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const domain = decodeURIComponent(params.domain ?? '');
  const auditId = searchParams.get('auditId');
  const [activeTab, setActiveTab] = useState<TabId>('seo');

  // ── Main audit query ───────────────────────────────────────────────────────
  const { data, isLoading, error } = useQuery<AuditData>({
    queryKey: ['audit', domain],
    queryFn: async () => {
      // Find most recent completed audit for this domain
      const listRes = await fetch(`/api/audits?pageSize=50`);
      if (!listRes.ok) throw new Error(`Failed to load audits (${listRes.status})`);
      const list = await listRes.json() as { data: AuditData[] };
      const match = list.data.find((a) => a.domain === domain && a.status === 'complete');
      if (!match) {
        // Also accept any status (e.g. failed) so user gets feedback
        const anyMatch = list.data.find((a) => a.domain === domain);
        if (!anyMatch) throw new Error('Audit not found');
        if (anyMatch.status === 'failed') throw new Error('Audit failed — please try again.');
        throw new Error('Audit not found');
      }
      const detail = await fetch(`/api/audit/${match.id}`);
      if (!detail.ok) throw new Error(`Failed to load audit results (${detail.status})`);
      return detail.json() as Promise<AuditData>;
    },
    enabled: !auditId, // if auditId present, show progress first
    staleTime: 60_000,
    retry: 3,
    retryDelay: 1000,
  });

  // ── v3 lazy queries — only fetch when tab is active ───────────────────────
  const auditId2 = data?.id ?? null;

  const { data: retrievalData, isLoading: retrievalLoading } = useQuery<RetrievalData>({
    queryKey: ['audit-retrieval', auditId2],
    queryFn: () => fetch(`/api/audit/${auditId2}/retrieval`).then((r) => r.json() as Promise<RetrievalData>),
    enabled: activeTab === 'retrieval' && !!auditId2,
    staleTime: 120_000,
  });
  const { data: machineTrustData, isLoading: machineTrustLoading } = useQuery<MachineTrustData>({
    queryKey: ['audit-machine-trust', auditId2],
    queryFn: () => fetch(`/api/audit/${auditId2}/machine-trust`).then((r) => r.json() as Promise<MachineTrustData>),
    enabled: activeTab === 'machine-trust' && !!auditId2,
    staleTime: 120_000,
  });
  const { data: temporalData, isLoading: temporalLoading } = useQuery<TemporalData>({
    queryKey: ['audit-temporal', auditId2],
    queryFn: () => fetch(`/api/audit/${auditId2}/temporal`).then((r) => r.json() as Promise<TemporalData>),
    enabled: activeTab === 'temporal' && !!auditId2,
    staleTime: 120_000,
  });
  const { data: surfacesData, isLoading: surfacesLoading } = useQuery<SurfacesData>({
    queryKey: ['audit-surfaces', auditId2],
    queryFn: () => fetch(`/api/audit/${auditId2}/surfaces`).then((r) => r.json() as Promise<SurfacesData>),
    enabled: activeTab === 'surfaces' && !!auditId2,
    staleTime: 120_000,
  });
  const { data: authenticityData, isLoading: authenticityLoading } = useQuery<AuthenticityData>({
    queryKey: ['audit-authenticity', auditId2],
    queryFn: () => fetch(`/api/audit/${auditId2}/authenticity`).then((r) => r.json() as Promise<AuthenticityData>),
    enabled: activeTab === 'authenticity' && !!auditId2,
    staleTime: 120_000,
  });
  const { data: perceptionData, isLoading: perceptionLoading } = useQuery<PerceptionGraphData>({
    queryKey: ['audit-perception-graph', auditId2],
    queryFn: () => fetch(`/api/audit/${auditId2}/perception-graph`).then((r) => r.json() as Promise<PerceptionGraphData>),
    enabled: activeTab === 'perception-graph' && !!auditId2,
    staleTime: 120_000,
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050B09]">
        <div className="text-center">
          <p className="text-lg font-semibold text-white">Audit not found</p>
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

      {/* ── Sticky nav ──────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#050B09]/95 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button onClick={() => router.push('/dashboard')} className="shrink-0 text-[#4A6280] hover:text-white transition-colors text-sm">← <span className="hidden sm:inline">Dashboard</span></button>
          <span className="text-white/20">/</span>
          <span className="truncate font-semibold text-white text-sm">{domain}</span>
          {data.status === 'complete' && (
            <span className="hidden sm:inline rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-400">Complete</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="hidden text-xs text-[#4A6280] md:block">
            Overall: <span className="font-bold text-white">{data.scores?.overall ?? '—'}</span>
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

        {/* ── Score hero ───────────────────────────────────────────────────── */}
        <div className="mb-8 card-glass rounded-2xl p-4 sm:p-8">
          <div className="mb-6 flex flex-wrap justify-center gap-4 sm:gap-8">
            <ScoreGauge label="SEO Health"         score={data.scores?.seoScore ?? null} />
            <ScoreGauge label="AI Readability"     score={data.scores?.aiScore ?? null} />
            <ScoreGauge label="Machine Readability"score={data.scores?.breakdown?.machineReadability ? Math.round((data.scores.breakdown.machineReadability.renderingFidelity + data.scores.breakdown.machineReadability.boilerplateRatio + data.scores.breakdown.machineReadability.chunkBoundaryQuality + data.scores.breakdown.machineReadability.signalToNoiseRatio + data.scores.breakdown.machineReadability.headingHierarchy + data.scores.breakdown.machineReadability.readingOrderConsistency + data.scores.breakdown.machineReadability.linkAnchorQuality) / 7) : null} />
            <ScoreGauge label="Entity Confidence"  score={data.scores?.breakdown?.entityIntelligence?.entityConfidenceScore ?? null} />
            <ScoreGauge label="Citation Probability" score={data.scores?.breakdown?.citationAnalysis?.citationProbabilityScore ?? null} />
            <ScoreGauge label="Semantic Trust"     score={data.scores?.breakdown?.semanticTrust?.score ?? null} />
            <ScoreGauge label="Schema"             score={data.scores?.schemaScore ?? null} />
            <ScoreGauge label="Link Strength"      score={data.scores?.linkGraphScore ?? null} />
            <ScoreGauge label="Performance"        score={data.scores?.performanceScore ?? null} />
          </div>
          <div className="flex flex-wrap justify-center gap-6 border-t border-white/10 pt-6 text-sm text-[#4A6280]">
            {data.pageCount != null && <span><strong className="text-white">{data.pageCount}</strong> pages crawled</span>}
            <span><strong className="text-white">{totalIssues}</strong> issues found</span>
            {avgTtfb != null && <span><strong className="text-white">{avgTtfb}ms</strong> avg response time</span>}
            {data.completedAt && (
              <span>Completed {new Date(data.completedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            )}
          </div>
        </div>

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
                    <span className="ml-2 text-xs text-[#4A6280]">({issue.url.replace(/^https?:\/\//, '')})</span>
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
          {activeTab === 'seo'                && <SeoTab data={data} />}
          {activeTab === 'ai'                 && <AiTab data={data} />}
          {activeTab === 'machine-readability' && <MachineReadabilityTab data={data} />}
          {activeTab === 'entity'             && <EntityTab data={data} />}
          {activeTab === 'citation'           && <CitationTab data={data} />}
          {activeTab === 'semantic-trust'     && <SemanticTrustTab data={data} />}
          {activeTab === 'schema'             && <SchemaTab data={data} />}
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
