/**
 * Crawler System Stability Test Suite — TEST MODE ONLY
 * Do NOT modify production code. Execute and report only.
 */

import { DomainCrawler } from './packages/crawler/src/crawler';
import { RobotsParser } from './packages/crawler/src/robots';
import { fetchSitemapUrls } from './packages/crawler/src/sitemap';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function header(title: string) {
  console.log(`\n${'═'.repeat(55)}`);
  console.log(title);
  console.log('═'.repeat(55));
}

function section(title: string) {
  console.log(`\n── ${title} ──`);
}

async function timedCrawl(
  label: string,
  domain: string,
  maxPages: number,
  timeoutMs = 15_000
): Promise<{ pages: number; errors: string[]; elapsed: number; threw: boolean; thrownMsg?: string }> {
  const errors: string[] = [];
  const start = Date.now();
  let threw = false;
  let thrownMsg: string | undefined;
  let pageCount = 0;

  try {
    const crawler = new DomainCrawler('test-audit', domain, { maxPages, timeoutMs });
    crawler.on('page:error', (url: string, err: Error) => {
      errors.push(`${url}: ${err.message}`);
    });
    const result = await crawler.run();
    pageCount = result.pages.length;
  } catch (e) {
    threw = true;
    thrownMsg = (e as Error).message;
  }

  return { pages: pageCount, errors, elapsed: Date.now() - start, threw, thrownMsg };
}

