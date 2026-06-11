'use client';

import {
  useState,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useQuery } from '@tanstack/react-query';
import type { SEOIssue, SEOIssueSeverity } from '@sitenexis/shared';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface IssuesTableProps {
  issues: SEOIssue[];
  isLoading?: boolean;
  showModuleFilter?: boolean;
  auditId?: string;
}

// ─── Severity helpers ─────────────────────────────────────────────────────────

const SEV_ORDER: Record<SEOIssueSeverity, number> = { critical: 0, warning: 1, info: 2 };

const SEV_STYLES: Record<SEOIssueSeverity, { badge: string; dot: string }> = {
  critical: { badge: 'bg-red-500/15 text-red-400 border border-red-500/30',   dot: 'bg-red-400' },
  warning:  { badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30', dot: 'bg-amber-400' },
  info:     { badge: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',  dot: 'bg-blue-400' },
};

const SEV_EMOJI: Record<SEOIssueSeverity, string> = {
  critical: '🔴',
  warning:  '🟡',
  info:     '🔵',
};

function SeverityBadge({ sev }: { sev: SEOIssueSeverity }) {
  const st = SEV_STYLES[sev];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${st.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
      {sev.charAt(0).toUpperCase() + sev.slice(1)}
    </span>
  );
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCsv(issues: SEOIssue[]) {
  const header = ['Severity', 'Page URL', 'Issue Type', 'Message', 'Recommendation'];
  const rows = issues.map((i) => [
    i.severity,
    i.url,
    i.type,
    `"${i.message.replace(/"/g, '""')}"`,
    `"${i.recommendation.replace(/"/g, '""')}"`,
  ]);
  const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sitenexis-issues.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Column helper ────────────────────────────────────────────────────────────

const col = createColumnHelper<SEOIssue>();

const PAGE_SIZE = 20;
const VIRTUALISE_THRESHOLD = 100;

// ─── Component ────────────────────────────────────────────────────────────────

export function IssuesTable({ issues, isLoading = false, auditId }: IssuesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'severity', desc: false },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [urlSearch, setUrlSearch] = useState('');
  // Sticky severity filter — stored in module-level ref so it persists across tab switches
  const [sevFilter, setSevFilter] = useState<Set<SEOIssueSeverity>>(new Set());
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const copyUrl = useCallback((url: string) => {
    void navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 1500);
  }, []);

  // Pre-filter before passing to TanStack Table (severity + url search)
  const filtered = useMemo(() => {
    let rows = issues;
    if (sevFilter.size > 0) rows = rows.filter((i) => sevFilter.has(i.severity));
    if (urlSearch.trim()) {
      const q = urlSearch.trim().toLowerCase();
      rows = rows.filter((i) => i.url.toLowerCase().includes(q));
    }
    return rows;
  }, [issues, sevFilter, urlSearch]);

  const columns = useMemo(() => [
    col.accessor('severity', {
      header: 'Severity',
      cell: (info) => <SeverityBadge sev={info.getValue()} />,
      sortingFn: (a, b) =>
        SEV_ORDER[a.original.severity] - SEV_ORDER[b.original.severity],
    }),
    col.accessor('url', {
      header: 'Page URL',
      cell: (info) => {
        const url = info.getValue();
        const copied = copiedUrl === url;
        return (
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-xs text-[#4A6280] max-w-[200px]" title={url}>
              {url.replace(/^https?:\/\//, '')}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); copyUrl(url); }}
              className={`shrink-0 text-[10px] rounded px-1.5 py-0.5 transition-colors ${
                copied ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-[#4A6280] hover:text-white'
              }`}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        );
      },
      enableSorting: true,
    }),
    col.accessor('type', {
      header: 'Issue Type',
      cell: (info) => (
        <span className="font-mono text-xs text-[#4A6280]">
          {info.getValue().replace(/_/g, ' ')}
        </span>
      ),
    }),
    col.accessor('message', {
      header: 'Description',
      cell: (info) => (
        <span className="text-xs text-white">{info.getValue()}</span>
      ),
    }),
    col.accessor('recommendation', {
      header: 'Recommendation',
      cell: (info) => (
        <span className="text-xs text-[#4A6280] line-clamp-2">{info.getValue()}</span>
      ),
    }),
  ], [copiedUrl, copyUrl]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
  });

  const rows = table.getRowModel().rows;
  const useVirtual = filtered.length > VIRTUALISE_THRESHOLD;

  const tbodyRef = useRef<HTMLDivElement>(null);
  const virtualiser = useVirtualizer({
    count: useVirtual ? rows.length : 0,
    getScrollElement: () => tbodyRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  // Severity counts for pills
  const sevCounts = useMemo(() => ({
    critical: issues.filter((i) => i.severity === 'critical').length,
    warning:  issues.filter((i) => i.severity === 'warning').length,
    info:     issues.filter((i) => i.severity === 'info').length,
  }), [issues]);

  // Active fix panel state — which issue is showing a fix
  const [fixPanelId, setFixPanelId] = useState<string | null>(null);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-white/5" />
        ))}
      </div>
    );
  }

  // Empty state
  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="text-5xl">✅</span>
        <p className="font-semibold text-white">No issues found in this category.</p>
        <p className="text-sm text-[#4A6280]">Great work!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Severity filter pills */}
        <div className="flex gap-2">
          {(['critical', 'warning', 'info'] as SEOIssueSeverity[]).map((sev) => {
            const active = sevFilter.has(sev);
            const st = SEV_STYLES[sev];
            return (
              <button
                key={sev}
                onClick={() => {
                  setSevFilter((prev) => {
                    const next = new Set(prev);
                    if (next.has(sev)) next.delete(sev); else next.add(sev);
                    return next;
                  });
                  table.setPageIndex(0);
                }}
                className={[
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all border',
                  active ? st.badge : 'border-white/10 text-[#4A6280] hover:border-white/20 hover:text-white',
                ].join(' ')}
              >
                {SEV_EMOJI[sev]}
                <span className="capitalize">{sev}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? '' : 'bg-white/5'}`}>
                  {sevCounts[sev]}
                </span>
              </button>
            );
          })}
        </div>

        {/* URL search */}
        <input
          type="text"
          value={urlSearch}
          onChange={(e) => { setUrlSearch(e.target.value); table.setPageIndex(0); }}
          placeholder="Filter by URL..."
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-[#4A6280] outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 transition-colors"
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Summary */}
        <span className="text-xs text-[#4A6280]">
          Showing {filtered.length === issues.length
            ? `${filtered.length} issue${filtered.length !== 1 ? 's' : ''}`
            : `${filtered.length} of ${issues.length} issues`}
        </span>

        {/* Export */}
        <button
          onClick={() => exportCsv(filtered)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[#4A6280] hover:text-white hover:border-white/20 transition-colors"
        >
          Export CSV ↓
        </button>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-white/10">
        {/* Header */}
        <div className="border-b border-white/10 bg-[#050B09]">
          {table.getHeaderGroups().map((hg) => (
            <div key={hg.id} className="flex items-center px-4 py-3">
              {hg.headers.map((header) => (
                <div
                  key={header.id}
                  className={headerColClass(header.column.id)}
                  onClick={header.column.getToggleSortingHandler()}
                  style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                >
                  <span className="flex items-center gap-1 text-xs font-semibold text-[#4A6280] hover:text-white transition-colors select-none">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc'  && <span> ↑</span>}
                    {header.column.getIsSorted() === 'desc' && <span> ↓</span>}
                    {header.column.getCanSort() && !header.column.getIsSorted() && (
                      <span className="opacity-30"> ↕</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Body */}
        {useVirtual ? (
          <div
            ref={tbodyRef}
            className="overflow-auto"
            style={{ height: Math.min(600, rows.length * 48) }}
          >
            <div style={{ height: virtualiser.getTotalSize(), position: 'relative' }}>
              {virtualiser.getVirtualItems().map((vrow) => {
                const row = rows[vrow.index]!;
                const expanded = expandedRow === row.id;
                return (
                  <div
                    key={row.id}
                    style={{ position: 'absolute', top: vrow.start, left: 0, right: 0 }}
                    className={rowClass(expanded, vrow.index)}
                    onClick={() => setExpandedRow(expanded ? null : row.id)}
                  >
                    <RowContent
                      row={row}
                      expanded={expanded}
                      auditId={auditId}
                      fixPanelId={fixPanelId}
                      onToggleFix={(id) => setFixPanelId((prev) => (prev === id ? null : id))}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            {rows.map((row, idx) => {
              const expanded = expandedRow === row.id;
              return (
                <div
                  key={row.id}
                  className={rowClass(expanded, idx)}
                  onClick={() => setExpandedRow(expanded ? null : row.id)}
                >
                  <RowContent
                    row={row}
                    expanded={expanded}
                    auditId={auditId}
                    fixPanelId={fixPanelId}
                    onToggleFix={(id) => setFixPanelId((prev) => (prev === id ? null : id))}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#4A6280]">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded-lg border border-white/10 px-3 py-1 text-xs text-[#4A6280] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded-lg border border-white/10 px-3 py-1 text-xs text-[#4A6280] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Row helpers ──────────────────────────────────────────────────────────────

function rowClass(expanded: boolean, idx: number): string {
  return [
    'cursor-pointer border-b border-white/5 transition-colors',
    expanded ? 'bg-[#0A1F14]' : idx % 2 === 1 ? 'bg-[#05130F]/50 hover:bg-white/[0.03]' : 'hover:bg-white/[0.03]',
  ].join(' ');
}

interface FixResponse {
  problem: string;
  solution: string;
  fixCode: string;
  fixLanguage: string;
  expectedImpact?: string;
  effort?: string;
}

function FixPanel({ auditId, issueId }: { auditId: string; issueId: string }) {
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery<FixResponse>({
    queryKey: ['issue-fix', auditId, issueId],
    queryFn: async () => {
      const res = await fetch(`/api/audit/${auditId}/fix/${issueId}`);
      if (!res.ok) throw new Error('Failed to generate fix');
      return res.json() as Promise<FixResponse>;
    },
    staleTime: Infinity,
    retry: 1,
  });

  function copyFix() {
    if (!data?.fixCode) return;
    void navigator.clipboard.writeText(data.fixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="mt-4 rounded-xl border border-cyan/20 bg-[#05111F] p-4">
        <div className="flex items-center gap-2 text-xs text-[#4A6280]">
          <div className="h-3 w-3 animate-spin rounded-full border border-cyan border-t-transparent" />
          Generating fix…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <p className="text-xs text-red-400">Fix generation failed. Try again.</p>
      </div>
    );
  }

  const langLabel: Record<string, string> = {
    'json-ld': 'JSON-LD',
    html: 'HTML',
    typescript: 'TypeScript',
    text: 'Text',
  };

  return (
    <div className="mt-4 rounded-xl border border-cyan/20 bg-[#05111F] overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-cyan">Fix</span>
        <div className="flex items-center gap-2">
          {data.expectedImpact && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
              data.expectedImpact === 'high'
                ? 'border-red-500/30 bg-red-500/10 text-red-400'
                : data.expectedImpact === 'medium'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
            }`}>
              {data.expectedImpact} impact
            </span>
          )}
          {data.effort && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-[#4A6280]">
              {data.effort} effort
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-red-400">Problem</p>
          <p className="text-xs text-slate-300 leading-relaxed">{data.problem}</p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-amber-400">Solution</p>
          <p className="text-xs text-slate-300 leading-relaxed">{data.solution}</p>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-teal-400">
              Fix · {langLabel[data.fixLanguage] ?? data.fixLanguage}
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); copyFix(); }}
              className={`rounded px-2.5 py-1 text-[10px] font-medium transition-colors ${
                copied
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-white/[0.06] text-[#4A6280] hover:bg-white/[0.1] hover:text-white'
              }`}
            >
              {copied ? 'Copied!' : 'Copy fix'}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-[#020A16] p-3 text-[11px] leading-relaxed text-slate-300 font-mono whitespace-pre-wrap max-h-64">
            {data.fixCode}
          </pre>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RowContent({
  row,
  expanded,
  auditId,
  fixPanelId,
  onToggleFix,
}: {
  row: any;
  expanded: boolean;
  auditId: string | undefined;
  fixPanelId: string | null;
  onToggleFix: (id: string) => void;
}) {
  const issueId: string | undefined = row.original.id;
  const showFixButton = !!auditId && !!issueId;
  const fixOpen = fixPanelId === issueId;

  return (
    <>
      <div className="flex items-center px-4 py-3">
        {row.getVisibleCells().map((cell: ReturnType<typeof row.getVisibleCells>[number]) => (
          <div key={cell.id} className={headerColClass(cell.column.id)}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </div>
        ))}
        <div className="w-6 shrink-0 text-right text-xs text-[#4A6280]">
          {expanded ? '▲' : '▼'}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-white/5 bg-[#0A1F14] px-5 py-4">
          <p className="mb-1 text-xs font-semibold text-cyan">Recommendation</p>
          <p className="text-sm text-white leading-relaxed">{row.original.recommendation}</p>
          <div className="mt-3 flex items-center gap-3">
            <a
              href={row.original.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-cyan underline hover:text-teal"
            >
              Open page ↗
            </a>
            {showFixButton && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFix(issueId);
                }}
                className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                  fixOpen
                    ? 'border-cyan/40 bg-cyan/10 text-cyan'
                    : 'border-white/10 bg-white/[0.04] text-[#4A6280] hover:border-cyan/30 hover:text-cyan'
                }`}
              >
                {fixOpen ? 'Hide fix ↑' : 'View fix →'}
              </button>
            )}
          </div>
          {showFixButton && fixOpen && (
            <div onClick={(e) => e.stopPropagation()}>
              <FixPanel auditId={auditId} issueId={issueId} />
            </div>
          )}
        </div>
      )}
    </>
  );
}

function headerColClass(id: string): string {
  switch (id) {
    case 'severity':       return 'w-28 shrink-0';
    case 'url':            return 'flex-1 min-w-0 px-2';
    case 'type':           return 'w-36 shrink-0 px-2 hidden md:block';
    case 'message':        return 'flex-1 min-w-0 px-2 hidden lg:block';
    case 'recommendation': return 'flex-1 min-w-0 px-2 hidden xl:block';
    default:               return 'flex-1';
  }
}
