import type {
  AuditChangeClassification, IssueLifecycleEventType, IssueLifecycleState,
  IssueSeverity, RecommendationOutcomeState, SecondBrainProcessingStatus,
} from '../../generated';
import { db } from '../client';

/**
 * Second Brain persistence layer — typed query helpers only, no business
 * logic (classification, fingerprinting, and lifecycle rules all live in
 * @sitenexis/analyzers/second-brain and are passed in as already-decided
 * values). Every write function that accepts a userId/domain pair also
 * accepts the audit it is being written against and verifies the audit
 * actually belongs to that tenant before writing — see assertAuditTenantScope
 * below. This is intentionally duplicated (not imported from
 * @sitenexis/analyzers) to keep this package's dependency direction
 * unchanged — packages/db must not depend on packages/analyzers.
 */

const STALE_PROCESSING_MS = 5 * 60_000; // matches claimReportGeneration's stale-reclaim window

// ── Tenant invariant guard ────────────────────────────────────────────────

export class SecondBrainTenantMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecondBrainTenantMismatchError';
  }
}

/**
 * A caller must never be able to construct a Second Brain row against an
 * audit belonging to a different user, or under a different domain than the
 * audit's own. There is no composite (userId, domain) unique key on Audit to
 * hang a database-level foreign key off — a user can have many audits for
 * the same domain — so this is enforced here, at the write boundary, for
 * every Second Brain write. Domain comparison is case-insensitive; Audit.domain
 * is already the canonical stored form (no protocol/path to strip), so only
 * trim+lowercase normalization is needed here — the fuller
 * normalizeDomainInput (protocol/path stripping) lives in apps/web and is
 * for raw user input, a different concern.
 */
export function assertAuditTenantScope(
  audit: { userId: string; domain: string },
  expected: { userId: string; domain: string },
): void {
  const normalize = (d: string) => d.trim().toLowerCase();
  if (audit.userId !== expected.userId) {
    throw new SecondBrainTenantMismatchError(
      `Second Brain write rejected: audit belongs to a different user than the target Second Brain row.`,
    );
  }
  if (normalize(audit.domain) !== normalize(expected.domain)) {
    throw new SecondBrainTenantMismatchError(
      `Second Brain write rejected: audit domain does not match the target Second Brain row's domain.`,
    );
  }
}

// ── Processing claim (mirrors claimReportGeneration exactly) ─────────────

export async function claimSecondBrainProcessing(auditId: string): Promise<boolean> {
  await db.secondBrainProcessingRun.upsert({
    where: { auditId },
    create: { auditId, status: 'pending' },
    update: {},
  });

  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS);
  const result = await db.secondBrainProcessingRun.updateMany({
    where: {
      auditId,
      OR: [
        { status: { in: ['pending', 'failed'] } },
        { status: 'processing', updatedAt: { lt: staleBefore } },
      ],
    },
    data: { status: 'processing', claimedAt: new Date(), updatedAt: new Date() },
  });

  return result.count > 0;
}

export async function markSecondBrainProcessingComplete(auditId: string): Promise<void> {
  await db.secondBrainProcessingRun.update({
    where: { auditId },
    data: { status: 'complete', completedAt: new Date(), lastError: null },
  });
}

export async function markSecondBrainProcessingFailed(auditId: string, error: string): Promise<void> {
  await db.secondBrainProcessingRun.update({
    where: { auditId },
    data: { status: 'failed', lastError: error.slice(0, 2000) },
  });
}

/** Resets a specific audit's processing run back to pending — the only way a bounded, explicit reprocess/backfill re-enters the claim path. Never bulk. */
export async function resetSecondBrainProcessingForReprocess(auditId: string): Promise<void> {
  await db.secondBrainProcessingRun.upsert({
    where: { auditId },
    create: { auditId, status: 'pending' },
    update: { status: 'pending', claimedAt: null, lastError: null },
  });
}

export interface SecondBrainProcessingRunRecord {
  auditId: string;
  status: SecondBrainProcessingStatus;
  claimedAt: Date | null;
  completedAt: Date | null;
  lastError: string | null;
}

export async function getSecondBrainProcessingRun(auditId: string): Promise<SecondBrainProcessingRunRecord | null> {
  return db.secondBrainProcessingRun.findUnique({
    where: { auditId },
    select: { auditId: true, status: true, claimedAt: true, completedAt: true, lastError: true },
  });
}

// ── Canonical score snapshot (for the Change Engine) ──────────────────────

export interface AuditScoreSnapshotRow {
  auditId: string;
  overall: number | null;
  seoScore: number | null;
  aiVisibilityScore: number | null;
  entityConfidenceScore: number | null;
  retrievalReadinessScore: number | null;
  citationProbabilityScore: number | null;
  semanticTrustScore: number | null;
  machineTrustScore: number | null;
}

