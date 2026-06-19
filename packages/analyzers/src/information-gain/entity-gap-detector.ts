import type { IGECohortPage, IGEEntityGap } from '@sitenexis/shared';

/**
 * Compares entities between cohort pages and the target page.
 *
 * Algorithm:
 * - Pool all entities from all cohort pages
 * - Deduplicate by normalized name (lowercase, trim)
 * - For each unique entity, count pages it appears in
 * - Universal: in >= 70% pages | Common: 30-69% | Rare: < 30%
 * - targetUniqueEntities: entities in target but in 0 cohort pages
 * - missingFromTarget: entities in >= 50% of cohort pages but NOT in target
 */
export function detectEntityGaps(
  cohortPages: IGECohortPage[],
  targetPage: IGECohortPage
): IGEEntityGap {
  const successfulCohort = cohortPages.filter((p) => p.crawlSuccess && p.url !== targetPage.url);
  const totalPages = successfulCohort.length;

  // Build entity -> page count map from cohort
  const entityPageCount = new Map<string, number>();
  const entityCanonicalName = new Map<string, string>();

  for (const page of successfulCohort) {
    const pageEntityKeys = new Set<string>();
    for (const entity of page.entities) {
      const key = normalizeEntityName(entity.name);
      if (!key) continue;
      if (!pageEntityKeys.has(key)) {
        pageEntityKeys.add(key);
        entityPageCount.set(key, (entityPageCount.get(key) ?? 0) + 1);
        if (!entityCanonicalName.has(key)) {
          entityCanonicalName.set(key, entity.name);
        }
      }
    }
  }

  // Build target entity set
  const targetEntityKeys = new Set<string>();
  for (const entity of targetPage.entities) {
    const key = normalizeEntityName(entity.name);
    if (key) targetEntityKeys.add(key);
  }

  // Classify cohort entities
  const universalEntities: string[] = [];
  const commonEntities: string[] = [];
  const rareEntities: string[] = [];
  const missingFromTarget: string[] = [];

  for (const [key, count] of entityPageCount.entries()) {
    const ratio = totalPages > 0 ? count / totalPages : 0;
    const canonicalName = entityCanonicalName.get(key) ?? key;
    const inTarget = targetEntityKeys.has(key);

    if (ratio >= 0.7) {
      universalEntities.push(canonicalName);
    } else if (ratio >= 0.3) {
      commonEntities.push(canonicalName);
    } else {
      rareEntities.push(canonicalName);
    }

    // Missing from target if in >= 50% of cohort pages but not in target
    if (ratio >= 0.5 && !inTarget) {
      missingFromTarget.push(canonicalName);
    }
  }

  // Target unique entities: in target but in 0 cohort pages
  const targetUniqueEntities: string[] = [];
  for (const entity of targetPage.entities) {
    const key = normalizeEntityName(entity.name);
    if (!key) continue;
    if (!entityPageCount.has(key)) {
      targetUniqueEntities.push(entity.name);
    }
  }

  return {
    universalEntities,
    commonEntities,
    rareEntities,
    targetUniqueEntities,
    missingFromTarget,
  };
}

function normalizeEntityName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}
