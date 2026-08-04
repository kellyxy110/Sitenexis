import type { GTLState } from '@sitenexis/shared';
import type { ExecutiveSummaryOutput } from '@sitenexis/analyzers';
import { resolveGTLState } from '@/lib/gtl';

const CACHE_VERSION = 'v1.0';

export type ExecutiveSummaryOutputWithMeta = ExecutiveSummaryOutput & { auditId: string; modelVersion: string; domain: string };

export interface ExecutiveSummaryServiceResult {
  state: GTLState;
  data: ExecutiveSummaryOutputWithMeta | null;
}

/**
 * Read-only. Never generates. Lookup order: the durable, canonical
 * `AuditIntelligenceReport` row (the source of truth) → legacy Redis cache
 * (covers rows written before this table existed, or as a fast path while
 * Redis is warm) → truthful "not available" if neither exists. Used by both
 * Telegram's /audit command and (indirectly, same contract) the dashboard.
 */
export async function getExecutiveSummary(auditId: string): Promise<ExecutiveSummaryServiceResult | null> {
  const { getAuditById, getAuditIntelligenceReport } = await import('@sitenexis/db');
  const audit = await getAuditById(auditId);
  if (!audit) return null;

  const state = resolveGTLState(audit.status, true);

  const persisted = await getAuditIntelligenceReport(auditId).catch(() => null);
  if (persisted?.executiveSummary) {
    return { state, data: persisted.executiveSummary as ExecutiveSummaryOutputWithMeta };
  }

  let redisGet: ((k: string) => Promise<string | null>) | null = null;
  try {
    const { createRedisClient, getRedisUrl } = await import('@sitenexis/crawler');
    if (getRedisUrl()) {
      const client = createRedisClient(false);
      redisGet = (k) => client.get(k);
    }
  } catch { /* Redis unavailable */ }

  if (redisGet) {
    try {
      const cached = await redisGet(`exec-summary:${auditId}:${CACHE_VERSION}`);
      if (cached) return { state, data: JSON.parse(cached) as ExecutiveSummaryOutputWithMeta };
    } catch { /* cache miss */ }
  }

  return { state, data: null };
}
