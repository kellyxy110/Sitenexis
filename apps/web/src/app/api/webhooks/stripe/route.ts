export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { type Plan } from '@sitenexis/shared';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';

const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? '');

// Price IDs are set via environment variables in Vercel:
//   STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, STRIPE_PRICE_AGENCY, STRIPE_PRICE_ENTERPRISE
// Copy each price ID from your Stripe dashboard → Products → [Plan] → Prices.
// A missing or empty price ID is skipped rather than silently mapping to 'free'.
function buildPriceToPlan(): Record<string, Plan> {
  const map: Record<string, Plan> = {};
  const entries: Array<[string, Plan]> = [
    [env.STRIPE_PRICE_STARTER,    'starter'],
    [env.STRIPE_PRICE_PRO,        'pro'],
    [env.STRIPE_PRICE_AGENCY,     'agency'],
    [env.STRIPE_PRICE_ENTERPRISE, 'enterprise'],
  ];
  for (const [priceId, plan] of entries) {
    if (priceId) map[priceId] = plan;
  }
  return map;
}

const PRICE_TO_PLAN = buildPriceToPlan();

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET ?? '');
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
        const plan = PRICE_TO_PLAN[priceId];
        if (!plan) {
          logger.warn({ priceId, type: event.type }, 'Stripe price ID not mapped — set STRIPE_PRICE_* env vars. Skipping plan update.');
          break;
        }
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

        const customer = await stripe.customers.retrieve(customerId);
        if (!customer.deleted && customer.metadata['userId']) {
          const { updateUserPlan } = await import('@sitenexis/db');
          await updateUserPlan(customer.metadata['userId'], plan);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        const customer = await stripe.customers.retrieve(customerId);
        if (!customer.deleted && customer.metadata['userId']) {
          const { updateUserPlan } = await import('@sitenexis/db');
          await updateUserPlan(customer.metadata['userId'], 'free');
        }
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.['userId'];
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        if (userId && customerId) {
          const { updateStripeCustomerId } = await import('@sitenexis/db');
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
