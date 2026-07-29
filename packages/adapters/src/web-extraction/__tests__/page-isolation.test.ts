import { describe, expect, it, vi } from 'vitest';
import { FetchExtractionAdapter } from '../fetch.adapter.js';

describe('page-level extraction ownership', () => {
  it('keeps metadata isolated for concurrent pages with shared template content', async () => {
    const htmlByUrl: Record<string, string> = {
      'https://fixture.example.com/': '<html><head><title>Home title</title><meta name="description" content="Home description"><link rel="canonical" href="https://fixture.example.com/"></head><body><nav><h2>Shared navigation</h2></nav><main><h1>Home H1</h1><h2>Home H2 one</h2><h2>Home H2 two</h2><p>Home body.</p><a href="/about">About</a></main><footer><h2>Shared footer</h2></footer></body></html>',
      'https://fixture.example.com/about': '<html><head><title>About title</title><meta name="description" content="About description"><link rel="canonical" href="https://fixture.example.com/about"></head><body><nav><h2>Shared navigation</h2></nav><main><h1>About H1</h1><h2>About H2 one</h2><h2>About H2 two</h2><p>About body.</p></main><footer><h2>Shared footer</h2></footer></body></html>',
    };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string | URL) => {
      const url = String(input);
      const html = htmlByUrl[url];
      return Promise.resolve({ status: html ? 200 : 404, ok: Boolean(html), url, headers: new Headers({ 'content-type': 'text/html' }), text: () => Promise.resolve(html ?? '') });
    }));
    const adapter = new FetchExtractionAdapter();
    const [{ page: home }, { page: about }] = await Promise.all([
      adapter.extractPage('https://fixture.example.com/'),
      adapter.extractPage('https://fixture.example.com/about'),
    ]);
    expect(home.h1).toBe('Home H1');
    expect(about.h1).toBe('About H1');
    expect(home.title).not.toBe(about.title);
    expect(home.metaDescription).not.toBe(about.metaDescription);
    expect(home.canonicalUrl).not.toBe(about.canonicalUrl);
    expect(home.bodyText).not.toBe(about.bodyText);
  });
});