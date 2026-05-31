import type { CrawledPage, EntityIntelligenceReport, TrustIssue } from '@sitenexis/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  score: number;
  issues: TrustIssue[];
  crossSourceValidationIndex: number;
  validatedClaimsCount: number;
  unvalidatedClaimsCount: number;
}

// ─── External validation signal analysis ─────────────────────────────────────

/**
 * Analyses external validation signals — sameAs links, external source
 * consistency, and absence of contradicting external claims.
 *
 * NOTE: HEAD requests to sameAs URLs are made by the agent (10s timeout,
 * 5 concurrent max). This module processes the crawl data synchronously
 * without making external HTTP calls.
 */
export function analyseExternalValidation(
  pages: CrawledPage[],
  entityReport: EntityIntelligenceReport,
): ValidationResult {
  const issues: TrustIssue[] = [];

  const primaryEntity = entityReport.primaryEntity;
  const sameAsUrls = primaryEntity?.sameAsUrls ?? [];

  // Count validatable claims (claims with sameAs or external link backing)
  const allExternalLinks = new Set(pages.flatMap((p) => p.externalLinks ?? []));
  // Classify external links as validating or not
  const validatingDomains = new Set<string>();
  const knownAuthorityDomains = [
    'wikipedia.org', 'wikidata.org', 'linkedin.com', 'crunchbase.com',
    'bloomberg.com', 'reuters.com', 'forbes.com', 'gov', 'edu',
  ];

  for (const link of allExternalLinks) {
    try {
      const hostname = new URL(link).hostname.replace(/^www\./, '');
      if (knownAuthorityDomains.some((d) => hostname.endsWith(d))) {
        validatingDomains.add(hostname);
      }
    } catch {
      // ignore malformed URLs
    }
  }

  const sameAsCount = sameAsUrls.length;
  const authorityLinkCount = validatingDomains.size;
  const validatedClaimsCount = sameAsCount + authorityLinkCount;

  // Cross-source validation index: ratio of claims that have external backing
  const totalEntityCount = entityReport.entitiesDetected.length || 1;
  const crossSourceValidationIndex = Math.min(1,
    Math.round((validatedClaimsCount / totalEntityCount) * 100) / 100,
  );

  // Issues for low external validation
  if (sameAsCount === 0 && primaryEntity) {
    issues.push({
      type: 'no_same_as_links',
      severity: 'warning',
      entity: primaryEntity.name,
      description: 'No sameAs links found — AI systems cannot cross-validate this entity against external knowledge bases.',
      recommendation: 'Add sameAs links to Wikipedia, Wikidata, or official government/industry registries in your schema markup.',
    });
  } else if (sameAsCount < 2 && primaryEntity) {
    issues.push({
      type: 'insufficient_same_as_links',
      severity: 'info',
      entity: primaryEntity.name,
      description: `Only ${sameAsCount} sameAs link(s) found — limited external cross-validation for this entity.`,
      recommendation: 'Add more sameAs links to improve entity disambiguation and external trust validation.',
    });
  }

  if (authorityLinkCount === 0) {
    issues.push({
      type: 'no_authority_external_links',
      severity: 'warning',
      entity: primaryEntity?.name ?? 'site',
      description: 'No external links to authoritative sources detected — factual claims cannot be externally verified.',
      recommendation: 'Link to authoritative external sources (Wikipedia, official registries, industry bodies) to validate factual claims.',
    });
  }

  // Score calculation
  let score = 0;
  score += Math.min(sameAsCount * 15, 45);
  score += Math.min(authorityLinkCount * 10, 30);
  score += crossSourceValidationIndex * 25;

  const unvalidatedClaimsCount = Math.max(0, totalEntityCount - validatedClaimsCount);

  return {
    score: Math.round(Math.min(100, score)),
    issues,
    crossSourceValidationIndex,
    validatedClaimsCount,
    unvalidatedClaimsCount,
  };
}
