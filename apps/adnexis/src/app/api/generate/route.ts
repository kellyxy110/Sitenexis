import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, AuthError, unauthorizedResponse } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { createAdGeneration } from '@sitenexis/db';
import { regenerateAd } from '@sitenexis/analyzers/adnexis';

const schema = z.object({
  sourceAd: z.string().min(10),
  platforms: z.array(z.string()).min(1),
  tone: z.enum(['aggressive', 'balanced', 'premium']),
  localization: z.enum(['nigerian_english', 'african_market', 'global_premium', 'none']).optional(),
  count: z.number().min(1).max(10).default(3),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!rateLimit(`generate:${user.id}`, 10, 60_000)) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
    }
    const body: unknown = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await regenerateAd(parsed.data, {
      groqApiKey: process.env['GROQ_API_KEY'] ?? '',
    });

    await createAdGeneration(user.id, {
      inputText: parsed.data.sourceAd,
      platforms: parsed.data.platforms,
      tone: parsed.data.tone,
      localization: parsed.data.localization,
      count: parsed.data.count,
      variations: result.variations as unknown as object,
    });

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse();
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
