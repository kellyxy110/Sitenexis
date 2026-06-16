// Semantic extraction: chunks, entities, relationships
// Called by crawler.ts after HTML parsing — output fed to Layer 2+ agents

import * as cheerio from 'cheerio';
import type { LinkPosition, LinkRef, ExternalLinkMeta } from '@sitenexis/shared';

// ─── Link ref extraction ──────────────────────────────────────────────────────

const HIGH_AUTHORITY_DOMAINS = new Set([
  'wikipedia.org', 'github.com', 'linkedin.com', 'youtube.com',
  'scholar.google.com', 'researchgate.net', 'ncbi.nlm.nih.gov',
]);

function positionFromParents($el: ReturnType<ReturnType<typeof cheerio.load>>): LinkPosition {
  const ancestors = $el.parents().toArray();
  for (const node of ancestors) {
    const raw = node as { tagName?: string; attribs?: Record<string, string> };
    const tag = (raw.tagName ?? '').toLowerCase();
    const cls = (raw.attribs?.['class'] ?? '').toLowerCase();
    const role = (raw.attribs?.['role'] ?? '').toLowerCase();

    if (tag === 'nav' || role === 'navigation' || /\b(nav|navbar|navigation|menu)\b/.test(cls)) return 'nav';
    if (tag === 'header' || /\bheader\b/.test(cls)) return 'nav';
    if (tag === 'footer' || role === 'contentinfo' || /\bfooter\b/.test(cls)) return 'footer';
    if (tag === 'aside' || role === 'complementary' || /\b(sidebar|side-nav|side_nav)\b/.test(cls)) return 'sidebar';
  }
  return 'body';
}

function isSameDomainExtractor(url: string, domain: string): boolean {
  try {
    const urlHost = new URL(url).hostname;
    const domainHost = new URL(domain).hostname;
    return urlHost === domainHost || urlHost.endsWith(`.${domainHost}`);
  } catch { return false; }
}

function normalizeUrlExtractor(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    const path = u.pathname.replace(/\/$/, '') || '/';
    return `${u.protocol}//${u.hostname}${path}${u.search}`;
  } catch { return url; }
}

function computeExternalAuthorityScore(hostCounts: Map<string, number>): number {
  if (hostCounts.size === 0) return 0;
  const total = [...hostCounts.values()].reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  let highAuth = 0;
  for (const [host, count] of hostCounts) {
    const tld = host.split('.').slice(-2).join('.');
    if (
      HIGH_AUTHORITY_DOMAINS.has(host) ||
      host.endsWith('.gov') || host.endsWith('.edu') ||
      tld.endsWith('.gov') || tld.endsWith('.edu')
    ) highAuth += count;
  }
  return Math.round((highAuth / total) * 100);
}

/**
 * Extracts rich link refs from raw HTML.
 * Populates internalLinkRefs (with anchor text + DOM position) and externalLinkMeta.
 * Called from parseHtml in crawler.ts — produces the parallel internalLinkRefs field.
 */
export function extractLinkRefs(
  html: string,
  pageUrl: string,
  domain: string,
): { internalLinkRefs: LinkRef[]; externalLinkMeta: ExternalLinkMeta } {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const internalLinkRefs: LinkRef[] = [];
  let totalExternal = 0;
  let nofollowExternal = 0;
  const externalHostCounts = new Map<string, number>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    let resolved: string;
    try { resolved = new URL(href, pageUrl).href; } catch { return; }

    const rel = $(el).attr('rel') ?? '';
    const isNoFollow = /\b(nofollow|ugc|sponsored)\b/i.test(rel);

    if (isSameDomainExtractor(resolved, domain)) {
      const cleanUrl = normalizeUrlExtractor(resolved);
      const position = positionFromParents($(el));
      const dedupKey = `${cleanUrl}::${position}`;

      // Keep one entry per url+position pair; pick better anchor if already seen
      if (!seen.has(dedupKey)) {
        seen.add(dedupKey);
        const anchorText = (
          $(el).text().trim() ||
          $(el).attr('title')?.trim() ||
          $(el).attr('aria-label')?.trim() ||
          ''
        ).slice(0, 120);
        internalLinkRefs.push({ url: cleanUrl, anchorText, position, isNoFollow });
      }
    } else {
      totalExternal++;
      if (isNoFollow) nofollowExternal++;
      try {
        const host = new URL(resolved).hostname.replace(/^www\./, '');
        externalHostCounts.set(host, (externalHostCounts.get(host) ?? 0) + 1);
      } catch { /* ignore */ }
    }
  });

  const topDomains = [...externalHostCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([d, count]) => ({ domain: d, count }));

  return {
    internalLinkRefs,
    externalLinkMeta: {
      externalLinkCount: totalExternal,
      topDomains,
      nofollowRatio: totalExternal > 0
        ? Math.round((nofollowExternal / totalExternal) * 100) / 100
        : 0,
      externalAuthorityScore: computeExternalAuthorityScore(externalHostCounts),
    },
  };
}

export interface PageChunk {
  index: number;
  text: string;
  tokenCount: number;
  startOffset: number;
  endOffset: number;
}

const TARGET_CHUNK_TOKENS = 450;
const WORDS_PER_TOKEN = 0.75;
const TARGET_CHUNK_WORDS = Math.round(TARGET_CHUNK_TOKENS / WORDS_PER_TOKEN);

export function extractChunks(bodyText: string): PageChunk[] {
  const paragraphs = bodyText
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: PageChunk[] = [];
  let current = '';
  let currentWords = 0;
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).length;

    if (currentWords + words > TARGET_CHUNK_WORDS && current.length > 0) {
      chunks.push(buildChunk(chunkIndex++, current.trim(), bodyText));
      current = '';
      currentWords = 0;
    }

    current += (current ? '\n\n' : '') + paragraph;
    currentWords += words;
  }

  if (current.trim().length > 0) {
    chunks.push(buildChunk(chunkIndex, current.trim(), bodyText));
  }

  return chunks;
}

function buildChunk(index: number, text: string, fullText: string): PageChunk {
  const startOffset = fullText.indexOf(text);
  const tokenCount = Math.round(text.split(/\s+/).length * WORDS_PER_TOKEN);
  return {
    index,
    text,
    tokenCount,
    startOffset,
    endOffset: startOffset + text.length,
  };
}
