/**
 * Second Brain Change Engine — deterministic, pure. Compares two already
 * -fetched canonical score snapshots for the same (userId, domain) and
 * classifies each of the eight canonical headline metrics. Never recomputes
 * a score; every value here is copied verbatim from AuditScore /
 * AIVisibilityScore / MachineTrustScore by the caller.
 *
 * "Unavailable ≠ Zero" is load-bearing here: `null` means the underlying
 * score row does not exist for that audit, never that the score is 0.
 * A caller that accidentally coalesces null to 0 before calling this module
 * would silently manufacture false REGRESSED classifications — which is
 * exactly the bug class this engine is designed to prevent, not commit.
 */

import { CANONICAL_METRIC_KEYS, type AuditScoreSnapshot, type MetricChange } from './types';

function classifyMetric(previousValue: number | null, currentValue: number | null): MetricChange['classification'] | null {
  if (previousValue === null && currentValue === null) {
    // No evidence either audit — nothing to say. Emitting a classification
    // here would fabricate a comparison that never happened.
    return null;
  }
  if (previousValue === null && currentValue !== null) {
    return 'INTRODUCED';
  }
  if (previousValue !== null && currentValue === null) {
    // A score that WAS measured and is no longer available is a coverage
    // gap, not evidence of decline. None of the six approved classification
    // values (IMPROVED/REGRESSED/UNCHANGED/INTRODUCED/RESOLVED/PERSISTENT)
    // truthfully describes "we no longer know" — forcing it into REGRESSED
    // would be exactly the fabrication this rule set exists to prevent (see
    // the explicit instruction: "available → unavailable must NOT
    // automatically mean REGRESSED"). SB1 therefore emits no AuditChange
    // row for this transition — documented as a known limitation, not a
    // silent gap, in the SB1 report.
    return null;
  }
  // Both non-null from here on.
  const prev = previousValue as number;
  const curr = currentValue as number;
  if (curr > prev) return 'IMPROVED';
  if (curr < prev) return 'REGRESSED';
  return 'UNCHANGED';
}

/**
 * Computes one MetricChange per canonical metric where a truthful
 * classification exists. Metrics with no comparable evidence (both
 * unavailable, or available→unavailable) are omitted entirely rather than
 * assigned a misleading label — callers must not assume the output array
 * has exactly CANONICAL_METRIC_KEYS.length entries.
 */
export function computeAuditChanges(previous: AuditScoreSnapshot, current: AuditScoreSnapshot): MetricChange[] {
  const changes: MetricChange[] = [];
  for (const metricKey of CANONICAL_METRIC_KEYS) {
    const previousValue = previous[metricKey];
    const currentValue = current[metricKey];
    const classification = classifyMetric(previousValue, currentValue);
    if (classification === null) continue;
    changes.push({ metricKey, previousValue, currentValue, classification });
  }
  return changes;
}
