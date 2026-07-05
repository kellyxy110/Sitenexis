// Schema Generator — extracts signals from crawled pages and generates JSON-LD.
// All generation is deterministic. No AI API calls.

import type { CrawledPage } from '@sitenexis/shared';

export interface OrgSignals {
  name: string | null;
  url: string;
  description: string | null;
  phone: string | null;
  address: string | null;
  logo: string | null;
  foundingYear: string | null;
  sameAsLinks: string[];
}

export interface FAQOpportunity {
  url: string;
  faqs: Array<{ question: string; answer: string }>;
}

export interface ServiceSignal {
  name: string;
  url: string;
  description: string;
}

// ── Signal extraction ─────────────────────────────────────────────────────────

export function extractOrgSignals(pages: CrawledPage[]): OrgSignals {
  const homepage = pages[0];
  if (!homepage) {
    return { name: null, url: '', description: null, phone: null, address: null, logo: null, foundingYear: null, sameAsLinks: [] };
  }

  // Try schema first — it's the most reliable source
  for (const page of pages) {
    for (const s of page.schemaMarkup) {
      if (typeof s !== 'object' || s === null) continue;
      const schema = s as Record<string, unknown>;
      const type = schema['@type'];
      if (type === 'Organization' || type === 'LocalBusiness' || type === 'Corporation' || type === 'ProfessionalService') {
        return {
          name: typeof schema['name'] === 'string' ? schema['name'] : null,
          url: typeof schema['url'] === 'string' ? schema['url'] : homepage.url,
          description: typeof schema['description'] === 'string' ? schema['description'] : null,
          phone: typeof schema['telephone'] === 'string' ? schema['telephone'] : null,
          address: parseAddressString(schema['address']),
          logo: parseLogoUrl(schema['logo']),
          foundingYear: typeof schema['foundingDate'] === 'string' ? schema['foundingDate'].slice(0, 4) : null,
          sameAsLinks: parseSameAs(schema['sameAs']),
        };
      }
    }
  }

  // Fallback: derive from page title/meta
  const name = homepage.title
    ? homepage.title.replace(/\s*[-–—|·]\s*.+$/, '').trim() || null
    : null;

  return {
    name,
    url: homepage.url,
    description: homepage.metaDescription ?? null,
    phone: null,
    address: null,
    logo: null,
    foundingYear: null,
    sameAsLinks: [],
  };
}

function parseAddressString(address: unknown): string | null {
  if (typeof address === 'string') return address;
  if (typeof address !== 'object' || address === null) return null;
  const a = address as Record<string, unknown>;
  return [a['streetAddress'], a['addressLocality'], a['addressRegion'], a['postalCode'], a['addressCountry']]
    .filter((p): p is string => typeof p === 'string')
    .join(', ') || null;
}

function parseLogoUrl(logo: unknown): string | null {
  if (typeof logo === 'string') return logo;
  if (typeof logo !== 'object' || logo === null) return null;
  const l = logo as Record<string, unknown>;
  return typeof l['url'] === 'string' ? l['url'] : null;
}

function parseSameAs(sameAs: unknown): string[] {
  if (typeof sameAs === 'string') return [sameAs];
  if (Array.isArray(sameAs)) return sameAs.filter((s): s is string => typeof s === 'string');
  return [];
}

export function detectServicePages(pages: CrawledPage[]): ServiceSignal[] {
  const indicator = /\b(services?|solutions?|products?|packages?|plans?|offerings?|what we do)\b/i;
  return pages
    .filter((p) => indicator.test(p.title ?? '') || indicator.test(p.h1 ?? '') || indicator.test(p.url))
    .map((p) => ({
      name: p.h1 ?? p.title ?? 'Service',
      url: p.url,
      description: p.metaDescription ?? p.bodyText.slice(0, 160).trim(),
    }))
    .slice(0, 5);
}

// ── FAQ detection ─────────────────────────────────────────────────────────────

const QUESTION_START = /^(how|what|why|when|where|can|do|is|are|which|who|should|does|will|have|has)\b/i;

