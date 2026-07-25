import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, AuthError, unauthorizedResponse } from '@/lib/auth';
import { compareAdsForCampaign } from '@sitenexis/db';

const compareSchema = z.object({
  adIds: z.array(z.string().min(1).max(100)).min(2).max(12),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const parsed = compareSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Select between 2 and 12 ads to compare.' }, { status: 400 });

    const adIds = [...new Set(parsed.data.adIds)];
    if (adIds.length < 2) return NextResponse.json({ error: 'Select at least two different ads.' }, { status: 400 });
    return NextResponse.json(await compareAdsForCampaign(user.id, adIds));
  } catch (error) {
    if (error instanceof AuthError) return unauthorizedResponse();
    console.error('Campaign comparison failed', error);
    return NextResponse.json({ error: 'Campaign comparison is temporarily unavailable.' }, { status: 503 });
  }
}
