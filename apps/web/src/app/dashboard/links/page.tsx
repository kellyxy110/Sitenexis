'use client';

import dynamic from 'next/dynamic';
import { useState, useRef, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useLatestAudit, useAuditSubReport, useMe } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { GitFork, AlertTriangle, Info, ArrowRight, ExternalLink, List, Share2 } from 'lucide-react';
import type { LinkGraphScore, GraphNode, GraphEdge, LinkStructuralIssue, GTLResponse } from '@sitenexis/shared';
import type { LinksApiResponse } from '@/app/api/audit/[id]/links/route';

// Force graph is browser-only
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

// ─── Score colours ────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 90) return '#22C55E';
  if (s >= 70) return '#0BCEBC';
  if (s >= 50) return '#F59E0B';
  return '#EF4444';
}

function scoreLabel(s: number) {
  if (s >= 90) return 'Excellent';
  if (s >= 70) return 'Good';
  if (s >= 50) return 'Needs Work';
  return 'Critical';
}

const CLUSTER_PALETTE = [
  '#00C8FF', '#0BCEBC', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#22C55E', '#F97316',
];

function clusterColor(cluster: string): string {
  const idx = parseInt(cluster.replace('cluster_', ''), 10) % CLUSTER_PALETTE.length;
  return CLUSTER_PALETTE[idx] ?? '#00C8FF';
}

// ─── Depth-grouped hierarchy view ────────────────────────────────────────────

interface DepthGroup { depth: number; nodes: GraphNode[] }

function buildDepthGroups(nodes: GraphNode[]): DepthGroup[] {
  const maxDepth = Math.max(0, ...nodes.map((n) => n.depth));
  const grouped: DepthGroup[] = [];
  for (let d = 0; d <= Math.min(maxDepth, 6); d++) {
    const group = nodes.filter((n) => n.depth === d).sort((a, b) => b.pageRank - a.pageRank);
    if (group.length > 0) grouped.push({ depth: d, nodes: group });
  }
  // Collapse depths 7+ into a single group
  const deepNodes = nodes.filter((n) => n.depth > 6).sort((a, b) => b.pageRank - a.pageRank);
  if (deepNodes.length > 0) grouped.push({ depth: 99, nodes: deepNodes });
  return grouped;
}

