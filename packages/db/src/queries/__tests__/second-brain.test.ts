import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  secondBrainProcessingRun: { upsert: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  auditScore: { findUnique: vi.fn() },
  aIVisibilityScore: { findUnique: vi.fn() },
  machineTrustScore: { findUnique: vi.fn() },
  issue: { findMany: vi.fn() },
  audit: { findUnique: vi.fn(), findMany: vi.fn() },
  websiteMemory: { findUnique: vi.fn(), upsert: vi.fn() },
  auditChange: { upsert: vi.fn() },
  issueMemory: { findMany: vi.fn(), upsert: vi.fn() },
  issueLifecycleEvent: { upsert: vi.fn() },
  recommendationOutcome: { upsert: vi.fn() },
}));

vi.mock('../../client', () => ({ db: h }));

import {
  assertAuditTenantScope, SecondBrainTenantMismatchError,
  claimSecondBrainProcessing, getAuditScoreSnapshot,
  upsertWebsiteMemory, upsertAuditChange, applyIssueLifecycleTransition,
} from '../second-brain';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('assertAuditTenantScope', () => {
  it('does not throw when userId and domain match', () => {
    expect(() => assertAuditTenantScope({ userId: 'u1', domain: 'example.com' }, { userId: 'u1', domain: 'example.com' })).not.toThrow();
  });

  it('is case-insensitive on domain', () => {
    expect(() => assertAuditTenantScope({ userId: 'u1', domain: 'Example.com' }, { userId: 'u1', domain: 'example.com' })).not.toThrow();
  });

  it('rejects a cross-user mismatch', () => {
    expect(() => assertAuditTenantScope({ userId: 'u1', domain: 'example.com' }, { userId: 'u2', domain: 'example.com' }))
      .toThrow(SecondBrainTenantMismatchError);
  });

  it('rejects a cross-domain mismatch for the same user', () => {
    expect(() => assertAuditTenantScope({ userId: 'u1', domain: 'example.com' }, { userId: 'u1', domain: 'other.com' }))
      .toThrow(SecondBrainTenantMismatchError);
  });
});

describe('write functions reject a tenant mismatch before touching the database', () => {
  it('upsertWebsiteMemory throws and never calls db.websiteMemory.upsert on mismatch', async () => {
    await expect(
      upsertWebsiteMemory('u1', 'example.com', { firstAuditId: 'a1', firstAuditAt: new Date() }, { userId: 'attacker', domain: 'example.com' }),
    ).rejects.toThrow(SecondBrainTenantMismatchError);
    expect(h.websiteMemory.upsert).not.toHaveBeenCalled();
  });

  it('upsertAuditChange throws and never calls db.auditChange.upsert on domain mismatch', async () => {
    await expect(
      upsertAuditChange('u1', 'example.com', 'a1', 'a2',
        { metricKey: 'overall', previousValue: 1, currentValue: 2, classification: 'IMPROVED' },
        { userId: 'u1', domain: 'someone-elses-domain.com' }),
    ).rejects.toThrow(SecondBrainTenantMismatchError);
    expect(h.auditChange.upsert).not.toHaveBeenCalled();
  });

  it('applyIssueLifecycleTransition throws and never writes IssueMemory/IssueLifecycleEvent on mismatch', async () => {
    await expect(
      applyIssueLifecycleTransition('u1', 'example.com', 'a1',
        { fingerprint: 'fp', fingerprintVersion: 'v1', module: 'seo', type: 'missing_alt_text', severity: 'warning', affectedPageCount: 1, eventType: 'OPENED', newLifecycleState: 'FIRST_SEEN' },
        { userId: 'u2', domain: 'example.com' }),
    ).rejects.toThrow(SecondBrainTenantMismatchError);
    expect(h.issueMemory.upsert).not.toHaveBeenCalled();
    expect(h.issueLifecycleEvent.upsert).not.toHaveBeenCalled();
  });
});

