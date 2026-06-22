export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(): Promise<NextResponse> {

  try {
    const { getLatestSelfAuditRun } = await import('@sitenexis/db');
    const run = await getLatestSelfAuditRun('sitenexis.vercel.app');

    if (!run) {
      return NextResponse.json({ run: null, message: 'No completed self-audit runs yet' });
    }

    return NextResponse.json({ run });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch latest self-audit run');
    return NextResponse.json({ error: 'Failed to fetch self-audit data' }, { status: 500 });
  }
}
