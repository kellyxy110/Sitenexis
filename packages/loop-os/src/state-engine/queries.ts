// StateEngine DB helpers — all SiteState and MemoryRecord writes go through here.
// No other package may write directly to site_states or memory_records.
// Reads are permitted from @sitenexis/db in V5 loops; write access is exclusive to this module.

import type {
  SiteState,
  SiteStatePatch,
  ScoreSnapshot,
  LoopCheckpoint,
  LoopType,
  MemoryRecordType,
} from '../types';

const SCORE_HISTORY_LIMIT = 50;

// ── Internal helper — load Prisma client lazily ───────────────────────────────
// Lazy import keeps the package usable in environments where @sitenexis/db
// is not yet built (e.g. during typecheck of loop-os itself).

async function db() {
  const { prisma } = await import('@sitenexis/db');
  return prisma;
}

// ── getSiteState ──────────────────────────────────────────────────────────────
// Returns the current SiteState for a domain, or null if no record exists yet.

export async function getSiteState(domain: string): Promise<SiteState | null> {
  const client = await db();
  const row = await client.siteState.findUnique({ where: { domain } });
  if (!row) return null;
  return rowToSiteState(row);
}

// ── upsertSiteState ───────────────────────────────────────────────────────────
// Creates or updates the SiteState for a domain.
// Only the fields in `patch` are modified — all other fields are preserved.

export async function upsertSiteState(
  domain: string,
  patch: SiteStatePatch,
): Promise<SiteState> {
  const client = await db();

  const existing = await client.siteState.findUnique({ where: { domain } });

  const base = existing
    ? rowToSiteState(existing)
    : emptyState(domain);

  const next: Omit<SiteState, 'id' | 'createdAt' | 'updatedAt'> = {
    domain,
    lastAuditId:          patch.lastAuditId          ?? base.lastAuditId,
    lastAuditCompletedAt: patch.lastAuditCompletedAt ?? base.lastAuditCompletedAt,
    scoreHistory:         patch.scoreHistory          ?? base.scoreHistory,
    openIssues:           patch.openIssues            ?? base.openIssues,
    resolvedIssues:       patch.resolvedIssues        ?? base.resolvedIssues,
    knownFixes:           patch.knownFixes            ?? base.knownFixes,
    failedFixes:          patch.failedFixes           ?? base.failedFixes,
    loopCheckpoints:      patch.loopCheckpoints       ?? base.loopCheckpoints,
    lastLoopRunAt:        patch.lastLoopRunAt         ?? base.lastLoopRunAt,
  };

  const row = await client.siteState.upsert({
    where: { domain },
    create: {
      domain:          next.domain,
      ...(next.lastAuditId != null ? { lastAuditId: next.lastAuditId } : {}),
      ...(next.lastAuditCompletedAt ? { lastAuditCompletedAt: new Date(next.lastAuditCompletedAt) } : {}),
      scoreHistory:    next.scoreHistory,
      openIssues:      next.openIssues,
      resolvedIssues:  next.resolvedIssues,
      knownFixes:      next.knownFixes,
      failedFixes:     next.failedFixes,
      loopCheckpoints: next.loopCheckpoints,
      lastLoopRunAt:   next.lastLoopRunAt,
    },
    update: {
      ...(next.lastAuditId != null ? { lastAuditId: next.lastAuditId } : {}),
      ...(next.lastAuditCompletedAt ? { lastAuditCompletedAt: new Date(next.lastAuditCompletedAt) } : {}),
      scoreHistory:    next.scoreHistory,
      openIssues:      next.openIssues,
      resolvedIssues:  next.resolvedIssues,
      knownFixes:      next.knownFixes,
      failedFixes:     next.failedFixes,
      loopCheckpoints: next.loopCheckpoints,
      lastLoopRunAt:   next.lastLoopRunAt,
    },
  });

  return rowToSiteState(row);
}

