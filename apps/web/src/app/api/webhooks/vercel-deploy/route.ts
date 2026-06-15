export const dynamic = 'force-dynamic';
/**
 * Vercel Deploy Webhook — triggers a self-audit of sitenexis.com on every production deployment.
 *
 * Setup in Vercel: Project → Settings → Git → Deploy Hooks
 * Add webhook URL: https://sitenexis.com/api/webhooks/vercel-deploy
 * Set header: x-vercel-signature matching VERCEL_DEPLOY_WEBHOOK_SECRET
 */
import { type NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Signature verification is always required — reject if secret is unconfigured.
  if (!env.VERCEL_DEPLOY_WEBHOOK_SECRET) {
    logger.warn('Vercel deploy webhook: VERCEL_DEPLOY_WEBHOOK_SECRET not configured — rejecting all requests');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }
  const signature = req.headers.get('x-vercel-signature') ?? '';
  if (signature !== env.VERCEL_DEPLOY_WEBHOOK_SECRET) {
    logger.warn({ signature }, 'Vercel deploy webhook: invalid signature');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json() as Record<string, unknown>;
  } catch { /* non-JSON payloads accepted */ }

  const deploymentType = body['type'] as string | undefined;
  const deploymentUrl = body['url'] as string | undefined;

  logger.info({ deploymentType, deploymentUrl }, 'Vercel deploy webhook received — triggering self-audit');

  // Only trigger on production deployments
  if (deploymentType && deploymentType !== 'DEPLOYMENT_READY' && !deploymentType.includes('production')) {
    return NextResponse.json({ message: 'Non-production deployment — skipping self-audit' });
  }

  // Trigger the self-audit asynchronously
  void triggerSelfAuditAsync();

  return NextResponse.json({ message: 'Self-audit triggered', triggeredBy: 'deploy' });
}

async function triggerSelfAuditAsync(): Promise<void> {
  const baseUrl = env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  try {
    const res = await fetch(`${baseUrl}/api/self-audit/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        triggeredBy: 'deploy',
        secret: env.SELF_AUDIT_SECRET,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.error({ status: res.status, text }, 'Self-audit trigger failed from deploy webhook');
    }
  } catch (err) {
    logger.error({ err }, 'Self-audit trigger request failed from deploy webhook');
  }
}
