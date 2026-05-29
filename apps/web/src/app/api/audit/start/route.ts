import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { isFullyConfigured } from '@/lib/mode';
import {
  createDemoAudit,
  updateDemoAudit,
  buildDemoResults,
} from '@/lib/demo-store';

const StartAuditSchema = z.object({
  domain: z.string().min(1).max(253),
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

  const parsed = StartAuditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { domain } = parsed.data;

  // ── Demo mode ────────────────────────────────────────────────────────────────
  if (!isFullyConfigured()) {
    return startDemoAudit(domain);
  }

  // ── Real mode (with demo fallback if DB is unreachable) ──────────────────────
  try {
    const { checkAuditLimit, checkLayer4Access } = await import('@/lib/plans');
    const { createAudit } = await import('@sitenexis/db');
    const { enqueueCrawlJob } = await import('@sitenexis/crawler');

    // Ensure the user row exists — created by auth callback but may be missing
    // if they signed in before this fix or the callback DB write failed.
    const { upsertUser } = await import('@sitenexis/db');
    await upsertUser(user.id, user.email);

    const limitCheck = await checkAuditLimit(user.id);
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.reason }, { status: 402 });
    }

    const layer4Enabled = await checkLayer4Access(user.id);
    const audit = await createAudit(user.id, domain);

    await enqueueCrawlJob({ auditId: audit.id, domain, userId: user.id, layer4Enabled });

    logger.info({ auditId: audit.id, domain, userId: user.id, layer4Enabled }, 'Audit enqueued');
    return NextResponse.json({ auditId: audit.id }, { status: 202 });
  } catch (err) {
    logger.error({ err, domain }, 'Audit start failed — DB or Redis unreachable');
    return NextResponse.json(
      { error: 'Service temporarily unavailable. Please check database and Redis configuration.' },
      { status: 503 },
    );
  }
}

function startDemoAudit(domain: string): NextResponse {
  const audit = createDemoAudit(domain);
  void runDemoSimulation(audit.id, domain);
  logger.info({ auditId: audit.id, domain, mode: 'demo' }, 'Demo audit started');
  return NextResponse.json({ auditId: audit.id }, { status: 202 });
}

// ── Demo simulation ───────────────────────────────────────────────────────────

async function runDemoSimulation(auditId: string, domain: string): Promise<void> {
  const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  updateDemoAudit(auditId, { status: 'running' });
  await delay(1200);

  // Simulate crawling — increment page count
  for (let i = 1; i <= 8; i++) {
    updateDemoAudit(auditId, { pageCount: i });
    await delay(400);
  }

  await delay(800);
  const results = buildDemoResults(domain);
  updateDemoAudit(auditId, { ...results, status: 'complete' });
}
