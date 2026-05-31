import type { CrawledPage, SurfaceScore, SurfaceBlocker } from '@sitenexis/shared';

/**
 * Models chat-based recommendation probability (CLAUDE.md §25 — Surface 2).
 *
 * Trigger conditions: Query intent matches entity or topic cluster on site.
 * Inclusion probability derived from:
 *   AI Extractability  × 0.35
 *   + Entity Confidence × 0.35
 *   + Semantic Trust    × 0.30
 */
export function modelChatRecommendation(
  pages: CrawledPage[],
  aiExtractabilityScore: number,
  entityConfidenceScore: number,
  semanticTrustScore: number,
): SurfaceScore {
  const blockers: SurfaceBlocker[] = [];

  // Chat recommendation requires direct conversational answers
  const hasConversationalContent = pages.some(hasConversationalAnswers);
  // Entity clarity required for chat systems to anchor recommendations
  const hasPrimaryEntityDefinition = pages.some(hasClearEntityDefinition);
  // No internal contradictions
  const hasContradictionRisk = aiExtractabilityScore < 50 && entityConfidenceScore < 50;

  let inclusionScore = Math.round(
    aiExtractabilityScore * 0.35
    + entityConfidenceScore * 0.35
    + semanticTrustScore * 0.30,
  );

  if (!hasConversationalContent) {
    inclusionScore = Math.round(inclusionScore * 0.85);
    blockers.push({
      type: 'no_conversational_structure',
      description: 'Content does not address natural language query patterns.',
      recommendation: 'Add FAQ sections and direct question-answer content structures to improve chat recommendation eligibility.',
    });
  }

  if (!hasPrimaryEntityDefinition) {
    inclusionScore = Math.round(inclusionScore * 0.80);
    blockers.push({
      type: 'unclear_primary_entity',
      description: 'Primary entity (organisation, person, or product) is not clearly defined for chat AI extraction.',
      recommendation: 'Add a clear entity definition on the homepage and About page with consistent schema markup.',
    });
  }

  if (hasContradictionRisk) {
    inclusionScore = Math.round(inclusionScore * 0.75);
    blockers.push({
      type: 'high_contradiction_risk',
      description: 'Low AI extractability and entity confidence together indicate high contradiction risk for chat systems.',
      recommendation: 'Resolve entity inconsistencies and improve content clarity to reduce contradiction risk.',
    });
  }

  const inclusionProbability = Math.min(100, Math.max(0, inclusionScore));

  return {
    inclusionProbability,
    status: classifySurfaceStatus(inclusionProbability),
    blockers,
    recommendations: blockers.map((b) => b.recommendation),
  };
}

function hasConversationalAnswers(page: CrawledPage): boolean {
  const text = page.bodyText ?? '';
  return (
    /\b(what is|how to|why does|when should|where can)\b/i.test(text)
    || /\b(answer|faq|question)\b/i.test(text)
    || (text.match(/\?/g) ?? []).length >= 2
  );
}

function hasClearEntityDefinition(page: CrawledPage): boolean {
  return (page.schemaMarkup ?? []).some((m) => {
    if (!m || typeof m !== 'object') return false;
    const obj = m as Record<string, unknown>;
    const type = obj['@type'];
    return (type === 'Organization' || type === 'Person' || type === 'Product')
      && typeof obj['name'] === 'string'
      && typeof obj['description'] === 'string';
  });
}

function classifySurfaceStatus(score: number): SurfaceScore['status'] {
  if (score >= 65) return 'visible';
  if (score >= 35) return 'partial';
  return 'absent';
}
