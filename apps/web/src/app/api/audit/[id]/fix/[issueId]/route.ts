export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';

interface Params {
  params: Promise<{ id: string; issueId: string }>;
}

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch {
    return unauthorizedResponse();
  }

  const { id: auditId, issueId } = await params;

  try {
    const { getAuditById, getIssueById, saveFix } = await import('@sitenexis/db');

    // Verify audit ownership
    const audit = await getAuditById(auditId);
    if (!audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
    if ((audit as { userId: string }).userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const issue = await getIssueById(issueId);
    if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    if (issue.auditId !== auditId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Return cached fix if already generated
    if (issue.fixCode) {
      return NextResponse.json({
        issueId: issue.id,
        problem: issue.problem,
        solution: issue.solution,
        fixCode: issue.fixCode,
        fixLanguage: issue.fixLanguage,
        cached: true,
      });
    }

    // Generate fix on demand
    const { generateFix } = await import('@sitenexis/analyzers/fixes');
    const { env } = await import('@/lib/env');

    const fix = await generateFix(
      {
        issueId: issue.id,
        auditId: issue.auditId,
        type: issue.type,
        severity: issue.severity,
        message: issue.message,
        recommendation: issue.recommendation,
        ...(issue.pageUrl ? { pageUrl: issue.pageUrl } : {}),
        module: issue.module,
        domain: audit.domain as string,
      },
      env.GROQ_API_KEY ? { groqApiKey: env.GROQ_API_KEY } : {},
    );

    // Persist so subsequent requests are instant
    await saveFix(issueId, {
      problem: fix.problem,
      solution: fix.solution,
      fixCode: fix.fixCode,
      fixLanguage: fix.fixLanguage,
    });

    return NextResponse.json({
      issueId: issue.id,
      problem: fix.problem,
      solution: fix.solution,
      fixCode: fix.fixCode,
      fixLanguage: fix.fixLanguage,
      expectedImpact: fix.expectedImpact,
      effort: fix.effort,
      cached: false,
    });
  } catch (err) {
    const { logger } = await import('@/lib/logger');
    logger.error({ err, auditId, issueId }, 'Fix generation failed');
    return NextResponse.json({ error: 'Fix generation failed' }, { status: 500 });
  }
}
