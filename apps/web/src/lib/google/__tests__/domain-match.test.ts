import { describe, it, expect } from 'vitest';
import { hostnameFromGscSiteUrl, matchAuditDomainToConnection } from '../domain-match';

describe('hostnameFromGscSiteUrl', () => {
  it('extracts the hostname from an sc-domain: property', () => {
    expect(hostnameFromGscSiteUrl('sc-domain:example.com')).toBe('example.com');
  });

  it('extracts the hostname from a URL-prefix property, stripping www.', () => {
    expect(hostnameFromGscSiteUrl('https://www.example.com/')).toBe('example.com');
  });

  it('returns null for an unparseable value', () => {
    expect(hostnameFromGscSiteUrl('not a url')).toBeNull();
  });
});

describe('matchAuditDomainToConnection', () => {
  it('returns none when the user has no audited domains at all', () => {
    expect(matchAuditDomainToConnection([], 'sc-domain:example.com')).toEqual({ domain: null, confidence: 'none' });
  });

  it('returns an exact match, case-insensitively, when the GSC hostname matches an audited domain', () => {
    const result = matchAuditDomainToConnection(['Example.com', 'other.com'], 'sc-domain:example.com');
    expect(result).toEqual({ domain: 'Example.com', confidence: 'exact' });
  });

  it('falls back to the most-recently-audited domain (first in the list) when nothing matches, with low confidence', () => {
    const result = matchAuditDomainToConnection(['recent.com', 'older.com'], 'sc-domain:unrelated.com');
    expect(result).toEqual({ domain: 'recent.com', confidence: 'fallback' });
  });

  it('falls back gracefully when there is no GSC connection at all', () => {
    const result = matchAuditDomainToConnection(['recent.com'], null);
    expect(result).toEqual({ domain: 'recent.com', confidence: 'fallback' });
  });
});
