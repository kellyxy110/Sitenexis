export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { buildMachineResourceStudioReport } from '@sitenexis/analyzers';
import type { MRSInput } from '@sitenexis/shared';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { gtlEmpty, gtlResponse, resolveGTLState } from '@/lib/gtl';
import { logger } from '@/lib/logger';

interface Params { params: Promise<{ id: string }> }
interface MRSDatabaseIssue extends Omit<MRSInput['issues'][number], 'createdAt'> { createdAt: Date }
interface MRSDatabaseAudit {
  id: string;
  userId: string;
  domain: string;
  status: 'queued' | 'running' | 'partial' | 'complete' | 'failed';
  completedAt: Date | null;
  pageCount: number | null;
  scores: MRSInput['scores'] & { id?: string };
  aiVisibilityScores: MRSInput['aiVisibility'];
  pages: Array<MRSInput['pages'][number]>;
  issues: MRSDatabaseIssue[];
}

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  try {
    const { getAuditWithResults, getMachineTrustScore } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id, user.id) as unknown as MRSDatabaseAudit | null;
    if (!audit) return gtlEmpty();
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const state = resolveGTLState(audit.status, Boolean(audit.scores));
    if (!audit.scores && audit.status !== 'complete') return gtlResponse(state, null);

    const trust = await getMachineTrustScore(id);

    const input: MRSInput = {
      audit: {
        id: audit.id,
        domain: audit.domain,
        completedAt: audit.completedAt?.toISOString() ?? null,
        pageCount: audit.pageCount,
      },
      scores: audit.scores ? {
        overall: audit.scores.overall,
        seoScore: audit.scores.seoScore,
        aiScore: audit.scores.aiScore,
        schemaScore: audit.scores.schemaScore,
        linkGraphScore: audit.scores.linkGraphScore,
        performanceScore: audit.scores.performanceScore,
      } : null,
      aiVisibility: audit.aiVisibilityScores ? {
        aiVisibilityScore: audit.aiVisibilityScores.aiVisibilityScore,
        machineReadabilityScore: audit.aiVisibilityScores.machineReadabilityScore,
        entityConfidenceScore: audit.aiVisibilityScores.entityConfidenceScore,
        retrievalReadinessScore: audit.aiVisibilityScores.retrievalReadinessScore,
        citationProbabilityScore: audit.aiVisibilityScores.citationProbabilityScore,
        semanticTrustScore: audit.aiVisibilityScores.semanticTrustScore,
        recommendationConfidence: audit.aiVisibilityScores.recommendationConfidence,
      } : null,
      machineTrust: trust ? { overall: trust.overall } : null,
      pages: audit.pages.map((page) => ({ id: page.id, url: page.url, statusCode: page.statusCode, isIndexable: page.isIndexable, wordCount: page.wordCount, internalLinks: page.internalLinks, externalLinks: page.externalLinks })),
      issues: audit.issues.map((issue) => ({ id: issue.id, module: issue.module, type: issue.type, severity: issue.severity, message: issue.message, recommendation: issue.recommendation, ...(issue.pageUrl !== undefined ? { pageUrl: issue.pageUrl } : {}), createdAt: issue.createdAt.toISOString() })),
    };
    return gtlResponse(state, buildMachineResourceStudioReport(input));
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/machine-resources failed');
    return NextResponse.json({ error: 'Failed to build Machine Resource Studio report' }, { status: 500 });
  }
}
