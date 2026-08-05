import { describe, it, expect } from 'vitest';
import { computeIssueFingerprint, groupCurrentAuditIssues, ISSUE_FINGERPRINT_VERSION } from '../issue-fingerprint';

describe('computeIssueFingerprint', () => {
  it('is deterministic for the same inputs', () => {
    const a = computeIssueFingerprint('user1', 'example.com', 'seo', 'missing_alt_text');
    const b = computeIssueFingerprint('user1', 'example.com', 'seo', 'missing_alt_text');
    expect(a).toBe(b);
  });

  it('differs across users for the same domain/module/type — tenancy is part of identity', () => {
    const a = computeIssueFingerprint('user1', 'example.com', 'seo', 'missing_alt_text');
    const b = computeIssueFingerprint('user2', 'example.com', 'seo', 'missing_alt_text');
    expect(a).not.toBe(b);
  });

  it('differs across domains for the same user/module/type', () => {
    const a = computeIssueFingerprint('user1', 'example.com', 'seo', 'missing_alt_text');
    const b = computeIssueFingerprint('user1', 'other.com', 'seo', 'missing_alt_text');
    expect(a).not.toBe(b);
  });

  it('differs across module boundaries — never merges two genuinely different rules', () => {
    const a = computeIssueFingerprint('user1', 'example.com', 'entity', 'disambiguation_failure');
    const b = computeIssueFingerprint('user1', 'example.com', 'machine-trust', 'disambiguation_failure');
    expect(a).not.toBe(b);
  });

  it('differs across type boundaries within the same module', () => {
    const a = computeIssueFingerprint('user1', 'example.com', 'seo', 'missing_title');
    const b = computeIssueFingerprint('user1', 'example.com', 'seo', 'missing_meta_description');
    expect(a).not.toBe(b);
  });
});

describe('groupCurrentAuditIssues', () => {
  it('collapses the same (module, type) issue across many pages into one group', () => {
    const groups = groupCurrentAuditIssues('user1', 'example.com', [
      { module: 'seo', type: 'missing_alt_text', severity: 'warning', pageUrl: 'https://example.com/a' },
      { module: 'seo', type: 'missing_alt_text', severity: 'warning', pageUrl: 'https://example.com/b' },
      { module: 'seo', type: 'missing_alt_text', severity: 'warning', pageUrl: 'https://example.com/c' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.affectedPageCount).toBe(3);
    expect(groups[0]!.fingerprintVersion).toBe(ISSUE_FINGERPRINT_VERSION);
  });

  it('keeps genuinely different (module, type) issues on the same page separate', () => {
    const groups = groupCurrentAuditIssues('user1', 'example.com', [
      { module: 'seo', type: 'missing_title', severity: 'critical', pageUrl: 'https://example.com/a' },
      { module: 'seo', type: 'missing_canonical', severity: 'warning', pageUrl: 'https://example.com/a' },
    ]);
    expect(groups).toHaveLength(2);
    expect(new Set(groups.map((g) => g.fingerprint)).size).toBe(2);
  });

  it('picks the highest-severity rank within a group (critical > warning > info)', () => {
    const groups = groupCurrentAuditIssues('user1', 'example.com', [
      { module: 'seo', type: 'missing_alt_text', severity: 'info', pageUrl: 'https://example.com/a' },
      { module: 'seo', type: 'missing_alt_text', severity: 'critical', pageUrl: 'https://example.com/b' },
      { module: 'seo', type: 'missing_alt_text', severity: 'warning', pageUrl: 'https://example.com/c' },
    ]);
    expect(groups[0]!.severity).toBe('critical');
  });

  it('deduplicates repeated pageUrls within one group', () => {
    const groups = groupCurrentAuditIssues('user1', 'example.com', [
      { module: 'seo', type: 'missing_alt_text', severity: 'warning', pageUrl: 'https://example.com/a' },
      { module: 'seo', type: 'missing_alt_text', severity: 'warning', pageUrl: 'https://example.com/a' },
    ]);
    expect(groups[0]!.affectedPageCount).toBe(1);
  });

  it('handles issues with no pageUrl (site-wide findings) without throwing', () => {
    const groups = groupCurrentAuditIssues('user1', 'example.com', [
      { module: 'entity', type: 'missing_organization_schema', severity: 'critical', pageUrl: null },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.affectedPageCount).toBe(0);
  });

  it('returns an empty array for an audit with zero issues', () => {
    expect(groupCurrentAuditIssues('user1', 'example.com', [])).toEqual([]);
  });
});
