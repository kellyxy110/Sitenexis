/**
 * Self-Audit Benchmark Layer
 *
 * Defines the ideal AI visibility benchmark for SiteNexis itself and
 * any domain being compared against it. Answers: "Does this site pass
 * its own intelligence standards?"
 *
 * If SiteNexis fails its own benchmark → flags SELF-INCONSISTENCY DETECTED.
 * This is a deliberate integrity check: a tool that measures AI visibility
 * must itself demonstrate high AI visibility.
 */

import type { BenchmarkComparisonResult, BenchmarkGap } from '@sitenexis/shared';

// ─── Benchmark profiles ───────────────────────────────────────────────────────

interface BenchmarkProfile {
  name:        string;
  description: string;
  minimums: {
    aiVisibilityScore:       number;
    entityConfidenceScore:   number;
    citationProbabilityScore: number;
    semanticTrustScore:      number;
    machineReadabilityScore: number;
    retrievalReadinessScore: number;
    schemaScore:             number;
    seoScore:                number;
  };
}

const BENCHMARKS: Record<string, BenchmarkProfile> = {
  // The standard profile: a tool that claims to measure AI visibility must
  // demonstrate the scores it tells others to achieve.
  sitenexis_standard: {
    name: 'SiteNexis AI Visibility Standard',
    description:
      'Minimum scores required for a domain to demonstrate the AI visibility standards it measures. ' +
      'Applied to SiteNexis itself as a self-consistency check.',
    minimums: {
      aiVisibilityScore:        65,
      entityConfidenceScore:    60,
      citationProbabilityScore: 55,
      semanticTrustScore:       60,
      machineReadabilityScore:  65,
      retrievalReadinessScore:  60,
      schemaScore:              55,
      seoScore:                 65,
    },
  },

  // A more lenient profile for general domains
  general_minimum: {
    name: 'General AI Visibility Minimum',
    description: 'Minimum threshold for a domain to be considered AI-visible.',
    minimums: {
      aiVisibilityScore:        50,
      entityConfidenceScore:    45,
      citationProbabilityScore: 40,
      semanticTrustScore:       45,
      machineReadabilityScore:  50,
      retrievalReadinessScore:  45,
      schemaScore:              40,
      seoScore:                 50,
    },
  },

  // High-bar profile for domains claiming to be authoritative in their niche
  authority_standard: {
    name: 'AI Authority Standard',
    description: 'Minimum scores required to be classified as an authoritative AI-visible domain.',
    minimums: {
      aiVisibilityScore:        75,
      entityConfidenceScore:    70,
      citationProbabilityScore: 65,
      semanticTrustScore:       70,
      machineReadabilityScore:  75,
      retrievalReadinessScore:  70,
      schemaScore:              65,
      seoScore:                 75,
    },
  },
};

// ─── Dimension labels ──────────────────────────────────────────────────────────

const DIMENSION_LABELS: Record<string, string> = {
  aiVisibilityScore:        'AI Visibility Score',
  entityConfidenceScore:    'Entity Confidence Score',
  citationProbabilityScore: 'Citation Probability Score',
  semanticTrustScore:       'Semantic Trust Score',
  machineReadabilityScore:  'Machine Readability Score',
  retrievalReadinessScore:  'Retrieval Readiness Score',
  schemaScore:              'Schema Completeness Score',
  seoScore:                 'SEO Health Score',
};

// ─── Self-inconsistency detection ────────────────────────────────────────────

