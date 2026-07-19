export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';

// Same owner allowlist already used to gate manual self-audit triggers.
const OWNER_EMAILS = new Set([
  'kellyxy110@gmail.com',
  'luchijudith@gmail.com',
  'judithluchi@gmail.com',
]);

export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  if (!OWNER_EMAILS.has(user.email?.toLowerCase() ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { getAdminOverview } = await import('@sitenexis/db');
  const overview = await getAdminOverview(30);

  return NextResponse.json(overview);
}
