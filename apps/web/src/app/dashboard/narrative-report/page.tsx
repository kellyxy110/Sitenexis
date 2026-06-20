'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useLatestAudit, useAuditSubReport, useMe } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { BookOpen, ExternalLink } from 'lucide-react';

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

export default function NarrativeReportPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { audit, isLoading: auditLoading } = useLatestAudit();
  const { data, isLoading } = useAuditSubReport<NarrativeData>(audit?.id ?? null, 'narrative-report');

  const loading = auditLoading || isLoading;

  const orderedSections: Array<[string, unknown]> = [];
  if (data) {
    for (const key of SECTION_ORDER) {
      if (key in data && data[key] != null) {
        orderedSections.push([key, data[key]]);
      }
    }
    for (const [key, val] of Object.entries(data)) {
      if (SKIP_KEYS.has(key) || SECTION_ORDER.includes(key)) continue;
      if (val != null && typeof val === 'object') {
        orderedSections.push([key, val]);
      }
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
        <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">Narrative Intelligence Report</h1>
            </div>
            <p className="text-sm text-[#4A6280]">
              {audit
                ? <>AI-synthesized report for <span className="text-[#7A9AB4]">{audit.domain}</span> — <a href={`/audit/${encodeURIComponent(audit.domain)}?auditId=${audit.id}`} className="text-cyan hover:underline inline-flex items-center gap-1">full report <ExternalLink className="h-3 w-3" /></a></>
                : 'Multi-agent intelligence synthesized into a structured narrative'}
            </p>
          </div>
          {data && (
            <div className="text-right text-[10px] text-[#4A6280]">
              <div>Model: {data.modelVersion}</div>
              <div>Generated: {new Date(data.generatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            </div>
          )}
        </div>

        {loading && (
          <div className="space-y-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-white/[0.03]" />)}</div>
        )}

        {!loading && !data && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <BookOpen className="h-8 w-8 text-[#4A6280] mx-auto mb-3" />
            <p className="text-white font-semibold">No narrative report available</p>
            <p className="mt-1 text-sm text-[#4A6280]">Run an audit to generate an AI intelligence narrative.</p>
          </div>
        )}

        {data && orderedSections.length > 0 && (
          <div className="space-y-5">
            {orderedSections.map(([key, val]) => (
              <div key={key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h2 className="mb-4 text-sm font-semibold text-white">{sectionLabel(key)}</h2>
                <div className="text-xs">{renderValue(val)}</div>
              </div>
            ))}
          </div>
        )}

        {data && orderedSections.length === 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <p className="text-[#4A6280]">Report generated but contains no structured sections. Check the raw audit report for details.</p>
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
