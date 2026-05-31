export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';
import { logger } from '@/lib/logger';

interface Params { params: Promise<{ id: string }> }

function demoData(auditId: string) {
  return {
    auditId,
    aiVisibilityScore: 74,
    machineReadabilityScore: 79,
    entityConfidenceScore: 78,
    retrievalReadinessScore: 72,
    citationProbabilityScore: 71,
    semanticTrustScore: 81,
    recommendationConfidence: 74,
    providerScores: {
      googleAIOverviews: 71,
      chatGPT: 68,
      perplexity: 74,
      gemini: 70,
      claude: 76,
    },
    breakdown: {
      machineReadability: {
        renderingFidelity: 95,
        boilerplateRatio: 78,
        chunkBoundaryQuality: 72,
        signalToNoiseRatio: 80,
        headingHierarchy: 84,
        readingOrderConsistency: 88,
        linkAnchorQuality: 66,
      },
      entityIntelligence: {
        consistencyScore: 82,
        coverageScore: 74,
        disambiguationScore: 79,
      },
      citationFactors: [
        { url: 'https://example.com/', score: 78 },
        { url: 'https://example.com/about', score: 71 },
        { url: 'https://example.com/services', score: 65 },
      ],
      semanticTrust: {
        authorshipTrust: 72,
        organisationalTrust: 84,
        contentTrust: 78,
        structuralTrust: 91,
      },
    },
  };
}

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  try { await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  if (!isFullyConfigured()) return NextResponse.json(demoData(id));

  try {
    const { getAuditWithResults, getAIVisibilityScore } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as { userId: string } | null;
    if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const score = await getAIVisibilityScore(id);
    if (!score) return NextResponse.json({ error: 'AI visibility analysis not yet available' }, { status: 404 });

    return NextResponse.json({
      auditId: id,
      aiVisibilityScore: score.aiVisibilityScore,
      machineReadabilityScore: score.machineReadabilityScore,
      entityConfidenceScore: score.entityConfidenceScore,
      retrievalReadinessScore: score.retrievalReadinessScore,
      citationProbabilityScore: score.citationProbabilityScore,
      semanticTrustScore: score.semanticTrustScore,
      recommendationConfidence: score.recommendationConfidence,
      providerScores: score.providerScores,
      breakdown: score.breakdown,
    });
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/ai-visibility failed');
    return NextResponse.json({ error: 'Failed to load AI visibility data' }, { status: 500 });
  }
}
