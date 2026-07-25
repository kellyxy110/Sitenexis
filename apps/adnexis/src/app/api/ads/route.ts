import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, AuthError, unauthorizedResponse } from '@/lib/auth';
import { createAd, listAdsByUser } from '@sitenexis/db';

const platformSchema = z.enum(['meta', 'tiktok', 'youtube', 'native', 'other']);
const mediaTypeSchema = z.enum(['video', 'image', 'text', 'carousel']);

const createAdSchema = z.object({
  platform: z.string().trim().toLowerCase().pipe(platformSchema),
  mediaType: z.string().trim().toLowerCase().pipe(mediaTypeSchema).optional(),
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
    const platformValue = searchParams.get('platform')?.trim().toLowerCase();
    const platform = platformValue && platformValue !== 'all' ? platformValue : undefined;
    const hookType = searchParams.get('hookType') ?? undefined;
    const search = searchParams.get('search') ?? undefined;

    const { data: ads, total } = await listAdsByUser(user.id, { page, platform, hookType, search });
    return NextResponse.json({ ads, total });
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse();
    return NextResponse.json({ error: 'Unable to load ads right now.' }, { status: 500 });
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
    console.error('Ad creation failed', e);
    return NextResponse.json({ error: 'Unable to save this ad right now.' }, { status: 500 });
  }
}
