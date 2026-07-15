import { describe, it, expect } from 'vitest';
import {
  analyzeQuickScan,
  stripScriptsAndStyles,
  stripPairedTag,
  MAX_QUICK_SCAN_HTML,
} from '../analyze';

describe('stripPairedTag / stripScriptsAndStyles', () => {
  it('removes script and style bodies', () => {
    const html = '<p>keep</p><script>var a=1<2;</script><style>.x{color:red}</style><p>me</p>';
    const out = stripScriptsAndStyles(html);
    expect(out).toContain('keep');
    expect(out).toContain('me');
    expect(out).not.toContain('var a=1');
    expect(out).not.toContain('color:red');
  });

  it('drops the remainder of an unterminated script (bounded, never throws)', () => {
    const out = stripPairedTag('<p>ok</p><script>never closes', 'script');
    expect(out).toContain('ok');
    expect(out).not.toContain('never closes');
  });
});

describe('analyzeQuickScan — correctness', () => {
  it('detects thin content, missing schema, and scores a bare page', () => {
    const r = analyzeQuickScan({ html: '<html><head><title>A short but valid page title here</title></head><body><h1>Hi</h1><p>tiny</p></body></html>', url: 'https://example.com' });
    expect(r.issues.some((i) => i.type === 'thin_content')).toBe(true);
    expect(r.issues.some((i) => i.type === 'no_schema')).toBe(true);
    expect(r.quickScore).toBeGreaterThanOrEqual(0);
    expect(r.quickScore).toBeLessThanOrEqual(100);
  });

  it('flags a missing title and missing H1 as critical', () => {
    const r = analyzeQuickScan({ html: '<html><body><p>no title, no h1</p></body></html>', url: 'https://example.com' });
    expect(r.issues.some((i) => i.type === 'missing_title' && i.severity === 'critical')).toBe(true);
    expect(r.issues.some((i) => i.type === 'missing_h1' && i.severity === 'critical')).toBe(true);
  });

  it('extracts JSON-LD @type and clears the no_schema issue', () => {
    const html =
      '<html><head><title>Org page with a sufficiently long title tag</title>' +
      '<script type="application/ld+json">{"@type":"Organization","name":"X"}</script></head>' +
      '<body><h1>X</h1></body></html>';
    const r = analyzeQuickScan({ html, url: 'https://example.com' });
    expect(r.schemaTypes).toContain('Organization');
    expect(r.issues.some((i) => i.type === 'no_schema')).toBe(false);
  });

  it('detects a client-side-rendered shell', () => {
    const r = analyzeQuickScan({ html: '<html><head><title>App shell title long enough here</title></head><body><div id="__next"></div></body></html>', url: 'https://example.com' });
    expect(r.isLikelyJsRendered).toBe(true);
    expect(r.issues.some((i) => i.type === 'js_rendered')).toBe(true);
  });
});

describe('analyzeQuickScan — robustness (no site fails silently)', () => {
  it('REGRESSION: a pathological, oversized page is analysed in well under 2s and is marked truncated', () => {
    // ~6 MB of inline script full of "<" — the exact shape that stalls a backtracking
    // script-strip regex. Must complete fast and be capped.
    const huge =
      '<html><head><title>Massive minified page title goes here</title></head><body><h1>H</h1>' +
      '<script>' + 'a<b;c<d;'.repeat(750_000) + '</script>' +
      '<p>real content after the giant script block</p></body></html>';
    expect(huge.length).toBeGreaterThan(MAX_QUICK_SCAN_HTML);
    const t0 = Date.now();
    const r = analyzeQuickScan({ html: huge, url: 'https://heavy.example' });
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(2000);
    expect(r.truncated).toBe(true);
    expect(r.quickScore).toBeGreaterThanOrEqual(0);
  });

  it('never throws on empty or malformed input', () => {
    expect(() => analyzeQuickScan({ html: '', url: 'https://x.example' })).not.toThrow();
    expect(() => analyzeQuickScan({ html: '<html><body><script>', url: 'https://x.example' })).not.toThrow();
  });
});
