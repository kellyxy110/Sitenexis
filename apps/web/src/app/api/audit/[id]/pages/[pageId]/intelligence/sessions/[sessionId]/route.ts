export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';

interface Params { params: Promise<{ id: string; pageId: string; sessionId: string }> }

const PatchSchema = z.object({ status: z.enum(['accepted', 'published']) });

/**
 * PATCH — mark a rewrite session accepted or published. Suggestion-only: this
 * never touches the actual crawled Page content, and nothing is ever auto-applied
 * to a live page. The client fires the recommendation_applied event on success.
 */
export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { sessionId } = await params;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { getOptimizationSession, setOptimizationSessionStatus } = await import('@sitenexis/db');
  const session = await getOptimizationSession(sessionId);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (session.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await setOptimizationSessionStatus(sessionId, parsed.data.status);
  return NextResponse.json({ ok: true });
}
