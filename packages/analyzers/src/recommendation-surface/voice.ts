import type { CrawledPage, SurfaceScore, SurfaceBlocker } from '@sitenexis/shared';

/**
 * Models voice assistant retrieval probability (CLAUDE.md §25 — Surface 3).
 *
 * Trigger conditions: Short, direct factual query matching a schema-defined claim.
 * Inclusion probability derived from:
 *   Schema Completeness       × 0.40
 *   + Speakable presence      × 0.30
 *   + Answer directness score × 0.30
 */
export function modelVoiceRetrieval(
  pages: CrawledPage[],
  schemaCompletenessScore: number,
): SurfaceScore {
  const blockers: SurfaceBlocker[] = [];

  const hasSpeakableSchema = pages.some(hasSpeakable);
  const hasLocalBusinessSchema = pages.some((p) => hasSchemaType(p, 'LocalBusiness'));
  const hasNapConsistency = checkNapConsistency(pages);
  const answerDirectnessScore = computeAnswerDirectnessScore(pages);

  // Base score from schema
  let inclusionScore = Math.round(
    schemaCompletenessScore * 0.40
    + (hasSpeakableSchema ? 100 : 0) * 0.30
    + answerDirectnessScore * 0.30,
  );

  if (!hasSpeakableSchema) {
    blockers.push({
      type: 'no_speakable_schema',
      description: 'No speakable schema detected — voice assistants cannot identify which content to read aloud.',
      recommendation: 'Add speakable schema (SpeakableSpecification) to key pages with direct factual statements.',
    });
  }

  if (hasLocalBusinessSchema && !hasNapConsistency) {
    inclusionScore = Math.round(inclusionScore * 0.85);
    blockers.push({
      type: 'inconsistent_nap',
      description: 'Name, Address, and Phone (NAP) data is inconsistent across schema markup.',
      recommendation: 'Standardise NAP data in LocalBusiness schema across all pages.',
    });
  }

  if (answerDirectnessScore < 40) {
    blockers.push({
      type: 'low_answer_directness',
      description: 'Content lacks short, directly speakable factual statements (under 30 words).',
      recommendation: 'Add concise factual summaries and key facts in sub-30-word sentences at the top of key pages.',
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

function hasSpeakable(page: CrawledPage): boolean {
  return (page.schemaMarkup ?? []).some((m) => {
    if (!m || typeof m !== 'object') return false;
    const obj = m as Record<string, unknown>;
    return 'speakable' in obj || obj['@type'] === 'SpeakableSpecification';
  });
}

function hasSchemaType(page: CrawledPage, type: string): boolean {
  return (page.schemaMarkup ?? []).some((m) => {
    if (!m || typeof m !== 'object') return false;
    const t = (m as Record<string, unknown>)['@type'];
    return t === type || (Array.isArray(t) && t.includes(type));
  });
}

function checkNapConsistency(pages: CrawledPage[]): boolean {
  const names = new Set<string>();
  const addresses = new Set<string>();

  for (const page of pages) {
    for (const m of page.schemaMarkup ?? []) {
      if (!m || typeof m !== 'object') continue;
      const obj = m as Record<string, unknown>;
      if (obj['@type'] === 'LocalBusiness' || obj['@type'] === 'Organization') {
        if (typeof obj['name'] === 'string') names.add(obj['name'].toLowerCase().trim());
        if (typeof obj['address'] === 'string') addresses.add(obj['address'].toLowerCase().trim());
      }
    }
  }

  return names.size <= 1 && addresses.size <= 1;
}

function computeAnswerDirectnessScore(pages: CrawledPage[]): number {
  let directAnswerCount = 0;

  for (const page of pages) {
    const sentences = (page.bodyText ?? '').match(/[^.!?]+[.!?]/g) ?? [];
    const shortDirectSentences = sentences.filter((s) => {
      const wordCount = s.trim().split(/\s+/).length;
      return wordCount >= 5 && wordCount <= 30 && !/\b(and|or|but|however|therefore)\b/i.test(s);
    });
    if (shortDirectSentences.length >= 3) directAnswerCount++;
  }

  return pages.length === 0 ? 0 : Math.round((directAnswerCount / pages.length) * 100);
}

function classifySurfaceStatus(score: number): SurfaceScore['status'] {
  if (score >= 65) return 'visible';
  if (score >= 35) return 'partial';
  return 'absent';
}
