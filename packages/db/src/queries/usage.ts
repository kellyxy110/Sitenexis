import { Prisma } from '../../generated';
import { db } from '../client';

/**
 * Append a usage event to the `usage_logs` table (billing/analytics/audit trail).
 * Metadata must never contain secrets (API keys, tokens) — callers pass only
 * non-sensitive fields (event, model, latency, token counts, outcome).
 */
export async function logUsage(params: {
  userId: string;
  event: string;
  auditId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.usageLog.create({
    data: {
      userId: params.userId,
      event: params.event,
      ...(params.auditId ? { auditId: params.auditId } : {}),
      metadata: (params.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    },
  });
}

/** Count usage events of a given type for a user since a cutoff (for soft usage caps). */
export async function countUsageSince(userId: string, event: string, since: Date): Promise<number> {
  return db.usageLog.count({ where: { userId, event, createdAt: { gte: since } } });
}
