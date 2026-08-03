export interface AuditEvidenceSummary {
  domain: string;
  pageCount: number;
  homepage: {
    url: string;
    statusCode: number;
    isIndexable: boolean;
    robotsDirective: string | null;
    canonicalUrl: string | null;
    canonicalValidity: string | null;
    h1: string | null;
    schemaTypesDetected: string[];
  } | null;
  indexability: {
    indexablePages: number;
    nonIndexablePages: number;
  };
  schemaCoverage: {
    pagesWithSchema: number;
    pagesWithoutSchema: number;
    distinctSchemaTypes: string[];
  };
  canonicalIssues: {
    missingCanonical: number;
    invalidCanonical: number;
  };
  entities: {
    count: number;
    primaryEntityName: string | null;
    sameAsLinksCount: number;
  };
}

/**
 * Compact, evidence-only summary from canonical crawl data — never a
 * negative inference from missing data (a page with no schemaData is
 * counted as "without schema", never treated as evidence of anything
 * beyond that). Used by Telegram's /evidence command.
 */
export async function getAuditEvidenceSummary(auditId: string): Promise<AuditEvidenceSummary | null> {
  const { getAuditById, getPagesByAudit, getEntitiesByAudit } = await import('@sitenexis/db');

  const audit = await getAuditById(auditId);
  if (!audit) return null;

  const [pages, entities] = await Promise.all([
    getPagesByAudit(auditId).catch(() => []),
    getEntitiesByAudit(auditId).catch(() => [] as Array<{ name: string; sameAsUrls: string[] }>),
  ]);

  const home = pages.find((p) => {
    try {
      const u = new URL(p.url);
      return u.pathname === '/' || u.pathname === '';
    } catch {
      return false;
    }
  }) ?? pages[0] ?? null;

  const schemaTypesOf = (p: { schemaData: unknown }): string[] => {
    const raw = p.schemaData;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry) => (entry && typeof entry === 'object' && '@type' in entry ? String((entry as Record<string, unknown>)['@type']) : null))
      .filter((t): t is string => !!t);
  };

  const distinctSchemaTypes = new Set<string>();
  let pagesWithSchema = 0;
  let missingCanonical = 0;
  let invalidCanonical = 0;
  let indexablePages = 0;

  for (const p of pages) {
    const types = schemaTypesOf(p);
    if (types.length > 0) {
      pagesWithSchema++;
      types.forEach((t) => distinctSchemaTypes.add(t));
    }
    if (!p.canonicalUrl) missingCanonical++;
    else if (p.canonicalValidity && p.canonicalValidity !== 'valid') invalidCanonical++;
    if (p.isIndexable) indexablePages++;
  }

  return {
    domain: audit.domain,
    pageCount: pages.length,
    homepage: home ? {
      url: home.url,
      statusCode: home.statusCode,
      isIndexable: home.isIndexable,
      robotsDirective: home.robotsDirective,
      canonicalUrl: home.canonicalUrl,
      canonicalValidity: home.canonicalValidity,
      h1: home.h1,
      schemaTypesDetected: schemaTypesOf(home),
    } : null,
    indexability: {
      indexablePages,
      nonIndexablePages: pages.length - indexablePages,
    },
    schemaCoverage: {
      pagesWithSchema,
      pagesWithoutSchema: pages.length - pagesWithSchema,
      distinctSchemaTypes: [...distinctSchemaTypes],
    },
    canonicalIssues: { missingCanonical, invalidCanonical },
    entities: {
      count: entities.length,
      primaryEntityName: entities[0]?.name ?? null,
      sameAsLinksCount: entities.reduce((s, e) => s + (e.sameAsUrls?.length ?? 0), 0),
    },
  };
}
