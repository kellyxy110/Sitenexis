export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { isFullyConfigured } from '@/lib/mode';

export async function GET(): Promise<NextResponse> {
  if (!isFullyConfigured()) {
    return NextResponse.json({ demos: [] });
  }

  try {
    const { db } = await import('@sitenexis/db');
    const audits = await db.audit.findMany({
      where: { isDemo: true, status: 'complete', archivedAt: null },
      select: { id: true, domain: true, completedAt: true, pageCount: true },
      orderBy: { domain: 'asc' },
    });

    return NextResponse.json({ demos: audits });
  } catch {
    return NextResponse.json({ demos: [] });
  }
}
