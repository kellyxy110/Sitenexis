export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';
import { logger } from '@/lib/logger';

interface Params { params: Promise<{ id: string }> }

function demoData(auditId: string) {
  return {
    auditId,
    overallSurfaceScore: 64,
    surfaces: {
      aiOverviews: {
        inclusionProbability: 71,
        status: 'partial',
        blockers: [{ type: 'low_schema_completeness', description: 'Featured snippet eligibility is below threshold on key topic pages.', recommendation: 'Add FAQ schema to primary service pages.' }],
        recommendations: ['Add FAQ schema to top 5 pages', 'Improve structured data coverage'],
      },
      chatRecommendation: {
        inclusionProbability: 69,
        status: 'partial',
        blockers: [{ type: 'weak_entity_definition', description: 'Primary entity definition is not present in a concise, conversationally-retrievable form.', recommendation: 'Add a clear one-paragraph entity definition to the homepage.' }],
        recommendations: ['Add direct answer blocks for common queries'],
      },
      voiceRetrieval: {
        inclusionProbability: 42,
        status: 'absent',
        blockers: [{ type: 'no_speakable_schema', description: 'No speakable schema detected. Voice assistants cannot identify concise answer candidates.', recommendation: 'Add SpeakableSpecification schema to FAQ and definition pages.' }],
        recommendations: ['Add speakable schema to FAQ pages', 'Create sub-30-word answer blocks for key facts'],
      },
      agentDiscovery: {
        inclusionProbability: 38,
        status: 'absent',
        blockers: [{ type: 'no_agent_endpoints', description: 'No /.well-known/ai-plugin.json or robots.txt agent directives detected.', recommendation: 'Publish discovery endpoints for autonomous agent access.' }],
        recommendations: ['Publish /.well-known/ai-plugin.json', 'Add agent-specific robots.txt allowances'],
      },
    },
    coverageGaps: [
      { surface: 'Voice Retrieval', missedOpportunity: 'No speakable answer candidates', requiredSignals: ['speakable schema', 'sub-30-word facts'], estimatedImpact: 'medium' },
      { surface: 'Agent Discovery', missedOpportunity: 'No programmatic discovery endpoints', requiredSignals: ['/.well-known/ai-plugin.json', 'OpenAPI spec'], estimatedImpact: 'low' },
    ],
    missingVisibilityChannels: ['Voice assistants', 'Autonomous AI agents'],
  };
}

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  try { await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  if (!isFullyConfigured()) return NextResponse.json(demoData(id));

  try {
    const { getAuditWithResults, getRecommendationSurfaceMap } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as { userId: string } | null;
    if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const map = await getRecommendationSurfaceMap(id);
    if (!map) return NextResponse.json({ error: 'Recommendation surface analysis not yet available' }, { status: 404 });

    return NextResponse.json({ auditId: id, ...map });
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/surfaces failed');
    return NextResponse.json({ error: 'Failed to load recommendation surface data' }, { status: 500 });
  }
}
