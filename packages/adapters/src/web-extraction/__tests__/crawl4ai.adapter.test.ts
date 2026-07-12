import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Crawl4aiExtractionAdapter } from '../crawl4ai.adapter.js';

describe('Crawl4aiExtractionAdapter', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('isConfigured() reflects the service URL', () => {
    expect(new Crawl4aiExtractionAdapter('https://crawl.example.com').isConfigured()).toBe(true);
    expect(new Crawl4aiExtractionAdapter('').isConfigured()).toBe(false);
  });

  it('crawlDomain maps the service response into CrawledPage[]', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        pages: [
          { url: 'https://x.com/', status_code: 200, title: 'Home', body_text: 'hello world', word_count: 2, internal_links: ['https://x.com/about'] },
          { url: 'https://x.com/about', status_code: 200, title: 'About', body_text: 'about us', word_count: 2 },
        ],
      }),
    }));

    const adapter = new Crawl4aiExtractionAdapter('https://crawl.example.com');
    const pages = await adapter.crawlDomain('x.com', { maxPages: 50 });

    expect(pages).toHaveLength(2);
    expect(pages[0]!.url).toBe('https://x.com/');
    expect(pages[0]!.statusCode).toBe(200);
    expect(pages[0]!.title).toBe('Home');
    expect(pages[0]!.internalLinks).toContain('https://x.com/about');
  });

  it('crawlDomain returns [] when the service responds non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, json: () => Promise.resolve({}) }));
    const adapter = new Crawl4aiExtractionAdapter('https://crawl.example.com');
    expect(await adapter.crawlDomain('x.com')).toEqual([]);
  });

  it('crawlDomain returns [] when the request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const adapter = new Crawl4aiExtractionAdapter('https://crawl.example.com');
    expect(await adapter.crawlDomain('x.com')).toEqual([]);
  });
});
