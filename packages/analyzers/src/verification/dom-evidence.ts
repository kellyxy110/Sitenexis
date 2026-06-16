import type { CrawledPage, EvidenceReference } from '@sitenexis/shared';

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Returns true if the crawl snapshot is older than 24 hours. */
export function isStaleSnapshot(page: CrawledPage): boolean {
  return Date.now() - new Date(page.crawledAt).getTime() > STALE_THRESHOLD_MS;
}

// ── Direct DOM attribute extraction ──────────────────────────────────────────
// Each function below extracts evidence from a specific DOM signal.
// These are the highest-confidence sources (always direct, never inferred).

export function titleEvidence(page: CrawledPage): EvidenceReference {
  return {
    sourceType: 'dom_element',
    pageUrl: page.url,
    cssSelector: 'head > title',
    exactValue: page.title ?? '',
    htmlSnippet: page.title
      ? `<title>${page.title.slice(0, 120)}</title>`
      : '<!-- <title> element not found -->',
    observedAt: page.crawledAt,
  };
}

export function metaDescriptionEvidence(page: CrawledPage): EvidenceReference {
  return {
    sourceType: 'meta_tag',
    pageUrl: page.url,
    cssSelector: 'head > meta[name="description"]',
    exactValue: page.metaDescription ?? '',
    htmlSnippet: page.metaDescription
      ? `<meta name="description" content="${page.metaDescription.slice(0, 160)}">`
      : '<!-- meta[name="description"] not found -->',
    observedAt: page.crawledAt,
  };
}

export function canonicalEvidence(page: CrawledPage): EvidenceReference {
  return {
    sourceType: 'link_element',
    pageUrl: page.url,
    cssSelector: 'head > link[rel="canonical"]',
    exactValue: page.canonicalUrl ?? '',
    htmlSnippet: page.canonicalUrl
      ? `<link rel="canonical" href="${page.canonicalUrl}">`
      : '<!-- link[rel="canonical"] not found -->',
    observedAt: page.crawledAt,
  };
}

export function h1Evidence(page: CrawledPage): EvidenceReference {
  return {
    sourceType: 'heading',
    pageUrl: page.url,
    cssSelector: 'h1',
    exactValue: page.h1 ?? '',
    htmlSnippet: page.h1
      ? `<h1>${page.h1.slice(0, 100)}</h1>`
      : '<!-- <h1> not found -->',
    observedAt: page.crawledAt,
  };
}

export function robotsEvidence(page: CrawledPage): EvidenceReference {
  return {
    sourceType: 'meta_tag',
    pageUrl: page.url,
    cssSelector: 'head > meta[name="robots"]',
    exactValue: page.robotsDirectives.join(', ') || 'not set',
    htmlSnippet: page.robotsDirectives.length > 0
      ? `<meta name="robots" content="${page.robotsDirectives.join(', ')}">`
      : '<!-- meta[name="robots"] not found -->',
    observedAt: page.crawledAt,
  };
}

export function redirectChainEvidence(page: CrawledPage): EvidenceReference {
  return {
    sourceType: 'http_header',
    pageUrl: page.url,
    exactValue: page.redirectChain.length > 0
      ? page.redirectChain.join(' → ')
      : 'no redirects',
    observedAt: page.crawledAt,
  };
}

export function wordCountEvidence(page: CrawledPage): EvidenceReference {
  return {
    sourceType: 'body_text',
    pageUrl: page.url,
    exactValue: `${page.wordCount} words`,
    observedAt: page.crawledAt,
  };
}

export function imageAltEvidence(
  page: CrawledPage,
  maxImages = 3,
): EvidenceReference[] {
  return page.images
    .filter((img) => !img.alt)
    .slice(0, maxImages)
    .map((img) => ({
      sourceType: 'dom_element' as const,
      pageUrl: page.url,
      cssSelector: `img[src="${img.src.slice(0, 80)}"]`,
      exactValue: img.src,
      htmlSnippet: `<img src="${img.src.slice(0, 80)}" alt="">`,
      observedAt: page.crawledAt,
    }));
}

// ── Schema JSON-LD evidence ───────────────────────────────────────────────────

function asSchemaObject(s: unknown): Record<string, unknown> | null {
  if (typeof s === 'object' && s !== null && !Array.isArray(s)) {
    return s as Record<string, unknown>;
  }
  return null;
}

