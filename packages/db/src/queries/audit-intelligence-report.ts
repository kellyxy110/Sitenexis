import type { Prisma, ReportGenerationStatus } from '../../generated';
import { db } from '../client';

/**
 * Canonical, durable prose Intelligence Report — the single source of truth
 * for the executive summary and narrative report. Redis is a performance
 * cache in front of this table, never the source of truth.
 */

export interface AuditIntelligenceReportRecord {
  id: string;
  auditId: string;
  status: ReportGenerationStatus;
  executiveSummary: unknown;
  executiveSummaryVersion: string | null;
  narrativeReport: unknown;
  narrativeReportVersion: string | null;
  provider: string | null;
  model: string | null;
  lastError: string | null;
  generatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getAuditIntelligenceReport(auditId: string): Promise<AuditIntelligenceReportRecord | null> {
  return db.auditIntelligenceReport.findUnique({ where: { auditId } });
}

// A 'generating' claim older than this is treated as abandoned (crashed
// process, deployment restart mid-generation) and eligible to be re-claimed
// — otherwise a genuinely stuck row would block every future attempt forever.
const STALE_GENERATING_MS = 5 * 60_000;

/**
 * Atomic idempotency guard. Ensures a row exists, then attempts to move it
 * into 'generating' — but only if it's not already pending elsewhere
 * (status in pending/failed) or its previous 'generating' claim is stale.
 * Returns true only for the caller that actually won the claim; every
 * concurrent/retried/replayed caller gets false and must not generate.
 */
export async function claimReportGeneration(auditId: string): Promise<boolean> {
  await db.auditIntelligenceReport.upsert({
    where: { auditId },
    create: { auditId, status: 'pending' },
    update: {},
  });

  const staleBefore = new Date(Date.now() - STALE_GENERATING_MS);
  const result = await db.auditIntelligenceReport.updateMany({
    where: {
      auditId,
      OR: [
        { status: { in: ['pending', 'failed'] } },
        { status: 'generating', updatedAt: { lt: staleBefore } },
      ],
    },
    data: { status: 'generating', updatedAt: new Date() },
  });

  return result.count > 0;
}

export interface SaveGeneratedReportInput {
  executiveSummary?: unknown;
  executiveSummaryVersion?: string;
  narrativeReport?: unknown;
  narrativeReportVersion?: string;
  provider?: string;
  model?: string;
}

/** Persists a successful (or partially successful) generation. Status is derived from which artifacts are actually present — never asserted by the caller. */
export async function saveGeneratedReport(auditId: string, input: SaveGeneratedReportInput): Promise<void> {
  const hasExecutive = input.executiveSummary != null;
  const hasNarrative = input.narrativeReport != null;
  const status: ReportGenerationStatus = hasExecutive && hasNarrative ? 'ready' : hasExecutive || hasNarrative ? 'partial' : 'failed';

  await db.auditIntelligenceReport.upsert({
    where: { auditId },
    create: {
      auditId,
      status,
      ...(hasExecutive ? { executiveSummary: input.executiveSummary as Prisma.InputJsonValue, executiveSummaryVersion: input.executiveSummaryVersion ?? null } : {}),
      ...(hasNarrative ? { narrativeReport: input.narrativeReport as Prisma.InputJsonValue, narrativeReportVersion: input.narrativeReportVersion ?? null } : {}),
      provider: input.provider ?? null,
      model: input.model ?? null,
      lastError: null,
      generatedAt: new Date(),
    },
    update: {
      status,
      ...(hasExecutive ? { executiveSummary: input.executiveSummary as Prisma.InputJsonValue, executiveSummaryVersion: input.executiveSummaryVersion ?? null } : {}),
      ...(hasNarrative ? { narrativeReport: input.narrativeReport as Prisma.InputJsonValue, narrativeReportVersion: input.narrativeReportVersion ?? null } : {}),
      provider: input.provider ?? null,
      model: input.model ?? null,
      lastError: null,
      generatedAt: new Date(),
    },
  });
}

/**
 * Explicit, deliberate reset — used only by the separately-authorized
 * regeneration route, never by an ordinary read path. Sets status back to
 * 'pending' so the next `claimReportGeneration` call can win regardless of
 * the report's current state (including an already-'ready' one).
 */
export async function resetReportForRegeneration(auditId: string): Promise<void> {
  await db.auditIntelligenceReport.upsert({
    where: { auditId },
    create: { auditId, status: 'pending' },
    update: { status: 'pending' },
  });
}

/** Marks a generation attempt as failed with a sanitized (never-raw-stack-trace) error string. Never throws. */
export async function markReportGenerationFailed(auditId: string, errorMessage: string): Promise<void> {
  await db.auditIntelligenceReport.upsert({
    where: { auditId },
    create: { auditId, status: 'failed', lastError: errorMessage.slice(0, 500) },
    update: { status: 'failed', lastError: errorMessage.slice(0, 500) },
  });
}
