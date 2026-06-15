import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, AuthError, unauthorizedResponse } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { env } from '@/lib/env';
import { generateHooks } from '@sitenexis/analyzers/adnexis';

const schema = z.object({
  offer:     z.string().min(3).max(500),
  audience:  z.string().min(3).max(500),
  platform:  z.string().min(1).max(100),
  painPoint: z.string().min(3).max(500),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!await rateLimit(`hooks:${user.id}`, 15, 60_000)) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
    }
    const body: unknown = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await generateHooks(parsed.data, {
      groqApiKey: env.GROQ_API_KEY,
    });

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse();
    return NextResponse.json({ error: 'Hook generation failed' }, { status: 500 });
  }
}

