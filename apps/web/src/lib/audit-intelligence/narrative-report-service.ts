import type { GTLState } from '@sitenexis/shared';
import { resolveGTLState } from '@/lib/gtl';

const NARRATIVE_CACHE_VERSION = 'v4.1';

export type NarrativeReport = Record<string, unknown> & { auditId: string; domain: string; generatedAt: string; modelVersion: string };

export interface NarrativeReportServiceResult {
  state: GTLState;
  data: NarrativeReport | null;
}

/**
 * Read-only. Never generates. Same lookup order as `getExecutiveSummary`:
 * durable `AuditIntelligenceReport` row → legacy Redis cache → truthful
 * "not available".
 */
export async function getNarrativeReport(auditId: string): Promise<NarrativeReportServiceResult | null> {
  const { getAuditById, getAuditIntelligenceReport } = await import('@sitenexis/db');
  const audit = await getAuditById(auditId);
  if (!audit) return null;

  const state = resolveGTLState(audit.status, true);

  const persisted = await getAuditIntelligenceReport(auditId).catch(() => null);
  if (persisted?.narrativeReport) {
    return { state, data: persisted.narrativeReport as NarrativeReport };
  }

  let redisGet: ((k: string) => Promise<string | null>) | null = null;
  try {
    const { createRedisClient, getRedisUrl } = await import('@sitenexis/crawler');
    if (getRedisUrl()) {
      const client = createRedisClient(false);
      redisGet = (k) => client.get(k);
    }
  } catch { /* Redis unavailable — continue without cache */ }

  if (redisGet) {
    try {
      const cached = await redisGet(`narrative:${auditId}:${NARRATIVE_CACHE_VERSION}`);
      if (cached) return { state, data: JSON.parse(cached) as NarrativeReport };
    } catch { /* cache miss */ }
  }

  return { state, data: null };
}
