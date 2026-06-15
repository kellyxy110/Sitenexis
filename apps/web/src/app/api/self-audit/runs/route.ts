export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { type NextRequest } from 'next/server';
import { isFullyConfigured } from '@/lib/mode';
import { logger } from '@/lib/logger';

const ADMIN_EMAILS = new Set([
  'luchijudith@gmail.com',
  'system@sitenexis.com',
]);

export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch {
    return unauthorizedResponse();
  }
  if (!ADMIN_EMAILS.has(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!isFullyConfigured()) {
    return NextResponse.json({ runs: [], total: 0 });
  }

  try {
    const { getSelfAuditRuns } = await import('@sitenexis/db');
    const runs = await getSelfAuditRuns('sitenexis.com', 100);

    return NextResponse.json({
      runs: runs.map((r) => ({
        id: r.id,
        status: r.status,
        triggeredBy: r.triggeredBy,
        healthScore: r.healthScore,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
      })),
      total: runs.length,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch self-audit runs');
    return NextResponse.json({ error: 'Failed to fetch runs' }, { status: 500 });
  }
}
