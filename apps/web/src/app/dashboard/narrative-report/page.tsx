'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useLatestAudit, useAuditSubReport, useMe } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { BookOpen, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { ExecutiveSummaryOutput } from '@sitenexis/analyzers';

// ── Executive Summary types ──────────────────────────────────────────────────

interface ExecSummaryData extends ExecutiveSummaryOutput {
  auditId: string;
  modelVersion: string;
}

// ── Technical report types ────────────────────────────────────────────────────

interface NarrativeData {
  auditId: string;
  domain: string;
  generatedAt: string;
  modelVersion: string;
  sections?: Record<string, unknown>;
  scoring_layer?: Record<string, unknown>;
  technical_seo_audit?: Record<string, unknown>;
  entity_intelligence?: Record<string, unknown>;
  retrieval_simulation?: Record<string, unknown>;
  machine_trust_analysis?: Record<string, unknown>;
  citation_probability?: Record<string, unknown>;
  surface_coverage?: Record<string, unknown>;
  issues_and_fix_engine?: Record<string, unknown>;
  competitive_position?: Record<string, unknown>;
  decision_engine?: Record<string, unknown>;
  final_verdict?: Record<string, unknown>;
  [key: string]: unknown;
}

// ── Score helpers ─────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 9) return '#22C55E';
  if (score >= 7.5) return '#0BCEBC';
  if (score >= 6) return '#F59E0B';
  return '#EF4444';
}

function scoreBg(score: number): string {
  if (score >= 9) return 'rgba(34,197,94,0.08)';
  if (score >= 7.5) return 'rgba(11,206,188,0.08)';
  if (score >= 6) return 'rgba(245,158,11,0.08)';
  return 'rgba(239,68,68,0.08)';
}

