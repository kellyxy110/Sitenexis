export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Stripe from 'stripe';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';
import { CREDIT_PACKS } from '@/lib/credits-config';

const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? '');

const CheckoutSchema = z.object({
  plan: z.string().min(1),
});

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

  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Missing plan' }, { status: 400 });
  }

  const pack = CREDIT_PACKS.find((p) => p.id === parsed.data.plan);
  if (!pack) {
    return NextResponse.json({ error: 'Unknown credit pack' }, { status: 400 });
  }

  try {
    const { getUserById } = await import('@sitenexis/db');
    const dbUser = await getUserById(user.id);

    const customerId = dbUser?.stripeCustomerId ?? null;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      ...(customerId ? { customer: customerId } : { customer_email: user.email }),
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: pack.price * 100,
            product_data: {
              name: `SiteNexis ${pack.label} Credit Pack`,
              description: `${pack.credits} analysis credits`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        packId: pack.id,
        credits: String(pack.credits),
      },
      success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing?checkout=success`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing?checkout=cancelled`,
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    logger.error({ err, userId: user.id, pack: pack.id }, 'Stripe checkout session creation failed');
    return NextResponse.json({ error: 'Billing service unavailable' }, { status: 503 });
  }
}