export function detectFAQOpportunities(pages: CrawledPage[]): FAQOpportunity[] {
  const opportunities: FAQOpportunity[] = [];

  for (const page of pages) {
    const faqs: Array<{ question: string; answer: string }> = [];

    // Look for question-style headings
    for (const heading of page.headings) {
      const t = heading.text.trim();
      if (!QUESTION_START.test(t) && !t.endsWith('?')) continue;

      const question = t.endsWith('?') ? t : `${t}?`;
      const bodyIdx = page.bodyText.indexOf(heading.text);
      const answerRaw = bodyIdx !== -1
        ? page.bodyText.slice(bodyIdx + heading.text.length, bodyIdx + heading.text.length + 400)
        : '';
      const answer = answerRaw.replace(/\s+/g, ' ').trim().slice(0, 250);

      if (answer.length > 20 && faqs.length < 8) {
        faqs.push({ question, answer });
      }
    }

    // Pull existing FAQPage schema data too
    for (const s of page.schemaMarkup) {
      if (typeof s !== 'object' || s === null) continue;
      const schema = s as Record<string, unknown>;
      if (schema['@type'] === 'FAQPage' && Array.isArray(schema['mainEntity'])) {
        for (const item of schema['mainEntity'] as Record<string, unknown>[]) {
          const q = item['name'] as string | undefined;
          const aObj = item['acceptedAnswer'] as Record<string, unknown> | undefined;
          const a = aObj?.['text'] as string | undefined;
          if (q && a && faqs.length < 8) faqs.push({ question: q, answer: a });
        }
      }
    }

    if (faqs.length >= 2) {
      opportunities.push({ url: page.url, faqs });
    }
  }

  return opportunities;
}

// ── Schema code generation ────────────────────────────────────────────────────

export function generateOrganizationSchema(signals: OrgSignals, domain: string): string {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    'name': signals.name ?? domain,
    'url': signals.url || `https://${domain}`,
  };

  if (signals.description) schema['description'] = signals.description;
  if (signals.phone) schema['telephone'] = signals.phone;
  if (signals.foundingYear) schema['foundingDate'] = signals.foundingYear;

  if (signals.logo) {
    schema['logo'] = { '@type': 'ImageObject', 'url': signals.logo };
  }

  if (signals.address) {
    schema['address'] = { '@type': 'PostalAddress', 'streetAddress': signals.address };
  }

  const safeSlug = (signals.name ?? domain).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  schema['sameAs'] = signals.sameAsLinks.length > 0
    ? signals.sameAsLinks
    : [
        `https://en.wikipedia.org/wiki/${encodeURIComponent((signals.name ?? domain).replace(/\s+/g, '_'))}`,
        `https://www.linkedin.com/company/${safeSlug}`,
        `https://www.wikidata.org/wiki/Q_REPLACE_WITH_QNUMBER`,
      ];

  return JSON.stringify(schema, null, 2);
}

export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': faqs.map(({ question, answer }) => ({
      '@type': 'Question',
      'name': question,
      'acceptedAnswer': { '@type': 'Answer', 'text': answer },
    })),
  };
  return JSON.stringify(schema, null, 2);
}

export function generateServiceSchema(
  name: string,
  description: string,
  url: string,
  providerName: string,
): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    'name': name,
    'description': description,
    'url': url,
    'provider': { '@type': 'Organization', 'name': providerName },
  };
  return JSON.stringify(schema, null, 2);
}

export function generateBreadcrumbSchema(pageUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(pageUrl.startsWith('http') ? pageUrl : `https://${pageUrl}`);
  } catch {
    return '';
  }

  const pathParts = parsed.pathname.split('/').filter(Boolean);
  const items: Array<{ position: number; name: string; item: string }> = [
    { position: 1, name: 'Home', item: `https://${parsed.hostname}/` },
  ];

  let cumulativePath = `https://${parsed.hostname}`;
  for (let i = 0; i < pathParts.length; i++) {
    cumulativePath += `/${pathParts[i]}`;
    const name = (pathParts[i] ?? '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    items.push({ position: i + 2, name, item: `${cumulativePath}/` });
  }

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': items.map((item) => ({
      '@type': 'ListItem',
      'position': item.position,
      'name': item.name,
      'item': item.item,
    })),
  };
  return JSON.stringify(schema, null, 2);
}

export function generatePersonSchema(
  name: string,
  jobTitle: string,
  url: string,
  orgName: string,
): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    'name': name,
    'jobTitle': jobTitle,
    'url': url,
    'worksFor': { '@type': 'Organization', 'name': orgName },
  };
  return JSON.stringify(schema, null, 2);
}

export function generateWebSiteSchema(domain: string, name: string, description: string): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': name,
    'url': `https://${domain}`,
    'description': description,
    'potentialAction': {
      '@type': 'SearchAction',
      'target': {
        '@type': 'EntryPoint',
        'urlTemplate': `https://${domain}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
  return JSON.stringify(schema, null, 2);
}
