import {
  type CrawledPage,
  type SchemaScore,
  type SchemaType,
  type SchemaIssue,
  type SchemaValidationResult,
  type SchemaPageAnalysis,
} from '@sitenexis/shared';
import { SCHEMA_RULES } from './rules';

const KNOWN_TYPES = new Set<SchemaType>(Object.keys(SCHEMA_RULES) as SchemaType[]);

// ─── Phase 1: Detection ───────────────────────────────────────────────────────

interface DetectedSchema {
  schemaType: SchemaType | string;
  source: 'json-ld' | 'microdata' | 'rdfa';
  data: Record<string, unknown>;
}

function detectJsonLd(schemaMarkup: unknown[]): DetectedSchema[] {
  const results: DetectedSchema[] = [];

  for (const raw of schemaMarkup) {
    if (typeof raw !== 'object' || raw === null) continue;
    const obj = raw as Record<string, unknown>;

    // Handle @graph arrays
    if (Array.isArray(obj['@graph'])) {
      for (const node of obj['@graph'] as unknown[]) {
        if (typeof node !== 'object' || node === null) continue;
        const nodeObj = node as Record<string, unknown>;
        const types = extractTypes(nodeObj);
        for (const t of types) {
          results.push({ schemaType: t, source: 'json-ld', data: nodeObj });
        }
      }
      continue;
    }

    const types = extractTypes(obj);
    for (const t of types) {
      results.push({ schemaType: t, source: 'json-ld', data: obj });
    }
  }

  return results;
}

/**
 * Detect microdata by scanning for itemtype/itemprop attributes in raw HTML.
 * Extracts the schema.org type from the itemtype URL, e.g.
 * itemtype="https://schema.org/Product" → "Product"
 */
function detectMicrodata(rawHtml: string): DetectedSchema[] {
  const results: DetectedSchema[] = [];
  const itemtypeRegex = /itemtype=["']https?:\/\/schema\.org\/([A-Za-z]+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = itemtypeRegex.exec(rawHtml)) !== null) {
    const schemaType = match[1];
    if (schemaType) {
      // Microdata is detected but not fully parsed here — we record the type
      // and leave full property extraction to Phase 2 validation.
      results.push({ schemaType, source: 'microdata', data: {} });
    }
  }

  return deduplicateByType(results);
}

/**
 * Detect RDFa by scanning for typeof/property attributes.
 * Extracts schema.org types from typeof="schema:Product" or typeof="Product".
 */
function detectRdfa(rawHtml: string): DetectedSchema[] {
  const results: DetectedSchema[] = [];
  // Match typeof="schema:Foo", typeof="http://schema.org/Foo", typeof="Foo"
  const typeofRegex = /typeof=["'](?:schema:)?([A-Za-z]+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = typeofRegex.exec(rawHtml)) !== null) {
    const schemaType = match[1];
    if (schemaType && schemaType !== 'undefined') {
      results.push({ schemaType, source: 'rdfa', data: {} });
    }
  }

  return deduplicateByType(results);
}

function extractTypes(obj: Record<string, unknown>): (SchemaType | string)[] {
  const raw = obj['@type'];
  if (!raw) return [];
  const types = Array.isArray(raw) ? raw : [raw];
  return types.filter((t): t is string => typeof t === 'string');
}

