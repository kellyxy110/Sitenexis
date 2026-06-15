export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';
import { logger } from '@/lib/logger';

interface Params { params: Promise<{ id: string }> }

function demoData(auditId: string) {
  return {
    auditId,
    nodes: [
      { id: 'n1', type: 'entity', label: 'Primary Organisation', confidence: 0.92, citationReadiness: 0.84, disambiguationStrength: 0.86, supportingPages: ['/', '/about'] },
      { id: 'n2', type: 'topic',  label: 'Core Service Category', confidence: 0.85, citationReadiness: 0.76, disambiguationStrength: 0.71, supportingPages: ['/services'] },
      { id: 'n3', type: 'topic',  label: 'Secondary Topic Cluster', confidence: 0.79, citationReadiness: 0.68, disambiguationStrength: 0.65, supportingPages: ['/blog'] },
      { id: 'n4', type: 'entity', label: 'Founder / Author', confidence: 0.62, citationReadiness: 0.51, disambiguationStrength: 0.48, supportingPages: ['/about'] },
      { id: 'n5', type: 'claim',  label: 'Primary Value Proposition', confidence: 0.88, citationReadiness: 0.80, disambiguationStrength: 0.74, supportingPages: ['/', '/pricing'] },
    ],
    edges: [
      { source: 'n1', target: 'n2', relationshipType: 'offers', strength: 0.84, evidencedBy: ['/services'] },
      { source: 'n1', target: 'n5', relationshipType: 'supports', strength: 0.88, evidencedBy: ['/', '/pricing'] },
      { source: 'n4', target: 'n1', relationshipType: 'authorOf', strength: 0.72, evidencedBy: ['/about'] },
      { source: 'n2', target: 'n3', relationshipType: 'relatedTo', strength: 0.61, evidencedBy: ['/blog'] },
    ],
  };
}

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  if (!isFullyConfigured()) return NextResponse.json(demoData(id));

  try {
    const { getAuditWithResults, getPerceptionGraph } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as { userId: string } | null;
    if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const graph = await getPerceptionGraph(id);
    if (!graph) return NextResponse.json({ error: 'Perception graph not yet available' }, { status: 404 });

    return NextResponse.json(graph);
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/perception-graph failed');
    return NextResponse.json({ error: 'Failed to load perception graph data' }, { status: 500 });
  }
}
