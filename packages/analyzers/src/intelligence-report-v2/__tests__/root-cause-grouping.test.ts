import { describe, expect, it } from 'vitest';
import { createConfidenceSummary, groupRootCauses, type EvidenceContradiction, type IntelligenceReportV2Input } from '@sitenexis/shared';
function input(): IntelligenceReportV2Input { return { audit: { auditId: 'a1', domain: 'example.com' }, version: { scoringModelVersion: 'v2', reportVersion: 'v2', evidenceModelVersion: 'v2', crawlerVersion: 'v2' }, evidence: [], rawRenderedComparisons: [], modules: [], providers: [], confidence: createConfidenceSummary() }; }
function conflict(type: EvidenceContradiction['type'], subject: string, overrides: Partial<EvidenceContradiction> = {}): EvidenceContradiction { return { id: `${type}:${subject}`, type, subject, scope: 'DOMAIN', severity: 'medium', confidence: createConfidenceSummary({ score: 0.8 }), evidenceIds: ['e1', 'e2'], values: [], affectedUrls: [], modules: [], reason: 'Test conflict.', resolutionStatus: 'UNRESOLVED', ...overrides }; }
describe('root-cause grouping', () => {
  it('groups identity symptoms under one entity cause and preserves traceability', () => {
    const groups = groupRootCauses({ input: input(), contradictions: [conflict('ENTITY_NAME_CONFLICT', 'organization.name'), conflict('EMAIL_DOMAIN_CONFLICT', 'organization.email', { id: 'email', affectedUrls: ['https://example.com/contact'], modules: ['entity'] })] });
    expect(groups).toHaveLength(1); expect(groups[0]).toMatchObject({ type: 'ENTITY_IDENTITY_INCONSISTENCY', subject: 'organization.identity', primaryCategory: 'Entity Consistency' });
    expect(groups[0]?.contradictionIds).toEqual(expect.arrayContaining(['ENTITY_NAME_CONFLICT:organization.name', 'email'])); expect(groups[0]?.affectedUrls).toContain('https://example.com/contact');
  });
  it('keeps page canonical conflicts separate and does not infer a template cause', () => {
    const groups = groupRootCauses({ input: input(), contradictions: [conflict('CANONICAL_CONFLICT', 'page.canonical', { affectedUrls: ['https://example.com/a'] }), conflict('CANONICAL_CONFLICT', 'page.canonical', { id: 'b', affectedUrls: ['https://example.com/b'] })] });
    expect(groups).toHaveLength(2); expect(groups.every((group) => group.type === 'CANONICAL_CONFIGURATION_CONFLICT' && group.scope === 'PAGE')).toBe(true);
  });
  it('groups rendered-only H1/content evidence but not ordinary H1 disagreement', () => {
    const composed = input(); composed.rawRenderedComparisons = [
      { field: 'h1', rawAvailability: 'AVAILABLE', renderedAvailability: 'AVAILABLE', relationship: 'RENDERED_ONLY', confidence: createConfidenceSummary({ score: 0.8 }), evidenceReferences: [], url: 'https://example.com/a' },
      { field: 'bodyTextLength', rawAvailability: 'AVAILABLE', renderedAvailability: 'AVAILABLE', relationship: 'RENDERED_ONLY', confidence: createConfidenceSummary({ score: 0.8 }), evidenceReferences: [], url: 'https://example.com/a' },
      { field: 'h1', rawAvailability: 'AVAILABLE', renderedAvailability: 'AVAILABLE', relationship: 'DIFFERENT', confidence: createConfidenceSummary({ score: 0.8 }), evidenceReferences: [], url: 'https://example.com/b' },
    ];
    const groups = groupRootCauses({ input: composed }); expect(groups).toHaveLength(1); expect(groups[0]?.type).toBe('RENDERING_DEPENDENCY');
  });
  it('groups same unavailable provider limitations without merging providers', () => {
    const composed = input(); composed.providers = [{ provider: 'serper', available: false } as const, { provider: 'other', available: false } as const]; composed.modules = [{ moduleId: 'information-gain', state: 'UNAVAILABLE', provider: 'serper' }, { moduleId: 'citation', state: 'BLOCKED', provider: 'serper' }, { moduleId: 'other-module', state: 'UNAVAILABLE', provider: 'other' }];
    const groups = groupRootCauses({ input: composed }); expect(groups).toHaveLength(2); expect(groups.find((group) => group.subject === 'provider:serper')?.modules).toEqual(expect.arrayContaining(['information-gain', 'citation']));
  });
  it('groups matching policy subjects, retains independent causes, and has stable IDs', () => {
    const governance = conflict('CRAWLER_POLICY_CONFLICT', 'crawler.GPTBot.policy'); const groups = groupRootCauses({ input: input(), contradictions: [governance, conflict('GOVERNANCE_POLICY_CONFLICT', 'crawler.GPTBot.policy', { id: 'gov' }), conflict('EMAIL_CONFLICT', 'organization.email')] }); const repeat = groupRootCauses({ input: input(), contradictions: [governance, conflict('GOVERNANCE_POLICY_CONFLICT', 'crawler.GPTBot.policy', { id: 'gov' }), conflict('EMAIL_CONFLICT', 'organization.email')] });
    expect(groups).toHaveLength(2); expect(groups.find((group) => group.type === 'GOVERNANCE_POLICY_CONFLICT')?.contradictionIds).toEqual(expect.arrayContaining([governance.id, 'gov'])); expect(groups.map((group) => group.id)).toEqual(repeat.map((group) => group.id));
  });
  it('keeps confidence bounded and does not mutate inputs or calculate score deductions', () => {
    const low = conflict('ENTITY_NAME_CONFLICT', 'organization.name', { confidence: createConfidenceSummary({ score: 0.3 }) }); const composed = input(); const before = JSON.stringify({ composed, low }); const group = groupRootCauses({ input: composed, contradictions: [low] })[0];
    expect(group?.confidence.score).toBe(0.3); expect((group as unknown as Record<string, unknown>)['deduction']).toBeUndefined(); expect(JSON.stringify({ composed, low })).toBe(before);
  });
});