function deduplicateByType(schemas: DetectedSchema[]): DetectedSchema[] {
  const seen = new Set<string>();
  return schemas.filter((s) => {
    const key = `${s.source}:${s.schemaType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Phase 2: Validation ──────────────────────────────────────────────────────

function validateSchema(detected: DetectedSchema): SchemaValidationResult {
  const { schemaType, data } = detected;
  const rule = KNOWN_TYPES.has(schemaType as SchemaType)
    ? SCHEMA_RULES[schemaType as SchemaType]
    : null;

  if (!rule) {
    return {
      schemaType,
      isValid: true,
      missingRequiredFields: [],
      missingRecommendedFields: [],
      typeErrors: [],
      warningMessages: [`Schema type "${schemaType}" is not in the validated type list.`],
    };
  }

  const missingRequiredFields = rule.required.filter(
    (field) => data[field] === undefined || data[field] === null || data[field] === ''
  );

  const missingRecommendedFields = rule.recommended.filter(
    (field) => data[field] === undefined || data[field] === null || data[field] === ''
  );

  const typeErrors = checkFieldTypes(data, schemaType as SchemaType);
  const warningMessages = buildWarnings(schemaType, data, missingRecommendedFields);

  return {
    schemaType,
    isValid: missingRequiredFields.length === 0 && typeErrors.length === 0,
    missingRequiredFields,
    missingRecommendedFields,
    typeErrors,
    warningMessages,
  };
}

function checkFieldTypes(
  data: Record<string, unknown>,
  schemaType: SchemaType
): SchemaValidationResult['typeErrors'] {
  const errors: SchemaValidationResult['typeErrors'] = [];
  const rule = SCHEMA_RULES[schemaType];
  if (!rule?.fieldTypes) return errors;

  for (const [field, expectedType] of Object.entries(rule.fieldTypes)) {
    const value = data[field];
    if (value === undefined || value === null) continue;

    if (expectedType.startsWith('string') && typeof value !== 'string') {
      errors.push({ field, expected: expectedType, got: typeof value });
    } else if (expectedType.includes('[]') && !Array.isArray(value)) {
      errors.push({ field, expected: expectedType, got: typeof value });
    }
  }

  return errors;
}

function buildWarnings(
  schemaType: string,
  data: Record<string, unknown>,
  missingRecommended: string[]
): string[] {
  const warnings: string[] = [];

  // FAQPage: validate mainEntity structure
  if (schemaType === 'FAQPage' && Array.isArray(data['mainEntity'])) {
    const mainEntity = data['mainEntity'] as unknown[];
    const malformed = mainEntity.filter((q) => {
      const question = q as Record<string, unknown>;
      return !question['@type'] || !question['name'] || !question['acceptedAnswer'];
    });
    if (malformed.length > 0) {
      warnings.push(`${malformed.length} FAQ Question(s) missing required @type, name, or acceptedAnswer.`);
    }
  }

  // Product: validate offers structure
  if (schemaType === 'Product' && data['offers']) {
    const offers = data['offers'] as Record<string, unknown>;
    if (!offers['price'] && !offers['lowPrice']) {
      warnings.push('Offers object is missing price or lowPrice field.');
    }
    if (!offers['priceCurrency']) {
      warnings.push('Offers object is missing priceCurrency field.');
    }
    if (!offers['availability']) {
      warnings.push('Offers object is missing availability field.');
    }
  }

  // BreadcrumbList: validate itemListElement structure
  if (schemaType === 'BreadcrumbList' && Array.isArray(data['itemListElement'])) {
    const items = data['itemListElement'] as unknown[];
    const malformed = items.filter((item) => {
      const listItem = item as Record<string, unknown>;
      return !listItem['position'] || !listItem['name'];
    });
    if (malformed.length > 0) {
      warnings.push(`${malformed.length} BreadcrumbList item(s) missing position or name.`);
    }
  }

  if (missingRecommended.length > 0) {
    warnings.push(`Consider adding recommended fields: ${missingRecommended.slice(0, 4).join(', ')}.`);
  }

  return warnings;
}

// ─── Phase 3: Suggestions ─────────────────────────────────────────────────────

const FAQ_SIGNALS = ['faq', 'frequently asked', 'questions', 'q&a', 'q & a'];
const PRODUCT_SIGNALS = ['price', 'add to cart', 'buy now', 'in stock', '€', '$', '£', 'sku'];
const BLOG_SIGNALS = ['published', 'author', 'posted', 'written by', 'read time', 'min read'];

function suggestMissingSchemas(
  page: CrawledPage,
  detectedTypes: Set<string>
): SchemaType[] {
  const suggestions: SchemaType[] = [];
  const body = page.bodyText.toLowerCase();
  const url = page.url.toLowerCase();
  const isHomepage = isHomePageUrl(url);

  // Homepage: suggest Organization + WebSite if absent
  if (isHomepage) {
    if (!detectedTypes.has('Organization')) suggestions.push('Organization');
    if (!detectedTypes.has('WebSite')) suggestions.push('WebSite');
  }

  // Blog/article content
  if (
    BLOG_SIGNALS.some((s) => body.includes(s)) &&
    !detectedTypes.has('BlogPosting') &&
    !detectedTypes.has('Article')
  ) {
    suggestions.push('BlogPosting');
  }

  // Product page
  if (
    PRODUCT_SIGNALS.some((s) => body.includes(s)) &&
    !detectedTypes.has('Product')
  ) {
    suggestions.push('Product');
  }

  // FAQ content
  if (
    FAQ_SIGNALS.some((s) => body.includes(s)) &&
    !detectedTypes.has('FAQPage')
  ) {
    suggestions.push('FAQPage');
  }

  return suggestions;
}

function isHomePageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.pathname === '/' || u.pathname === '';
  } catch {
    return false;
  }
}

// ─── Phase 4: Auto-generation ─────────────────────────────────────────────────

/**
 * Generate a ready-to-paste JSON-LD `<script>` block for the given schema type.
 * Uses available page data to pre-fill as many fields as possible.
 *
 * @param type     - Schema.org type to generate (e.g. "Organization").
 * @param pageData - Partial CrawledPage to draw values from.
 */
export function generateSchemaSnippet(
  type: string,
  pageData: Partial<CrawledPage>
): string {
  const schema = buildSchemaObject(type, pageData);
  const json = JSON.stringify(schema, null, 2);
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

function buildSchemaObject(
  type: string,
  page: Partial<CrawledPage>
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': type,
  };

  switch (type) {
    case 'Organization':
      return {
        ...base,
        name: '[Your Organisation Name]',
        url: page.url ?? '[https://example.com]',
        logo: '[https://example.com/logo.png]',
        sameAs: ['[https://twitter.com/yourorg]', '[https://linkedin.com/company/yourorg]'],
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: '[+1-000-000-0000]',
          contactType: 'customer service',
        },
      };

    case 'WebSite':
      return {
        ...base,
        name: page.title ?? '[Site Name]',
        url: page.url ?? '[https://example.com]',
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${page.url ?? ''}?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      };

    case 'BlogPosting':
    case 'Article':
      return {
        ...base,
        headline: page.title ?? page.h1 ?? '[Article Title]',
        author: { '@type': 'Person', name: '[Author Name]' },
        datePublished: '[YYYY-MM-DD]',
        dateModified: '[YYYY-MM-DD]',
        image: '[https://example.com/article-image.jpg]',
        publisher: {
          '@type': 'Organization',
          name: '[Publisher Name]',
          logo: { '@type': 'ImageObject', url: '[https://example.com/logo.png]' },
        },
        description: page.metaDescription ?? '[Article description]',
      };

    case 'FAQPage':
      return {
        ...base,
        mainEntity: [
          {
            '@type': 'Question',
            name: '[Frequently asked question?]',
            acceptedAnswer: {
              '@type': 'Answer',
              text: '[Concise answer to the question.]',
            },
          },
        ],
      };

    case 'Product':
      return {
        ...base,
        name: page.title ?? '[Product Name]',
        description: page.metaDescription ?? '[Product description]',
        image: '[https://example.com/product-image.jpg]',
        sku: '[PRODUCT-SKU]',
        brand: { '@type': 'Brand', name: '[Brand Name]' },
        offers: {
          '@type': 'Offer',
          price: '[0.00]',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          url: page.url ?? '[https://example.com/product]',
        },
      };

    case 'BreadcrumbList':
      return {
        ...base,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: page.url?.split('/').slice(0, 3).join('/') ?? '[https://example.com]' },
          { '@type': 'ListItem', position: 2, name: page.title ?? '[Current Page]', item: page.url ?? '[https://example.com/page]' },
        ],
      };

    case 'LocalBusiness':
      return {
        ...base,
        name: '[Business Name]',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '[123 Main St]',
          addressLocality: '[City]',
          addressRegion: '[State]',
          postalCode: '[00000]',
          addressCountry: 'US',
        },
        telephone: '[+1-000-000-0000]',
        openingHours: ['Mo-Fr 09:00-17:00'],
        url: page.url ?? '[https://example.com]',
      };

    default:
      return { ...base, name: page.title ?? '[Title]' };
  }
}

// ─── Issue builder ────────────────────────────────────────────────────────────

function buildIssues(
  url: string,
  validationResults: SchemaValidationResult[],
  suggestedTypes: SchemaType[]
): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  for (const result of validationResults) {
    if (!result.isValid && result.missingRequiredFields.length > 0) {
      issues.push({
        severity: 'critical',
        url,
        schemaType: result.schemaType,
        message: `${result.schemaType} schema is missing required fields: ${result.missingRequiredFields.join(', ')}.`,
        missingFields: result.missingRequiredFields,
        recommendation: `Add the following required fields to your ${result.schemaType} schema: ${result.missingRequiredFields.join(', ')}.`,
      });
    }

    if (result.missingRecommendedFields.length > 0) {
      issues.push({
        severity: 'info',
        url,
        schemaType: result.schemaType,
        message: `${result.schemaType} schema is missing recommended fields: ${result.missingRecommendedFields.slice(0, 4).join(', ')}.`,
        missingFields: result.missingRecommendedFields,
        recommendation: `Consider adding recommended fields to improve AI discoverability: ${result.missingRecommendedFields.slice(0, 4).join(', ')}.`,
      });
    }

    for (const typeError of result.typeErrors) {
      issues.push({
        severity: 'warning',
        url,
        schemaType: result.schemaType,
        message: `Field "${typeError.field}" has wrong type: expected ${typeError.expected}, got ${typeError.got}.`,
        missingFields: [],
        recommendation: `Fix the type of field "${typeError.field}" to be ${typeError.expected}.`,
      });
    }
  }

  for (const suggestedType of suggestedTypes) {
    issues.push({
      severity: 'warning',
      url,
      schemaType: suggestedType,
      message: `No ${suggestedType} schema detected on this page, but content signals suggest it is appropriate.`,
      missingFields: [],
      recommendation: `Add ${suggestedType} JSON-LD schema to this page to improve machine readability and AI citation eligibility.`,
    });
  }

  return issues;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Analyse schema markup across all crawled pages.
 *
 * Runs 4 phases per page:
 *   1. Detection  — JSON-LD, microdata, RDFa
 *   2. Validation — required/recommended field checks + type error detection
 *   3. Suggestions — missing schema types inferred from page content signals
 *   4. Generation — ready-to-paste JSON-LD snippets for each suggestion
 *
 * @param pages   - Full crawl result.
 * @param rawHtml - Optional map of URL → raw HTML string for microdata/RDFa detection.
 *                  If omitted, only JSON-LD is detected.
 */
export function analyzeSchema(
  pages: CrawledPage[],
  rawHtml: Record<string, string> = {}
): SchemaScore {
  const allIssues: SchemaIssue[] = [];
  const siteWideTypes = new Set<SchemaType>();
  const pageAnalyses: SchemaPageAnalysis[] = [];
  let pagesWithSchema = 0;

  for (const page of pages) {
    const html = rawHtml[page.url] ?? '';

    // Phase 1: Detect
    const jsonLdSchemas = detectJsonLd(page.schemaMarkup);
    const microdataSchemas = html ? detectMicrodata(html) : [];
    const rdfaSchemas = html ? detectRdfa(html) : [];
    const allDetected = [...jsonLdSchemas, ...microdataSchemas, ...rdfaSchemas];

    const detectedTypeNames = allDetected.map((s) => s.schemaType);
    const detectedTypeSet = new Set(detectedTypeNames);

    if (allDetected.length > 0) pagesWithSchema++;

    // Track site-wide types (known types only)
    for (const t of detectedTypeNames) {
      if (KNOWN_TYPES.has(t as SchemaType)) {
        siteWideTypes.add(t as SchemaType);
      }
    }

    // Phase 2: Validate
    const validationResults = allDetected.map(validateSchema);

    // Phase 3: Suggest
    const suggestedTypes = suggestMissingSchemas(page, detectedTypeSet);

    // Phase 4: Generate snippets for suggestions
    const generatedSnippets: Record<string, string> = {};
    for (const suggestedType of suggestedTypes) {
      generatedSnippets[suggestedType] = generateSchemaSnippet(suggestedType, page);
    }

    // Build issues for this page
    const pageIssues = buildIssues(page.url, validationResults, suggestedTypes);
    allIssues.push(...pageIssues);

    pageAnalyses.push({
      url: page.url,
      detectedTypes: detectedTypeNames,
      validationResults,
      suggestedTypes,
      generatedSnippets,
    });
  }

  const coverage = pages.length > 0 ? Math.round((pagesWithSchema / pages.length) * 100) : 0;

  // Score formula: coverage (50pts) + type diversity (30pts) + validity (20pts)
  const coverageScore = Math.min(50, coverage * 0.5);
  const typeScore = Math.min(30, siteWideTypes.size * 5);
  const criticalIssues = allIssues.filter((i) => i.severity === 'critical').length;
  const validityScore = Math.max(0, 20 - criticalIssues * 3);

  return {
    score: Math.round(Math.min(100, coverageScore + typeScore + validityScore)),
    issues: allIssues,
    detectedTypes: Array.from(siteWideTypes),
    coverage,
    pageAnalyses,
  };
}