describe('claimSecondBrainProcessing', () => {
  it('claims via an updateMany guarded by pending/failed/stale-processing — the same compare-and-swap shape as claimReportGeneration', async () => {
    h.secondBrainProcessingRun.upsert.mockResolvedValue({});
    h.secondBrainProcessingRun.updateMany.mockResolvedValue({ count: 1 });

    const claimed = await claimSecondBrainProcessing('audit-1');

    expect(claimed).toBe(true);
    expect(h.secondBrainProcessingRun.upsert).toHaveBeenCalledWith({
      where: { auditId: 'audit-1' }, create: { auditId: 'audit-1', status: 'pending' }, update: {},
    });
    const updateManyArgs = h.secondBrainProcessingRun.updateMany.mock.calls[0]![0];
    expect(updateManyArgs.where.auditId).toBe('audit-1');
    expect(updateManyArgs.where.OR).toEqual([
      { status: { in: ['pending', 'failed'] } },
      { status: 'processing', updatedAt: { lt: expect.any(Date) } },
    ]);
    expect(updateManyArgs.data.status).toBe('processing');
  });

  it('concurrent claim: a losing caller sees count 0 and returns false', async () => {
    h.secondBrainProcessingRun.upsert.mockResolvedValue({});
    h.secondBrainProcessingRun.updateMany.mockResolvedValue({ count: 0 });

    const claimed = await claimSecondBrainProcessing('audit-1');
    expect(claimed).toBe(false);
  });

  it('same audit processed twice: second claim after the first already moved status to processing/complete returns false', async () => {
    h.secondBrainProcessingRun.upsert.mockResolvedValue({});
    h.secondBrainProcessingRun.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    expect(await claimSecondBrainProcessing('audit-1')).toBe(true);
    expect(await claimSecondBrainProcessing('audit-1')).toBe(false);
  });

  it('stale claim recovery: the WHERE clause includes a reclaim path for processing rows older than the stale window', async () => {
    h.secondBrainProcessingRun.upsert.mockResolvedValue({});
    h.secondBrainProcessingRun.updateMany.mockResolvedValue({ count: 1 });

    await claimSecondBrainProcessing('audit-1');
    const args = h.secondBrainProcessingRun.updateMany.mock.calls[0]![0];
    const staleClause = args.where.OR[1];
    expect(staleClause.status).toBe('processing');
    expect(staleClause.updatedAt.lt).toBeInstanceOf(Date);
    // Reclaim threshold must be in the past relative to now.
    expect(staleClause.updatedAt.lt.getTime()).toBeLessThan(Date.now());
  });
});

