import { type Audit, type AuditStatus, type Prisma } from '../../generated';
import { db } from '../client';
import type { AuditAgentManifest, AuditAgentState, AgentResultStatus } from '@sitenexis/shared';

export type { Audit };

export async function createAudit(userId: string, domain: string): Promise<Audit> {
  return db.audit.create({
    data: { userId, domain, status: 'queued' },
  });
}

export async function getAuditById(id: string, userId?: string): Promise<Audit | null> {
  return db.audit.findFirst({
    where: { id, ...(userId ? { userId } : {}), archivedAt: null },
  });
}

export async function getAuditProgressSnapshot(id: string, userId?: string) {
  return db.audit.findFirst({
    where: { id, ...(userId ? { userId } : {}), archivedAt: null },
    select: { id: true, status: true, pageCount: true, agentManifest: true, _count: { select: { issues: true } } },
  });
}

export async function getAuditWithResults(id: string, userId?: string) {
  return db.audit.findFirst({
    where: { id, ...(userId ? { userId } : {}), archivedAt: null },
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

export async function initializeAuditManifest(auditId: string, required: string[]): Promise<void> {
  const now = new Date().toISOString();
  const agents = Object.fromEntries(required.map((agent) => [agent, {
    agent, status: 'pending' as const, startedAt: null, finishedAt: null,
    durationMs: null, retryCount: 0, keyOutput: null, resultPersisted: false,
  }]));
  const manifest: AuditAgentManifest = { version: 1, required, agents, updatedAt: now };
  await db.audit.update({
    where: { id: auditId },
    data: { agentManifest: manifest as unknown as Prisma.InputJsonValue, requiredAgentCount: required.length },
  });
}

export async function updateAuditAgentState(auditId: string, state: AuditAgentState): Promise<void> {
  const audit = await db.audit.findUnique({ where: { id: auditId }, select: { agentManifest: true } });
  if (!audit) throw new Error(`Audit ${auditId} not found`);
  const current = (audit.agentManifest as unknown as Partial<AuditAgentManifest>) ?? {};
  const agents = { ...(current.agents ?? {}), [state.agent]: state };
  const values = Object.values(agents);
  const manifest: AuditAgentManifest = {
    version: 1,
    required: current.required ?? values.map((value) => value.agent),
    agents,
    updatedAt: new Date().toISOString(),
  };
  const count = (status: AgentResultStatus) => values.filter((value) => value.status === status).length;
  await db.audit.update({
    where: { id: auditId },
    data: {
      agentManifest: manifest as unknown as Prisma.InputJsonValue,
      completedAgentCount: count('completed'),
      partialAgentCount: count('partial'),
      failedAgentCount: count('failed'),
    },
  });
}

export async function getAuditManifest(auditId: string, userId?: string): Promise<AuditAgentManifest | null> {
  const audit = await db.audit.findFirst({
    where: { id: auditId, ...(userId ? { userId } : {}), archivedAt: null },
    select: { agentManifest: true },
  });
  return (audit?.agentManifest as unknown as AuditAgentManifest | undefined) ?? null;
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

export async function getDemoAudit(domain: string) {
  return db.audit.findFirst({
    where: { domain, isDemo: true, status: 'complete', archivedAt: null },
    include: {
      pages: { where: { archivedAt: null } },
      issues: true,
      scores: true,
      aiVisibilityScores: true,
      report: true,
    },
    orderBy: { completedAt: 'desc' },
  });
}

export async function listDemoAudits() {
  return db.audit.findMany({
    where: { isDemo: true, status: 'complete', archivedAt: null },
    select: { id: true, domain: true, completedAt: true, pageCount: true },
    orderBy: { domain: 'asc' },
  });
}
