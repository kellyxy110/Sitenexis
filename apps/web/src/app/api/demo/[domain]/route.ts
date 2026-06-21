export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { isFullyConfigured } from '@/lib/mode';
import { gtlEmpty, gtlResponse } from '@/lib/gtl';

interface Params {
  params: Promise<{ domain: string }>;
}

export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { domain } = await params;
  const normalized = decodeURIComponent(domain).toLowerCase().replace(/^www\./, '');

  if (!isFullyConfigured()) return gtlEmpty();

  try {
    const { db } = await import('@sitenexis/db');
    const audit = await db.audit.findFirst({
      where: { domain: normalized, isDemo: true, archivedAt: null, status: 'complete' },
      include: {
        pages: { where: { archivedAt: null } },
        issues: true,
        scores: true,
        aiVisibilityScores: true,
        report: true,
      },
      orderBy: { completedAt: 'desc' },
    });

    if (!audit) return gtlEmpty();

    return gtlResponse('complete', audit);
  } catch {
    return gtlEmpty();
  }
}
