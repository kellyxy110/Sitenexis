export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { updateUserPlan, updateStripeCustomerId } from '@sitenexis/db';
import { type Plan } from '@sitenexis/shared';
import { logger } from '@/lib/logger';

const stripe = new Stripe(process.env['STRIPE_SECRET_KEY']!);

const PRICE_TO_PLAN: Record<string, Plan> = {
  // Populate with actual Stripe price IDs from dashboard
  // e.g. 'price_xxx': 'starter',
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env['STRIPE_WEBHOOK_SECRET']!);
  } catch (err) {
    logger.error({ err }, 'Stripe webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = sub.items.data[0]?.price.id ?? '';
        const plan = PRICE_TO_PLAN[priceId] ?? 'free';
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

        const customer = await stripe.customers.retrieve(customerId);
        if (!customer.deleted && customer.metadata['userId']) {
          await updateUserPlan(customer.metadata['userId'], plan);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        const customer = await stripe.customers.retrieve(customerId);
        if (!customer.deleted && customer.metadata['userId']) {
          await updateUserPlan(customer.metadata['userId'], 'free');
        }
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.['userId'];
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        if (userId && customerId) {
          await updateStripeCustomerId(userId, customerId);
        }
        break;
      }
    }
  } catch (err) {
    logger.error({ err, type: event.type }, 'Stripe webhook handler error');
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
