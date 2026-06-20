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

interface PageData {
  url: string;
  title: string | null;
  h1: string | null;
  canonicalUrl: string | null;
  metaDescription: string | null;
  wordCount: number;
  statusCode?: number;
  isIndexable?: boolean;
}

export interface IssuesTableProps {
  issues: SEOIssue[];
  isLoading?: boolean;
  showModuleFilter?: boolean;
  auditId?: string;
  pages?: PageData[];
}

// ─── Evidence builder ─────────────────────────────────────────────────────────

type ImpactLevel = 'critical' | 'high' | 'medium' | 'low';

interface IssueEvidence {
  detected: string;
  expected: string;
  impactSeo: ImpactLevel;
  impactAi: ImpactLevel;
}

const IMPACT_COLOR: Record<ImpactLevel, string> = {
  critical: 'text-red-400',
  high: 'text-red-400',
  medium: 'text-amber-400',
  low: 'text-blue-400',
};

function buildEvidence(type: string, page: PageData | undefined): IssueEvidence | null {
  switch (type) {
    case 'missing_title':
      return {
        detected: '<title></title>  ← empty or absent',
        expected: '<title>Descriptive Page Title — Brand</title>',
        impactSeo: 'critical',
        impactAi: 'high',
      };
    case 'title_too_long': {
      const t = page?.title ?? 'Your page title that is too long to display in full...';
      return {
        detected: `<title>${t}</title>  (${t.length} chars)`,
        expected: `<title>${t.slice(0, 60)}${t.length > 60 ? '…' : ''}</title>  (≤ 60 chars)`,
        impactSeo: 'medium',
        impactAi: 'low',
      };
    }
    case 'title_too_short': {
      const t = page?.title ?? 'Short';
      return {
        detected: `<title>${t}</title>  (${t.length} chars)`,
        expected: '<title>Specific, descriptive title with primary keyword (30–60 chars)</title>',
        impactSeo: 'medium',
        impactAi: 'medium',
      };
    }
    case 'duplicate_title':
      return {
        detected: `<title>${page?.title ?? '(same title as other pages)'}</title>`,
        expected: '<title>Unique title specific to this page\'s content</title>',
        impactSeo: 'high',
        impactAi: 'medium',
      };
    case 'missing_meta_description':
      return {
        detected: '← no <meta name="description"> tag found',
        expected: '<meta name="description" content="Clear 120–155 character summary of page content.">',
        impactSeo: 'medium',
        impactAi: 'medium',
      };
    case 'meta_description_too_long': {
      const d = page?.metaDescription ?? '';
      return {
        detected: `<meta name="description" content="${d}">  (${d.length} chars)`,
        expected: `<meta name="description" content="${d.slice(0, 150)}…">  (≤ 155 chars)`,
        impactSeo: 'low',
        impactAi: 'low',
      };
    }
    case 'duplicate_meta_description':
      return {
        detected: `<meta name="description" content="${page?.metaDescription ?? '(duplicate)'}">`,
        expected: '<meta name="description" content="Unique description for this specific page.">',
        impactSeo: 'medium',
        impactAi: 'low',
      };
    case 'missing_h1':
      return {
        detected: '← no <h1> tag found in page body',
        expected: '<h1>Primary Page Heading That Matches User Intent</h1>',
        impactSeo: 'critical',
        impactAi: 'critical',
      };
    case 'multiple_h1':
      return {
        detected: '<h1>First heading</h1>  +  <h1>Second heading</h1>  (ambiguous)',
        expected: '<h1>Single primary heading</h1>  (one per page only)',
        impactSeo: 'high',
        impactAi: 'high',
      };
    case 'missing_canonical': {
      const pageUrl = page?.url ?? 'https://example.com/page';
      return {
        detected: '← no <link rel="canonical"> tag found',
        expected: `<link rel="canonical" href="${pageUrl}">`,
        impactSeo: 'high',
        impactAi: 'low',
      };
    }
    case 'broken_canonical':
      return {
        detected: `<link rel="canonical" href="${page?.canonicalUrl ?? '(broken URL)'}">  ← returns 404`,
        expected: `<link rel="canonical" href="${page?.url ?? 'https://example.com/correct-url'}">`,
        impactSeo: 'high',
        impactAi: 'low',
      };
    case 'noindex_page':
      return {
        detected: '<meta name="robots" content="noindex">  ← blocks all crawlers',
        expected: '<meta name="robots" content="index, follow">  (or remove the tag)',
        impactSeo: 'critical',
        impactAi: 'critical',
      };
    case 'missing_alt_text':
      return {
        detected: '<img src="image.jpg" alt="">  ← empty alt attribute',
        expected: '<img src="image.jpg" alt="Descriptive text about the image content">',
        impactSeo: 'low',
        impactAi: 'low',
      };
    case 'broken_internal_link':
      return {
        detected: '<a href="/missing-page">Link text</a>  ← target returns 404',
        expected: '<a href="/correct-existing-page">Link text</a>',
        impactSeo: 'medium',
        impactAi: 'low',
      };
    case 'redirect_chain':
      return {
        detected: 'URL → 301 → URL2 → 301 → URL3  (chain of 3+ redirects)',
        expected: 'URL → 301 → Final URL  (direct, single redirect)',
        impactSeo: 'medium',
        impactAi: 'low',
      };
    case 'low_word_count':
      return {
        detected: `${page?.wordCount ?? 0} words detected  ← below 300 word minimum`,
        expected: '300–600+ words with substantive content to form stable AI retrieval chunks',
        impactSeo: 'medium',
        impactAi: 'critical',
      };
    case 'missing_robots_txt':
      return {
        detected: 'GET /robots.txt  → 404 Not Found',
        expected: 'GET /robots.txt  → 200 OK  with crawl directives',
        impactSeo: 'high',
        impactAi: 'medium',
      };
    case 'missing_sitemap':
      return {
        detected: 'GET /sitemap.xml  → 404 Not Found',
        expected: 'GET /sitemap.xml  → 200 OK  listing all indexable URLs',
        impactSeo: 'high',
        impactAi: 'medium',
      };
    default:
      return null;
  }
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
    i.url ?? '',
    i.type ?? '',
    `"${(i.message ?? '').replace(/"/g, '""')}"`,
    `"${(i.recommendation ?? '').replace(/"/g, '""')}"`,
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

// ─── Cause lookup (deterministic per issue type) ─────────────────────────────

const CAUSE_MAP: Record<string, string> = {
  missing_title: "The <title> tag is the primary signal crawlers use to classify a page's topic. Without it, search engines and AI retrieval systems cannot confidently categorise or cite this page.",
  title_too_long: "Search engines display approximately 60–70 characters of a title. Text beyond this is cut off, hiding key information and reducing click-through rates.",
  title_too_short: "Short titles lack the semantic richness needed for accurate topic classification by search engines and AI systems.",
  missing_meta_description: "Without a description, search engines generate snippet text from body content, which is rarely optimised for user intent and reduces click-through rates.",
  meta_description_too_long: "Search engines truncate descriptions beyond approximately 155 characters, cutting off your message mid-sentence.",
  duplicate_meta_description: "Duplicate descriptions signal a lack of page differentiation, reducing the click-through rate for each individual page in search results.",
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

// ─── Column helper ────────────────────────────────────────────────────────────

const col = createColumnHelper<SEOIssue>();

const PAGE_SIZE = 20;
const VIRTUALISE_THRESHOLD = 100;

// ─── Component ────────────────────────────────────────────────────────────────

export function IssuesTable({ issues, isLoading = false, auditId, pages }: IssuesTableProps) {
  const pageMap = useMemo(() => {
    const map = new Map<string, PageData>();
    for (const p of pages ?? []) map.set(p.url.replace(/\/$/, ''), p);
    return map;
  }, [pages]);
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
      rows = rows.filter((i) => (i.url ?? '').toLowerCase().includes(q));
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
        const url = info.getValue() ?? '';
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
          {(info.getValue() ?? '').replace(/_/g, ' ')}
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
                      pageMap={pageMap}
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
                    pageMap={pageMap}
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
  pageMap,
}: {
  row: any;
  expanded: boolean;
  auditId: string | undefined;
  fixPanelId: string | null;
  onToggleFix: (id: string) => void;
  pageMap: Map<string, PageData>;
}) {
  const issueId: string | undefined = row.original.id;
  const showFixButton = !!auditId && !!issueId;
  const fixOpen = fixPanelId === issueId;

  const issueType = row.original.type as string;
  const issueUrl = (row.original.url as string ?? '').replace(/\/$/, '');
  const page = pageMap.get(issueUrl);
  const evidence = buildEvidence(issueType, page);

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
        <div className="border-t border-white/5 bg-[#070F1A] px-5 py-4 space-y-4">

          {/* Affected URL */}
          {issueUrl && (
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#4A6280]">Affected URL</span>
              <a
                href={row.original.url as string}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="ml-auto text-xs text-cyan hover:underline truncate max-w-sm"
              >
                {issueUrl.replace(/^https?:\/\//, '')} ↗
              </a>
            </div>
          )}

          {/* Evidence block */}
          {evidence && (
            <div className="rounded-lg border border-white/[0.06] bg-[#020A16] overflow-hidden">
              <div className="border-b border-white/[0.06] px-3 py-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#4A6280]">Evidence</span>
                <div className="flex items-center gap-3 text-[10px]">
                  <span>SEO impact: <span className={`font-semibold ${IMPACT_COLOR[evidence.impactSeo]}`}>{evidence.impactSeo}</span></span>
                  <span>AI impact: <span className={`font-semibold ${IMPACT_COLOR[evidence.impactAi]}`}>{evidence.impactAi}</span></span>
                </div>
              </div>
              <div className="p-3 space-y-2">
                <div>
                  <p className="mb-1 text-[10px] font-semibold text-red-400 uppercase tracking-wide">Detected</p>
                  <pre className="text-[11px] text-[#EF9090] font-mono leading-relaxed whitespace-pre-wrap break-all">{evidence.detected}</pre>
                </div>
                <div className="border-t border-white/[0.04] pt-2">
                  <p className="mb-1 text-[10px] font-semibold text-green-400 uppercase tracking-wide">Expected</p>
                  <pre className="text-[11px] text-[#6ECF8A] font-mono leading-relaxed whitespace-pre-wrap break-all">{evidence.expected}</pre>
                </div>
              </div>
            </div>
          )}

          {/* Problem */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-red-400">Why This Matters</p>
            <p className="text-sm text-white leading-relaxed">
              {(row.original.problem as string | undefined) ?? row.original.message}
            </p>
          </div>

          {/* Cause */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-amber-400">Root Cause</p>
            <p className="text-sm text-[#b0c4cc] leading-relaxed">
              {(row.original.cause as string | undefined) ?? CAUSE_MAP[issueType] ?? 'This issue degrades crawlability, AI retrievability, or user experience — each of which contributes to overall visibility.'}
            </p>
          </div>

          {/* Solution */}
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-teal-400">How to Fix</p>
            <p className="text-sm text-white leading-relaxed">
              {(row.original.solution as string | undefined) ?? row.original.recommendation}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            {issueUrl && (
              <a
                href={row.original.url as string}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-cyan underline hover:text-teal"
              >
                Open page ↗
              </a>
            )}
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
                {fixOpen ? 'Hide code fix ↑' : 'View code fix →'}
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
