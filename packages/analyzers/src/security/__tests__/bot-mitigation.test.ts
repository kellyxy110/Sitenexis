import { describe, it, expect } from 'vitest';
import { detectBotMitigation } from '../bot-mitigation';

describe('detectBotMitigation', () => {
  // Regression fixture: the EXACT signature captured from https://www.mayoclinic.org
  // on 2026-07-14 (Akamai returns 403 to all non-browser clients). This test exists so
  // no future change silently regresses handling of Akamai-protected sites.
  it('classifies the real Mayo Clinic Akamai 403 block', () => {
    const r = detectBotMitigation(
      403,
      { server: 'AkamaiGHost', 'content-type': 'text/html', 'set-cookie': 'MAYO_CLINIC_USER_GEO=NG; path=/' },
      '<HTML><HEAD><TITLE>Access Denied</TITLE></HEAD><BODY>Reference #18.9ec71002 https://errors.edgesuite.net/18.9ec71002</BODY></HTML>',
    );
    expect(r.blocked).toBe(true);
    expect(r.vendor).toBe('akamai');
    expect(r.vendorLabel).toBe('Akamai Bot Manager');
    expect(r.evidence.length).toBeGreaterThan(0);
    expect(r.explanation).toMatch(/Akamai Bot Manager/);
    expect(r.explanation).toMatch(/CRAWL4AI_URL/);
  });

  it('detects Cloudflare challenge', () => {
    const r = detectBotMitigation(403, { server: 'cloudflare', 'cf-ray': '8abc123-LHR', 'cf-mitigated': 'challenge' });
    expect(r.vendor).toBe('cloudflare');
    expect(r.blocked).toBe(true);
    expect(r.evidence.some((e) => e.includes('cf-ray'))).toBe(true);
  });

  it('detects Imperva/Incapsula via cookie', () => {
    const r = detectBotMitigation(403, { 'set-cookie': 'visid_incap_123=abc; incap_ses_1=xyz' });
    expect(r.vendor).toBe('imperva');
  });

  it('detects Fastly', () => {
    const r = detectBotMitigation(503, { server: 'Varnish', via: '1.1 varnish', 'x-served-by': 'cache-lhr-egll', 'x-fastly-request-id': 'abc' });
    expect(r.vendor).toBe('fastly');
  });

  it('detects AWS CloudFront / WAF', () => {
    const r = detectBotMitigation(403, { server: 'CloudFront', 'x-amz-cf-id': 'abc==', 'x-amzn-waf-action': 'block' });
    expect(r.vendor).toBe('aws');
  });

  it('treats a timeout (no response) behind a known vendor as blocked', () => {
    const r = detectBotMitigation(undefined, { server: 'AkamaiGHost' });
    expect(r.blocked).toBe(true);
    expect(r.vendor).toBe('akamai');
  });

  it('does NOT flag an ordinary 404 as a bot-mitigation block', () => {
    const r = detectBotMitigation(404, { server: 'nginx', 'content-type': 'text/html' });
    expect(r.blocked).toBe(false);
    expect(r.vendor).toBe('unknown');
  });

  it('flags a generic 403 with no vendor signature as blocked/unknown', () => {
    const r = detectBotMitigation(403, { server: 'nginx' });
    expect(r.blocked).toBe(true);
    expect(r.vendor).toBe('unknown');
    expect(r.explanation).toMatch(/CRAWL4AI_URL/);
  });
});
