import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const FETCH_TIMEOUT_MS = 8_000;
const MAX_URLS = 10_000;
const MAX_SITEMAP_DEPTH = 3;

const CANDIDATE_PATHS = [
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/sitemap-index.xml',
  '/sitemap/sitemap.xml',
];

/**
 * Fetch and parse all URLs from a domain's sitemap(s).
 *
 * Handles:
 * - Flat sitemap.xml
 * - Sitemap index files (nested sitemaps, up to MAX_SITEMAP_DEPTH levels)
 * - Gzip-compressed sitemaps (.xml.gz)
 * - Both sitemap.xml and sitemap_index.xml candidate paths
 *
 * Returns at most MAX_URLS URLs. Safe-defaults to [] on any network/parse failure.
 *
 * @param domain - Domain origin, e.g. "https://example.com"
 */
export async function fetchSitemapUrls(domain: string): Promise<string[]> {
  const origin = toOrigin(domain);

  // Try candidates in order, return on first successful parse
  for (const path of CANDIDATE_PATHS) {
    try {
      const urls = await parseSitemapUrl(`${origin}${path}`, new Set(), 0);
      if (urls.length > 0) return urls.slice(0, MAX_URLS);
    } catch {
      continue;
    }
  }

  return [];
}

// ─── Core parsing ─────────────────────────────────────────────────────────────

async function parseSitemapUrl(
  url: string,
  visited: Set<string>,
  depth: number
): Promise<string[]> {
  if (depth > MAX_SITEMAP_DEPTH) return [];
  if (visited.has(url)) return [];
  visited.add(url);

  let xml: string;
  try {
    xml = await fetchXml(url);
  } catch {
    return [];
  }

  if (!xml.trim()) return [];

  // Sitemap index — contains <sitemapindex> with nested <sitemap><loc> entries
  if (xml.includes('<sitemapindex')) {
    return parseSitemapIndex(xml, visited, depth);
  }

  // URL set — contains <urlset> with <url><loc> entries
  return parseUrlSet(xml);
}

async function parseSitemapIndex(
  xml: string,
  visited: Set<string>,
  depth: number
): Promise<string[]> {
  const sitemapLocs = extractLocs(xml, 'sitemap');
  const all: string[] = [];

  await Promise.allSettled(
    sitemapLocs.map(async (loc) => {
      const urls = await parseSitemapUrl(loc, visited, depth + 1);
      all.push(...urls);
    })
  );

  return all.slice(0, MAX_URLS);
}

function parseUrlSet(xml: string): string[] {
  return extractLocs(xml, 'url');
}

/**
 * Extract <loc> values nested inside the given parent element tag.
 * Handles both <url><loc>…</loc></url> and <sitemap><loc>…</loc></sitemap>.
 */
function extractLocs(xml: string, parentTag: string): string[] {
  const urls: string[] = [];
  // Match <parentTag> blocks first, then pull <loc> from each
  const blockRegex = new RegExp(`<${parentTag}[^>]*>([\\s\\S]*?)<\\/${parentTag}>`, 'gi');
  const locRegex = /<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/i;

  let block: RegExpExecArray | null;
  while ((block = blockRegex.exec(xml)) !== null && urls.length < MAX_URLS) {
    const locMatch = locRegex.exec(block[1] ?? '');
    if (locMatch?.[1]) {
      urls.push(locMatch[1].trim());
    }
  }

  return urls;
}

// ─── Network ──────────────────────────────────────────────────────────────────

async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      'User-Agent': 'SiteNexis-Bot/1.0 (+https://sitenexis.com/bot)',
      'Accept-Encoding': 'gzip, deflate',
    },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} fetching sitemap: ${url}`);

  const contentType = res.headers.get('content-type') ?? '';
  const isGzip =
    url.endsWith('.gz') ||
    contentType.includes('gzip') ||
    contentType.includes('x-gzip');

  if (isGzip) {
    return decompressGzip(res);
  }

  return res.text();
}

async function decompressGzip(res: Response): Promise<string> {
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const readable = Readable.from(buffer);
  const gunzip = createGunzip();
  const chunks: Buffer[] = [];

  gunzip.on('data', (chunk: Buffer) => chunks.push(chunk));
  await pipeline(readable, gunzip);

  return Buffer.concat(chunks).toString('utf-8');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toOrigin(domain: string): string {
  const withProtocol = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  const u = new URL(withProtocol);
  return `${u.protocol}//${u.hostname}`;
}
