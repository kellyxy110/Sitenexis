import { describe, it, expect } from 'vitest';
import { parseHtml } from './crawler';

describe('parseHtml', () => {
  it('extracts JSON-LD schema markup even though <script> tags are stripped from bodyText', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">{"@type":"Organization","name":"Acme"}</script>
      </head><body><p>Hello world</p></body></html>
    `;
    const page = parseHtml('https://example.com/', html, 200, [], 'example.com', 100);
    expect(page.schemaMarkup).toHaveLength(1);
    expect(page.schemaMarkup[0]).toMatchObject({ '@type': 'Organization', name: 'Acme' });
  });

  it('flattens @graph-wrapped JSON-LD into individual entities', () => {
    const html = `<script type="application/ld+json">{"@graph":[{"@type":"Organization","name":"Acme"},{"@type":"WebSite","name":"Acme Site"}]}</script>`;
    const page = parseHtml('https://example.com/', html, 200, [], 'example.com', 100);
    expect(page.schemaMarkup).toHaveLength(2);
  });

  it('ignores malformed JSON-LD without throwing', () => {
    const html = `<script type="application/ld+json">{not valid json</script>`;
    const page = parseHtml('https://example.com/', html, 200, [], 'example.com', 100);
    expect(page.schemaMarkup).toEqual([]);
  });

  it('collects script src URLs before scripts are stripped from bodyText', () => {
    const html = `
      <html><body>
        <script src="https://cdn.example.com/jquery-1.12.4.min.js"></script>
        <script src="/local/app.js"></script>
        <p>Hello world</p>
      </body></html>
    `;
    const page = parseHtml('https://example.com/', html, 200, [], 'example.com', 100);
    expect(page.scriptSources).toEqual(['https://cdn.example.com/jquery-1.12.4.min.js', '/local/app.js']);
    expect(page.bodyText).not.toContain('jquery');
  });

  it('never leaks script or style content into bodyText', () => {
    const html = `<html><body><script>alert('x')</script><style>.a{color:red}</style><p>Visible text</p></body></html>`;
    const page = parseHtml('https://example.com/', html, 200, [], 'example.com', 100);
    expect(page.bodyText).toBe('Visible text');
  });
});
