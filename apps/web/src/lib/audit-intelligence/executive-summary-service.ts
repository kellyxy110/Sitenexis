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
 * Cache-only read of `/api/audit/[id]/executive-summary`'s Redis cache
 * (`exec-summary:{auditId}:v1.0`). Telegram is a read-only presentation
 * surface — it must never trigger `routeTask`/`callAI` on a cache miss,
 * both to guarantee it can never diverge from the dashboard's canonical
 * prose (there is only ever one generator: the dashboard route) and to
 * keep Telegram retrieval free of LLM cost/latency. A miss returns
 * `data: null`; callers must present a truthful "prose not currently
 * available" state and fall back to the deterministic scores/issues/
 * recommendations/evidence commands, which remain fully available.
 */
export async function getExecutiveSummary(auditId: string): Promise<ExecutiveSummaryServiceResult | null> {
  const { getAuditById } = await import('@sitenexis/db');
  const audit = await getAuditById(auditId);
  if (!audit) return null;

  const state = resolveGTLState(audit.status, true);

  let redisGet: ((k: string) => Promise<string | null>) | null = null;
  try {
    const { createRedisClient, getRedisUrl } = await import('@sitenexis/crawler');
    if (getRedisUrl()) {
      const client = createRedisClient(false);
      redisGet = (k) => client.get(k);
    }
  } catch { /* Redis unavailable */ }

  const cacheKey = `exec-summary:${auditId}:${CACHE_VERSION}`;
  if (redisGet) {
    try {
      const cached = await redisGet(cacheKey);
      if (cached) return { state, data: JSON.parse(cached) as ExecutiveSummaryOutputWithMeta };
    } catch { /* cache miss */ }
  }

  return { state, data: null };
}
