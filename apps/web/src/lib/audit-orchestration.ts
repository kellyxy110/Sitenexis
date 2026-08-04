/**
 * Canonical audit-creation orchestration, shared by every surface that can
 * start an audit (the dashboard's POST /api/audit/start route, and the
 * Telegram User Assistant's /audit and /addsite commands).
 *
 * There is exactly one implementation of: domain normalization + SSRF
 * guarding, duplicate-running-audit prevention, credit/plan gating, audit
 * creation, and worker dispatch. No caller re-implements any of this —
 * they call startAuditForUser() and branch on the discriminated result.
 */
import { after } from 'next/server';
import { logger } from '@/lib/logger';
import { isFullyConfigured } from '@/lib/mode';
import { rateLimit, type RateLimitResult } from '@/lib/rate-limit';

// Private IP ranges that must never be fetched (SSRF protection)
const PRIVATE_IP_RE =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|::1|fc00:|fe80:)/i;
const DOMAIN_RE = /^[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)*\.[a-z]{2,}$/i;

export type DomainValidationResult =
  | { ok: true; domain: string }
  | { ok: false; reason: 'invalid_format' | 'private_or_reserved' };

/** Single source of truth for domain normalization + SSRF guarding. */
export function normalizeAndValidateDomain(raw: string): DomainValidationResult {
  const domain = raw.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  if (domain.length === 0 || domain.length > 253 || !DOMAIN_RE.test(domain)) {
    return { ok: false, reason: 'invalid_format' };
  }
  if (PRIVATE_IP_RE.test(domain)) {
    return { ok: false, reason: 'private_or_reserved' };
  }
  return { ok: true, domain };
}

export type StartAuditFailureReason =
  | 'invalid_domain'
  | 'private_domain'
  | 'not_configured'
  | 'rate_limited'
  | 'credits_denied'
  | 'duplicate_running'
  | 'db_error';

export interface StartAuditSuccess {
  ok: true;
  auditId: string;
  domain: string;
  executionMode: 'bullmq' | 'serverless';
  workerAlive: boolean;
}

export interface StartAuditFailure {
  ok: false;
  reason: StartAuditFailureReason;
  message: string;
  /** Present only for reason: 'rate_limited' — lets HTTP callers forward standard rate-limit headers. */
  rateLimitHeaders?: Record<string, string>;
  /** Present only for reason: 'duplicate_running' — the id of the audit already in flight. */
  existingAuditId?: string;
}

export type StartAuditResult = StartAuditSuccess | StartAuditFailure;

/**
 * Creates and dispatches an audit for a user-owned domain. Enforces, in
 * order: per-user rate limiting, domain validation + SSRF guarding, DB
 * configuration, duplicate-running-audit prevention, credit/plan gating,
 * then creates the audit record and dispatches it (BullMQ if a worker is
 * alive, otherwise a serverless run scheduled via next/server's after()).
 *
 * Callers must already have established the caller's own identity and
 * authorization to act as `userId` — this function does not authenticate,
 * it only authorizes and executes the audit itself.
 */
