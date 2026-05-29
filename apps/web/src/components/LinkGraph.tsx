'use client';

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import type { InternalLinkGraph, GraphNode, LinkSuggestion } from '@sitenexis/shared';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface LinkGraphProps {
  graph: InternalLinkGraph;
  onNodeClick?: (nodeId: string) => void;
}

// ─── Colour palette for clusters ─────────────────────────────────────────────

const CLUSTER_PALETTE = [
  '#00C8FF', '#0BCEBC', '#22C55E', '#F59E0B', '#EF4444',
  '#A855F7', '#EC4899', '#F97316', '#14B8A6', '#6366F1',
];

const ORPHAN_COLOR   = '#EF4444';
const HOME_COLOR     = '#F59E0B';
const SELECTED_COLOR = '#FFFFFF';
const EDGE_COLOR     = 'rgba(0,200,255,0.25)';
// const EDGE_HOVER_COLOR = 'rgba(0,200,255,0.6)'; // reserved for hover state
const BG_COLOR       = '#0A1628';

const MIN_RADIUS = 5;
const MAX_RADIUS = 22;
const LABEL_MIN_RANK = 0.05; // always show label if pageRank >= this

// ─── Force simulation types (react-force-graph-2d) ───────────────────────────

// react-force-graph-2d React component props (subset we use)
type FG2DProps = {
  graphData: { nodes: FGNode[]; links: FGLink[] };
  backgroundColor?: string;
  nodeId?: string;
  nodeLabel?: () => string;
  nodeCanvasObject?: (node: FGNode, ctx: CanvasRenderingContext2D, globalScale: number) => void;
  nodePointerAreaPaint?: (node: FGNode, color: string, ctx: CanvasRenderingContext2D) => void;
  linkColor?: () => string;
  linkWidth?: (link: FGLink) => number;
  linkDirectionalArrowLength?: number;
  linkDirectionalArrowRelPos?: number;
  onNodeClick?: (node: FGNode) => void;
  onNodeHover?: (node: FGNode | null) => void;
  onNodeDrag?: (node: FGNode) => void;
  width?: number;
  height?: number;
};

type ForceGraphComponent = (props: FG2DProps) => React.ReactElement;

interface FGNode extends GraphNode {
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
  __r?: number;         // computed radius
  __color?: string;     // computed fill
}

