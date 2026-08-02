import { describe, expect, it } from 'vitest';
import {
  createConfidenceSummary,
  detectEvidenceContradictions,
  type EvidenceProjection,
  type IntelligenceReportV2Input,
} from '@sitenexis/shared';

function evidence(overrides: Partial<EvidenceProjection> = {}): EvidenceProjection {
  return {
    id: 'e1', auditId: 'audit-1', domain: 'example.com', scope: 'DOMAIN', category: 'entity', title: 'Observed', description: 'Observed',
    confidence: createConfidenceSummary({ score: 0.9 }), verificationState: 'CONFIRMED', observationType: 'OBSERVATION', ...overrides,
  };
}
function input(evidenceItems: EvidenceProjection[] = []): IntelligenceReportV2Input {
  return { audit: { auditId: 'audit-1', domain: 'example.com' }, version: { scoringModelVersion: 'v2', reportVersion: 'v2', evidenceModelVersion: 'v2', crawlerVersion: 'v2' }, evidence: evidenceItems, rawRenderedComparisons: [], modules: [], confidence: createConfidenceSummary(), providers: [] };
}

describe('read-time evidence contradiction diagnostics', () => {
  it('normalizes case and whitespace but preserves meaningful organization-name differences', () => {
    const same = detectEvidenceContradictions({ input: input([
      evidence({ id: 'a', issueCode: 'organization-name', rawValue: ' Crestscape   International Limited ' }),
      evidence({ id: 'b', issueCode: 'organization-name', rawValue: 'crestscape international limited' }),
    ]) });
    const conflict = detectEvidenceContradictions({ input: input([
      evidence({ id: 'a', issueCode: 'organization-name', rawValue: 'Crestscape International Limited' }),
      evidence({ id: 'b', issueCode: 'organization-name', rawValue: 'Crestcape International Limited' }),
    ]) });
    expect(same).toHaveLength(0);
    expect(conflict[0]).toMatchObject({ type: 'ENTITY_NAME_CONFLICT', subject: 'organization.name' });
  });

  it('handles email casing, mailbox variants, and domain identity conflicts conservatively', () => {
    const same = detectEvidenceContradictions({ input: input([
      evidence({ id: 'a', issueCode: 'email', rawValue: 'INFO@EXAMPLE.COM' }), evidence({ id: 'b', issueCode: 'email', rawValue: 'info@example.com' }),
    ]) });
    const mailboxes = detectEvidenceContradictions({ input: input([
      evidence({ id: 'a', issueCode: 'email', rawValue: 'sales@example.com' }), evidence({ id: 'b', issueCode: 'email', rawValue: 'support@example.com' }),
    ]) });
    const domains = detectEvidenceContradictions({ input: input([
      evidence({ id: 'a', issueCode: 'email', rawValue: 'info@example.com' }), evidence({ id: 'b', issueCode: 'email', rawValue: 'info@exampel.com' }),
    ]) });
    expect(same).toHaveLength(0); expect(mailboxes).toHaveLength(0);
    expect(domains[0]?.type).toBe('EMAIL_DOMAIN_CONFLICT');
  });

  it('normalizes phone formatting but detects materially distinct phone values', () => {
    const same = detectEvidenceContradictions({ input: input([
      evidence({ id: 'a', issueCode: 'phone', rawValue: '+234 906 937 0727' }), evidence({ id: 'b', issueCode: 'phone', rawValue: '+2349069370727' }),
    ]) });
    const conflict = detectEvidenceContradictions({ input: input([
      evidence({ id: 'a', issueCode: 'phone', rawValue: '+2349069370727' }), evidence({ id: 'b', issueCode: 'phone', rawValue: '+2349069370728' }),
    ]) });
    expect(same).toHaveLength(0); expect(conflict[0]?.type).toBe('PHONE_CONFLICT');
  });

  it('emits page-specific raw/rendered conflicts only for materially different values', () => {
    const same = input(); same.rawRenderedComparisons = [{ field: 'canonicalUrl', rawAvailability: 'AVAILABLE', renderedAvailability: 'AVAILABLE', rawValue: 'https://example.com/page', renderedValue: 'https://example.com/page', relationship: 'MATCH', confidence: createConfidenceSummary({ score: 0.9 }), evidenceReferences: [], url: 'https://example.com/page' }];
    const different = input(); different.rawRenderedComparisons = [{ field: 'canonicalUrl', rawAvailability: 'AVAILABLE', renderedAvailability: 'AVAILABLE', rawValue: 'https://example.com/page', renderedValue: 'https://example.com/', relationship: 'DIFFERENT', confidence: createConfidenceSummary({ score: 0.9 }), evidenceReferences: [], url: 'https://example.com/page' }];
    const missing = input(); missing.rawRenderedComparisons = [{ field: 'canonicalUrl', rawAvailability: 'AVAILABLE', renderedAvailability: 'AVAILABLE', rawValue: 'https://example.com/page', renderedValue: null, relationship: 'RAW_ONLY', confidence: createConfidenceSummary(), evidenceReferences: [], url: 'https://example.com/page' }];
    expect(detectEvidenceContradictions({ input: same })).toHaveLength(0);
    expect(detectEvidenceContradictions({ input: different })[0]).toMatchObject({ type: 'CANONICAL_CONFLICT', scope: 'PAGE' });
    expect(detectEvidenceContradictions({ input: missing })).toHaveLength(0);
  });

  it('detects H1/title differences and schema-visible entity disagreement with traceable evidence', () => {
    const result = detectEvidenceContradictions({ input: input([
      evidence({ id: 'title-a', issueCode: 'title', rawValue: 'One', url: 'https://example.com/p', scope: 'PAGE' }), evidence({ id: 'title-b', issueCode: 'title', rawValue: 'Two', url: 'https://example.com/p', scope: 'PAGE' }),
      evidence({ id: 'schema', issueCode: 'organization-name', rawValue: 'Crestcape International', sourceLayer: 'STRUCTURED_DATA' }), evidence({ id: 'visible', issueCode: 'organization-name', rawValue: 'Crestscape International', sourceLayer: 'RAW_HTML' }),
    ]) });
    expect(result.map((item) => item.type)).toEqual(expect.arrayContaining(['TITLE_CONFLICT', 'SCHEMA_VISIBLE_CONTENT_CONFLICT']));
    expect(result.every((item) => item.evidenceIds.length >= 2)).toBe(true);
  });

  it('checks structured module claims against module states but allows completed no-evidence outputs', () => {
    const unavailable = input(); unavailable.modules = [{ moduleId: 'citation', state: 'UNAVAILABLE', reasonCode: 'PROVIDER_UNAVAILABLE' }];
    const completed = input(); completed.modules = [{ moduleId: 'citation', state: 'COMPLETED', reasonCode: 'NO_EVIDENCE' }];
    expect(detectEvidenceContradictions({ input: unavailable, claims: [{ id: 'claim-1', moduleId: 'citation', assertion: 'ABSENCE' }] })[0]?.type).toBe('MODULE_STATE_CLAIM_CONFLICT');
    expect(detectEvidenceContradictions({ input: completed, claims: [{ id: 'claim-1', moduleId: 'citation', assertion: 'ZERO_FINDINGS' }] })).toHaveLength(0);
  });

  it('groups repeated entity conflicts, detects governance policy conflict, and does not mix history by default', () => {
    const current = [
      evidence({ id: 'a', issueCode: 'organization-name', rawValue: 'Crestscape' }), evidence({ id: 'b', issueCode: 'organization-name', rawValue: 'Crestcape' }), evidence({ id: 'c', issueCode: 'organization-name', rawValue: 'Crestscape', url: 'https://example.com/about' }),
      evidence({ id: 'allow', issueCode: 'crawler-policy', rawValue: 'GPTBot Allow', metadata: { policySubject: 'crawler.GPTBot.policy' } }), evidence({ id: 'deny', issueCode: 'crawler-policy', rawValue: 'GPTBot Disallow', metadata: { policySubject: 'crawler.GPTBot.policy' } }),
    ];
    const composed = input(current); composed.historicalEvidence = [evidence({ id: 'old', auditId: 'audit-0', issueCode: 'organization-name', rawValue: 'Old Crestscape' })];
    const normal = detectEvidenceContradictions({ input: composed });
    const historical = detectEvidenceContradictions({ input: composed, compareHistoricalContinuity: true });
    expect(normal.filter((item) => item.type === 'ENTITY_NAME_CONFLICT')).toHaveLength(1);
    expect(normal.map((item) => item.type)).toContain('CRAWLER_POLICY_CONFLICT');
    expect(normal.map((item) => item.type)).not.toContain('CURRENT_HISTORICAL_CONFLICT');
    expect(historical.map((item) => item.type)).toContain('CURRENT_HISTORICAL_CONFLICT');
  });

  it('does not mutate the composed input envelope', () => {
    const composed = input([evidence({ issueCode: 'h1', rawValue: 'One', url: 'https://example.com/p', scope: 'PAGE' }), evidence({ id: 'e2', issueCode: 'h1', rawValue: 'Two', url: 'https://example.com/p', scope: 'PAGE' })]);
    const before = JSON.stringify(composed); detectEvidenceContradictions({ input: composed });
    expect(JSON.stringify(composed)).toBe(before);
  });
});