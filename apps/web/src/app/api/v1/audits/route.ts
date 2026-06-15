export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { isFullyConfigured } from '@/lib/mode';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const StartSchema = z.object({
  domain: z.string().min(1).max(253).trim()
    .transform((d) => d.toLowerCase().replace(/^https?:\/\//i, '').replace(/\/.*$/, '')),
});

async function resolveApiKey(req: NextRequest): Promise<{ userId: string; plan: string } | null> {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  const raw = auth.slice(7).trim();
  if (!raw) return null;

  const keyHash = createHash('sha256').update(raw).digest('hex');

  try {
    const { db } = await import('@sitenexis/db');
    const key = await (db as unknown as {
      apiKey: {
        findFirst: (args: object) => Promise<{ userId: string; id: string } | null>;
        update: (args: object) => Promise<unknown>;
      };
    }).apiKey.findFirst({
      where: { keyHash, archivedAt: null },
      select: { userId: true, id: true },
    });
    if (!key) return null;

    const { getUserById } = await import('@sitenexis/db');
    const user = await getUserById(key.userId);
    if (!user || (user.plan !== 'agency' && user.plan !== 'enterprise')) return null;

    // Update lastUsed
    await (db as unknown as {
      apiKey: { update: (args: object) => Promise<unknown> };
    }).apiKey.update({ where: { id: key.id }, data: { lastUsed: new Date() } });

    return { userId: key.userId, plan: user.plan };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isFullyConfigured()) {
    return NextResponse.json({ error: 'API access requires a connected Supabase project' }, { status: 503 });
  }

  const caller = await resolveApiKey(req);
  if (!caller) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));

  try {
    const { listAuditsByUser } = await import('@sitenexis/db');
    const { data, total } = await listAuditsByUser(caller.userId, page, pageSize);

    return NextResponse.json({
      object: 'list',
      data: data.map((a) => ({
        id: a.id,
        domain: a.domain,
        status: a.status,
        createdAt: a.createdAt,
        completedAt: a.completedAt,
        pageCount: a.pageCount,
        scores: (a as { scores?: { overall: number } | null }).scores
          ? { overall: (a as { scores: { overall: number; seoScore: number; aiScore: number } }).scores.overall }
          : null,
      })),
      total,
      page,
      limit: pageSize,
      hasMore: page * pageSize < total,
    });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isFullyConfigured()) {
    return NextResponse.json({ error: 'API access requires a connected Supabase project' }, { status: 503 });
  }

  const caller = await resolveApiKey(req);
  if (!caller) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
  }

  // Rate limit: 30 API audit creations per minute per API key user
  const rl = await rateLimit('v1:audit:create', caller.userId, { limit: 30, windowSec: 60 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded', type: 'rate_limit_error' }, { status: 429, headers: rl.headers });
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = StartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid domain', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { createAudit, countAuditsThisMonth } = await import('@sitenexis/db');

    // Enforce soft monthly limit for agency (unlimited for enterprise)
    if (caller.plan === 'agency') {
      const count = await countAuditsThisMonth(caller.userId);
      if (count >= 500) {
        return NextResponse.json({ error: 'Monthly audit limit reached' }, { status: 429 });
      }
    }

    const audit = await createAudit(caller.userId, parsed.data.domain);
    return NextResponse.json({ object: 'audit', id: audit.id, domain: audit.domain, status: audit.status, createdAt: audit.createdAt }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 });
  }
}
