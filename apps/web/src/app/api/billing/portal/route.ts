export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';

const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? '');

export async function POST(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch {
    return unauthorizedResponse();
  }

  try {
    const { getUserById } = await import('@sitenexis/db');
    const dbUser = await getUserById(user.id);

    if (!dbUser?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No billing account found. Purchase a credit pack first to set up billing.' },
        { status: 404 },
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: dbUser.stripeCustomerId,
      return_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    logger.error({ err, userId: user.id }, 'Stripe portal session creation failed');
    return NextResponse.json({ error: 'Billing service unavailable' }, { status: 503 });
  }
}
