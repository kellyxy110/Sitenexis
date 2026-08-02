/**
 * Joins a domain's audit history (AI Visibility Score over time) with its
 * synced GA4/GSC traffic and search data, summing real activity in a window
 * around each audit's completion date. Audits are infrequent (often just 1-2
 * per domain), so this never fabricates a trend line between sparse points —
 * it returns exactly one correlation point per audit, nothing interpolated.
 */

export interface ScoredAudit {
  auditId: string;
  completedAt: Date;
  aiVisibilityScore: number;
}

export interface TrafficDailyPoint {
  date: Date;
  sessions: number;
}

export interface SearchDailyPoint {
  date: Date;
  clicks: number;
}

export interface ScoreTrafficCorrelationPoint {
  auditId: string;
  date: string; // ISO date, the audit's completion date
  aiVisibilityScore: number;
  sessions: number;
  clicks: number;
}

function withinWindow(day: Date, center: Date, windowDays: number): boolean {
  const diffMs = Math.abs(day.getTime() - center.getTime());
  return diffMs <= windowDays * 24 * 3_600_000;
}

export function correlateScoresWithTraffic(
  audits: ScoredAudit[],
  traffic: TrafficDailyPoint[],
  search: SearchDailyPoint[],
  windowDays = 3,
): ScoreTrafficCorrelationPoint[] {
  return audits
    .filter((a) => a.completedAt != null)
    .sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime())
    .map((audit) => {
      const sessions = traffic
        .filter((t) => withinWindow(t.date, audit.completedAt, windowDays))
        .reduce((s, t) => s + t.sessions, 0);
      const clicks = search
        .filter((s) => withinWindow(s.date, audit.completedAt, windowDays))
        .reduce((s, r) => s + r.clicks, 0);

      return {
        auditId: audit.auditId,
        date: audit.completedAt.toISOString().slice(0, 10),
        aiVisibilityScore: audit.aiVisibilityScore,
        sessions,
        clicks,
      };
    });
}