function HierarchyView({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const [showAllPerDepth, setShowAllPerDepth] = useState<Record<number, boolean>>({});
  const PAGE_LIMIT = 8;
  const groups = buildDepthGroups(nodes);

  // Build parent mapping: url → first incoming edge source
  const parentMap = new Map<string, string>();
  for (const edge of edges) {
    if (!parentMap.has(edge.to)) parentMap.set(edge.to, edge.from);
  }

  if (groups.length === 0) return (
    <p className="text-sm text-[#4A6280]">No pages to display.</p>
  );

  return (
    <div className="space-y-6">
      {groups.map(({ depth, nodes: groupNodes }) => {
        const isDeep = depth === 99;
        const label = isDeep ? 'Depth 7+' : `Depth ${depth}`;
        const sublabel = depth === 0 ? 'Root' : depth === 1 ? 'Direct from homepage' : isDeep ? 'Deep pages' : undefined;
        const visible = showAllPerDepth[depth] ? groupNodes : groupNodes.slice(0, PAGE_LIMIT);
        const hasMore = groupNodes.length > PAGE_LIMIT;

        return (
          <div key={depth}>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded px-2 py-0.5 text-[10px] font-bold tracking-wide"
                style={{ backgroundColor: '#00C8FF18', color: '#00C8FF' }}>
                {label}
              </span>
              {sublabel && <span className="text-xs text-[#4A6280]">{sublabel}</span>}
              <span className="text-xs text-[#4A6280]">— {groupNodes.length} page{groupNodes.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="space-y-1 pl-3 border-l border-white/[0.06]">
              {visible.map((node, i) => {
                const isLast = i === visible.length - 1 && (!hasMore || showAllPerDepth[depth]);
                const connector = isLast ? '└──' : '├──';
                const lafs = node.linkAuthorityFlowScore;
                const parent = parentMap.get(node.url);

                return (
                  <div key={node.url} className="group flex items-start gap-2 py-1 px-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                    <span className="shrink-0 font-mono text-xs text-[#4A6280] select-none pt-0.5">{connector}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate text-sm font-medium text-white">{node.label}</span>
                        <span
                          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                          style={{ color: scoreColor(lafs), backgroundColor: `${scoreColor(lafs)}18` }}
                        >
                          {lafs}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px] text-[#4A6280] truncate max-w-[240px]">{node.url}</span>
                        <span className="shrink-0 text-[11px] text-[#4A6280]">↑{node.inDegree} ↓{node.outDegree}</span>
                        {parent && depth > 0 && (
                          <span className="shrink-0 text-[11px] text-[#4A6280] hidden lg:inline truncate max-w-[160px]">
                            via {urlSlug(parent)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className="shrink-0 text-xs tabular-nums pt-0.5"
                      style={{ color: scoreColor(node.pageRank * 500) }}
                    >
                      PR {(node.pageRank * 100).toFixed(1)}
                    </span>
                  </div>
                );
              })}

              {hasMore && !showAllPerDepth[depth] && (
                <button
                  onClick={() => setShowAllPerDepth((p) => ({ ...p, [depth]: true }))}
                  className="ml-6 text-xs text-cyan hover:underline"
                >
                  + {groupNodes.length - PAGE_LIMIT} more pages
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Force graph view ─────────────────────────────────────────────────────────

const FORCE_NODE_CAP = 200;
const FORCE_EDGE_CAP = 400;

interface ForceGraphViewProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  totalNodes: number;
  totalEdges: number;
}

function ForceGraphView({ nodes, edges, totalNodes, totalEdges }: ForceGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Sort by PageRank so cap always drops lowest-value nodes
  const displayNodes = [...nodes].sort((a, b) => b.pageRank - a.pageRank).slice(0, FORCE_NODE_CAP);
  const displayNodeUrls = new Set(displayNodes.map((n) => n.url));
  const displayEdges = edges
    .filter((e) => displayNodeUrls.has(e.from) && displayNodeUrls.has(e.to))
    .slice(0, FORCE_EDGE_CAP);

  const hiddenByRenderCap = nodes.length - displayNodes.length;
  const hiddenEdgesByRenderCap = edges.length - displayEdges.length;
  const hiddenByPagination = totalNodes - nodes.length;
  const hiddenEdgesByPagination = totalEdges - edges.length;
  const anyHidden = hiddenByRenderCap > 0 || hiddenByPagination > 0;

  const graphData = {
    nodes: displayNodes.map((n) => ({ ...n, id: n.url })),
    links: displayEdges.map((e) => ({ source: e.from, target: e.to })),
  };

  return (
    <div className="space-y-2">
      {/* FIX 3: visible cap indicator above the graph, not buried below */}
      {anyHidden && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2">
          <span className="text-xs font-medium text-amber-300">Graph capped for performance</span>
          {hiddenByRenderCap > 0 && (
            <span className="text-xs text-[#7A9AB4]">
              +{hiddenByRenderCap} node{hiddenByRenderCap !== 1 ? 's' : ''} hidden
              {hiddenEdgesByRenderCap > 0 ? `, +${hiddenEdgesByRenderCap} edges hidden` : ''} (render limit)
            </span>
          )}
          {hiddenByPagination > 0 && (
            <span className="text-xs text-[#7A9AB4]">
              +{hiddenByPagination} node{hiddenByPagination !== 1 ? 's' : ''}
              {hiddenEdgesByPagination > 0 ? `, +${hiddenEdgesByPagination} edges` : ''} not yet loaded — use Load More below
            </span>
          )}
          <span className="text-xs text-[#4A6280]">
            Showing {displayNodes.length} nodes · {displayEdges.length} edges
          </span>
        </div>
      )}

      <div ref={containerRef} className="rounded-xl overflow-hidden border border-white/[0.06]">
        <ForceGraph2D
          graphData={graphData}
          nodeLabel={(n) => (n as GraphNode).label}
          nodeColor={(n) => clusterColor((n as GraphNode).cluster)}
          nodeVal={(n) => Math.max(1, (n as GraphNode).pageRank * 800)}
          linkColor={(e) => {
            const edge = e as unknown as { source: { id?: string }; target: { id?: string } };
            const from = edge.source.id ?? '';
            const to = edge.target.id ?? '';
            const edgeData = edges.find((ed) => ed.from === from && ed.to === to);
            return edgeData?.position === 'body' ? 'rgba(0,200,255,0.18)' : 'rgba(255,255,255,0.05)';
          }}
          linkDirectionalArrowLength={3}
          linkDirectionalArrowRelPos={1}
          backgroundColor="#0A1628"
          width={width}
          height={520}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 pt-1">
        <span className="flex items-center gap-1.5 text-[11px] text-[#4A6280]">
          <span className="inline-block h-2 w-2 rounded-full bg-[#00C8FF]" />
          Node color = topic cluster
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[#4A6280]">
          <span className="inline-block h-2 w-2 rounded-full bg-[#00C8FF]/40" />
          Node size = PageRank
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[#4A6280]">
          <span className="inline-block h-0.5 w-4 bg-[#00C8FF]/40" />
          Bright edge = body link
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[#4A6280]">
          <span className="inline-block h-0.5 w-4 bg-white/10" />
          Dim edge = nav / footer link
        </span>
      </div>
    </div>
  );
}

// ─── Issue card ───────────────────────────────────────────────────────────────

const ISSUE_META: Record<LinkStructuralIssue['type'], { label: string; color: string; bg: string; Icon: typeof AlertTriangle }> = {
  orphan:                { label: 'Orphan Page',              color: '#F59E0B', bg: '#F59E0B18', Icon: AlertTriangle },
  dead_end:              { label: 'Dead-End Page',            color: '#4A6280', bg: '#4A628018', Icon: Info },
  overlinked:            { label: 'Overlinked',               color: '#8B5CF6', bg: '#8B5CF618', Icon: Info },
  underlinked_critical:  { label: 'Underlinked Critical',     color: '#EF4444', bg: '#EF444418', Icon: AlertTriangle },
};

function IssueCard({ issue }: { issue: LinkStructuralIssue }) {
  const meta = ISSUE_META[issue.type];
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold shrink-0"
          style={{ color: meta.color, backgroundColor: meta.bg }}>
          {meta.label}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[#C8DFE8] truncate">{urlSlug(issue.url)}</p>
          <p className="mt-1 text-xs text-[#4A6280]">{issue.description}</p>
          <p className="mt-1.5 flex items-start gap-1 text-xs text-cyan">
            <ArrowRight className="h-3 w-3 mt-0.5 shrink-0" />
            {issue.recommendation}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
      <div className="text-2xl font-bold tabular-nums" style={{ color: color ?? 'white' }}>{value}</div>
      <div className="mt-0.5 text-xs font-medium text-white">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-[#4A6280]">{sub}</div>}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function urlSlug(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === '/' ? u.hostname : u.pathname;
  } catch { return url; }
}

// ─── Main page ────────────────────────────────────────────────────────────────

type ViewMode = 'tree' | 'force';

export default function LinksPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { audit, isLoading: auditLoading } = useLatestAudit();

  // FIX 4: typed as LinksApiResponse to capture pagination metadata
  const { data: baseData, isLoading } = useAuditSubReport<LinksApiResponse>(audit?.id ?? null, 'links');

  // Accumulated nodes/edges — grow with each "load more" batch
  const [accNodes, setAccNodes] = useState<GraphNode[]>([]);
  const [accEdges, setAccEdges] = useState<GraphEdge[]>([]);
  const [totalNodes, setTotalNodes] = useState(0);
  const [totalEdges, setTotalEdges] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [view, setView] = useState<ViewMode>('tree');

  // Seed accumulated state when initial data arrives or audit changes
  useEffect(() => {
    if (baseData) {
      setAccNodes(baseData.nodes);
      setAccEdges(baseData.edges);
      setTotalNodes(baseData.totalNodes ?? baseData.nodes.length);
      setTotalEdges(baseData.totalEdges ?? baseData.edges.length);
    }
  }, [baseData]);

  const hasMoreNodes = accNodes.length < totalNodes;
  const hasMoreEdges = accEdges.length < totalEdges;

  const handleLoadMore = useCallback(async () => {
    if (!audit?.id || loadingMore || (!hasMoreNodes && !hasMoreEdges)) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        nodesOffset: String(accNodes.length),
        nodesLimit: '200',
        edgesOffset: String(accEdges.length),
        edgesLimit: '400',
      });
      const res = await fetch(`/api/audit/${audit.id}/links?${params.toString()}`);
      if (!res.ok) return;
      const envelope = await res.json() as GTLResponse<LinksApiResponse>;
      const batch = envelope.data;
      if (!batch) return;
      setAccNodes((prev) => [...prev, ...batch.nodes]);
      setAccEdges((prev) => [...prev, ...batch.edges]);
    } finally {
      setLoadingMore(false);
    }
  }, [audit?.id, accNodes.length, accEdges.length, loadingMore, hasMoreNodes, hasMoreEdges]);

  const loading = auditLoading || isLoading;
  const data = baseData as LinkGraphScore | undefined;
  const nodes = accNodes;
  const edges = accEdges;

  const issuesByType = {
    orphan:               (data?.structuralIssues ?? []).filter((i) => i.type === 'orphan'),
    dead_end:             (data?.structuralIssues ?? []).filter((i) => i.type === 'dead_end'),
    overlinked:           (data?.structuralIssues ?? []).filter((i) => i.type === 'overlinked'),
    underlinked_critical: (data?.structuralIssues ?? []).filter((i) => i.type === 'underlinked_critical'),
  };

  return (
    <DashboardLayout>
      <TopCommandBar
        onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)}
        userName={me?.email?.split('@')[0] ?? null}
        plan={me?.plan}
      />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <GitFork className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">Internal Link Graph</h1>
            </div>
            <p className="text-sm text-[#4A6280]">
              {audit
                ? <>For <span className="text-[#7A9AB4]">{audit.domain}</span></>
                : 'Structural map of internal page relationships, authority flow, and AI crawl paths'}
            </p>
          </div>
          {data && (
            <div className="text-right">
              <div className="text-4xl font-bold tabular-nums" style={{ color: scoreColor(data.score) }}>
                {data.score}
              </div>
              <div className="text-xs text-[#4A6280]">{scoreLabel(data.score)}</div>
            </div>
          )}
        </div>

        {/* Empty states */}
        {!audit && !auditLoading && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <p className="font-semibold text-white">No completed audits yet</p>
            <p className="mt-1 text-sm text-[#4A6280]">Run an audit to generate the internal link graph.</p>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-white/[0.03]" />)}
          </div>
        )}

        {data && (
          <div className="space-y-6">

            {/* Summary stats — uses totalNodes, not accNodes.length */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total Pages" value={totalNodes} {...(accNodes.length < totalNodes ? { sub: `${accNodes.length} loaded` } : {})} />
              <StatCard
                label="Orphan Pages"
                value={data.orphanPages.length}
                sub="no incoming links"
                color={data.orphanPages.length > 0 ? '#F59E0B' : '#22C55E'}
              />
              <StatCard
                label="Dead-End Pages"
                value={data.deadEndPages.length}
                sub="no outgoing links"
                color={data.deadEndPages.length > 5 ? '#F59E0B' : '#4A6280'}
              />
              <StatCard
                label="Link Authority Flow"
                value={data.linkAuthorityFlowScore}
                sub="site-wide LAFS"
                color={scoreColor(data.linkAuthorityFlowScore)}
              />
            </div>

            {/* Secondary stats row */}
            <div className="grid gap-3 sm:grid-cols-4">
              <StatCard label="Hierarchy Depth" value={data.hierarchyDepth} sub="max click depth" />
              <StatCard label="Hub Pages" value={data.overlinkedPages.length} sub="overlinked" />
              <StatCard label="Weak Clusters" value={data.weakClusters.length} sub="low link density" />
              <StatCard
                label="Avg PageRank"
                value={(data.avgPageRank * 100).toFixed(2)}
                sub="× 100"
              />
            </div>

            {/* View toggle */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#C8DFE8]">Graph Visualization</h2>
              <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1">
                <button
                  onClick={() => setView('tree')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    view === 'tree' ? 'bg-white/[0.08] text-white' : 'text-[#4A6280] hover:text-white'
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  Hierarchy Tree
                </button>
                <button
                  onClick={() => setView('force')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    view === 'force' ? 'bg-white/[0.08] text-white' : 'text-[#4A6280] hover:text-white'
                  }`}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Force Graph
                </button>
              </div>
            </div>

            {/* Graph panels */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
              {view === 'tree' ? (
                <HierarchyView nodes={nodes} edges={edges} />
              ) : (
                <ForceGraphView
                  nodes={nodes}
                  edges={edges}
                  totalNodes={totalNodes}
                  totalEdges={totalEdges}
                />
              )}
            </div>

            {/* FIX 4: Load more button — shown when more nodes/edges exist */}
            {(hasMoreNodes || hasMoreEdges) && (
              <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div className="text-xs text-[#4A6280]">
                  <span className="font-medium text-[#7A9AB4]">{accNodes.length} of {totalNodes}</span> nodes loaded
                  {hasMoreEdges && (
                    <> · <span className="font-medium text-[#7A9AB4]">{accEdges.length} of {totalEdges}</span> edges loaded</>
                  )}
                </div>
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="rounded-lg border border-cyan/20 bg-cyan/10 px-3 py-1.5 text-xs font-semibold text-cyan hover:bg-cyan/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMore ? 'Loading…' : `Load next 200 nodes`}
                </button>
              </div>
            )}

            {/* Structural issues */}
            {data.structuralIssues.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">
                  Structural Issues ({data.structuralIssues.length})
                </h2>
                <div className="space-y-2">
                  {[...issuesByType.underlinked_critical, ...issuesByType.orphan, ...issuesByType.dead_end, ...issuesByType.overlinked]
                    .slice(0, 20)
                    .map((issue, i) => <IssueCard key={i} issue={issue} />)}
                  {data.structuralIssues.length > 20 && (
                    <p className="text-xs text-[#4A6280] pt-1">
                      + {data.structuralIssues.length - 20} more issues — run a full audit for the complete report.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Link suggestions */}
            {data.linkSuggestions.length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">
                  Link Suggestions ({data.linkSuggestions.length})
                </h2>
                <div className="space-y-3">
                  {data.linkSuggestions.slice(0, 10).map((s, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-[#7A9AB4] truncate max-w-[180px]">{urlSlug(s.from)}</span>
                          <ArrowRight className="h-3 w-3 text-cyan shrink-0" />
                          <span className="font-medium text-white truncate max-w-[180px]">{urlSlug(s.to)}</span>
                        </div>
                        <p className="mt-0.5 text-[#4A6280]">{s.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* External link metadata */}
            {data.externalLinkMeta.externalLinkCount > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8] flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-[#4A6280]" />
                  External Link Profile
                </h2>
                <div className="grid gap-3 sm:grid-cols-3 mb-4">
                  <StatCard
                    label="External Links"
                    value={data.externalLinkMeta.externalLinkCount}
                  />
                  <StatCard
                    label="Nofollow Ratio"
                    value={`${Math.round(data.externalLinkMeta.nofollowRatio * 100)}%`}
                    color={data.externalLinkMeta.nofollowRatio > 0.5 ? '#F59E0B' : '#4A6280'}
                  />
                  <StatCard
                    label="Authority Score"
                    value={data.externalLinkMeta.externalAuthorityScore}
                    sub="% to high-auth domains"
                    color={scoreColor(data.externalLinkMeta.externalAuthorityScore)}
                  />
                </div>
                {data.externalLinkMeta.topDomains.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-[#4A6280]">Top External Domains</p>
                    <div className="space-y-1">
                      {data.externalLinkMeta.topDomains.slice(0, 8).map((d) => (
                        <div key={d.domain} className="flex items-center gap-2 text-xs">
                          <span className="flex-1 text-[#C8DFE8] truncate">{d.domain}</span>
                          <div className="h-1.5 rounded-full bg-white/[0.06] w-24 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-cyan/40"
                              style={{
                                width: `${Math.round((d.count / (data.externalLinkMeta.topDomains[0]?.count ?? 1)) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="w-8 text-right tabular-nums text-[#4A6280]">{d.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Full-report link */}
            {audit && (
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <GitFork className="h-5 w-5 shrink-0 text-cyan" />
                <div>
                  <p className="text-sm font-semibold text-white">Full Link Graph</p>
                  <p className="text-xs text-[#4A6280]">
                    Interactive full-site graph with cluster exploration available on the audit results page.
                  </p>
                </div>
                <a
                  href={`/audit/${encodeURIComponent(audit.domain)}?auditId=${audit.id}`}
                  className="ml-auto shrink-0 rounded-lg border border-cyan/20 bg-cyan/10 px-3 py-1.5 text-xs font-semibold text-cyan hover:bg-cyan/20 transition-colors flex items-center gap-1"
                >
                  Open Audit <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