// ── appendScoreSnapshot ───────────────────────────────────────────────────────
// Appends a score snapshot to the history, capped at SCORE_HISTORY_LIMIT entries.
// Also writes a memory_record of type 'score_snapshot'.
// Called at the end of every complete audit.

export async function appendScoreSnapshot(
  domain: string,
  snapshot: ScoreSnapshot,
): Promise<void> {
  const client = await db();

  const existing = await client.siteState.findUnique({ where: { domain } });
  const current = existing ? rowToSiteState(existing) : emptyState(domain);

  const history = [...current.scoreHistory, snapshot];
  if (history.length > SCORE_HISTORY_LIMIT) {
    history.splice(0, history.length - SCORE_HISTORY_LIMIT);
  }

  const row = await client.siteState.upsert({
    where: { domain },
    create: {
      domain,
      lastAuditId:          snapshot.auditId,
      lastAuditCompletedAt: new Date(snapshot.capturedAt),
      scoreHistory:         history,
      openIssues:           current.openIssues,
      resolvedIssues:       current.resolvedIssues,
      knownFixes:           current.knownFixes,
      failedFixes:          current.failedFixes,
      loopCheckpoints:      current.loopCheckpoints,
      lastLoopRunAt:        current.lastLoopRunAt,
    },
    update: {
      lastAuditId:          snapshot.auditId,
      lastAuditCompletedAt: new Date(snapshot.capturedAt),
      scoreHistory:         history,
    },
  });

  await client.memoryRecord.create({
    data: {
      domain,
      siteStateId: row.id,
      recordType:  'score_snapshot',
      payload:     { snapshot } as object,
      auditId:     snapshot.auditId,
    },
  });
}

// ── recordIssueSet ────────────────────────────────────────────────────────────
// Updates open/resolved issue sets after an audit.
// Compares new open issue IDs against the previous set to compute resolutions.
// Writes memory_records for newly opened and newly resolved issues.

export async function recordIssueSet(
  domain: string,
  auditId: string,
  newOpenIssueIds: string[],
  newOpenIssueTypes: Record<string, { type: string; severity: string; module: string }>,
): Promise<void> {
  const client = await db();

  const existing = await client.siteState.findUnique({ where: { domain } });
  const current = existing ? rowToSiteState(existing) : emptyState(domain);

  const previouslyOpen = new Set(current.openIssues);
  const nowOpen = new Set(newOpenIssueIds);

  const newlyOpened  = newOpenIssueIds.filter(id => !previouslyOpen.has(id));
  const newlyResolved = current.openIssues.filter(id => !nowOpen.has(id));

  const resolvedSet = [
    ...new Set([...current.resolvedIssues, ...newlyResolved]),
  ];

  const row = await client.siteState.upsert({
    where: { domain },
    create: {
      domain,
      scoreHistory:    current.scoreHistory,
      openIssues:      newOpenIssueIds,
      resolvedIssues:  resolvedSet,
      knownFixes:      current.knownFixes,
      failedFixes:     current.failedFixes,
      loopCheckpoints: current.loopCheckpoints,
      lastLoopRunAt:   current.lastLoopRunAt,
    },
    update: {
      openIssues:     newOpenIssueIds,
      resolvedIssues: resolvedSet,
    },
  });

  const memoryWrites = [
    ...newlyOpened.map(id => {
      const meta = newOpenIssueTypes[id];
      return client.memoryRecord.create({
        data: {
          domain,
          siteStateId: row.id,
          recordType:  'issue_opened' satisfies MemoryRecordType,
          payload:     {
            issueId:  id,
            issueType: meta?.type ?? 'unknown',
            severity:  meta?.severity ?? 'info',
            module:    meta?.module ?? 'unknown',
          } as object,
          auditId,
        },
      });
    }),
    ...newlyResolved.map(id =>
      client.memoryRecord.create({
        data: {
          domain,
          siteStateId: row.id,
          recordType:  'issue_resolved' satisfies MemoryRecordType,
          payload:     { issueId: id, resolvedAfterAuditId: auditId } as object,
          auditId,
        },
      }),
    ),
  ];

  await Promise.allSettled(memoryWrites);
}

