import { logger } from '@/lib/logger';

export interface SecondBrainProcessResult {
  status: 'skipped' | 'complete' | 'failed' | 'not_usable';
  reason?: string;
}

/**
 * Second Brain's one entry point, called from the post-audit hook in
 * serverless-audit.ts. Best-effort, non-blocking, retry-safe, idempotent —
 * every failure inside is caught here and marked on the
 * SecondBrainProcessingRun row; nothing propagates to the caller as a
 * thrown error, so a Second Brain failure can never fail the underlying
 * audit. Never fabricates memory: if a step can't produce a truthful
 * result, it produces no result for that step rather than a guessed one.
 */
export async function processSecondBrainForAudit(auditId: string): Promise<SecondBrainProcessResult> {
  const dbModule = await import('@sitenexis/db');
  const { claimSecondBrainProcessing, markSecondBrainProcessingComplete, markSecondBrainProcessingFailed } = dbModule;

  const claimed = await claimSecondBrainProcessing(auditId);
  if (!claimed) return { status: 'skipped', reason: 'already processed, in progress, or not yet stale' };

  try {
    const result = await runSecondBrainProcessing(auditId, dbModule);
    await markSecondBrainProcessingComplete(auditId);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markSecondBrainProcessingFailed(auditId, message).catch((markErr) => {
      logger.error({ auditId, err: markErr instanceof Error ? markErr.message : String(markErr) }, 'Second Brain: failed to record processing failure');
    });
    logger.error({ auditId, err: message }, 'Second Brain processing failed (non-fatal to audit)');
    return { status: 'failed', reason: message };
  }
}

async function runSecondBrainProcessing(
  auditId: string,
  dbModule: typeof import('@sitenexis/db'),
): Promise<SecondBrainProcessResult> {
  const {
    getSecondBrainAuditSummary, listUsableAuditsForWebsite,
    getWebsiteMemory, upsertWebsiteMemory,
    getAuditScoreSnapshot, upsertAuditChange,
    getRawIssuesForAudit, getIssueMemoriesForDomain, applyIssueLifecycleTransition,
  } = dbModule;
  const {
    computeAuditChanges, groupCurrentAuditIssues, computeIssueLifecycleTransitions,
    resolveFirstAudit, findPreviousUsableAudit,
  } = await import('@sitenexis/analyzers');

  const audit = await getSecondBrainAuditSummary(auditId);
  if (!audit) return { status: 'failed', reason: 'audit not found' };
  if (audit.isDemo) return { status: 'not_usable', reason: 'demo audits are excluded from Second Brain' };
  if (audit.status !== 'complete' && audit.status !== 'partial') {
    return { status: 'not_usable', reason: `audit status "${audit.status}" is not comparable/usable` };
  }

  const tenant = { userId: audit.userId, domain: audit.domain };
  const auditTimestampIso = (audit.completedAt ?? audit.createdAt).toISOString();

  // ── WebsiteMemory — firstAuditId is a strictly-earlier-wins compare-and-set, so this is safe to run every audit, including out-of-order backfill. ──
  const existingWebsiteMemory = await getWebsiteMemory(audit.userId, audit.domain);
  const websiteResolution = resolveFirstAudit(
    existingWebsiteMemory
      ? { auditId: existingWebsiteMemory.firstAuditId, auditAt: existingWebsiteMemory.firstAuditAt.toISOString() }
      : null,
    { auditId, auditAt: auditTimestampIso },
  );
  await upsertWebsiteMemory(
    audit.userId, audit.domain,
    { firstAuditId: websiteResolution.firstAuditId, firstAuditAt: new Date(websiteResolution.firstAuditAt) },
    tenant,
  );

  // ── Change Engine — only runs when a comparable previous audit exists. ──
  const usableAudits = await listUsableAuditsForWebsite(audit.userId, audit.domain);
  const candidatePool = usableAudits.some((a) => a.id === auditId)
    ? usableAudits
    : [...usableAudits, audit];
  const previous = findPreviousUsableAudit(
    candidatePool.map((a) => ({ id: a.id, completedAt: a.completedAt?.toISOString() ?? null, createdAt: a.createdAt.toISOString() })),
    auditId,
  );

  if (previous) {
    const [previousSnapshot, currentSnapshot] = await Promise.all([
      getAuditScoreSnapshot(previous.id),
      getAuditScoreSnapshot(auditId),
    ]);
    const changes = computeAuditChanges(previousSnapshot, currentSnapshot);
    for (const change of changes) {
      await upsertAuditChange(audit.userId, audit.domain, previous.id, auditId, change, tenant);
    }
  }

  // ── Issue Memory / Lifecycle / Regression — always runs, first audit included (produces OPENED/FIRST_SEEN for every issue). ──
  const [rawIssues, previousMemories] = await Promise.all([
    getRawIssuesForAudit(auditId),
    getIssueMemoriesForDomain(audit.userId, audit.domain),
  ]);
  const currentGroups = groupCurrentAuditIssues(audit.userId, audit.domain, rawIssues);
  const transitions = computeIssueLifecycleTransitions(previousMemories, currentGroups);
  for (const transition of transitions) {
    await applyIssueLifecycleTransition(audit.userId, audit.domain, auditId, transition, tenant);
  }

  return { status: 'complete' };
}