/**
 * machineTrustScore is read from machine_trust_scores.overall ONLY — never
 * ai_visibility_scores.semantic_trust_score, a different v2 metric a prior
 * bug once conflated it with (see project history: "Fix MRS Machine Trust
 * card reading wrong field (semanticTrustScore)"). The two are fetched from
 * genuinely separate tables below, which is what makes that conflation
 * structurally impossible here, not just avoided by convention.
 */
export async function getAuditScoreSnapshot(auditId: string): Promise<AuditScoreSnapshotRow> {
  const [auditScore, aiVisibility, machineTrust] = await Promise.all([
    db.auditScore.findUnique({ where: { auditId }, select: { overall: true, seoScore: true } }),
    db.aIVisibilityScore.findUnique({
      where: { auditId },
      select: { aiVisibilityScore: true, entityConfidenceScore: true, retrievalReadinessScore: true, citationProbabilityScore: true, semanticTrustScore: true },
    }),
    db.machineTrustScore.findUnique({ where: { auditId }, select: { overall: true } }),
  ]);

  return {
    auditId,
    overall: auditScore?.overall ?? null,
    seoScore: auditScore?.seoScore ?? null,
    aiVisibilityScore: aiVisibility?.aiVisibilityScore ?? null,
    entityConfidenceScore: aiVisibility?.entityConfidenceScore ?? null,
    retrievalReadinessScore: aiVisibility?.retrievalReadinessScore ?? null,
    citationProbabilityScore: aiVisibility?.citationProbabilityScore ?? null,
    semanticTrustScore: aiVisibility?.semanticTrustScore ?? null,
    machineTrustScore: machineTrust?.overall ?? null,
  };
}

// ── Audit lookup (for the orchestration layer's previous-audit resolution) ─

export interface SecondBrainAuditSummary {
  id: string;
  userId: string;
  domain: string;
  status: string;
  isDemo: boolean;
  completedAt: Date | null;
  createdAt: Date;
}

export async function getSecondBrainAuditSummary(auditId: string): Promise<SecondBrainAuditSummary | null> {
  return db.audit.findUnique({
    where: { id: auditId },
    select: { id: true, userId: true, domain: true, status: true, isDemo: true, completedAt: true, createdAt: true },
  });
}

/** Non-demo, complete/partial audits for one (userId, domain) — the candidate pool the orchestration layer picks "the previous comparable audit" from. Never scoped by domain alone. */
export async function listUsableAuditsForWebsite(userId: string, domain: string, limit = 25): Promise<SecondBrainAuditSummary[]> {
  return db.audit.findMany({
    where: { userId, domain, isDemo: false, status: { in: ['complete', 'partial'] } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, userId: true, domain: true, status: true, isDemo: true, completedAt: true, createdAt: true },
  });
}

// ── Raw issues (for the Issue Fingerprint / Lifecycle engines) ────────────

export interface RawIssueRow {
  module: string;
  type: string;
  severity: IssueSeverity;
  pageUrl: string | null;
}

export async function getRawIssuesForAudit(auditId: string): Promise<RawIssueRow[]> {
  return db.issue.findMany({ where: { auditId }, select: { module: true, type: true, severity: true, pageUrl: true } });
}

// ── WebsiteMemory ──────────────────────────────────────────────────────────

export interface WebsiteMemoryRecord {
  id: string;
  userId: string;
  domain: string;
  firstAuditId: string;
  firstAuditAt: Date;
}

export async function getWebsiteMemory(userId: string, domain: string): Promise<WebsiteMemoryRecord | null> {
  return db.websiteMemory.findUnique({
    where: { userId_domain: { userId, domain } },
    select: { id: true, userId: true, domain: true, firstAuditId: true, firstAuditAt: true },
  });
}

export async function upsertWebsiteMemory(
  userId: string,
  domain: string,
  resolution: { firstAuditId: string; firstAuditAt: Date },
  auditForTenantCheck: { userId: string; domain: string },
): Promise<WebsiteMemoryRecord> {
  assertAuditTenantScope(auditForTenantCheck, { userId, domain });
  return db.websiteMemory.upsert({
    where: { userId_domain: { userId, domain } },
    create: { userId, domain, firstAuditId: resolution.firstAuditId, firstAuditAt: resolution.firstAuditAt },
    update: { firstAuditId: resolution.firstAuditId, firstAuditAt: resolution.firstAuditAt },
    select: { id: true, userId: true, domain: true, firstAuditId: true, firstAuditAt: true },
  });
}

// ── AuditChange ─────────────────────────────────────────────────────────

