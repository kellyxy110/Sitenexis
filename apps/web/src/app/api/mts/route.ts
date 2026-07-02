export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { computeQuickMTS } from '@/lib/quick-mts';

const Schema = z.object({
  domain: z.string().min(3).max(253),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);
  const rl = await rateLimit('quick-mts', ip, { limit: 30, windowSec: 3600 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429, headers: rl.headers });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'domain is required' }, { status: 400 });

  const result = await computeQuickMTS(parsed.data.domain);
  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300' },
  });
}