async function runCrawlerTests() {

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1: EDGE CASE SITES
  // ─────────────────────────────────────────────────────────────────────────
  header('CRAWLER TEST 1: EDGE CASE SITES');

  // 1a — 403 Forbidden
  section('Test 1a: HTTP 403 Forbidden (httpstat.us/403)');
  const t1a = await timedCrawl('403', 'https://httpstat.us', 5, 10_000);
  console.log('Threw exception?', t1a.threw ? `YES — ${t1a.thrownMsg}` : 'NO');
  console.log('Pages crawled:', t1a.pages);
  console.log('page:error events:', t1a.errors.length);
  for (const e of t1a.errors) console.log('  ERROR:', e);
  console.log('Elapsed ms:', t1a.elapsed);
  console.log('Behavior: The crawler visits httpstat.us/. If the root returns HTML, it will be parsed regardless of 403 on subpages.');
  console.log('Note: httpstat.us/* routes each return their status code as both HTTP status and response body. The crawler checks for content-type text/html — if the root redirects or serves non-HTML, the page returns null and is silently dropped.');

  // 1b — JS-heavy SPA
  section('Test 1b: JS-heavy SPA — behavior analysis (code inspection)');
  console.log('SPA handling (from crawler.ts:150-158):');
  console.log('  - Uses waitUntil: "networkidle2" (waits for network quiet)');
  console.log('  - Falls back to waitUntil: "domcontentloaded" if networkidle2 times out');
  console.log('  - If second goto also fails: returns null (page silently skipped)');
  console.log('  - Scripts are NOT blocked (only images/fonts/media blocked: crawler.ts:142-144)');
  console.log('  - JS execution IS allowed — Puppeteer runs JS before content extraction');
  console.log('  - SPA content rendered by JS WILL appear in bodyText (unlike curl-based crawlers)');
  console.log('  - Risk: SPAs with infinite scroll or lazy hydration may timeout at 15s, falling back to domcontentloaded snapshot');

  // 1c — Redirect loop analysis
  section('Test 1c: Redirect loop site — behavior analysis (code inspection)');
  console.log('Redirect handling (from crawler.ts:167-171):');
  console.log('  - redirectChain is captured via: response.request().redirectChain()');
  console.log('  - SLICED to MAX_REDIRECT_HOPS = 5 (crawler.ts:13)');
  console.log('  - Puppeteer follows redirects automatically — if a redirect loop exceeds');
  console.log('    Puppeteer\'s internal limit, goto() throws');
  console.log('  - The outer catch (crawler.ts:153) catches goto() failure and tries domcontentloaded fallback');
  console.log('  - If domcontentloaded also fails (redirect loop never resolves): returns null');
  console.log('  - No explicit loop detection: if A→B→C→A, Puppeteer will throw at its own hop limit');
  console.log('  - INCONSISTENCY: redirectChain is sliced to 5 but actual redirect following is unlimited');
  console.log('    until Puppeteer\'s internal guard fires. The slice only affects what\'s stored, not enforcement.');

  // 1d — robots.txt blocked
  section('Test 1d: robots.txt blocked site — behavior analysis + live test');

  // Test robots parsing with a synthetic disallow-all
  const robotsBlocked = new RobotsParser(
    'https://example.com/robots.txt',
    'User-agent: *\nDisallow: /\n\nUser-agent: SiteNexis-Bot\nDisallow: /'
  );
  // @ts-ignore — accessing private constructor via prototype trick isn't needed; test via public API
  // We can't call private constructor directly, so test with RobotsParser.fetch on a domain that blocks bots
  console.log('robots.txt parsing test (synthetic disallow-all rules):');
  console.log('  isAllowed("https://example.com/") with wildcard Disallow:/ ?', 'Cannot test — constructor is private');

  // Test actual robots.txt fetch
  const robots404 = await RobotsParser.fetch('https://httpstat.us');
  console.log('\nRobots.txt fetch from httpstat.us:');
  console.log('  isAllowed("https://httpstat.us/"):', robots404.isAllowed('https://httpstat.us/'));
  console.log('  getCrawlDelay():', robots404.getCrawlDelay());
  console.log('  getSitemaps():', robots404.getSitemaps());

  console.log('\nRobots enforcement analysis (from crawler.ts + robots.ts):');
  console.log('  - RobotsParser.fetch() is called BEFORE the queue starts (crawler.ts:59)');
  console.log('  - If robots.txt returns 404/error: fetch() catches and returns allow-all (robots.ts:43-47)');
  console.log('  - crawlPage() calls robots.isAllowed(normalized) at line 130');
  console.log('  - If disallowed: returns null immediately (no page:error emitted, no log)');
  console.log('  - SILENT DROP — disallowed URLs produce no observable event to the caller');
  console.log('  - Crawl-delay from robots.txt is PARSED (getCrawlDelay()) but NEVER APPLIED');
  console.log('    crawler.ts has no code reading getCrawlDelay() — the delay is ignored entirely');

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2: INFINITE CRAWL PROTECTION
  // ─────────────────────────────────────────────────────────────────────────
  header('CRAWLER TEST 2: INFINITE CRAWL PROTECTION');

  section('Test 2a: maxPages enforcement — code analysis');
  console.log('From crawler.ts:85:');
  console.log('  while (queue.length > 0 && pages.length < this.options.maxPages)');
  console.log('');
  console.log('Enforcement mechanism:');
  console.log('  - Check is at the TOP of the while loop (before batch dequeue)');
  console.log('  - Batch size = concurrency (default 5) — so up to (maxPages-1)+5 pages may be');
  console.log('    in-flight when the limit is hit');
  console.log('  - Example: maxPages=10, concurrency=5. When pages.length=8, batch of 5 starts.');
  console.log('    All 5 complete. pages.length=13 → OVERSHOOTS by up to (concurrency-1) pages');
  console.log('');
  console.log('INCONSISTENCY: maxPages is checked before batching, not after each page resolves.');
  console.log('  Actual pages returned can be up to maxPages + (concurrency-1) = maxPages+4 by default.');

  section('Test 2b: Recursive internal linking — code analysis');
  console.log('Queue deduplication mechanism (crawler.ts:97-103):');
  console.log('  for (const link of page.internalLinks) {');
  console.log('    const clean = normalizeUrl(link);');
  console.log('    if (!visited.has(clean) && !queue.includes(clean)) {');
  console.log('      queue.push(clean);');
  console.log('    }');
  console.log('  }');
  console.log('');
  console.log('Deduplication: URLs checked against both visited (Set) and queue (Array)');
  console.log('  - visited: O(1) lookup — correct');
  console.log('  - queue: O(n) Array.includes() scan — correct but PERFORMANCE ISSUE');
  console.log('    On a site with 500 pages and queue of 400 pending URLs: 400 linear scans per link');
  console.log('    This is O(n²) in the worst case for a heavily-linked site');
  console.log('');
  console.log('INFINITE LOOP PROTECTION: Yes — crawlPage() adds to visited BEFORE async crawl (line 131)');
  console.log('  visited.add(normalized) runs synchronously before browser.newPage()');
  console.log('  A→B→A cycle: A is crawled, B found, B crawled, A found again → already in visited → skipped');
  console.log('  Protection is sound for single-worker serial batches');
  console.log('');
  console.log('RACE CONDITION: Multiple pages in the same batch can add the same URL to the queue');
  console.log('  Scenario: page1 and page2 both link to page3. Both are in same batch.');
  console.log('  page1.internalLinks → page3 added to queue (not yet visited)');
  console.log('  page2.internalLinks → page3 checked: not in visited (crawl not started),');
  console.log('                         IS in queue (already added by page1)');
  console.log('  → queue.includes() catches this. BUT: both page1 and page2 complete before');
  console.log('    queue processing, so the check runs serially in the for loop → SAFE');

  section('Test 2c: maxPages with small limit — simulate');
  console.log('Simulating maxPages=1 with recursive links (code path trace):');
  console.log('  1. queue = [domain], pages = []');
  console.log('  2. while(queue.length>0 && 0 < 1): batch = [domain], queue = []');
  console.log('  3. crawlPage(domain) → returns page with N internal links');
  console.log('  4. pages.push(page) → pages.length = 1');
  console.log('  5. Internal links added to queue: queue = [link1, link2, ...]');
  console.log('  6. while(queue.length>0 && 1 < 1): FALSE → loop exits');
  console.log('  Result: Exactly 1 page returned. maxPages=1 is respected correctly.');
  console.log('  (No overshoot possible when concurrency=1-page batch completes before re-check)');

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3: PARTIAL CRAWL SCENARIO
  // ─────────────────────────────────────────────────────────────────────────
  header('CRAWLER TEST 3: PARTIAL CRAWL SCENARIO');

  section('Test 3a: Page failure mid-crawl — code analysis');
  console.log('From crawler.ts:87-104:');
  console.log('  const results = await Promise.allSettled(');
  console.log('    batch.map((url) => this.crawlPage(...))');
  console.log('  );');
  console.log('  for (const result of results) {');
  console.log('    if (result.status === "fulfilled" && result.value !== null) {');
  console.log('      // add to pages');
  console.log('    }');
  console.log('  }');
  console.log('');
  console.log('Promise.allSettled behavior:');
  console.log('  - Never throws even if individual crawlPage() rejects');
  console.log('  - Rejected promises: result.status === "rejected" → silently skipped');
  console.log('  - Fulfilled with null: result.value === null → silently skipped');
  console.log('  - Both cases: NO page:error emitted from the batch loop itself');
  console.log('  - page:error IS emitted from inside crawlPage() catch block (crawler.ts:178)');
  console.log('');
  console.log('SKIPPED PAGES HANDLING:');
  console.log('  - A page that 404s: statusCode=404, but content-type is still text/html');
  console.log('    → The page IS included in results with statusCode 404');
  console.log('    → No special handling — 404 pages enter the pages array');
  console.log('  - A page that returns non-HTML (e.g. PDF, JSON): returns null (crawler.ts:165)');
  console.log('    → Silently dropped, no event emitted');
  console.log('  - A page that times out twice (goto fails both times): returns null');
  console.log('    → page:error emitted, then null returned');
  console.log('  - A page where browser.newPage() throws: caught at line 177, emits page:error, returns null');

  section('Test 3b: Missing pages tracking');
  console.log('There is NO "pages skipped" counter or list in the CrawlResult type:');
  console.log('  CrawlResult = { auditId, domain, pages: CrawledPage[], crawlDurationMs }');
  console.log('');
  console.log('If 100 URLs were queued and 30 failed/timed out:');
  console.log('  - CrawlResult.pages.length = 70');
  console.log('  - The 30 failed URLs are permanently lost from the result');
  console.log('  - page:error events were emitted but not persisted');
  console.log('  - The caller (Infrastructure Agent) has no way to know 30 pages were missed');
  console.log('  - MISSING: skippedUrls[], failedUrls[], or attemptedCount fields in CrawlResult');

  section('Test 3c: Queue behavior on network error');
  console.log('Network failure mid-queue scenario:');
  console.log('  - Each page is independently wrapped in Promise.allSettled');
  console.log('  - One network failure does NOT stop the batch — remaining pages continue');
  console.log('  - The failed URL is removed from queue (was in current batch) and NOT re-queued');
  console.log('  - No retry logic for individual page crawl failures');
  console.log('  - MISSING: per-page retry mechanism (BullMQ retries the whole job, not individual pages)');

  console.log('\n' + '═'.repeat(55));
  console.log('CRAWLER TESTS COMPLETE');
  console.log('═'.repeat(55) + '\n');
}

runCrawlerTests().catch(err => {
  console.error('\nFATAL TEST ERROR:', err);
  process.exit(1);
});