function detectSelfInconsistency(
  scores: Record<string, number | null>,
  benchmark: BenchmarkProfile,
): { detected: boolean; reason?: string } {
  // Critical: if the AI Visibility Score is below half the standard minimum,
  // the tool is demonstrably not practicing what it preaches.
  const aiVis = scores['aiVisibilityScore'] ?? null;
  if (aiVis !== null && aiVis < benchmark.minimums.aiVisibilityScore / 2) {
    return {
      detected: true,
      reason: `AI Visibility Score (${aiVis}) is below half the benchmark minimum (${benchmark.minimums.aiVisibilityScore}). ` +
               `A platform that measures AI visibility should itself demonstrate adequate AI visibility.`,
    };
  }

  // If the majority of dimensions fail, flag self-inconsistency
  const failCount = Object.entries(benchmark.minimums).filter(([dim, min]) => {
    const current = scores[dim] ?? null;
    return current !== null && current < min;
  }).length;

  const totalDims = Object.keys(benchmark.minimums).length;
  if (failCount > totalDims * 0.6) {
    return {
      detected: true,
      reason: `${failCount} of ${totalDims} benchmark dimensions are failing. ` +
               `The domain does not meet the standards it measures.`,
    };
  }

  return { detected: false };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Compare a set of scores against an AI visibility benchmark.
 *
 * @param scores         - Key-value map of dimension name → score (null = not available)
 * @param benchmarkName  - Which benchmark to use (default: 'sitenexis_standard')
 *
 * @returns BenchmarkComparisonResult with pass/fail status, gap report,
 *          and self-inconsistency flag
 */
export function compareToBenchmark(
  scores: Record<string, number | null>,
  benchmarkName = 'sitenexis_standard',
): BenchmarkComparisonResult {
  const benchmark = BENCHMARKS[benchmarkName] ?? BENCHMARKS['sitenexis_standard']!;
  const gapReport: BenchmarkGap[] = [];
  const passingDimensions: string[] = [];
  const failingDimensions: string[] = [];

  let totalGap = 0;
  let dimensionsWithData = 0;

  for (const [dim, minimum] of Object.entries(benchmark.minimums)) {
    const current = scores[dim] ?? null;
    if (current === null) continue;

    dimensionsWithData++;
    const gap = current - minimum;
    const label = DIMENSION_LABELS[dim] ?? dim;

    const severity = current >= minimum            ? 'info'     :
                     current >= minimum * 0.8      ? 'warning'  : 'critical';

    gapReport.push({
      dimension:        label,
      currentScore:     current,
      benchmarkMinimum: minimum,
      gap:              Math.round(gap),
      severity,
    });

    if (current >= minimum) {
      passingDimensions.push(label);
    } else {
      failingDimensions.push(label);
      totalGap += minimum - current;
    }
  }

  // Overall gap score: 100 = meets all benchmarks, 0 = fails all
  const overallGapScore = dimensionsWithData > 0
    ? Math.round(
        Math.max(0, 100 - (totalGap / (dimensionsWithData * 50)) * 100),
      )
    : 0;

  const passed = failingDimensions.length === 0;

  const inconsistency = detectSelfInconsistency(scores, benchmark);

  let verdict: string;
  if (inconsistency.detected) {
    verdict = 'SELF-INCONSISTENCY DETECTED — The domain does not meet the AI visibility standards it measures.';
  } else if (passed) {
    verdict = `Passes ${benchmark.name}. All ${passingDimensions.length} measured dimensions meet minimum thresholds.`;
  } else if (failingDimensions.length <= 2) {
    verdict = `Near-passing — ${failingDimensions.length} dimension(s) below minimum: ${failingDimensions.join(', ')}.`;
  } else {
    verdict = `Fails ${benchmark.name} — ${failingDimensions.length} of ${dimensionsWithData} dimensions below minimum thresholds.`;
  }

  return {
    passed,
    selfInconsistencyDetected: inconsistency.detected,
    ...(inconsistency.reason !== undefined ? { selfInconsistencyReason: inconsistency.reason } : {}),
    overallGapScore,
    gapReport: gapReport.sort((a, b) => a.gap - b.gap), // worst gaps first
    passingDimensions,
    failingDimensions,
    verdict,
  };
}

/** Export available benchmark profile names. */
export const AVAILABLE_BENCHMARKS = Object.keys(BENCHMARKS) as (keyof typeof BENCHMARKS)[];

/** Export benchmark minimums for a given profile (useful for UI display). */
export function getBenchmarkProfile(name = 'sitenexis_standard'): BenchmarkProfile {
  return BENCHMARKS[name] ?? BENCHMARKS['sitenexis_standard']!;
}
