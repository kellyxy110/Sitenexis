import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { AuthError } from '@/lib/auth';
import { env } from '@/lib/env';

const PRICE_IDS: Record<string, string> = {
  pro:    process.env.STRIPE_PRICE_PRO    ?? '',
  agency: process.env.STRIPE_PRICE_AGENCY ?? '',
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(req);
    const plan = req.nextUrl.searchParams.get('plan') ?? '';

    if (!PRICE_IDS[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Stripe keys not yet configured — redirect to a coming-soon page
    if (
      !env.STRIPE_SECRET_KEY ||
      env.STRIPE_SECRET_KEY === 'sk_test_placeholder' ||
      !PRICE_IDS[plan]
    ) {
      const url = new URL('/pricing?status=coming-soon', req.nextUrl.origin);
      return NextResponse.redirect(url);
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=1`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/pricing`,
      metadata: { userId: user.id, plan },
    });

    return NextResponse.redirect(session.url ?? `${env.NEXT_PUBLIC_APP_URL}/pricing`);
  } catch (err) {
    if (err instanceof AuthError) return unauthorizedResponse();
    console.error('[billing/checkout]', err);
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
  }
}
