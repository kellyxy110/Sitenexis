import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FetchExtractionAdapter } from '../fetch.adapter.js';

describe('page-level heading and canonical accuracy', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('preserves every H1 and H2 in DOM order and does not use title as H1', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true, url: 'https://fixture.example.com/services', headers: new Headers(), text: () => Promise.resolve('<html><head><title>Services title</title></head><body><nav><h2>Navigation</h2></nav><main><h1>Services H1</h1><h1>Second H1</h1><h2>Service H2 one</h2><h2>Service H2 two</h2></main><footer><h2>Footer</h2></footer></body></html>') }));
    const { page } = await new FetchExtractionAdapter().extractPage('https://fixture.example.com/services');
    expect(page.h1).toBe('Services H1');
    expect(page.headings).toEqual([{ level: 2, text: 'Navigation' }, { level: 1, text: 'Services H1' }, { level: 1, text: 'Second H1' }, { level: 2, text: 'Service H2 one' }, { level: 2, text: 'Service H2 two' }, { level: 2, text: 'Footer' }]);
    expect(page.headingEvidence?.filter((h) => h.level === 2).map((h) => h.text)).toEqual(['Navigation', 'Service H2 one', 'Service H2 two', 'Footer']);
  });

  it('resolves relative canonicals against the final page URL and leaves missing canonical null', async () => {
    const responses: Record<string, string> = {
      'https://fixture.example.com/about': '<html><head><link rel="canonical" href="/about"></head><body><h1>About</h1></body></html>',
      'https://fixture.example.com/contact': '<html><head><title>Contact</title></head><body><h1>Contact</h1></body></html>',
    };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => Promise.resolve({ status: 200, ok: true, url: input, headers: new Headers(), text: () => Promise.resolve(responses[input]!) })));
    const adapter = new FetchExtractionAdapter();
    const about = (await adapter.extractPage('https://fixture.example.com/about')).page;
    const contact = (await adapter.extractPage('https://fixture.example.com/contact')).page;
    expect(about.canonicalUrl).toBe('https://fixture.example.com/about');
    expect(contact.canonicalUrl).toBeNull();
  });

  it('keeps a redirected page linked to requested and final URLs without changing declared canonical', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true, url: 'https://www.fixture.example.com/about', headers: new Headers(), text: () => Promise.resolve('<html><head><link rel="canonical" href="/about"></head><body><h1>About</h1></body></html>') }));
    const { page } = await new FetchExtractionAdapter().extractPage('https://fixture.example.com/about');
    expect(page.requestedUrl).toBe('https://fixture.example.com/about');
    expect(page.finalUrl).toBe('https://www.fixture.example.com/about');
    expect(page.canonicalUrl).toBe('https://www.fixture.example.com/about');
  });
});