// ── recordLoopCheckpoint ──────────────────────────────────────────────────────
// Records the result of a loop run against a domain.
// Updates the relevant entry in loopCheckpoints[].
// Called by loop agents in V5 — wired here in V4.5 so the API is stable.

export async function recordLoopCheckpoint(
  domain: string,
  checkpoint: LoopCheckpoint,
): Promise<void> {
  const client = await db();

  const existing = await client.siteState.findUnique({ where: { domain } });
  const current = existing ? rowToSiteState(existing) : emptyState(domain);

  const checkpoints = current.loopCheckpoints.filter(
    c => c.loopType !== checkpoint.loopType,
  );
  checkpoints.push(checkpoint);

  const lastLoopRunAt = {
    ...current.lastLoopRunAt,
    [checkpoint.loopType]: checkpoint.completedAt ?? new Date().toISOString(),
  };

  const row = await client.siteState.upsert({
    where: { domain },
    create: {
      domain,
      scoreHistory:    current.scoreHistory,
      openIssues:      current.openIssues,
      resolvedIssues:  current.resolvedIssues,
      knownFixes:      current.knownFixes,
      failedFixes:     current.failedFixes,
      loopCheckpoints: checkpoints,
      lastLoopRunAt,
    },
    update: {
      loopCheckpoints: checkpoints,
      lastLoopRunAt,
    },
  });

  await client.memoryRecord.create({
    data: {
      domain,
      siteStateId: row.id,
      recordType:  'loop_checkpoint' satisfies MemoryRecordType,
      payload:     { loopType: checkpoint.loopType, checkpointId: checkpoint.checkpointId, outputSummary: checkpoint.outputSummary } as object,
    },
  });
}

// ── Internal helpers ──────────────────────────────────────────────────────────

type PrismaRow = {
  id: string
  domain: string
  lastAuditId: string | null
  lastAuditCompletedAt: Date | null
  scoreHistory: unknown
  openIssues: string[]
  resolvedIssues: string[]
  knownFixes: unknown
  failedFixes: unknown
  loopCheckpoints: unknown
  lastLoopRunAt: unknown
  createdAt: Date
  updatedAt: Date
}

function rowToSiteState(row: PrismaRow): SiteState {
  return {
    id:                   row.id,
    domain:               row.domain,
    lastAuditId:          row.lastAuditId,
    lastAuditCompletedAt: row.lastAuditCompletedAt?.toISOString() ?? null,
    scoreHistory:         (row.scoreHistory as ScoreSnapshot[]) ?? [],
    openIssues:           row.openIssues,
    resolvedIssues:       row.resolvedIssues,
    knownFixes:           (row.knownFixes as SiteState['knownFixes']) ?? [],
    failedFixes:          (row.failedFixes as SiteState['failedFixes']) ?? [],
    loopCheckpoints:      (row.loopCheckpoints as LoopCheckpoint[]) ?? [],
    lastLoopRunAt:        (row.lastLoopRunAt as Partial<Record<LoopType, string>>) ?? {},
    createdAt:            row.createdAt.toISOString(),
    updatedAt:            row.updatedAt.toISOString(),
  };
}

function emptyState(domain: string): SiteState {
  const now = new Date().toISOString();
  return {
    id:                   '',
    domain,
    lastAuditId:          null,
    lastAuditCompletedAt: null,
    scoreHistory:         [],
    openIssues:           [],
    resolvedIssues:       [],
    knownFixes:           [],
    failedFixes:          [],
    loopCheckpoints:      [],
    lastLoopRunAt:        {},
    createdAt:            now,
    updatedAt:            now,
  };
}
