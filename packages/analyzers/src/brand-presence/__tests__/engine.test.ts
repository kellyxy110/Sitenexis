import { describe, it, expect } from 'vitest';
import { buildBrandPresenceReport } from '../engine';

describe('brand presence scanner', () => {
  it('scores an empty presence low and notes invisibility', () => {
    const report = buildBrandPresenceReport({ domain: 'x.com', externalLinks: [] });
    expect(report.foundProfiles).toHaveLength(0);
    expect(report.missingRecommended).toEqual(expect.arrayContaining(['linkedin', 'twitter/x', 'facebook', 'instagram']));
    expect(report.notes[0]).toMatch(/invisible/);
    expect(report.brandPresenceScore).toBeLessThan(30);
  });

  it('detects profiles from external links', () => {
    const report = buildBrandPresenceReport({
      domain: 'x.com',
      externalLinks: ['https://linkedin.com/company/x', 'https://twitter.com/x', 'https://github.com/x'],
    });
    expect(report.foundProfiles.map((p) => p.platform)).toEqual(expect.arrayContaining(['linkedin', 'twitter/x', 'github']));
    expect(report.missingRecommended).toEqual(expect.arrayContaining(['facebook', 'instagram']));
  });

  it('rewards sameAs-validated profiles over merely-linked ones', () => {
    const linkedOnly = buildBrandPresenceReport({
      domain: 'x.com',
      externalLinks: ['https://linkedin.com/company/x', 'https://facebook.com/x'],
    });
    const validated = buildBrandPresenceReport({
      domain: 'x.com',
      externalLinks: ['https://linkedin.com/company/x', 'https://facebook.com/x'],
      sameAsUrls: ['https://linkedin.com/company/x', 'https://facebook.com/x'],
    });
    expect(validated.sameAsValidatedCount).toBe(2);
    expect(validated.brandPresenceScore).toBeGreaterThan(linkedOnly.brandPresenceScore);
    expect(linkedOnly.notes.some((n) => /sameAs/.test(n))).toBe(true);
  });

  it('assesses email/domain consistency', () => {
    const brandEmail = buildBrandPresenceReport({ domain: 'acme.com', externalLinks: [], emails: ['hello@acme.com'] });
    const freeEmail = buildBrandPresenceReport({ domain: 'acme.com', externalLinks: [], emails: ['acme@gmail.com'] });
    const noEmail = buildBrandPresenceReport({ domain: 'acme.com', externalLinks: [] });
    expect(brandEmail.emailDomainConsistent).toBe(true);
    expect(freeEmail.emailDomainConsistent).toBe(false);
    expect(noEmail.emailDomainConsistent).toBeNull();
    expect(brandEmail.brandPresenceScore).toBeGreaterThan(freeEmail.brandPresenceScore);
  });

  it('matches brand root domain across subdomains', () => {
    const report = buildBrandPresenceReport({ domain: 'www.acme.com', externalLinks: [], emails: ['team@mail.acme.com'] });
    expect(report.emailDomainConsistent).toBe(true);
  });
});
