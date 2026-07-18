export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';

export async function POST(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  const { disconnectGoogleConnection } = await import('@sitenexis/db');
  await disconnectGoogleConnection(user.id);

  return NextResponse.json({ ok: true });
}
