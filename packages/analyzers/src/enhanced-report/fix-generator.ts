// Fix Generator — deterministic HTML/meta/copy fixes for each issue type.
// All output is ready to paste; placeholders are capitalized and bracket-wrapped.

import type { CrawledPage } from '@sitenexis/shared';

// ── Meta description ──────────────────────────────────────────────────────────

export function generateMetaDescription(page: CrawledPage): string {
  // Build a description from title + first substantive sentence of body text
  const base = page.bodyText.replace(/\s+/g, ' ').trim();
  const firstSentence = base.match(/[^.!?]{20,}[.!?]/)?.[0] ?? base.slice(0, 120);
  const cleaned = firstSentence.replace(/<[^>]+>/g, '').trim().slice(0, 150);

  const description = cleaned.length > 30
    ? cleaned
    : `${page.title ?? '[PAGE TITLE]'} — learn more on our website.`;

  return `<meta name="description" content="${escapeAttr(description)}">`;
}

// ── Canonical tag ─────────────────────────────────────────────────────────────

export function generateCanonicalTag(url: string): string {
  return `<link rel="canonical" href="${escapeAttr(url)}">`;
}

// ── Open Graph tags ───────────────────────────────────────────────────────────

export function generateOGTags(page: CrawledPage, domain: string): string {
  const title = page.title ?? '[PAGE TITLE]';
  const description = (page.metaDescription ?? page.bodyText.slice(0, 155).replace(/\s+/g, ' ').trim()) || '[PAGE DESCRIPTION]';
  const url = page.url;
  const image = page.images.find((img) => img.src && !img.src.includes('icon') && !img.src.includes('logo'))?.src
    ?? `https://${domain}/og-image.jpg`;

  return [
    `<meta property="og:title" content="${escapeAttr(title)}">`,
    `<meta property="og:description" content="${escapeAttr(description.slice(0, 155))}">`,
    `<meta property="og:url" content="${escapeAttr(url)}">`,
    `<meta property="og:image" content="${escapeAttr(image)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escapeAttr(domain)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttr(title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(description.slice(0, 155))}">`,
    `<meta name="twitter:image" content="${escapeAttr(image)}">`,
  ].join('\n');
}

// ── Alt text ─────────────────────────────────────────────────────────────────

export function generateAltTextSuggestion(imageSrc: string, pageTitle: string | null): string {
  // Derive from filename
  const filename = imageSrc.split('/').pop()?.split('?')[0] ?? '';
  const nameFromFile = filename
    .replace(/\.[a-z]{2,4}$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

  if (nameFromFile.length > 3) {
    return nameFromFile.length > 100 ? nameFromFile.slice(0, 100) : nameFromFile;
  }

  return pageTitle ? `Image related to ${pageTitle}` : 'Descriptive alt text required';
}

export function generateAltTextHTML(src: string, alt: string): string {
  return `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}">`;
}

// ── Title tag ─────────────────────────────────────────────────────────────────

export function generateTitleTag(page: CrawledPage, siteName: string): string {
  const topic = page.h1 ?? page.metaDescription?.slice(0, 40) ?? 'Page';
  const title = `${topic.slice(0, 50)} | ${siteName}`;
  return `<title>${escapeHtml(title)}</title>`;
}

// ── H1 tag ────────────────────────────────────────────────────────────────────

export function generateH1Tag(page: CrawledPage): string {
  const candidate = page.title?.replace(/\s*[-|–]\s*.+$/, '').trim()
    ?? page.metaDescription?.split('.')[0]?.trim()
    ?? '[Primary Page Topic]';
  return `<h1>${escapeHtml(candidate.slice(0, 80))}</h1>`;
}

// ── Robots.txt ────────────────────────────────────────────────────────────────

export function generateRobotsTxt(domain: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    '',
    '# Block admin and utility paths',
    'Disallow: /wp-admin/',
    'Disallow: /wp-login.php',
    'Disallow: /api/',
    'Disallow: /admin/',
    '',
    `Sitemap: https://${domain}/sitemap.xml`,
  ].join('\n');
}

// ── Sitemap entry ─────────────────────────────────────────────────────────────

export function generateSitemapEntry(url: string, priority: number = 0.8): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    '  <url>',
    `    <loc>${escapeHtml(url)}</loc>`,
    `    <lastmod>${today}</lastmod>`,
    `    <changefreq>monthly</changefreq>`,
    `    <priority>${priority.toFixed(1)}</priority>`,
    '  </url>',
  ].join('\n');
}

export function generateSitemapXml(urls: string[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.slice(0, 50).map((u, i) => generateSitemapEntry(u, i === 0 ? 1.0 : 0.8)),
    '</urlset>',
  ].join('\n');
}

// ── Speakable schema ──────────────────────────────────────────────────────────

export function generateSpeakableSchema(pageUrl: string, cssSelectors: string[]): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    'name': '[PAGE TITLE]',
    'url': pageUrl,
    'speakable': {
      '@type': 'SpeakableSpecification',
      'cssSelector': cssSelectors.length > 0 ? cssSelectors : ['h1', '.summary', '.faq-answer', 'article p:first-of-type'],
    },
  };
  return JSON.stringify(schema, null, 2);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
