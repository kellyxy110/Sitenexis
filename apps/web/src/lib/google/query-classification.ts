/**
 * Deterministic Search Console query classification. Every rule is a
 * threshold over real, already-synced `SearchQueryMetric` aggregates — no
 * LLM, no fabricated trend. A query can carry more than one classification
 * at once (e.g. "rising" and "near page one" are not mutually exclusive).
 */
import { comparePeriodMetric, type PeriodComparison } from './period-comparison';

export type QueryClassification =
  | 'rising'
  | 'declining'
  | 'high_impression_low_ctr'
  | 'near_page_one'
  | 'losing_position'
  | 'gaining_position';

export interface QueryPeriodStat {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
}

export interface ClassifiedQuery {
  query: string;
  current: QueryPeriodStat;
  previous: QueryPeriodStat | null;
  clicksComparison: PeriodComparison;
  impressionsComparison: PeriodComparison;
  /** previous.avgPosition − current.avgPosition. Positive = rank improved (moved toward #1). Null when there is no previous-period data for this query. */
  positionDelta: number | null;
  classifications: QueryClassification[];
}

export interface QueryClassificationThresholds {
  /** Minimum |percentageDelta| on impressions to call a query rising/declining. */
  trendThreshold: number;
  /** Minimum impressions to be eligible for the high-impression/low-CTR rule — mirrors detectHighImpressionsLowCtr's default so the two surfaces agree. */
  highImpressionThreshold: number;
  /** CTR below which a high-impression query is flagged. */
  lowCtrThreshold: number;
  /** Inclusive avgPosition range considered "page two, close to page one". */
  nearPageOneRange: [number, number];
  /** Minimum position-number swing (in either direction) to call it a real gain/loss, not noise. */
  positionSwingThreshold: number;
}

export const DEFAULT_QUERY_CLASSIFICATION_THRESHOLDS: QueryClassificationThresholds = {
  trendThreshold: 0.2,
  highImpressionThreshold: 500,
  lowCtrThreshold: 0.02,
  nearPageOneRange: [11, 20],
  positionSwingThreshold: 2,
};

export function classifyQueries(
  current: QueryPeriodStat[],
  previous: QueryPeriodStat[],
  thresholds: Partial<QueryClassificationThresholds> = {},
): ClassifiedQuery[] {
  const t = { ...DEFAULT_QUERY_CLASSIFICATION_THRESHOLDS, ...thresholds };
  const previousByQuery = new Map(previous.map((p) => [p.query, p]));

  return current.map((c) => {
    const prev = previousByQuery.get(c.query) ?? null;
    const clicksComparison = comparePeriodMetric(c.clicks, prev?.clicks ?? 0);
    const impressionsComparison = comparePeriodMetric(c.impressions, prev?.impressions ?? 0);
    const positionDelta = prev && prev.avgPosition > 0 ? prev.avgPosition - c.avgPosition : null;

    const classifications: QueryClassification[] = [];

    if (
      impressionsComparison.percentageDelta !== null &&
      impressionsComparison.percentageDelta >= t.trendThreshold
    ) {
      classifications.push('rising');
    }
    if (
      impressionsComparison.percentageDelta !== null &&
      impressionsComparison.percentageDelta <= -t.trendThreshold
    ) {
      classifications.push('declining');
    }
    if (c.impressions >= t.highImpressionThreshold && c.ctr < t.lowCtrThreshold) {
      classifications.push('high_impression_low_ctr');
    }
    if (c.avgPosition >= t.nearPageOneRange[0] && c.avgPosition <= t.nearPageOneRange[1]) {
      classifications.push('near_page_one');
    }
    if (positionDelta !== null && positionDelta <= -t.positionSwingThreshold) {
      classifications.push('losing_position');
    }
    if (positionDelta !== null && positionDelta >= t.positionSwingThreshold) {
      classifications.push('gaining_position');
    }

    return {
      query: c.query,
      current: c,
      previous: prev,
      clicksComparison,
      impressionsComparison,
      positionDelta,
      classifications,
    };
  });
}

export function groupQueriesByClassification(
  classified: ClassifiedQuery[],
): Record<QueryClassification, ClassifiedQuery[]> {
  const groups: Record<QueryClassification, ClassifiedQuery[]> = {
    rising: [], declining: [], high_impression_low_ctr: [], near_page_one: [], losing_position: [], gaining_position: [],
  };
  for (const q of classified) {
    for (const c of q.classifications) groups[c].push(q);
  }
  return groups;
}