// ── Executive Summary UI ──────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const fill = (score / 10) * circ;
  const color = scoreColor(score);
  return (
    <svg width={56} height={56} viewBox="0 0 56 56">
      <circle cx={28} cy={28} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
      <circle
        cx={28} cy={28} r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={`${fill} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 28 28)"
      />
      <text x={28} y={33} textAnchor="middle" fill={color} fontSize={13} fontWeight={700} fontFamily="system-ui">
        {score.toFixed(1)}
      </text>
    </svg>
  );
}

function CompositeHero({ data }: { data: ExecSummaryData }) {
  return (
    <div
      className="rounded-2xl border border-white/[0.08] p-6 mb-2"
      style={{ background: 'linear-gradient(135deg, rgba(0,200,255,0.04) 0%, rgba(11,206,188,0.04) 100%)' }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-6">
        {/* Composite score ring */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <svg width={96} height={96} viewBox="0 0 96 96">
            {(() => {
              const r = 38;
              const circ = 2 * Math.PI * r;
              const fill = (data.composite_score / 10) * circ;
              const color = scoreColor(data.composite_score);
              return (
                <>
                  <circle cx={48} cy={48} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
                  <circle
                    cx={48} cy={48} r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth={6}
                    strokeDasharray={`${fill} ${circ}`}
                    strokeLinecap="round"
                    transform="rotate(-90 48 48)"
                  />
                  <text x={48} y={45} textAnchor="middle" fill={color} fontSize={22} fontWeight={800} fontFamily="system-ui">
                    {data.composite_score.toFixed(1)}
                  </text>
                  <text x={48} y={61} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={9} fontFamily="system-ui">
                    / 10
                  </text>
                </>
              );
            })()}
          </svg>
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ color: scoreColor(data.composite_score), background: scoreBg(data.composite_score) }}
          >
            {data.composite_label}
          </span>
        </div>

        {/* Verdict text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#4A6280] mb-1 uppercase tracking-wider">Executive Assessment</p>
          <h2 className="text-lg font-bold text-white mb-3 leading-snug">{data.domain}</h2>
          <p className="text-sm text-[#C8DFE8] leading-relaxed mb-4">{data.overall_verdict}</p>
          <p className="text-xs text-[#4A6280] italic">{data.trajectory}</p>
        </div>
      </div>

      {/* Benchmark + recommendations */}
      <div className="mt-5 pt-5 border-t border-white/[0.06] grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4A6280] mb-2">Benchmark</p>
          <p className="text-xs text-[#C8DFE8]">{data.benchmark_statement}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4A6280] mb-2">Top Recommendations</p>
          <ol className="space-y-1">
            {data.top_recommendations.slice(0, 5).map((r, i) => (
              <li key={i} className="text-xs text-[#C8DFE8] flex gap-2">
                <span className="shrink-0 text-[#0BCEBC] font-bold">{i + 1}.</span>
                {r}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function SectionCard({ section }: { section: ExecSummaryData['sections'][number] }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-start gap-4">
        <ScoreRing score={section.score} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-white">{section.name}</h3>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ color: scoreColor(section.score), background: scoreBg(section.score) }}
            >
              {section.score_label}
            </span>
          </div>
          <p className="text-xs text-[#C8DFE8] leading-relaxed mb-3">{section.narrative}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {section.strengths.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#22C55E] mb-1">Strengths</p>
                <ul className="space-y-0.5">
                  {section.strengths.map((s, i) => (
                    <li key={i} className="text-[11px] text-[#C8DFE8] flex gap-1.5">
                      <span className="text-[#22C55E] mt-0.5">✓</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {section.issues.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#F59E0B] mb-1">Issues</p>
                <ul className="space-y-0.5">
                  {section.issues.map((s, i) => (
                    <li key={i} className="text-[11px] text-[#C8DFE8] flex gap-1.5">
                      <span className="text-[#F59E0B] mt-0.5">⚠</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Technical report renderer (unchanged) ────────────────────────────────────

function renderValue(val: unknown, depth: number = 0): React.ReactNode {
  if (val == null) return <span className="text-[#4A6280]">—</span>;
  if (typeof val === 'string') return <span className="text-[#C8DFE8]">{val}</span>;
  if (typeof val === 'number') return <span className="text-cyan tabular-nums font-semibold">{val}</span>;
  if (typeof val === 'boolean') return <span className={val ? 'text-green-400' : 'text-red-400'}>{val ? 'Yes' : 'No'}</span>;
  if (Array.isArray(val)) {
    if (val.length === 0) return <span className="text-[#4A6280]">None</span>;
    if (typeof val[0] === 'string') {
      return (
        <ul className="space-y-1">
          {val.map((item, i) => <li key={i} className="text-xs text-[#C8DFE8]">• {String(item)}</li>)}
        </ul>
      );
    }
    return (
      <div className="space-y-2">
        {val.map((item, i) => <div key={i}>{renderValue(item, depth + 1)}</div>)}
      </div>
    );
  }
  if (typeof val === 'object') {
    const entries = Object.entries(val as Record<string, unknown>);
    if (depth > 2) return <span className="text-[#4A6280] text-[10px]">[nested]</span>;
    return (
      <div className={`space-y-2 ${depth > 0 ? 'ml-3 pl-3 border-l border-white/[0.06]' : ''}`}>
        {entries.map(([k, v]) => (
          <div key={k}>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#7A9AB4]">{k.replace(/_/g, ' ')}</span>
            <div className="mt-0.5">{renderValue(v, depth + 1)}</div>
          </div>
        ))}
      </div>
    );
  }
  return <span className="text-[#4A6280]">{String(val)}</span>;
}

const SKIP_KEYS = new Set(['auditId', 'domain', 'generatedAt', 'modelVersion']);

const SECTION_ORDER = [
  'scoring_layer',
  'technical_seo_audit',
  'entity_intelligence',
  'retrieval_simulation',
  'machine_trust_analysis',
  'citation_probability',
  'surface_coverage',
  'issues_and_fix_engine',
  'competitive_position',
  'decision_engine',
  'final_verdict',
];

function sectionLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NarrativeReportPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { audit, isLoading: auditLoading } = useLatestAudit();
  const { data: execData, isLoading: execLoading } = useAuditSubReport<ExecSummaryData>(
    audit?.id ?? null,
    'executive-summary',
  );
  const { data, isLoading: techLoading } = useAuditSubReport<NarrativeData>(
    audit?.id ?? null,
    'narrative-report',
  );
  const [techExpanded, setTechExpanded] = useState(false);

  const loading = auditLoading || execLoading || techLoading;

  const orderedSections: Array<[string, unknown]> = [];
  if (data) {
    for (const key of SECTION_ORDER) {
      if (key in data && data[key] != null) orderedSections.push([key, data[key]]);
    }
    for (const [key, val] of Object.entries(data)) {
      if (SKIP_KEYS.has(key) || SECTION_ORDER.includes(key)) continue;
      if (val != null && typeof val === 'object') orderedSections.push([key, val]);
    }
  }

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
            <div className="mb-1 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">Intelligence Report</h1>
            </div>
            <p className="text-sm text-[#4A6280]">
              {audit
                ? <>AI-synthesized assessment for <span className="text-[#7A9AB4]">{audit.domain}</span> — <a href={`/audit/${encodeURIComponent(audit.domain)}?auditId=${audit.id}`} className="text-cyan hover:underline inline-flex items-center gap-1">full report <ExternalLink className="h-3 w-3" /></a></>
                : 'Multi-agent intelligence synthesized into a structured narrative'}
            </p>
          </div>
          {execData && (
            <div className="text-right text-[10px] text-[#4A6280]">
              <div>Model: {execData.modelVersion}</div>
              <div>Generated: {new Date(data?.generatedAt ?? Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-white/[0.03]" />)}
          </div>
        )}

        {/* No data */}
        {!loading && !execData && !data && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <BookOpen className="h-8 w-8 text-[#4A6280] mx-auto mb-3" />
            <p className="text-white font-semibold">No report available</p>
            <p className="mt-1 text-sm text-[#4A6280]">Run an audit to generate an AI intelligence narrative.</p>
          </div>
        )}

        {/* ── Executive Summary ─────────────────────────────────────────── */}
        {!loading && execData && (
          <div className="space-y-3 mb-8">
            <CompositeHero data={execData} />
            <div className="grid gap-3 sm:grid-cols-2">
              {execData.sections?.map((section) => (
                <SectionCard key={section.name} section={section} />
              ))}
            </div>
          </div>
        )}

        {/* ── Technical Report (collapsible) ───────────────────────────── */}
        {!loading && orderedSections.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setTechExpanded((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3 text-left hover:bg-white/[0.04] transition-colors"
            >
              <span className="text-sm font-semibold text-[#7A9AB4]">Full Technical Report</span>
              {techExpanded
                ? <ChevronDown className="h-4 w-4 text-[#4A6280]" />
                : <ChevronRight className="h-4 w-4 text-[#4A6280]" />
              }
            </button>
            {techExpanded && (
              <div className="mt-3 space-y-5">
                {orderedSections.map(([key, val]) => (
                  <div key={key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                    <h2 className="mb-4 text-sm font-semibold text-white">{sectionLabel(key)}</h2>
                    <div className="text-xs">{renderValue(val)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