export interface AuditChangeInput {
  metricKey: string;
  previousValue: number | null;
  currentValue: number | null;
  classification: AuditChangeClassification;
}

export async function upsertAuditChange(
  userId: string,
  domain: string,
  previousAuditId: string,
  currentAuditId: string,
  change: AuditChangeInput,
  auditForTenantCheck: { userId: string; domain: string },
): Promise<void> {
  assertAuditTenantScope(auditForTenantCheck, { userId, domain });
  await db.auditChange.upsert({
    where: { currentAuditId_metricKey: { currentAuditId, metricKey: change.metricKey } },
    create: {
      userId, domain, previousAuditId, currentAuditId,
      metricKey: change.metricKey, previousValue: change.previousValue, currentValue: change.currentValue,
      classification: change.classification, derivationVersion: 'v1',
    },
    update: {
      previousValue: change.previousValue, currentValue: change.currentValue, classification: change.classification,
    },
  });
}

// ── IssueMemory + IssueLifecycleEvent ──────────────────────────────────────

export interface IssueMemorySnapshotRow {
  fingerprint: string;
  fingerprintVersion: string;
  module: string;
  type: string;
  severity: IssueSeverity;
  lifecycleState: IssueLifecycleState;
}

export async function getIssueMemoriesForDomain(userId: string, domain: string): Promise<IssueMemorySnapshotRow[]> {
  return db.issueMemory.findMany({
    where: { userId, domain },
    select: { fingerprint: true, fingerprintVersion: true, module: true, type: true, severity: true, lifecycleState: true },
  });
}

export interface IssueLifecycleTransitionInput {
  fingerprint: string;
  fingerprintVersion: string;
  module: string;
  type: string;
  severity: IssueSeverity;
  affectedPageCount: number;
  eventType: IssueLifecycleEventType;
  newLifecycleState: IssueLifecycleState;
}

/**
 * Applies one lifecycle transition: upserts the IssueMemory row per the
 * documented semantics (lastResolvedAuditId preserved on REGRESSED, updated
 * only on RESOLVED; lastSeenAuditId only advances when the issue was
 * actually observed this audit), then idempotently records the event.
 * The event's uniqueness (issueMemoryId, auditId, eventType) is what makes a
 * retried/replayed call for the same audit a safe no-op — implemented as a
 * Prisma upsert against that compound key, never a bare create that could
 * throw or duplicate on retry.
 */
export async function applyIssueLifecycleTransition(
  userId: string,
  domain: string,
  auditId: string,
  transition: IssueLifecycleTransitionInput,
  auditForTenantCheck: { userId: string; domain: string },
): Promise<void> {
  assertAuditTenantScope(auditForTenantCheck, { userId, domain });

  const baseFields = { module: transition.module, type: transition.type, severity: transition.severity, lifecycleState: transition.newLifecycleState };

  const issueMemory = await db.issueMemory.upsert({
    where: { userId_domain_fingerprint: { userId, domain, fingerprint: transition.fingerprint } },
    create: {
      userId, domain, fingerprint: transition.fingerprint, fingerprintVersion: transition.fingerprintVersion,
      ...baseFields, firstSeenAuditId: auditId, lastSeenAuditId: auditId,
      lastResolvedAuditId: transition.eventType === 'RESOLVED' ? auditId : null,
      affectedPageCount: transition.affectedPageCount,
    },
    update: {
      ...baseFields,
      ...(transition.eventType === 'RESOLVED'
        ? { lastResolvedAuditId: auditId, affectedPageCount: 0 }
        : transition.eventType === 'REGRESSED'
        ? { lastSeenAuditId: auditId, affectedPageCount: transition.affectedPageCount } // lastResolvedAuditId deliberately untouched — preserved
        : { lastSeenAuditId: auditId, affectedPageCount: transition.affectedPageCount }), // OPENED / PERSISTED
    },
    select: { id: true },
  });

  await db.issueLifecycleEvent.upsert({
    where: { issueMemoryId_auditId_eventType: { issueMemoryId: issueMemory.id, auditId, eventType: transition.eventType } },
    create: { issueMemoryId: issueMemory.id, auditId, eventType: transition.eventType },
    update: {},
  });
}

// ── RecommendationOutcome ──────────────────────────────────────────────────

export async function upsertRecommendationOutcome(
  issueMemoryId: string,
  recommendedAtAuditId: string,
  outcomeState: RecommendationOutcomeState,
): Promise<void> {
  await db.recommendationOutcome.upsert({
    where: { issueMemoryId_recommendedAtAuditId: { issueMemoryId, recommendedAtAuditId } },
    create: { issueMemoryId, recommendedAtAuditId, outcomeState },
    update: { outcomeState },
  });
}
