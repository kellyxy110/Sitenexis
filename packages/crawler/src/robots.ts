import robotsParserLib from 'robots-parser';

const FETCH_TIMEOUT_MS = 5_000;
const OUR_USER_AGENT = 'SiteNexis-Bot';

/**
 * Robots.txt parser for SiteNexis.
 *
 * Fetches and parses robots.txt, then exposes allow/deny checks,
 * sitemap URL extraction, and crawl-delay values.
 *
 * Usage:
 *   const robots = await RobotsParser.fetch('https://example.com');
 *   robots.isAllowed('https://example.com/secret');  // false
 *   robots.getCrawlDelay();                           // 1 (seconds) or null
 */
export class RobotsParser {
  private readonly parser: ReturnType<typeof robotsParserLib>;
  private readonly robotsUrl: string;

  private constructor(robotsUrl: string, content: string) {
    this.robotsUrl = robotsUrl;
    this.parser = robotsParserLib(robotsUrl, content);
  }

  /**
   * Fetch and parse robots.txt for the given domain origin.
   * Returns a permissive (allow-all) parser if the file is unreachable.
   */
  static async fetch(domain: string): Promise<RobotsParser> {
    const origin = toOrigin(domain);
    const robotsUrl = `${origin}/robots.txt`;
    let content = '';

    try {
      const res = await fetch(robotsUrl, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { 'User-Agent': `${OUR_USER_AGENT}/1.0` },
      });
      if (res.ok) {
        content = await res.text();
      }
    } catch {
      // robots.txt is optional — treat as allow-all on network failure
    }

    return new RobotsParser(robotsUrl, content);
  }

  /**
   * Returns true if the given URL is allowed for crawling.
   * Checks our bot agent first; falls back to the wildcard `*` group.
   *
   * @param url       - Absolute URL to check.
   * @param userAgent - Agent string to check (defaults to SiteNexis-Bot).
   */
  isAllowed(url: string, userAgent: string = OUR_USER_AGENT): boolean {
    return this.parser.isAllowed(url, userAgent) ?? true;
  }

  /**
   * Returns all Sitemap URLs declared in robots.txt.
   */
  getSitemaps(): string[] {
    return this.parser.getSitemaps() ?? [];
  }

  /**
   * Returns the Crawl-delay value (in seconds) for our agent, or null if not set.
   *
   * @param userAgent - Agent string to check (defaults to SiteNexis-Bot).
   */
  getCrawlDelay(userAgent: string = OUR_USER_AGENT): number | null {
    return this.parser.getCrawlDelay(userAgent) ?? null;
  }

  get url(): string {
    return this.robotsUrl;
  }
}

/**
 * @deprecated Use `RobotsParser.fetch(domain)` instead.
 * Kept for backwards-compatibility with the original functional API.
 */
export interface RobotsRules {
  isAllowed: (url: string) => boolean;
  getCrawlDelay: () => number | null;
  getSitemapUrls: () => string[];
}

/**
 * @deprecated Use `RobotsParser.fetch(domain)` instead.
 */
export async function fetchRobotsTxt(domain: string): Promise<RobotsRules> {
  const parser = await RobotsParser.fetch(domain);
  return {
    isAllowed: (url: string) => parser.isAllowed(url),
    getCrawlDelay: () => parser.getCrawlDelay(),
    getSitemapUrls: () => parser.getSitemaps(),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toOrigin(domain: string): string {
  const withProtocol = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  const u = new URL(withProtocol);
  return `${u.protocol}//${u.hostname}`;
}
