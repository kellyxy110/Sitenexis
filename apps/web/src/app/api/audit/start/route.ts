export const dynamic = 'force-dynamic';
export const maxDuration = 300;
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { startAuditForUser, type StartAuditFailureReason } from '@/lib/audit-orchestration';

const StartAuditSchema = z.object({
  domain: z.string().min(1).max(253),
});

const STATUS_BY_REASON: Record<StartAuditFailureReason, number> = {
  invalid_domain: 400,
  private_domain: 400,
  not_configured: 503,
  rate_limited: 429,
  credits_denied: 402,
  duplicate_running: 409,
  db_error: 503,
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch {
    return unauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = StartAuditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await startAuditForUser(user.id, user.email, parsed.data.domain);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      { status: STATUS_BY_REASON[result.reason], ...(result.rateLimitHeaders ? { headers: result.rateLimitHeaders } : {}) },
    );
  }

  return NextResponse.json(
    { auditId: result.auditId, executionMode: result.executionMode, workerAlive: result.workerAlive },
    { status: 202 },
  );
}
