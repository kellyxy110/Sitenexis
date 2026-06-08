export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';
import { z } from 'zod';

const CreateSchema = z.object({
  email:     z.string().email(),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  domain:    z.string().optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  hour:      z.number().int().min(0).max(23).default(8),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  if (!isFullyConfigured()) return NextResponse.json([]);

  try {
    const { getScheduledReports } = await import('@sitenexis/db');
    const reports = await getScheduledReports(user.id);
    return NextResponse.json(reports);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  const body = await req.json().catch(() => ({})) as unknown;
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!isFullyConfigured()) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  try {
    const { createScheduledReport } = await import('@sitenexis/db');
    const report = await createScheduledReport(
      user.id,
      parsed.data.email,
      parsed.data.frequency,
      parsed.data.domain,
      parsed.data.dayOfWeek,
      parsed.data.hour,
    );
    return NextResponse.json(report, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
