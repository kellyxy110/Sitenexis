import type { CrawledPage, SyntheticPattern, EntityIntelligenceReport } from '@sitenexis/shared';

// ─── Schema manipulation pattern detection ────────────────────────────────────

/**
 * Detects schema markup patterns that misrepresent page content or exploit
 * structured data for AI visibility manipulation.
 */
export function detectSchemaManipulationPatterns(
  pages: CrawledPage[],
): SyntheticPattern[] {
  const patterns: SyntheticPattern[] = [];

  const schemaManipulationEvidence: string[] = [];
  let manipulationCount = 0;

  for (const page of pages) {
    for (const markup of page.schemaMarkup ?? []) {
      if (!markup || typeof markup !== 'object') continue;
      const obj = markup as Record<string, unknown>;

      // Aggregate rating without review content
      if (obj['aggregateRating'] && !hasReviewIndicators(page)) {
        manipulationCount++;
        schemaManipulationEvidence.push(
          `${page.url}: AggregateRating schema with no review content in body text.`,
        );
      }

      // Author entity not mentioned in body text
      const author = obj['author'];
      if (author && typeof author === 'object' && 'name' in author) {
        const authorName = String((author as Record<string, unknown>)['name'] ?? '');
        if (authorName && !page.bodyText?.toLowerCase().includes(authorName.toLowerCase())) {
          manipulationCount++;
          schemaManipulationEvidence.push(
            `${page.url}: Author "${authorName}" in schema not mentioned in body text.`,
          );
        }
      }

      // Speakable schema on pages with no short direct answers
      if ('speakable' in obj && !hasDirectAnswers(page)) {
        schemaManipulationEvidence.push(
          `${page.url}: Speakable schema present but no concise direct answers detected.`,
        );
      }
    }
  }

  if (manipulationCount > 0) {
    const confidence = Math.min(0.9, manipulationCount * 0.15);
    patterns.push({
      patternType: 'schema_manipulation',
      confidence: Math.round(confidence * 100) / 100,
      evidence: schemaManipulationEvidence.slice(0, 5),
      affectedEntities: [],
      severity: confidence > 0.5 ? 'warning' : 'info',
    });
  }

  return patterns;
}

// ─── Citation farming detection ───────────────────────────────────────────────

/**
 * Detects patterns consistent with manufacturing citation eligibility:
 * pages that cite only themselves, sudden fact injection, circular citation.
 */
export function detectCitationFarmingPatterns(
  pages: CrawledPage[],
): SyntheticPattern[] {
  const patterns: SyntheticPattern[] = [];

  // Check for pages that only link to other pages on the same domain
  const internalOnlyPages = pages.filter(
    (p) => p.internalLinks.length > 5 && (p.externalLinks ?? []).length === 0,
  );

  const internalOnlyRatio = pages.length > 0 ? internalOnlyPages.length / pages.length : 0;

  if (internalOnlyRatio > 0.8 && pages.length >= 5) {
    const confidence = Math.min(0.7, internalOnlyRatio * 0.8);
    patterns.push({
      patternType: 'citation_farming',
      confidence: Math.round(confidence * 100) / 100,
      evidence: [
        `${internalOnlyPages.length}/${pages.length} pages (${(internalOnlyRatio * 100).toFixed(0)}%) have no external links — all citations are self-referential.`,
      ],
      affectedEntities: [],
      severity: 'info',
    });
  }

  return patterns;
}

// ─── Fake entity pattern detection ───────────────────────────────────────────

/**
 * Detects entity patterns consistent with synthetic creation:
 * entities with no external presence, word-for-word identical attributes.
 */
export function detectFakeEntityPatterns(
  entityReport: EntityIntelligenceReport,
): SyntheticPattern[] {
  const patterns: SyntheticPattern[] = [];

  // Entities with zero external presence signals
  const zeroPresenceEntities = entityReport.entitiesDetected.filter(
    (e) => e.sameAsUrls.length === 0 && e.mentionCount < 2,
  );

  if (zeroPresenceEntities.length > entityReport.entitiesDetected.length * 0.7 && zeroPresenceEntities.length >= 3) {
    const confidence = Math.min(0.6, zeroPresenceEntities.length * 0.08);
    patterns.push({
      patternType: 'fake_entity',
      confidence: Math.round(confidence * 100) / 100,
      evidence: [
        `${zeroPresenceEntities.length} entities have no external validation links and fewer than 2 body-text mentions.`,
      ],
      affectedEntities: zeroPresenceEntities.slice(0, 5).map((e) => e.name),
      severity: confidence > 0.4 ? 'warning' : 'info',
    });
  }

  // Very high disambiguation score without external validation — may indicate manufactured clarity
  const highDisambiguationNoValidation = entityReport.entitiesDetected.filter(
    (e) => e.disambiguationScore > 90 && e.sameAsUrls.length === 0,
  );

  if (highDisambiguationNoValidation.length > 2) {
    patterns.push({
      patternType: 'fake_entity',
      confidence: 0.25,
      evidence: [
        `${highDisambiguationNoValidation.length} entities have high disambiguation scores (>90) but no external sameAs links — clarity without verifiability.`,
      ],
      affectedEntities: highDisambiguationNoValidation.slice(0, 3).map((e) => e.name),
      severity: 'info',
    });
  }

  return patterns;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasReviewIndicators(page: CrawledPage): boolean {
  const text = (page.bodyText ?? '').toLowerCase();
  return /\b(review|rating|stars?|out of \d|verified purchase|testimonial)\b/.test(text);
}

function hasDirectAnswers(page: CrawledPage): boolean {
  const sentences = (page.bodyText ?? '').match(/[^.!?]+[.!?]/g) ?? [];
  return sentences.some((s) => s.trim().split(/\s+/).length <= 30);
}
