import type { Entity, SyntheticPattern } from '@sitenexis/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NetworkIntegrityResult {
  networkIntegrityScore: number;
  patterns: SyntheticPattern[];
}

// ─── Entity network integrity analysis ───────────────────────────────────────

/**
 * Analyses the entity relationship network for structural anomalies that
 * indicate coordinated synthetic authority construction.
 *
 * IMPORTANT: All findings are probabilistic pattern detection — never definitive
 * fraud classification. Always returned with confidence scores (0–1).
 */
export function analyseNetworkIntegrity(entities: Entity[]): NetworkIntegrityResult {
  const patterns: SyntheticPattern[] = [];

  if (entities.length === 0) {
    return { networkIntegrityScore: 100, patterns };
  }

  // Pattern: unusually high reciprocal sameAs density
  const reciprocalLinks = detectReciprocalSameAs(entities);
  if (reciprocalLinks.confidence > 0.3) {
    patterns.push(reciprocalLinks);
  }

  // Pattern: entities with identical creation patterns (same description length, zero context)
  const clonedEntities = detectClonedEntityPatterns(entities);
  if (clonedEntities.confidence > 0.3) {
    patterns.push(clonedEntities);
  }

  // Pattern: implausibly broad topic coverage relative to entity count
  const topicOverreach = detectTopicOverreach(entities);
  if (topicOverreach.confidence > 0.3) {
    patterns.push(topicOverreach);
  }

  // Network integrity score: 100 minus weighted pattern penalties
  const totalPenalty = patterns.reduce((sum, p) => {
    const severityWeight = p.severity === 'critical' ? 20
      : p.severity === 'warning' ? 10 : 5;
    return sum + severityWeight * p.confidence;
  }, 0);

  const networkIntegrityScore = Math.max(0, Math.round(100 - totalPenalty));

  return { networkIntegrityScore, patterns };
}

function detectReciprocalSameAs(entities: Entity[]): SyntheticPattern {
  const allSameAsUrls = entities.flatMap((e) => e.sameAsUrls);
  const uniqueDomains = new Set(
    allSameAsUrls.map((u) => {
      try { return new URL(u).hostname; } catch { return u; }
    }),
  );

  // Unusually high ratio of sameAs URLs to unique domains signals link clustering
  const reciprocalRatio = allSameAsUrls.length > 0
    ? 1 - (uniqueDomains.size / allSameAsUrls.length)
    : 0;

  const confidence = reciprocalRatio > 0.7 ? 0.7
    : reciprocalRatio > 0.5 ? 0.5
      : reciprocalRatio > 0.3 ? 0.3
        : 0;

  return {
    patternType: 'authority_network',
    confidence: Math.round(confidence * 100) / 100,
    evidence: confidence > 0
      ? [`${allSameAsUrls.length} sameAs URLs across only ${uniqueDomains.size} unique domains (${(reciprocalRatio * 100).toFixed(0)}% domain clustering).`]
      : [],
    affectedEntities: entities.filter((e) => e.sameAsUrls.length > 2).map((e) => e.name),
    severity: confidence > 0.6 ? 'warning' : 'info',
  };
}

function detectClonedEntityPatterns(entities: Entity[]): SyntheticPattern {
  const descriptionLengths = entities
    .map((e) => e.description?.length ?? 0)
    .filter((l) => l > 0);

  if (descriptionLengths.length < 3) {
    return {
      patternType: 'fake_entity',
      confidence: 0,
      evidence: [],
      affectedEntities: [],
      severity: 'info',
    };
  }

  // Standard deviation of description lengths — low variance suggests templated generation
  const mean = descriptionLengths.reduce((a, b) => a + b, 0) / descriptionLengths.length;
  const variance = descriptionLengths.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / descriptionLengths.length;
  const stdDev = Math.sqrt(variance);

  const normalizedStdDev = stdDev / (mean || 1);
  // Very low normalized std dev (<0.1) suggests all descriptions are the same length
  const confidence = normalizedStdDev < 0.05 ? 0.6
    : normalizedStdDev < 0.10 ? 0.4
      : normalizedStdDev < 0.15 ? 0.2
        : 0;

  return {
    patternType: 'fake_entity',
    confidence: Math.round(confidence * 100) / 100,
    evidence: confidence > 0
      ? [`Entity descriptions have abnormally uniform length (stdDev: ${stdDev.toFixed(0)} chars, mean: ${mean.toFixed(0)} chars).`]
      : [],
    affectedEntities: [],
    severity: 'info',
  };
}

function detectTopicOverreach(entities: Entity[]): SyntheticPattern {
  if (entities.length < 5) {
    return {
      patternType: 'unnatural_clustering',
      confidence: 0,
      evidence: [],
      affectedEntities: [],
      severity: 'info',
    };
  }

  // Collect unique entity types — an implausibly broad type spread is a signal
  const types = new Set(entities.map((e) => e.type.toLowerCase()));
  const typeRatio = types.size / entities.length;

  // Each entity having a completely unique type suggests manufactured diversity
  const confidence = typeRatio > 0.9 ? 0.5
    : typeRatio > 0.8 ? 0.3
      : 0;

  return {
    patternType: 'unnatural_clustering',
    confidence: Math.round(confidence * 100) / 100,
    evidence: confidence > 0
      ? [`${types.size} unique entity types across ${entities.length} entities (${(typeRatio * 100).toFixed(0)}% type diversity — expected <50% for organic sites).`]
      : [],
    affectedEntities: [],
    severity: 'info',
  };
}
