export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { gtlEmpty, gtlResponse, resolveGTLState } from '@/lib/gtl';
import type { LinkGraphScore, GraphNode, GraphEdge, AuditStatus } from '@sitenexis/shared';

interface Params { params: Promise<{ id: string }> }

// ─── Pagination defaults ──────────────────────────────────────────────────────

const DEFAULT_NODES_LIMIT = 200;
const DEFAULT_EDGES_LIMIT = 400;

// Extended response type — superset of LinkGraphScore, adds pagination metadata.
// Clients should treat nodes/edges as a page; all other fields are always complete.
export interface LinksApiResponse extends Omit<LinkGraphScore, 'nodes' | 'edges'> {
  nodes: GraphNode[];
  edges: GraphEdge[];
  totalNodes: number;
  totalEdges: number;
  nodesOffset: number;
  nodesLimit: number;
  edgesOffset: number;
  edgesLimit: number;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  const sp = req.nextUrl.searchParams;
  const nodesOffset = Math.max(0, parseInt(sp.get('nodesOffset') ?? '0', 10) || 0);
  const nodesLimit  = Math.min(500, Math.max(1, parseInt(sp.get('nodesLimit') ?? String(DEFAULT_NODES_LIMIT), 10) || DEFAULT_NODES_LIMIT));
  const edgesOffset = Math.max(0, parseInt(sp.get('edgesOffset') ?? '0', 10) || 0);
  const edgesLimit  = Math.min(2000, Math.max(1, parseInt(sp.get('edgesLimit') ?? String(DEFAULT_EDGES_LIMIT), 10) || DEFAULT_EDGES_LIMIT));

  try {
    const { getAuditWithResults, getAuditScores } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as { userId: string; status: AuditStatus } | null;
    if (!audit) return gtlEmpty();
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const auditScores = await getAuditScores(id);
    const breakdown = auditScores?.breakdown as Record<string, unknown> | null ?? {};
    const linkGraph = breakdown['linkGraph'] as LinkGraphScore | undefined;

    const state = resolveGTLState(audit.status, !!linkGraph);
    if (!linkGraph) return gtlResponse(state, null);

    // Nodes sorted highest-PageRank first so pagination always returns the most
    // important nodes first, regardless of crawl order.
    const sortedNodes = [...linkGraph.nodes].sort((a, b) => b.pageRank - a.pageRank);
    const pagedNodes = sortedNodes.slice(nodesOffset, nodesOffset + nodesLimit);

    // Paginate edges in array order — no natural priority ordering for edges.
    const pagedEdges = linkGraph.edges.slice(edgesOffset, edgesOffset + edgesLimit);

    const payload: LinksApiResponse = {
      ...linkGraph,
      nodes: pagedNodes,
      edges: pagedEdges,
      totalNodes: linkGraph.nodes.length,
      totalEdges: linkGraph.edges.length,
      nodesOffset,
      nodesLimit,
      edgesOffset,
      edgesLimit,
    };

    return gtlResponse(state, payload);
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/links failed');
    return NextResponse.json({ error: 'Failed to load link graph data' }, { status: 500 });
  }
}