describe('applyIssueLifecycleTransition — duplicate event prevention', () => {
  it('records the lifecycle event via an upsert on the (issueMemoryId, auditId, eventType) compound key — a retried call is a safe no-op, never a duplicate insert', async () => {
    h.issueMemory.upsert.mockResolvedValue({ id: 'im1' });
    h.issueLifecycleEvent.upsert.mockResolvedValue({});

    const transition = { fingerprint: 'fp', fingerprintVersion: 'v1', module: 'seo', type: 'missing_alt_text', severity: 'warning' as const, affectedPageCount: 1, eventType: 'OPENED' as const, newLifecycleState: 'FIRST_SEEN' as const };
    await applyIssueLifecycleTransition('u1', 'example.com', 'audit-1', transition, { userId: 'u1', domain: 'example.com' });
    await applyIssueLifecycleTransition('u1', 'example.com', 'audit-1', transition, { userId: 'u1', domain: 'example.com' });

    expect(h.issueLifecycleEvent.upsert).toHaveBeenCalledTimes(2);
    const [firstCall, secondCall] = h.issueLifecycleEvent.upsert.mock.calls;
    expect(firstCall![0].where).toEqual(secondCall![0].where);
    expect(firstCall![0].where).toEqual({
      issueMemoryId_auditId_eventType: { issueMemoryId: 'im1', auditId: 'audit-1', eventType: 'OPENED' },
    });
    expect(firstCall![0].update).toEqual({});
  });

  it('preserves lastResolvedAuditId on a REGRESSED transition — does not include it in the update payload', async () => {
    h.issueMemory.upsert.mockResolvedValue({ id: 'im1' });
    h.issueLifecycleEvent.upsert.mockResolvedValue({});

    await applyIssueLifecycleTransition('u1', 'example.com', 'audit-3',
      { fingerprint: 'fp', fingerprintVersion: 'v1', module: 'seo', type: 'missing_alt_text', severity: 'warning', affectedPageCount: 2, eventType: 'REGRESSED', newLifecycleState: 'REGRESSED' },
      { userId: 'u1', domain: 'example.com' });

    const upsertArgs = h.issueMemory.upsert.mock.calls[0]![0];
    expect(upsertArgs.update).not.toHaveProperty('lastResolvedAuditId');
    expect(upsertArgs.update.lastSeenAuditId).toBe('audit-3');
  });

  it('sets lastResolvedAuditId to the new audit on a RESOLVED transition', async () => {
    h.issueMemory.upsert.mockResolvedValue({ id: 'im1' });
    h.issueLifecycleEvent.upsert.mockResolvedValue({});

    await applyIssueLifecycleTransition('u1', 'example.com', 'audit-2',
      { fingerprint: 'fp', fingerprintVersion: 'v1', module: 'seo', type: 'missing_alt_text', severity: 'warning', affectedPageCount: 0, eventType: 'RESOLVED', newLifecycleState: 'RESOLVED' },
      { userId: 'u1', domain: 'example.com' });

    const upsertArgs = h.issueMemory.upsert.mock.calls[0]![0];
    expect(upsertArgs.update.lastResolvedAuditId).toBe('audit-2');
    expect(upsertArgs.update.affectedPageCount).toBe(0);
  });
});

describe('getAuditScoreSnapshot — Machine Trust source regression guard', () => {
  it('reads machineTrustScore exclusively from the machine_trust_scores table, never from ai_visibility_scores', async () => {
    h.auditScore.findUnique.mockResolvedValue({ overall: 50, seoScore: 60 });
    h.aIVisibilityScore.findUnique.mockResolvedValue({
      aiVisibilityScore: 70, entityConfidenceScore: 80, retrievalReadinessScore: 90,
      citationProbabilityScore: 40, semanticTrustScore: 10, // deliberately different from machineTrustScore below
    });
    h.machineTrustScore.findUnique.mockResolvedValue({ overall: 99 });

    const snapshot = await getAuditScoreSnapshot('audit-1');

    expect(snapshot.machineTrustScore).toBe(99); // from machine_trust_scores.overall
    expect(snapshot.semanticTrustScore).toBe(10); // from ai_visibility_scores.semantic_trust_score — a different metric
    expect(snapshot.machineTrustScore).not.toBe(snapshot.semanticTrustScore);
    // Proves the two are fetched from genuinely separate queries, not aliased to the same source.
    expect(h.machineTrustScore.findUnique).toHaveBeenCalledWith({ where: { auditId: 'audit-1' }, select: { overall: true } });
    expect(h.aIVisibilityScore.findUnique.mock.calls[0]![0].select).not.toHaveProperty('overall');
  });

  it('unavailable ≠ zero: a missing MachineTrustScore row yields null, never 0', async () => {
    h.auditScore.findUnique.mockResolvedValue(null);
    h.aIVisibilityScore.findUnique.mockResolvedValue(null);
    h.machineTrustScore.findUnique.mockResolvedValue(null);

    const snapshot = await getAuditScoreSnapshot('audit-1');

    expect(snapshot.machineTrustScore).toBeNull();
    expect(snapshot.overall).toBeNull();
    expect(snapshot.aiVisibilityScore).toBeNull();
  });
});
