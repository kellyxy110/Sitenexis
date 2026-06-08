'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAudits } from '@/lib/use-audit-data';
import { Code2, Copy, Check, AlertCircle, Sparkles, FileJson } from 'lucide-react';
import { useState, Suspense } from 'react';

interface SchemaSnippet {
  url: string;
  schemaType: string;
  snippet: string;
  isNew: boolean;
}

interface SchemaData {
  schemaScore: number | null;
  coverage: number | null;
  snippets: SchemaSnippet[];
  totalPages: number;
  pagesWithSchema: number;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-slate-400 transition-all hover:border-cyan/30 hover:text-cyan"
    >
      {copied ? <Check className="h-3 w-3 text-teal-400" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function ScoreChip({ value }: { value: number }) {
  const color = value >= 70 ? '#0BCEBC' : value >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <span className="inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-bold tabular-nums"
      style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}30` }}>
      {value}
    </span>
  );
}

const TYPE_COLORS: Record<string, string> = {
  Organization:   '#00C8FF',
  Article:        '#0BCEBC',
  Person:         '#A78BFA',
  FAQPage:        '#F59E0B',
  Product:        '#34D399',
  Service:        '#60A5FA',
  LocalBusiness:  '#F472B6',
  WebSite:        '#818CF8',
  BreadcrumbList: '#94A3B8',
  HowTo:          '#FB923C',
};

function typeColor(t: string) {
  return TYPE_COLORS[t] ?? '#4A6280';
}

function SchemaPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auditIdParam = searchParams.get('auditId');

  const { data: auditsData } = useAudits(20);
  const completedAudits = (auditsData?.data ?? []).filter((a) => a.status === 'complete');
  const selectedId = auditIdParam ?? completedAudits[0]?.id ?? '';

  const [filterType, setFilterType] = useState<'all' | 'new'>('all');

  const { data, isLoading } = useQuery<SchemaData>({
    queryKey: ['schema-snippets', selectedId],
    queryFn: () => fetch(`/api/audit/${selectedId}/schema`).then((r) => r.json() as Promise<SchemaData>),
    enabled: !!selectedId,
    staleTime: 60_000,
  });

  const snippets = (data?.snippets ?? []).filter((s) =>
    filterType === 'all' ? true : s.isNew,
  );

  const uniqueTypes = [...new Set((data?.snippets ?? []).map((s) => s.schemaType))];

  return (
    <DashboardLayout>
      <TopCommandBar onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)} />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <FileJson className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">Schema Generator</h1>
            </div>
            <p className="text-sm text-[#4A6280]">
              Ready-to-paste JSON-LD for every page — detected types and missing schema auto-generated
            </p>
          </div>
          {data?.schemaScore !== null && data?.schemaScore !== undefined && (
            <div className="text-right">
              <ScoreChip value={Math.round(data.schemaScore)} />
              <div className="mt-0.5 text-[10px] text-[#4A6280]">Schema score</div>
            </div>
          )}
        </div>

        {/* Audit selector */}
        {completedAudits.length > 1 && (
          <div className="mb-5">
            <select
              value={selectedId}
              onChange={(e) => router.push(`/dashboard/schema?auditId=${e.target.value}`)}
              className="rounded-lg border border-white/[0.08] bg-[#0A1628] px-3 py-2 text-sm text-white outline-none focus:border-cyan/40"
            >
              {completedAudits.map((a) => (
                <option key={a.id} value={a.id}>{a.domain}</option>
              ))}
            </select>
          </div>
        )}

        {/* Stats row */}
        {data && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total Pages',       value: data.totalPages },
              { label: 'Pages with Schema', value: data.pagesWithSchema },
              { label: 'Missing Schema',    value: data.totalPages - data.pagesWithSchema },
              { label: 'Schema Types',      value: uniqueTypes.length },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                <div className="text-2xl font-bold tabular-nums text-white">{stat.value}</div>
                <div className="mt-0.5 text-xs text-[#4A6280]">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Type legend */}
        {uniqueTypes.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {uniqueTypes.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                style={{ color: typeColor(t), borderColor: `${typeColor(t)}30`, backgroundColor: `${typeColor(t)}10` }}>
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Filter tabs */}
        {data && data.snippets.some((s) => s.isNew) && (
          <div className="mb-5 flex gap-2">
            {(['all', 'new'] as const).map((f) => (
              <button key={f} onClick={() => setFilterType(f)}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${filterType === f ? 'bg-cyan/10 border border-cyan/20 text-cyan' : 'text-[#4A6280] hover:text-white'}`}>
                {f === 'all' ? 'All Schema' : (
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-amber-400" /> Missing (Auto-generated)
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-white/[0.03]" />)}
          </div>
        )}

        {/* No audit selected */}
        {!selectedId && !isLoading && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
            <Code2 className="mx-auto mb-3 h-8 w-8 text-[#4A6280]" />
            <p className="text-white font-semibold">No completed audits</p>
            <p className="mt-1 text-sm text-[#4A6280]">Run an audit to generate schema snippets.</p>
          </div>
        )}

        {/* Snippets */}
        {!isLoading && snippets.length > 0 && (
          <div className="space-y-4">
            {snippets.map((s, i) => (
              <div key={i} className={`rounded-xl border bg-white/[0.015] overflow-hidden ${s.isNew ? 'border-amber-500/20' : 'border-white/[0.06]'}`}>
                {/* Header */}
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.04] px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {s.isNew && (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                        <Sparkles className="h-2.5 w-2.5" /> NEW
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                      style={{ color: typeColor(s.schemaType), borderColor: `${typeColor(s.schemaType)}30`, backgroundColor: `${typeColor(s.schemaType)}10` }}>
                      {s.schemaType}
                    </span>
                    <span className="truncate text-[11px] text-[#4A6280]">{s.url}</span>
                  </div>
                  <CopyButton text={`<script type="application/ld+json">\n${s.snippet}\n</script>`} />
                </div>
                {/* Code */}
                <pre className="overflow-x-auto px-4 py-4 text-[12px] leading-[1.7] text-slate-400 font-mono">
                  {`<script type="application/ld+json">\n${s.snippet}\n</script>`}
                </pre>
              </div>
            ))}
          </div>
        )}

        {/* No snippets */}
        {!isLoading && selectedId && snippets.length === 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <AlertCircle className="mx-auto mb-3 h-7 w-7 text-teal-400" />
            <p className="font-semibold text-white">All schema detected</p>
            <p className="mt-1 text-sm text-[#4A6280]">
              {filterType === 'new' ? 'No missing schema found — great coverage.' : 'No schema data available for this audit.'}
            </p>
          </div>
        )}

        {/* Paste guide */}
        <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#C8DFE8]">
            <Code2 className="h-4 w-4 text-cyan" /> How to add schema
          </h2>
          <ul className="space-y-1 text-xs text-[#4A6280]">
            <li>1. Click <strong className="text-slate-400">Copy</strong> on any snippet above</li>
            <li>2. Paste the entire <code className="text-slate-500">&lt;script&gt;</code> block into the <code className="text-slate-500">&lt;head&gt;</code> of the relevant page</li>
            <li>3. Replace placeholder values with your actual data</li>
            <li>4. Validate using <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:underline">Google Rich Results Test</a></li>
            <li>5. Re-run your SiteNexis audit to see the schema score improvement</li>
          </ul>
        </div>
      </main>
    </DashboardLayout>
  );
}

export default function SchemaPage() {
  return (
    <Suspense>
      <SchemaPageContent />
    </Suspense>
  );
}
