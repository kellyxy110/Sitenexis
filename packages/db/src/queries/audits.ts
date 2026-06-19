import { type Audit, type AuditStatus } from '../../generated';
import { db } from '../client';

export type { Audit };

export async function createAudit(userId: string, domain: string): Promise<Audit> {
  return db.audit.create({
    data: { userId, domain, status: 'queued' },
  });
}

export async function getAuditById(id: string): Promise<Audit | null> {
  return db.audit.findFirst({
    where: { id, archivedAt: null },
  });
}

export async function getAuditWithResults(id: string) {
  return db.audit.findFirst({
    where: { id, archivedAt: null },
    include: {
      pages: { where: { archivedAt: null } },
      issues: true,
      scores: true,
      aiVisibilityScores: true,
      report: true,
    },
  });
}

export async function listAuditsByUser(
  userId: string,
  page: number,
  pageSize: number
) {
  const [data, total] = await db.$transaction([
    db.audit.findMany({
      where: { userId, archivedAt: null },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        scores: true,
        aiVisibilityScores: true,
        _count: { select: { issues: true } },
      },
    }),
    db.audit.count({ where: { userId, archivedAt: null } }),
  ]);
  return { data, total };
}

export async function getAuditsByUser(userId: string, limit?: number): Promise<Audit[]> {
  return db.audit.findMany({
    where: { userId, archivedAt: null },
    orderBy: { createdAt: 'desc' },
    ...(limit !== undefined ? { take: limit } : {}),
  });
}

export async function updateAuditStatus(
  id: string,
  status: AuditStatus,
  metadata?: {
    errorMessage?: string;
    pageCount?: number;
    crawlDurationMs?: number;
  }
): Promise<void> {
  await db.audit.update({
    where: { id },
    data: {
      status,
      ...(status === 'running' ? { startedAt: new Date() } : {}),
      ...(status === 'complete' || status === 'failed' ? { completedAt: new Date() } : {}),
      ...(metadata?.errorMessage !== undefined ? { errorMessage: metadata.errorMessage } : {}),
      ...(metadata?.pageCount !== undefined ? { pageCount: metadata.pageCount } : {}),
      ...(metadata?.crawlDurationMs !== undefined ? { crawlDurationMs: metadata.crawlDurationMs } : {}),
    },
  });
}

export async function softDeleteAudit(id: string): Promise<void> {
  await db.audit.update({
    where: { id },
    data: { archivedAt: new Date() },
  });
}

export async function getPreviousCompletedAuditIdForDomain(
  domain: string,
  excludeAuditId: string,
): Promise<string | null> {
  const audit = await db.audit.findFirst({
    where: { domain, status: 'complete', archivedAt: null, id: { not: excludeAuditId } },
    orderBy: { completedAt: 'desc' },
    select: { id: true },
  });
  return audit?.id ?? null;
}

export async function countAuditsThisMonth(userId: string): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return db.audit.count({
    where: { userId, createdAt: { gte: start }, archivedAt: null },
  });
}