export async function startAuditForUser(
  userId: string,
  userEmail: string,
  rawDomain: string,
): Promise<StartAuditResult> {
  const rl: RateLimitResult = await rateLimit('audit:start', userId, { limit: 10, windowSec: 60 });
  if (!rl.ok) {
    return {
      ok: false,
      reason: 'rate_limited',
      message: 'Too many audit requests. Please wait before starting another audit.',
      rateLimitHeaders: rl.headers,
    };
  }

  const domainResult = normalizeAndValidateDomain(rawDomain);
  if (!domainResult.ok) {
    return domainResult.reason === 'private_or_reserved'
      ? { ok: false, reason: 'private_domain', message: 'Private or reserved domains are not allowed.' }
      : { ok: false, reason: 'invalid_domain', message: 'Invalid domain format.' };
  }
  const domain = domainResult.domain;

  if (!isFullyConfigured()) {
    return {
      ok: false,
      reason: 'not_configured',
      message: 'No data available — configure your database and run an audit.',
    };
  }

  // Duplicate-running-audit prevention — did not exist anywhere in the
  // codebase before T3; applies identically to every calling surface.
  try {
    const { getLatestAuditByDomain } = await import('@sitenexis/db');
    const [running, queued] = await Promise.all([
      getLatestAuditByDomain(domain, userId, 'running'),
      getLatestAuditByDomain(domain, userId, 'queued'),
    ]);
    const existing = running ?? queued;
    if (existing) {
      return {
        ok: false,
        reason: 'duplicate_running',
        message: `An audit for ${domain} is already ${existing.status}. Use /status to check progress.`,
        existingAuditId: existing.id,
      };
    }
  } catch (err) {
    logger.error({ err, domain, userId }, 'Duplicate-running-audit check failed');
    return { ok: false, reason: 'db_error', message: 'Database unavailable — could not check for a running audit.' };
  }

  try {
    const { upsertUser } = await import('@sitenexis/db');
    await upsertUser(userId, userEmail);
  } catch (err) {
    logger.error({ err, domain, userId }, 'upsertUser failed in startAuditForUser');
    return { ok: false, reason: 'db_error', message: 'Database unavailable.' };
  }

  let prelimLayer4 = false;
  try {
    const { checkLayer4Access } = await import('@/lib/plans');
    prelimLayer4 = await checkLayer4Access(userId);
  } catch { /* non-fatal — use conservative cost */ }

  const auditAction = prelimLayer4 ? 'ai_swarm_audit' : 'ai_visibility_audit';

  let creditResult: { allowed: boolean; reason?: string };
  try {
    const { checkAndDeductCredits } = await import('@/lib/credits');
    creditResult = await checkAndDeductCredits(userId, auditAction, { domain });
  } catch (err) {
    logger.error({ err, domain, userId }, 'Credit check failed in startAuditForUser');
    return { ok: false, reason: 'db_error', message: 'Credit check failed.' };
  }

  if (!creditResult.allowed) {
    return { ok: false, reason: 'credits_denied', message: creditResult.reason ?? 'Insufficient credits.' };
  }

  let layer4Enabled = false;
  try {
    const { checkLayer4Access } = await import('@/lib/plans');
    const { getUserCredits } = await import('@sitenexis/db');
    const [planAccess, credits] = await Promise.all([checkLayer4Access(userId), getUserCredits(userId)]);
    layer4Enabled = planAccess || credits.isUnlimited;
  } catch (err) {
    logger.error({ err, domain, userId }, 'Layer4 access check failed in startAuditForUser');
    return { ok: false, reason: 'db_error', message: 'Database query failed on users/plans table.' };
  }

  let audit: { id: string };
  try {
    const { createAudit, initializeAuditManifest } = await import('@sitenexis/db');
    audit = await createAudit(userId, domain);
    const { DEFAULT_AUDIT_AGENTS } = await import('@sitenexis/shared');
    await initializeAuditManifest(audit.id, [...DEFAULT_AUDIT_AGENTS]);
  } catch (err) {
    logger.error({ err, domain, userId }, 'createAudit failed in startAuditForUser');
    return { ok: false, reason: 'db_error', message: 'Cannot write to audits table.' };
  }

  let executionMode: 'bullmq' | 'serverless' = 'serverless';
  let workerAlive = false;

  try {
    const { getRedisUrl, createRedisClient, HEARTBEAT_KEY, HEARTBEAT_STALE_MS } = await import('@sitenexis/crawler');
    if (getRedisUrl()) {
      const probe = createRedisClient(false);
      try {
        const heartbeatRaw = await probe.get(HEARTBEAT_KEY);
        workerAlive = heartbeatRaw ? Date.now() - parseInt(heartbeatRaw, 10) < HEARTBEAT_STALE_MS : false;
      } finally {
        probe.disconnect();
      }
    }
  } catch { /* Redis unreachable — no worker possible */ }

  if (workerAlive) {
    try {
      const { enqueueCrawlJob } = await import('@sitenexis/crawler');
      await enqueueCrawlJob({ auditId: audit.id, domain, userId, layer4Enabled });
      executionMode = 'bullmq';
    } catch (enqErr) {
      logger.warn({ enqErr, auditId: audit.id, domain }, 'enqueueCrawlJob failed despite heartbeat — falling back to serverless');
    }
  }

  if (executionMode === 'serverless') {
    after(async () => {
      try {
        const { runServerlessAudit } = await import('@/lib/serverless-audit');
        await runServerlessAudit(audit.id, domain, userId);
      } catch (auditErr) {
        logger.error({ auditId: audit.id, domain, err: auditErr }, 'Serverless audit after() failed');
        try {
          const { updateAuditStatus } = await import('@sitenexis/db');
          await updateAuditStatus(audit.id, 'failed', {
            errorMessage: auditErr instanceof Error ? auditErr.message : 'Serverless audit failed',
          });
        } catch { /* best effort */ }
      }
    });
  }

  logger.info({ auditId: audit.id, domain, userId, layer4Enabled, executionMode, workerAlive }, 'Audit started');

  return { ok: true, auditId: audit.id, domain, executionMode, workerAlive };
}
