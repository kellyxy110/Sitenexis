import type { CohortPageRaw } from './types';

interface SerperResult {
  organic?: Array<{ link?: string; title?: string }>;
}

/**
 * Fetches the top-N SERP results for a keyword via the Serper API,
 * then lightly crawls each URL using plain fetch (not Puppeteer).
 *
 * Returns an empty array with an error message if SERPER_API_KEY is not set.
 */
export async function collectSerpCohort(
  keyword: string,
  maxPages = 10
): Promise<{ pages: CohortPageRaw[]; error?: string }> {
  const apiKey = process.env['SERPER_API_KEY'];
  if (!apiKey) {
    return {
      pages: [],
      error: 'SERPER_API_KEY not configured — SERP cohort collection unavailable',
    };
  }

  // ── Step 1: Fetch SERP via Serper ─────────────────────────────────────────
  let urls: string[] = [];
  try {
    const serpRes = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: keyword, num: maxPages }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!serpRes.ok) {
      return {
        pages: [],
        error: `Serper API returned ${serpRes.status}: ${await serpRes.text().catch(() => 'unknown')}`,
      };
    }

    const serpData = (await serpRes.json()) as SerperResult;
    urls = (serpData.organic ?? [])
      .map((r) => r.link ?? '')
      .filter(Boolean)
      .slice(0, maxPages);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { pages: [], error: `Serper API fetch failed: ${msg}` };
  }

  if (urls.length === 0) {
    return { pages: [], error: 'Serper returned no organic results' };
  }

  // ── Step 2: Crawl each URL concurrently (max 5 at a time) ─────────────────
  const results: CohortPageRaw[] = [];
  const concurrency = 5;

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const fetched = await Promise.allSettled(batch.map((url) => fetchPage(url)));
    for (const result of fetched) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
      // Silently skip rejected (failed) pages — ZFDA: only include crawled content
    }
  }

  return { pages: results };
}

async function fetchPage(url: string): Promise<CohortPageRaw> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; SiteNexis-IGE/1.0; +https://sitenexis.com/bot)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      return { url, html: '', title: '', wordCount: 0, crawlSuccess: false };
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      return { url, html: '', title: '', wordCount: 0, crawlSuccess: false };
    }

    const html = await res.text();
    const title = extractTitle(html);
    const wordCount = estimateWordCount(html);

    return { url, html, title, wordCount, crawlSuccess: true };
  } catch {
    return { url, html: '', title: '', wordCount: 0, crawlSuccess: false };
  } finally {
    clearTimeout(timeout);
  }
}

function extractTitle(html: string): string {
  const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  return match ? match[1]?.trim() ?? '' : '';
}

function estimateWordCount(html: string): number {
  // Strip tags and count whitespace-separated tokens
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return 0;
  return text.split(' ').filter((w) => w.length > 0).length;
}
