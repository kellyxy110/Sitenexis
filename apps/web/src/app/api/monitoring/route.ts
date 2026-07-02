export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';
import type { ScoreSnapshot } from '@sitenexis/loop-os';

export type MonitoringData = {
  domain: string | null;
  scoreHistory: ScoreSnapshot[];
  lastAuditId: string | null;
  lastAuditCompletedAt: string | null;
  openIssueCount: number;
  resolvedIssueCount: number;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  if (!isFullyConfigured()) {
    return NextResponse.json({
      domain: null, scoreHistory: [],
      lastAuditId: null, lastAuditCompletedAt: null,
      openIssueCount: 0, resolvedIssueCount: 0,
    } satisfies MonitoringData);
  }

  try {
    const { prisma } = await import('@sitenexis/db');

    // Get the user's most recent audit to find their domain
    const latestAudit = await prisma.audit.findFirst({
      where: { userId: user.id, status: 'complete' },
      orderBy: { createdAt: 'desc' },
      select: { domain: true },
    });

    if (!latestAudit?.domain) {
      return NextResponse.json({
        domain: null, scoreHistory: [],
        lastAuditId: null, lastAuditCompletedAt: null,
        openIssueCount: 0, resolvedIssueCount: 0,
      } satisfies MonitoringData);
    }

    const { getSiteState } = await import('@sitenexis/loop-os');
    const state = await getSiteState(latestAudit.domain);

    return NextResponse.json({
      domain: latestAudit.domain,
      scoreHistory: state?.scoreHistory ?? [],
      lastAuditId: state?.lastAuditId ?? null,
      lastAuditCompletedAt: state?.lastAuditCompletedAt ?? null,
      openIssueCount: state?.openIssues.length ?? 0,
      resolvedIssueCount: state?.resolvedIssues.length ?? 0,
    } satisfies MonitoringData);
  } catch {
    return NextResponse.json({ error: 'Failed to load monitoring data' }, { status: 500 });
  }
}