/** Returns JSON-LD evidence for a given schema @type, or null if not present. */
export function schemaTypeEvidence(
  page: CrawledPage,
  schemaType: string,
): EvidenceReference | null {
  const schema = page.schemaMarkup
    .map(asSchemaObject)
    .find((s) => s?.['@type'] === schemaType);

  if (!schema) return null;

  const snippet = JSON.stringify(schema, null, 2).slice(0, 200);
  return {
    sourceType: 'schema_jsonld',
    pageUrl: page.url,
    cssSelector: 'script[type="application/ld+json"]',
    exactValue: JSON.stringify(schema).slice(0, 300),
    htmlSnippet: `<script type="application/ld+json">\n${snippet}\n</script>`,
    observedAt: page.crawledAt,
  };
}

/** Returns evidence if a string value appears in any JSON-LD schema on the page. */
export function schemaValueEvidence(
  page: CrawledPage,
  value: string,
): EvidenceReference | null {
  const schemaJson = JSON.stringify(page.schemaMarkup);
  if (!schemaJson.toLowerCase().includes(value.toLowerCase())) return null;

  return {
    sourceType: 'schema_jsonld',
    pageUrl: page.url,
    cssSelector: 'script[type="application/ld+json"]',
    exactValue: value,
    observedAt: page.crawledAt,
  };
}

/**
 * Cross-validates a schema field value against visible DOM content.
 * Returns { schemaValue, domValue, agrees } — used for source reliability scoring.
 */
export function crossValidateSchemaToDom(
  page: CrawledPage,
  schemaType: string,
  schemaField: string,
): { schemaValue: string; domValue: string; agrees: boolean } | null {
  const schema = page.schemaMarkup
    .map(asSchemaObject)
    .find((s) => s?.['@type'] === schemaType);

  if (!schema) return null;

  const schemaValue = String(schema[schemaField] ?? '').trim();
  if (!schemaValue) return null;

  const domValue = (page.title ?? '').trim();
  const agrees =
    domValue.toLowerCase().includes(schemaValue.toLowerCase()) ||
    schemaValue.toLowerCase().includes(domValue.toLowerCase());

  return { schemaValue, domValue, agrees };
}

// ── Body text + heading evidence ──────────────────────────────────────────────

/**
 * Returns evidence if the value appears in the page's visible body text.
 * Includes a ±40 character snippet around the match.
 */
export function bodyTextEvidence(
  page: CrawledPage,
  value: string,
): EvidenceReference | null {
  const lowerBody = page.bodyText.toLowerCase();
  const lowerValue = value.toLowerCase();
  const idx = lowerBody.indexOf(lowerValue);
  if (idx === -1) return null;

  const snippet = page.bodyText
    .slice(Math.max(0, idx - 40), idx + value.length + 40)
    .replace(/\s+/g, ' ')
    .trim();

  return {
    sourceType: 'body_text',
    pageUrl: page.url,
    exactValue: page.bodyText.slice(idx, idx + value.length),
    htmlSnippet: `...${snippet}...`,
    observedAt: page.crawledAt,
  };
}

/**
 * Returns evidence if the value appears in any heading on the page.
 * Reports the specific heading tag and text.
 */
export function headingEvidence(
  page: CrawledPage,
  value: string,
): EvidenceReference | null {
  const match = page.headings.find((h) =>
    h.text.toLowerCase().includes(value.toLowerCase()),
  );
  if (!match) return null;

  return {
    sourceType: 'heading',
    pageUrl: page.url,
    cssSelector: `h${match.level}`,
    exactValue: match.text,
    htmlSnippet: `<h${match.level}>${match.text.slice(0, 100)}</h${match.level}>`,
    observedAt: page.crawledAt,
  };
}

/**
 * Counts how many independent source types contain a given value across
 * one or more pages. Used to compute extraction consistency.
 */
export function countEvidenceSources(
  value: string,
  pages: CrawledPage[],
): {
  inBodyText: number;
  inHeadings: number;
  inSchema: number;
  conflictDetected: boolean;
} {
  let inBodyText = 0;
  let inHeadings = 0;
  let inSchema = 0;
  let conflictDetected = false;

  for (const page of pages) {
    if (bodyTextEvidence(page, value)) inBodyText++;
    if (headingEvidence(page, value)) inHeadings++;
    if (schemaValueEvidence(page, value)) inSchema++;
  }

  // Conflict: value appears in schema but not in any body text or heading
  if (inSchema > 0 && inBodyText === 0 && inHeadings === 0) {
    conflictDetected = true;
  }

  return { inBodyText, inHeadings, inSchema, conflictDetected };
}
