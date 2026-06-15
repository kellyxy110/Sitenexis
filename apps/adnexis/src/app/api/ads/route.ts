import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, AuthError, unauthorizedResponse } from '@/lib/auth';
import { createAd, listAdsByUser } from '@sitenexis/db';

const createAdSchema = z.object({
  platform:   z.string().min(1).max(100),
  mediaType:  z.string().max(100).optional(),
  sourceUrl:  z.string().url().max(2048)
    .refine((u) => /^https?:\/\//i.test(u), { message: 'Only http/https URLs allowed' })
    .optional(),
  transcript: z.string().min(1).max(50_000),
  niche:      z.string().max(200).optional(),
  tags:       z.array(z.string().max(50)).max(20).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get('page') ?? '1');
    const platform = searchParams.get('platform') ?? undefined;
    const hookType = searchParams.get('hookType') ?? undefined;

    const { data: ads, total } = await listAdsByUser(user.id, { page, platform, hookType });
    return NextResponse.json({ ads, total });
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse();
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body: unknown = await req.json();
    const parsed = createAdSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const ad = await createAd(user.id, parsed.data);
    return NextResponse.json(ad, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse();
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
