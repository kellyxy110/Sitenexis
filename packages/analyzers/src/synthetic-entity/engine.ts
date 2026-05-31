import type {
  CrawledPage,
  EntityIntelligenceReport,
  SyntheticEntityAnalysis,
} from '@sitenexis/shared';
import { analyseNetworkIntegrity } from './network';
import { detectSchemaManipulationPatterns, detectCitationFarmingPatterns, detectFakeEntityPatterns } from './patterns';
import { aggregateSyntheticRisk } from './scorer';

export { analyseNetworkIntegrity } from './network';
export { detectSchemaManipulationPatterns, detectCitationFarmingPatterns, detectFakeEntityPatterns } from './patterns';
export { aggregateSyntheticRisk } from './scorer';

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Runs the full Synthetic Entity Detection analysis.
 *
 * Per CLAUDE.md §26:
 * - Detection is pattern-based and probabilistic — never definitive fraud classification
 * - All findings labelled with detection confidence (0–1) — not binary flags
 * - Results shown ONLY to the domain owner — never in competitive analysis
 * - If any individual pattern rule throws: log, skip, continue
 * - Rules loaded from /config/synthetic-detection-rules.json in production
 *   (the agent layer handles config loading; this module applies the rules)
 */
export function runSyntheticEntityDetection(
  pages: CrawledPage[],
  entityReport: EntityIntelligenceReport,
): SyntheticEntityAnalysis {
  const allPatterns: SyntheticEntityAnalysis['detectedPatterns'] = [];

  // Entity network integrity — structural anomalies
  const networkResult = safeRun(
    () => analyseNetworkIntegrity(entityReport.entitiesDetected),
    { networkIntegrityScore: 100, patterns: [] },
    'network integrity analysis',
  );
  allPatterns.push(...networkResult.patterns);

  // Schema manipulation patterns
  const schemaPatterns = safeRun(
    () => detectSchemaManipulationPatterns(pages),
    [],
    'schema manipulation detection',
  );
  allPatterns.push(...schemaPatterns);

  // Citation farming patterns
  const citationPatterns = safeRun(
    () => detectCitationFarmingPatterns(pages),
    [],
    'citation farming detection',
  );
  allPatterns.push(...citationPatterns);

  // Fake entity patterns
  const fakeEntityPatterns = safeRun(
    () => detectFakeEntityPatterns(entityReport),
    [],
    'fake entity detection',
  );
  allPatterns.push(...fakeEntityPatterns);

  // Aggregate into final risk score
  return aggregateSyntheticRisk(allPatterns, networkResult);
}

function safeRun<T>(fn: () => T, fallback: T, label: string): T {
  try {
    return fn();
  } catch (err) {
    // Per CLAUDE.md §26: log, skip, continue — never block on a single rule failure
    console.error(`[synthetic-entity] ${label} failed — skipping:`, err);
    return fallback;
  }
}