interface FGLink {
  source: string | FGNode;
  target: string | FGNode;
  weight: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clusterColor(cluster: string, clusterIndex: Map<string, number>): string {
  const idx = clusterIndex.get(cluster) ?? 0;
  return CLUSTER_PALETTE[idx % CLUSTER_PALETTE.length]!;
}

function nodeRadius(node: GraphNode, maxRank: number, usePageRankSizing: boolean): number {
  if (!usePageRankSizing) return 8;
  const normalised = maxRank > 0 ? node.pageRank / maxRank : 0;
  return MIN_RADIUS + normalised * (MAX_RADIUS - MIN_RADIUS);
}

function truncateUrl(url: string, max = 40): string {
  const clean = url.replace(/^https?:\/\/(www\.)?/, '');
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}

// ─── Side panel ───────────────────────────────────────────────────────────────

interface SidePanelProps {
  node: GraphNode | null;
  graph: InternalLinkGraph;
  onClose: () => void;
}

function SidePanel({ node, graph, onClose }: SidePanelProps) {
  if (!node) return null;

  const inbound  = (graph.edges ?? []).filter((e) => e.target === node.url || e.to === node.url).map((e) => e.source ?? e.from);
  const outbound = (graph.edges ?? []).filter((e) => e.source === node.url || e.from === node.url).map((e) => e.target ?? e.to);
  const suggestions: LinkSuggestion[] = (graph.linkSuggestions ?? []).filter((s) => s.to === node.url || s.from === node.url);
  const isOrphan = (graph.orphanPages ?? []).includes(node.url);

  return (
    <div className="absolute right-0 top-0 bottom-0 z-20 flex w-72 flex-col border-l border-white/10 bg-[#050B09]/95 backdrop-blur-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 shrink-0">
        <span className="text-sm font-semibold text-white truncate">{node.label}</span>
        <button onClick={onClose} className="shrink-0 text-[#4A6280] hover:text-white transition-colors ml-2">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* URL */}
        <div>
          <p className="mb-1 text-[#4A6280] uppercase tracking-wider text-[10px]">Page URL</p>
          <div className="flex items-center gap-2">
            <span className="truncate text-white">{truncateUrl(node.url, 35)}</span>
            <a href={node.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-cyan hover:text-teal">↗</a>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'PageRank',    value: node.pageRank.toFixed(4) },
            { label: 'Inbound',     value: node.inDegree },
            { label: 'Outbound',    value: node.outDegree },
            { label: 'Cluster',     value: node.cluster },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-white/10 bg-white/5 p-2">
              <p className="text-[10px] text-[#4A6280]">{label}</p>
              <p className="mt-0.5 font-semibold text-white truncate">{String(value)}</p>
            </div>
          ))}
        </div>

        {isOrphan && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
            <p className="text-xs font-medium text-red-400">⚠ Orphan page — no inbound links</p>
          </div>
        )}

        {/* Inbound links */}
        {inbound.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-wider text-[#4A6280]">Inbound Links ({inbound.length})</p>
            <ul className="space-y-1">
              {inbound.slice(0, 8).map((url, i) => (
                <li key={i} className="truncate text-[#4A6280] hover:text-white transition-colors">
                  {truncateUrl(String(url), 38)}
                </li>
              ))}
              {inbound.length > 8 && <li className="text-[#4A6280]">+{inbound.length - 8} more</li>}
            </ul>
          </div>
        )}

        {/* Outbound links */}
        {outbound.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-wider text-[#4A6280]">Outbound Links ({outbound.length})</p>
            <ul className="space-y-1">
              {outbound.slice(0, 8).map((url, i) => (
                <li key={i} className="truncate text-[#4A6280] hover:text-white transition-colors">
                  {truncateUrl(String(url), 38)}
                </li>
              ))}
              {outbound.length > 8 && <li className="text-[#4A6280]">+{outbound.length - 8} more</li>}
            </ul>
          </div>
        )}

        {/* Link suggestions */}
        {suggestions.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-wider text-cyan">Link Suggestions</p>
            <ul className="space-y-2">
              {suggestions.map((s, i) => (
                <li key={i} className="rounded-lg border border-cyan/20 bg-cyan/5 px-3 py-2">
                  <p className="text-[#4A6280] leading-relaxed">{s.reason}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LinkGraph({ graph, onNodeClick }: LinkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [FGComponent, setFGComponent] = useState<ForceGraphComponent | null>(null);

  const [selectedNode, setSelectedNode]     = useState<GraphNode | null>(null);
  const [hoveredNode,  setHoveredNode]      = useState<GraphNode | null>(null);
  const [tooltipPos,   setTooltipPos]       = useState({ x: 0, y: 0 });
  const [searchQuery,  setSearchQuery]      = useState('');
  const [showOrphans,  setShowOrphans]      = useState(true);
  const [showWeak,     setShowWeak]         = useState(true);
  const [useClusterColors, setUseClusterColors] = useState(true);
  const [useRankSizing,    setUseRankSizing]    = useState(true);
  const [highlightOrphans, setHighlightOrphans] = useState(true);
  const [mounted, setMounted]               = useState(false);

  const nodes        = graph.nodes ?? [];
  const edges        = graph.edges ?? [];
  const orphanPages  = graph.orphanPages ?? [];
  const weakClusters = graph.weakClusters ?? [];

  // Build cluster colour index once
  const clusterIndex = useMemo(() => {
    const idx = new Map<string, number>();
    let i = 0;
    for (const node of nodes) {
      if (!idx.has(node.cluster)) idx.set(node.cluster, i++);
    }
    return idx;
  }, [nodes]);

  const orphanSet  = useMemo(() => new Set(orphanPages), [orphanPages]);
  const weakSet    = useMemo(() => new Set(weakClusters.flat()), [weakClusters]);
  const maxRank    = useMemo(() => Math.max(...nodes.map((n) => n.pageRank), 0.001), [nodes]);

  // Root node = shortest URL
  const rootUrl = useMemo(() =>
    nodes.reduce((best, n) => n.url.length < best.length ? n.url : best, nodes[0]?.url ?? ''),
    [nodes]
  );

  // Filtered data based on toggles
  const { fgNodes, fgLinks } = useMemo(() => {
    let visNodes = nodes as FGNode[];
    if (!showOrphans) visNodes = visNodes.filter((n) => !orphanSet.has(n.url));
    if (!showWeak)    visNodes = visNodes.filter((n) => !weakSet.has(n.url));

    const nodeIds = new Set(visNodes.map((n) => n.url));
    const links: FGLink[] = edges
      .filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to))
      .map((e) => ({ source: e.from, target: e.to, weight: e.weight }));

    // Pre-compute radius and color on each node object
    visNodes = visNodes.map((n) => ({
      ...n,
      __r: nodeRadius(n, maxRank, useRankSizing),
      __color:
        n.url === rootUrl ? HOME_COLOR :
        highlightOrphans && orphanSet.has(n.url) ? ORPHAN_COLOR :
        useClusterColors ? clusterColor(n.cluster, clusterIndex) :
        '#4A6280',
    }));

    return { fgNodes: visNodes, fgLinks: links };
  }, [nodes, edges, showOrphans, showWeak, orphanSet, weakSet, maxRank, useRankSizing, highlightOrphans, useClusterColors, clusterIndex, rootUrl]);

  // Search highlight set
  const searchHighlight = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase();
    return new Set(nodes.filter((n) => n.url.toLowerCase().includes(q) || n.label.toLowerCase().includes(q)).map((n) => n.url));
  }, [searchQuery, nodes]);

  // Unique clusters for legend
  const clusters = useMemo(() => {
    const seen = new Set<string>();
    return nodes
      .filter((n) => { if (seen.has(n.cluster)) return false; seen.add(n.cluster); return true; })
      .slice(0, 10)
      .map((n) => ({ id: n.cluster, color: clusterColor(n.cluster, clusterIndex) }));
  }, [nodes, clusterIndex]);

  // Load react-force-graph-2d dynamically (ESM, browser-only React component)
  useEffect(() => {
    setMounted(true);
    void import('react-force-graph-2d').then((mod) => {
      setFGComponent(() => mod.default as ForceGraphComponent);
    });
  }, []);

  const nodeCanvasObjectFn = useCallback((node: FGNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const r     = node.__r ?? 7;
    const color = node.__color ?? '#4A6280';
    const isSelected = selectedNode?.url === node.url;
    const isHovered  = hoveredNode?.url   === node.url;
    const inSearch   = searchHighlight.size > 0 && searchHighlight.has(node.url);
    const dimmed     = searchHighlight.size > 0 && !inSearch && !isSelected;

    ctx.globalAlpha = dimmed ? 0.2 : 1;

    if (isSelected || isHovered) {
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, r + 3, 0, 2 * Math.PI);
      ctx.strokeStyle = isSelected ? SELECTED_COLOR : color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (inSearch) {
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, r + 5, 0, 2 * Math.PI);
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    const showLabel = node.pageRank >= LABEL_MIN_RANK || isHovered || isSelected;
    if (showLabel && globalScale > 0.4) {
      const label = node.label.length > 20 ? node.label.slice(0, 19) + '…' : node.label;
      const fontSize = Math.max(8, Math.min(12, r * 0.9));
      ctx.font = `${fontSize}px system-ui, sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + r + fontSize + 2);
    }
    ctx.globalAlpha = 1;
  }, [selectedNode, hoveredNode, searchHighlight]);

  const nodePointerAreaPaintFn = useCallback((node: FGNode, color: string, ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    ctx.arc(node.x ?? 0, node.y ?? 0, (node.__r ?? 7) + 4, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }, []);

  const handleNodeClick = useCallback((node: FGNode) => {
    setSelectedNode((prev) => prev?.url === node.url ? null : node);
    onNodeClick?.(node.url);
  }, [onNodeClick]);

  const handleNodeHover = useCallback((node: FGNode | null) => {
    setHoveredNode(node);
    if (containerRef.current) {
      containerRef.current.style.cursor = node ? 'pointer' : 'default';
    }
  }, []);

  const handleNodeDrag = useCallback((node: FGNode) => {
    node.fx = node.x ?? 0;
    node.fy = node.y ?? 0;
  }, []);

  const handleZoomIn   = useCallback(() => {}, []);
  const handleZoomOut  = useCallback(() => {}, []);
  const handleFit      = useCallback(() => {}, []);
  const handleReset    = useCallback(() => { setSelectedNode(null); }, []);

  return (
    <div className="relative flex h-[600px] w-full overflow-hidden rounded-xl border border-white/10 bg-[#050B09]">

      {/* ── Force graph canvas ──────────────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1">
        {FGComponent && (
          <FGComponent
            graphData={{ nodes: fgNodes, links: fgLinks }}
            backgroundColor={BG_COLOR}
            nodeId="url"
            nodeLabel={() => ''}
            nodeCanvasObject={nodeCanvasObjectFn}
            nodePointerAreaPaint={nodePointerAreaPaintFn}
            linkColor={() => EDGE_COLOR}
            linkWidth={(link: FGLink) => Math.max(1, Math.min(4, link.weight))}
            linkDirectionalArrowLength={3}
            linkDirectionalArrowRelPos={1}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            onNodeDrag={handleNodeDrag}
            width={800}
            height={580}
          />
        )}
      </div>

      {/* ── Controls panel (top-left) ───────────────────────────────────────── */}
      <div className="absolute left-3 top-3 z-10 flex flex-col gap-2">
        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search pages..."
          className="w-48 rounded-lg border border-white/10 bg-[#050B09]/90 px-3 py-1.5 text-xs text-white placeholder-[#4A6280] outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 backdrop-blur-sm"
        />

        {/* Zoom controls */}
        <div className="flex gap-1">
          {[
            { label: '+', fn: handleZoomIn,  title: 'Zoom in' },
            { label: '−', fn: handleZoomOut, title: 'Zoom out' },
            { label: '⊞', fn: handleFit,     title: 'Fit all' },
            { label: '↺', fn: handleReset,   title: 'Reset' },
          ].map(({ label, fn, title }) => (
            <button
              key={label}
              onClick={fn}
              title={title}
              className="h-7 w-7 rounded border border-white/10 bg-[#050B09]/90 text-sm text-[#4A6280] backdrop-blur-sm hover:border-white/30 hover:text-white transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        {/* Toggle panel */}
        <div className="rounded-lg border border-white/10 bg-[#050B09]/90 backdrop-blur-sm p-2 space-y-1.5">
          {[
            { label: 'Cluster colours', value: useClusterColors, set: setUseClusterColors },
            { label: 'PageRank sizing', value: useRankSizing,    set: setUseRankSizing },
            { label: 'Orphan highlight',value: highlightOrphans, set: setHighlightOrphans },
            { label: 'Show orphans',    value: showOrphans,      set: setShowOrphans },
            { label: 'Show weak clusters', value: showWeak,     set: setShowWeak },
          ].map(({ label, value, set }) => (
            <label key={label} className="flex cursor-pointer items-center gap-2 text-xs text-[#4A6280] hover:text-white transition-colors select-none">
              <div
                onClick={() => set((v: boolean) => !v)}
                className={`h-4 w-7 rounded-full transition-colors ${value ? 'bg-cyan' : 'bg-white/10'}`}
              >
                <div className={`h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${value ? 'translate-x-3' : 'translate-x-0'}`} />
              </div>
              {label}
            </label>
          ))}
        </div>

        {/* Legend */}
        {useClusterColors && clusters.length > 1 && (
          <div className="rounded-lg border border-white/10 bg-[#050B09]/90 backdrop-blur-sm p-2 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-[#4A6280]">Clusters</p>
            {clusters.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="text-[10px] text-[#4A6280] truncate">{c.id}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-1 pt-1 border-t border-white/5">
              <div className="h-2.5 w-2.5 rounded-full shrink-0 bg-red-400" />
              <span className="text-[10px] text-[#4A6280]">Orphan page</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full shrink-0 bg-amber-400" />
              <span className="text-[10px] text-[#4A6280]">Homepage</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Stats overlay (top-right when no side panel) ────────────────────── */}
      {!selectedNode && (
        <div className="absolute right-3 top-3 z-10 rounded-lg border border-white/10 bg-[#050B09]/90 backdrop-blur-sm px-3 py-2 text-xs text-[#4A6280] space-y-0.5">
          <p><span className="text-white font-semibold">{nodes.length}</span> pages</p>
          <p><span className="text-white font-semibold">{edges.length}</span> links</p>
          <p><span className="text-red-400 font-semibold">{orphanPages.length}</span> orphans</p>
          <p><span className="text-amber-400 font-semibold">{weakClusters.length}</span> weak clusters</p>
        </div>
      )}

      {/* ── Hover tooltip ────────────────────────────────────────────────────── */}
      {hoveredNode && !selectedNode && (
        <div
          className="pointer-events-none absolute z-30 rounded-lg border border-white/10 bg-[#050B09]/95 px-3 py-2 text-xs backdrop-blur-sm"
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 40, maxWidth: 220 }}
        >
          <p className="font-semibold text-white truncate">{hoveredNode.label}</p>
          <p className="text-[#4A6280] truncate mt-0.5">{truncateUrl(hoveredNode.url, 30)}</p>
          <div className="mt-1.5 flex gap-3 text-[10px]">
            <span>PR: <span className="text-cyan">{hoveredNode.pageRank.toFixed(3)}</span></span>
            <span>In: <span className="text-teal">{hoveredNode.inDegree}</span></span>
            <span>Out: <span className="text-teal">{hoveredNode.outDegree}</span></span>
          </div>
        </div>
      )}

      {/* ── Side panel ───────────────────────────────────────────────────────── */}
      <SidePanel
        node={selectedNode}
        graph={graph}
        onClose={() => setSelectedNode(null)}
      />

      {/* ── Mouse-move tracker for tooltip ───────────────────────────────────── */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        onMouseMove={(e) => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
      />

      {/* ── Loading placeholder if not yet mounted ────────────────────────── */}
      {!mounted && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
            <p className="text-xs text-[#4A6280]">Loading graph...</p>
          </div>
        </div>
      )}
    </div>
  );
}
