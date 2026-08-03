import type { GTLState } from '@sitenexis/shared';
import { resolveGTLState } from '@/lib/gtl';

const NARRATIVE_CACHE_VERSION = 'v4.1';

export type NarrativeReport = Record<string, unknown> & { auditId: string; domain: string; generatedAt: string; modelVersion: string };

export interface NarrativeReportServiceResult {
  state: GTLState;
  data: NarrativeReport | null;
}

/**
 * Cache-only read of `/api/audit/[id]/narrative-report`'s Redis cache
 * (`narrative:{auditId}:v4.1`). Same read-only/cost-isolation boundary as
 * `getExecutiveSummary` — Telegram never calls `routeTask`/`callAI`/
 * `parseAIResponse` on a cache miss. A miss returns `data: null`; the
 * caller must present a truthful "prose not currently available" state.
 */
export async function getNarrativeReport(auditId: string): Promise<NarrativeReportServiceResult | null> {
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
  } catch { /* Redis unavailable — continue without cache */ }

  const cacheKey = `narrative:${auditId}:${NARRATIVE_CACHE_VERSION}`;
  if (redisGet) {
    try {
      const cached = await redisGet(cacheKey);
      if (cached) return { state, data: JSON.parse(cached) as NarrativeReport };
    } catch { /* cache miss */ }
  }

  return { state, data: null };
}
