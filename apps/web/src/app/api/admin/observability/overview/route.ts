export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';

// Same owner allowlist already used to gate the intelligence-center admin view.
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

  const { getAiObservabilitySummary, getRecentAiCallMetrics } = await import('@sitenexis/db');

  const windowHoursParam = req.nextUrl.searchParams.get('windowHours');
  const windowHours = windowHoursParam ? Math.min(720, Math.max(1, Number(windowHoursParam) || 24)) : 24;

  const [summary, recentCalls] = await Promise.all([
    getAiObservabilitySummary(windowHours),
    getRecentAiCallMetrics(50),
  ]);

  return NextResponse.json({ summary, recentCalls });
}
