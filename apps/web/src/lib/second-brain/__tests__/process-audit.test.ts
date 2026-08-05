import { describe, it, expect, vi, beforeEach } from 'vitest';

// @sitenexis/analyzers is imported for real (not mocked) below — its
// cold-import cost can exceed Vitest's 5s default, matching the same
// documented cause in intelligence-commands.test.ts.
vi.setConfig({ testTimeout: 20000 });

const h = vi.hoisted(() => ({
  claimSecondBrainProcessing: vi.fn(),
  markSecondBrainProcessingComplete: vi.fn(),
  markSecondBrainProcessingFailed: vi.fn(),
  getSecondBrainAuditSummary: vi.fn(),
  listUsableAuditsForWebsite: vi.fn(),
  getWebsiteMemory: vi.fn(),
  upsertWebsiteMemory: vi.fn(),
  getAuditScoreSnapshot: vi.fn(),
  upsertAuditChange: vi.fn(),
  getRawIssuesForAudit: vi.fn(),
  getIssueMemoriesForDomain: vi.fn(),
  applyIssueLifecycleTransition: vi.fn(),
  // AI boundary — must NEVER be invoked by anything in the Second Brain deterministic core
  callAI: vi.fn(),
  routeTask: vi.fn(),
  routeTaskWithBynara: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

vi.mock('@sitenexis/db', () => ({
  claimSecondBrainProcessing: h.claimSecondBrainProcessing,
  markSecondBrainProcessingComplete: h.markSecondBrainProcessingComplete,
  markSecondBrainProcessingFailed: h.markSecondBrainProcessingFailed,
  getSecondBrainAuditSummary: h.getSecondBrainAuditSummary,
  listUsableAuditsForWebsite: h.listUsableAuditsForWebsite,
  getWebsiteMemory: h.getWebsiteMemory,
  upsertWebsiteMemory: h.upsertWebsiteMemory,
  getAuditScoreSnapshot: h.getAuditScoreSnapshot,
  upsertAuditChange: h.upsertAuditChange,
  getRawIssuesForAudit: h.getRawIssuesForAudit,
  getIssueMemoriesForDomain: h.getIssueMemoriesForDomain,
  applyIssueLifecycleTransition: h.applyIssueLifecycleTransition,
}));

// @sitenexis/analyzers is kept REAL for every other export (the deterministic
// engines run for real in these tests, proving the orchestration layer wires
// them correctly, not just that it calls stubs) — only the AI boundary is
// replaced with spies, so any accidental AI call anywhere in the Second
// Brain core would surface as a failing assertion below, not silently pass.
vi.mock('@sitenexis/analyzers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sitenexis/analyzers')>();
  return { ...actual, callAI: h.callAI, routeTask: h.routeTask, routeTaskWithBynara: h.routeTaskWithBynara };
});

import { processSecondBrainForAudit } from '../process-audit';
import { computeIssueFingerprint } from '@sitenexis/analyzers';

const AUDIT_ID = 'audit-current';
const USER_ID = 'user-1';
const DOMAIN = 'example.com';

function baseAudit(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: AUDIT_ID, userId: USER_ID, domain: DOMAIN, status: 'complete', isDemo: false,
    completedAt: new Date('2026-08-01T00:00:00.000Z'), createdAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

function emptySnapshot(auditId: string) {
  return {
    auditId, overall: null, seoScore: null, aiVisibilityScore: null, entityConfidenceScore: null,
    retrievalReadinessScore: null, citationProbabilityScore: null, semanticTrustScore: null, machineTrustScore: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.claimSecondBrainProcessing.mockResolvedValue(true);
  h.markSecondBrainProcessingComplete.mockResolvedValue(undefined);
  h.markSecondBrainProcessingFailed.mockResolvedValue(undefined);
  h.getWebsiteMemory.mockResolvedValue(null);
  h.upsertWebsiteMemory.mockResolvedValue({});
  h.listUsableAuditsForWebsite.mockResolvedValue([]);
  h.getAuditScoreSnapshot.mockImplementation((id: string) => Promise.resolve(emptySnapshot(id)));
  h.upsertAuditChange.mockResolvedValue(undefined);
  h.getRawIssuesForAudit.mockResolvedValue([]);
  h.getIssueMemoriesForDomain.mockResolvedValue([]);
  h.applyIssueLifecycleTransition.mockResolvedValue(undefined);
});

describe('processSecondBrainForAudit', () => {
  it('first audit: initializes WebsiteMemory and emits OPENED transitions for every issue, no Change Engine (no previous audit)', async () => {
    h.getSecondBrainAuditSummary.mockResolvedValue(baseAudit());
    h.getRawIssuesForAudit.mockResolvedValue([
      { module: 'seo', type: 'missing_alt_text', severity: 'warning', pageUrl: 'https://example.com/a' },
    ]);

    const result = await processSecondBrainForAudit(AUDIT_ID);

    expect(result).toEqual({ status: 'complete' });
    expect(h.upsertWebsiteMemory).toHaveBeenCalledWith(
      USER_ID, DOMAIN,
      { firstAuditId: AUDIT_ID, firstAuditAt: baseAudit().completedAt },
      { userId: USER_ID, domain: DOMAIN },
    );
    expect(h.upsertAuditChange).not.toHaveBeenCalled();
    expect(h.applyIssueLifecycleTransition).toHaveBeenCalledTimes(1);
    expect(h.applyIssueLifecycleTransition).toHaveBeenCalledWith(
      USER_ID, DOMAIN, AUDIT_ID,
      expect.objectContaining({ eventType: 'OPENED', newLifecycleState: 'FIRST_SEEN' }),
      { userId: USER_ID, domain: DOMAIN },
    );
    expect(h.markSecondBrainProcessingComplete).toHaveBeenCalledWith(AUDIT_ID);
  });

  it('second audit: runs the Change Engine against the previous audit and PERSISTs a still-present issue', async () => {
    const previousAuditId = 'audit-previous';
    h.getSecondBrainAuditSummary.mockResolvedValue(baseAudit());
    h.listUsableAuditsForWebsite.mockResolvedValue([
      baseAudit({ id: previousAuditId, completedAt: new Date('2026-07-01T00:00:00.000Z'), createdAt: new Date('2026-07-01T00:00:00.000Z') }),
      baseAudit(),
    ]);
    h.getWebsiteMemory.mockResolvedValue({ id: 'wm1', userId: USER_ID, domain: DOMAIN, firstAuditId: previousAuditId, firstAuditAt: new Date('2026-07-01T00:00:00.000Z') });
    h.getAuditScoreSnapshot.mockImplementation((id: string) =>
      Promise.resolve(id === previousAuditId ? { ...emptySnapshot(id), aiVisibilityScore: 60 } : { ...emptySnapshot(id), aiVisibilityScore: 75 }),
    );
    h.getIssueMemoriesForDomain.mockResolvedValue([
      { fingerprint: computeIssueFingerprint(USER_ID, DOMAIN, 'seo', 'missing_alt_text'), module: 'seo', type: 'missing_alt_text', severity: 'warning', lifecycleState: 'FIRST_SEEN' },
    ]);
    h.getRawIssuesForAudit.mockResolvedValue([
      { module: 'seo', type: 'missing_alt_text', severity: 'warning', pageUrl: 'https://example.com/a' },
    ]);

    const result = await processSecondBrainForAudit(AUDIT_ID);

    expect(result).toEqual({ status: 'complete' });
    expect(h.upsertAuditChange).toHaveBeenCalledWith(
      USER_ID, DOMAIN, previousAuditId, AUDIT_ID,
      expect.objectContaining({ metricKey: 'aiVisibilityScore', previousValue: 60, currentValue: 75, classification: 'IMPROVED' }),
      { userId: USER_ID, domain: DOMAIN },
    );
    expect(h.applyIssueLifecycleTransition).toHaveBeenCalledWith(
      USER_ID, DOMAIN, AUDIT_ID,
      expect.objectContaining({ eventType: 'PERSISTED', newLifecycleState: 'PERSISTING' }),
      { userId: USER_ID, domain: DOMAIN },
    );
  });

  it('same audit processed twice: the second call is a safe no-op (claim rejected)', async () => {
    h.getSecondBrainAuditSummary.mockResolvedValue(baseAudit());
    h.claimSecondBrainProcessing.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const first = await processSecondBrainForAudit(AUDIT_ID);
    const second = await processSecondBrainForAudit(AUDIT_ID);

    expect(first.status).toBe('complete');
    expect(second).toEqual({ status: 'skipped', reason: 'already processed, in progress, or not yet stale' });
    // Second call never touched the audit or wrote anything — it never even fetched.
    expect(h.getSecondBrainAuditSummary).toHaveBeenCalledTimes(1);
  });

  it('demo audits are excluded (not_usable), no writes performed', async () => {
    h.getSecondBrainAuditSummary.mockResolvedValue(baseAudit({ isDemo: true }));
    const result = await processSecondBrainForAudit(AUDIT_ID);
    expect(result).toEqual({ status: 'not_usable', reason: 'demo audits are excluded from Second Brain' });
    expect(h.upsertWebsiteMemory).not.toHaveBeenCalled();
    expect(h.applyIssueLifecycleTransition).not.toHaveBeenCalled();
    expect(h.markSecondBrainProcessingComplete).toHaveBeenCalledWith(AUDIT_ID);
  });

  it('failed-status audits are excluded (not_usable)', async () => {
    h.getSecondBrainAuditSummary.mockResolvedValue(baseAudit({ status: 'failed' }));
    const result = await processSecondBrainForAudit(AUDIT_ID);
    expect(result.status).toBe('not_usable');
    expect(h.upsertWebsiteMemory).not.toHaveBeenCalled();
  });

  it('partial audits ARE usable (partial ≠ excluded)', async () => {
    h.getSecondBrainAuditSummary.mockResolvedValue(baseAudit({ status: 'partial' }));
    const result = await processSecondBrainForAudit(AUDIT_ID);
    expect(result.status).toBe('complete');
    expect(h.upsertWebsiteMemory).toHaveBeenCalled();
  });

  it('Second Brain failure does not propagate — caught, recorded, audit unaffected', async () => {
    h.getSecondBrainAuditSummary.mockResolvedValue(baseAudit());
    h.upsertWebsiteMemory.mockRejectedValue(new Error('db write exploded'));

    const result = await processSecondBrainForAudit(AUDIT_ID);

    expect(result).toEqual({ status: 'failed', reason: 'db write exploded' });
    expect(h.markSecondBrainProcessingFailed).toHaveBeenCalledWith(AUDIT_ID, 'db write exploded');
    expect(h.markSecondBrainProcessingComplete).not.toHaveBeenCalled();
    // Crucially: the function returned normally, it did not throw.
  });

  it('a failure recording the failure itself is also swallowed — never throws under any circumstance', async () => {
    h.getSecondBrainAuditSummary.mockResolvedValue(baseAudit());
    h.upsertWebsiteMemory.mockRejectedValue(new Error('primary failure'));
    h.markSecondBrainProcessingFailed.mockRejectedValue(new Error('failure recording also failed'));

    await expect(processSecondBrainForAudit(AUDIT_ID)).resolves.toEqual({ status: 'failed', reason: 'primary failure' });
  });

  it('audit not found is a failed result, not a throw', async () => {
    h.getSecondBrainAuditSummary.mockResolvedValue(null);
    const result = await processSecondBrainForAudit(AUDIT_ID);
    expect(result).toEqual({ status: 'failed', reason: 'audit not found' });
  });
});

describe('LLM independence — the Second Brain deterministic core never calls an AI provider', () => {
  it('never invokes callAI, routeTask, or routeTaskWithBynara across first-audit, second-audit, or issue-lifecycle-cycle processing', async () => {
    // First audit.
    h.getSecondBrainAuditSummary.mockResolvedValue(baseAudit());
    h.getRawIssuesForAudit.mockResolvedValue([
      { module: 'seo', type: 'missing_alt_text', severity: 'warning', pageUrl: 'https://example.com/a' },
    ]);
    await processSecondBrainForAudit(AUDIT_ID);

    // Second audit with a comparable previous audit and a persisting issue.
    const previousAuditId = 'audit-previous';
    h.getWebsiteMemory.mockResolvedValue({ id: 'wm1', userId: USER_ID, domain: DOMAIN, firstAuditId: previousAuditId, firstAuditAt: new Date('2026-07-01T00:00:00.000Z') });
    h.listUsableAuditsForWebsite.mockResolvedValue([
      baseAudit({ id: previousAuditId, completedAt: new Date('2026-07-01T00:00:00.000Z'), createdAt: new Date('2026-07-01T00:00:00.000Z') }),
      baseAudit(),
    ]);
    h.getAuditScoreSnapshot.mockImplementation((id: string) =>
      Promise.resolve(id === previousAuditId ? { ...emptySnapshot(id), overall: 40 } : { ...emptySnapshot(id), overall: 20 }),
    );
    h.getIssueMemoriesForDomain.mockResolvedValue([
      { fingerprint: computeIssueFingerprint(USER_ID, DOMAIN, 'seo', 'missing_alt_text'), module: 'seo', type: 'missing_alt_text', severity: 'warning', lifecycleState: 'FIRST_SEEN' },
    ]);
    await processSecondBrainForAudit(AUDIT_ID);

    // A regression: the issue was resolved, now returns.
    h.getIssueMemoriesForDomain.mockResolvedValue([
      { fingerprint: computeIssueFingerprint(USER_ID, DOMAIN, 'seo', 'missing_alt_text'), module: 'seo', type: 'missing_alt_text', severity: 'warning', lifecycleState: 'RESOLVED' },
    ]);
    await processSecondBrainForAudit(AUDIT_ID);

    expect(h.callAI).not.toHaveBeenCalled();
    expect(h.routeTask).not.toHaveBeenCalled();
    expect(h.routeTaskWithBynara).not.toHaveBeenCalled();
  });

  it('static proof: no second-brain source file imports routeTask or callAI', async () => {
    const { readFileSync, readdirSync } = await import('fs');
    const { join } = await import('path');
    const roots = [
      join(__dirname, '..'), // apps/web/src/lib/second-brain
      join(__dirname, '../../../../../../packages/analyzers/src/second-brain'),
      join(__dirname, '../../../../../../packages/db/src/queries'),
    ];
    const offenders: string[] = [];
    for (const root of roots) {
      let entries: string[];
      try { entries = readdirSync(root); } catch { continue; }
      for (const entry of entries) {
        if (!entry.endsWith('.ts') || entry.includes('__tests__')) continue;
        if (entry !== 'second-brain.ts' && !root.endsWith('second-brain')) continue;
        const path = join(root, entry);
        const content = readFileSync(path, 'utf-8');
        // Call-syntax only — deliberately not a bare word match, since this
        // file's own doc comments discuss routeTask/callAI in prose (e.g.
        // "never calls routeTask, callAI") without invoking either.
        if (/\broute[Tt]ask\s*\(|\bcallAI\s*\(/.test(content)) offenders.push(path);
      }
    }
    expect(offenders).toEqual([]);
  });
});
