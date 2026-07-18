export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isGoogleOAuthConfigured } from '@/lib/google/crypto';

export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json({ configured: false, connection: null });
  }

  const { getGoogleConnection } = await import('@sitenexis/db');
  const connection = await getGoogleConnection(user.id);
  return NextResponse.json({ configured: true, connection });
}
