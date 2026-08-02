/**
 * Aggregates daily GA4/GSC rows (the storage grain — one row per user per day)
 * into weekly/monthly/quarterly buckets for trend charts. Pure, no DB access.
 *
 * Sum fields are summed. Rate fields (ctr, avgPosition) are NOT averaged
 * day-to-day — that silently distorts wider buckets (a 1-visit day and a
 * 10,000-visit day would count equally). They're recomputed from the summed
 * components: ctr = sumClicks / sumImpressions, avgPosition as an
 * impressions-weighted mean.
 */

export type Granularity = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface TrafficDailyRow {
  date: Date;
  sessions: number;
  activeUsers: number;
}

export interface TrafficBucketPoint {
  date: string; // ISO date, bucket start
  sessions: number;
  activeUsers: number;
}

export interface SearchDailyRow {
  date: Date;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
}

export interface SearchBucketPoint {
  date: string; // ISO date, bucket start
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
}

function toUtcDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Returns the ISO date string (bucket start) a given date falls into for a granularity. */
export function bucketKeyForDate(date: Date, granularity: Granularity): string {
  const d = toUtcDateOnly(date);

  if (granularity === 'daily') {
    return d.toISOString().slice(0, 10);
  }

  if (granularity === 'weekly') {
    // Monday-start ISO week. getUTCDay(): 0=Sun..6=Sat -> days since Monday.
    const daysSinceMonday = (d.getUTCDay() + 6) % 7;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - daysSinceMonday);
    return monday.toISOString().slice(0, 10);
  }

  if (granularity === 'monthly') {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
  }

  // quarterly
  const quarterStartMonth = Math.floor(d.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(d.getUTCFullYear(), quarterStartMonth, 1)).toISOString().slice(0, 10);
}

export function bucketTrafficSeries(rows: TrafficDailyRow[], granularity: Granularity): TrafficBucketPoint[] {
  if (granularity === 'daily') {
    return rows
      .slice()
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((r) => ({ date: bucketKeyForDate(r.date, 'daily'), sessions: r.sessions, activeUsers: r.activeUsers }));
  }

  const buckets = new Map<string, { sessions: number; activeUsers: number }>();
  for (const r of rows) {
    const key = bucketKeyForDate(r.date, granularity);
    const existing = buckets.get(key) ?? { sessions: 0, activeUsers: 0 };
    existing.sessions += r.sessions;
    existing.activeUsers += r.activeUsers;
    buckets.set(key, existing);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));
}

export function bucketSearchSeries(rows: SearchDailyRow[], granularity: Granularity): SearchBucketPoint[] {
  if (granularity === 'daily') {
    return rows
      .slice()
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((r) => ({ date: bucketKeyForDate(r.date, 'daily'), clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, avgPosition: r.avgPosition }));
  }

  const buckets = new Map<string, { clicks: number; impressions: number; positionWeightedSum: number }>();
  for (const r of rows) {
    const key = bucketKeyForDate(r.date, granularity);
    const existing = buckets.get(key) ?? { clicks: 0, impressions: 0, positionWeightedSum: 0 };
    existing.clicks += r.clicks;
    existing.impressions += r.impressions;
    existing.positionWeightedSum += r.avgPosition * r.impressions;
    buckets.set(key, existing);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      clicks: v.clicks,
      impressions: v.impressions,
      ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
      avgPosition: v.impressions > 0 ? v.positionWeightedSum / v.impressions : 0,
    }));
}
