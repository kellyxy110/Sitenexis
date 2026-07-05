import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FetchExtractionAdapter } from '../fetch.adapter.js';
import { URLValidationError } from '../security.js';

const FIXTURE = (name: string) =>
  readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8');

function mockFetch(html: string, status = 200): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    status,
    ok: status < 400,
    text: () => Promise.resolve(html),
  }));
}

describe('FetchExtractionAdapter', () => {
  let adapter: FetchExtractionAdapter;

  beforeEach(() => {
    adapter = new FetchExtractionAdapter();
    vi.restoreAllMocks();
  });

  // ── isConfigured ─────────────────────────────────────────────────────────────

  it('isConfigured() always returns true', () => {
    expect(adapter.isConfigured()).toBe(true);
  });

  // ── URL safety ────────────────────────────────────────────────────────────────

  it('rejects private IP addresses', async () => {
    await expect(adapter.extractPage('http://192.168.1.1/')).rejects.toThrow(URLValidationError);
  });

  it('rejects loopback addresses', async () => {
    await expect(adapter.extractPage('http://127.0.0.1/')).rejects.toThrow(URLValidationError);
  });

  it('rejects localhost hostname', async () => {
    await expect(adapter.extractPage('http://localhost/')).rejects.toThrow(URLValidationError);
  });

  it('rejects non-http schemes', async () => {
    await expect(adapter.extractPage('ftp://example.com/')).rejects.toThrow(URLValidationError);
  });

  // ── Static page fixture ───────────────────────────────────────────────────────

  it('extracts title, description, h1, canonical from static fixture', async () => {
    mockFetch(FIXTURE('static.html'));
    const { page } = await adapter.extractPage('https://acme.example.com/');

    expect(page.title).toBe('Acme Corp — Industrial Solutions');
    expect(page.metaDescription).toContain('Acme Corp');
    expect(page.h1).toBe('Precision Industrial Solutions');
    expect(page.canonicalUrl).toBe('https://acme.example.com/');
    expect(page.robotsDirectives).toContain('index, follow');
  });

  it('extracts schema markup and derives schemaTypes + hasStructuredData', async () => {
    mockFetch(FIXTURE('static.html'));
    const { page } = await adapter.extractPage('https://acme.example.com/');

    expect(page.schemaMarkup.length).toBeGreaterThan(0);
    expect(page.schemaTypes).toContain('Organization');
    expect(page.hasStructuredData).toBe(true);
  });

  it('extracts Open Graph fields', async () => {
    mockFetch(FIXTURE('static.html'));
    const { page } = await adapter.extractPage('https://acme.example.com/');

    expect(page.openGraph?.title).toBe('Acme Corp');
    expect(page.openGraph?.type).toBe('website');
  });

  it('extracts internal and external links', async () => {
    mockFetch(FIXTURE('static.html'));
    const { page } = await adapter.extractPage('https://acme.example.com/');

    expect(page.internalLinks.some((u) => u.includes('/about'))).toBe(true);
    expect(page.externalLinks.some((u) => u.includes('wikipedia.org'))).toBe(true);
  });

  it('returns valid metrics with correct field values', async () => {
    mockFetch(FIXTURE('static.html'));
    const { metrics } = await adapter.extractPage('https://acme.example.com/');

    expect(metrics.provider).toBe('fetch');
    expect(metrics.success).toBe(true);
    expect(metrics.statusCode).toBe(200);
    expect(metrics.schemaDetected).toBe(true);
    expect(metrics.schemaTypeCount).toBeGreaterThan(0);
    expect(metrics.headingCount).toBeGreaterThan(0);
    expect(metrics.wordCount).toBeGreaterThan(0);
  });

  // ── Schema-rich fixture ───────────────────────────────────────────────────────

  it('extracts multiple schema blocks from schema-rich fixture', async () => {
    mockFetch(FIXTURE('schema-rich.html'));
    const { page } = await adapter.extractPage('https://cycling.example.com/guides/replace-tyre');

    expect(page.schemaTypes).toContain('HowTo');
    expect(page.schemaTypes).toContain('FAQPage');
    expect(page.schemaMarkup.length).toBe(2);
  });

  // ── Minimal/thin page ─────────────────────────────────────────────────────────

  it('handles a page with a whitespace-only title gracefully', async () => {
    mockFetch(FIXTURE('minimal.html'));
    const { page } = await adapter.extractPage('https://thin.example.com/');

    // Title with only whitespace should be treated as effectively empty after trim
    expect(page.title === null || page.title?.trim() === '').toBe(true);
    expect(page.wordCount).toBeGreaterThan(0); // "Hi" is a word
  });

  // ── Broken-fields fixture ─────────────────────────────────────────────────────

  it('handles missing title, description, h1, canonical gracefully', async () => {
    mockFetch(FIXTURE('broken-fields.html'));
    const { page } = await adapter.extractPage('https://broken.example.com/');

    expect(page.title).toBeNull();
    expect(page.metaDescription).toBeNull();
    expect(page.h1).toBeNull();
    expect(page.canonicalUrl).toBeNull();
  });

  it('skips invalid JSON-LD and parses valid schema block', async () => {
    mockFetch(FIXTURE('broken-fields.html'));
    const { page } = await adapter.extractPage('https://broken.example.com/');

    // One block is invalid JSON, one is valid WebSite schema
    expect(page.schemaMarkup.length).toBe(1);
    expect(page.schemaTypes).toContain('WebSite');
  });

  it('skips javascript: and mailto: links', async () => {
    mockFetch(FIXTURE('broken-fields.html'));
    const { page } = await adapter.extractPage('https://broken.example.com/');

    const allLinks = [...page.internalLinks, ...page.externalLinks];
    expect(allLinks.every((u) => !u.startsWith('javascript:') && !u.startsWith('mailto:'))).toBe(true);
  });

  it('returns failure metrics when server returns 4xx', async () => {
    mockFetch('Not Found', 404);
    const { metrics } = await adapter.extractPage('https://gone.example.com/');

    expect(metrics.success).toBe(false);
    expect(metrics.statusCode).toBe(404);
  });

  it('returns failure metrics when fetch throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const { metrics } = await adapter.extractPage('https://unreachable.example.com/');

    expect(metrics.success).toBe(false);
    expect(metrics.statusCode).toBe(0);
  });

  // ── healthCheck ───────────────────────────────────────────────────────────────

  it('healthCheck returns healthy status', async () => {
    const health = await adapter.healthCheck();
    expect(health.provider).toBe('fetch');
    expect(health.status).toBe('healthy');
  });
});
