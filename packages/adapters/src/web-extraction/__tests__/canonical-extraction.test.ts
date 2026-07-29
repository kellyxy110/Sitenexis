import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchExtractionAdapter } from '../fetch.adapter.js';

function mockPage(html: string, requestedUrl = 'https://truvyx.org/path'): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200, ok: true, url: requestedUrl, headers: new Headers({ 'content-type': 'text/html' }), text: () => Promise.resolve(html) }));
}

async function extract(html: string, requestedUrl = 'https://truvyx.org/path') {
  mockPage(html, requestedUrl);
  return (await new FetchExtractionAdapter().extractPage(requestedUrl)).page;
}

describe('canonical extraction', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('ignores preload and stylesheet before canonical', async () => {
    const page = await extract('<head><link rel="preload" href="/assets/app.js" as="script"><link rel="stylesheet" href="/assets/app.css"><link rel="canonical" href="https://truvyx.org"></head>');
    expect(page.rawCanonical).toBe('https://truvyx.org');
    expect(page.resolvedCanonical).toBe('https://truvyx.org/');
    expect(page.canonicalCount).toBe(1);
    expect(page.canonicalSource).toBe('raw-dom');
    expect(page.canonicalValidity).toBe('valid');
    expect(page.isSelfReferencing).toBe(false);
  });

  it.each([
    ['canonical before preload', '<link rel="canonical" href="https://truvyx.org"><link rel="preload" href="/app.js">'],
    ['uppercase rel', '<link rel="Canonical" href="https://truvyx.org">'],
    ['canonical among rel tokens', '<link rel="alternate canonical" href="https://truvyx.org">'],
    ['canonical after rel tokens', '<link rel="canonical alternate" href="https://truvyx.org">'],
    ['href before rel', '<link href="https://truvyx.org" rel="canonical">'],
    ['rel before href', '<link rel="canonical" href="https://truvyx.org">'],
  ])('accepts %s', async (_name, tag) => {
    const page = await extract(`<head>${tag}</head>`);
    expect(page.resolvedCanonical).toBe('https://truvyx.org/');
    expect(page.canonicalValidity).toBe('valid');
  });

  it('rejects non-canonical rel values', async () => {
    const page = await extract('<link rel="preload" href="/preload"><link rel="stylesheet" href="/style.css"><link rel="modulepreload" href="/module.js"><link rel="alternate" href="/alternate"><link rel="icon" href="/favicon.ico">');
    expect(page.canonicalUrl).toBeNull();
    expect(page.canonicalCount).toBe(0);
    expect(page.canonicalSource).toBe('none');
    expect(page.canonicalValidity).toBe('missing');
  });

  it.each([
    ['/privacy', 'https://truvyx.org/privacy'],
    ['../guide', 'https://truvyx.org/guide'],
    ['//truvyx.org/blog', 'https://truvyx.org/blog'],
  ])('resolves canonical href %s', async (href, expected) => {
    const page = await extract(`<link rel="canonical" href="${href}">`, 'https://truvyx.org/account/settings');
    expect(page.rawCanonical).toBe(href);
    expect(page.resolvedCanonical).toBe(expected);
  });

  it('keeps missing and empty canonical values truthful', async () => {
    const missing = await extract('<meta property="og:url" content="https://truvyx.org/other">');
    const empty = await extract('<link rel="canonical" href="   ">');
    expect(missing.canonicalUrl).toBeNull();
    expect(missing.canonicalCount).toBe(0);
    expect(missing.canonicalSource).toBe('none');
    expect(empty.canonicalUrl).toBeNull();
    expect(empty.canonicalCount).toBe(1);
    expect(empty.canonicalValidity).toBe('invalid');
  });

  it('records duplicate identical canonicals', async () => {
    const page = await extract('<link rel="canonical" href="/path"><link rel="canonical" href="https://truvyx.org/path">');
    expect(page.canonicalUrl).toBe('https://truvyx.org/path');
    expect(page.canonicalRawValues).toEqual(['/path', 'https://truvyx.org/path']);
    expect(page.resolvedCanonicalValues).toEqual(['https://truvyx.org/path', 'https://truvyx.org/path']);
    expect(page.canonicalCount).toBe(2);
    expect(page.canonicalValidity).toBe('duplicate');
  });

  it('records conflicting canonicals without silently hiding the values', async () => {
    const page = await extract('<link rel="canonical" href="/one"><link rel="canonical" href="/two">');
    expect(page.canonicalRawValues).toEqual(['/one', '/two']);
    expect(page.resolvedCanonicalValues).toEqual(['https://truvyx.org/one', 'https://truvyx.org/two']);
    expect(page.canonicalCount).toBe(2);
    expect(page.canonicalValidity).toBe('conflicting');
  });

  it('ignores malformed unrelated link tags and Open Graph URL', async () => {
    const page = await extract('<link rel="preload" href="/bad"><link href="/broken"><meta property="og:url" content="https://truvyx.org/og">');
    expect(page.canonicalUrl).toBeNull();
    expect(page.canonicalCount).toBe(0);
  });

  it('resolves a relative canonical against the final redirect URL', async () => {
    const page = await extract('<link rel="canonical" href="../guide">', 'https://truvyx.org/old/path');
    expect(page.resolvedCanonical).toBe('https://truvyx.org/guide');
  });
});