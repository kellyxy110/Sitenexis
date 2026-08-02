import { describe, expect, it } from 'vitest';
import {
  createConfidenceSummary,
  mapLegacyEvidenceToScoringSignalTypes,
  type EvidenceProjection,
} from '@sitenexis/shared';

function evidence(overrides: Partial<EvidenceProjection> = {}): EvidenceProjection {
  return {
    id: 'e1',
    auditId: 'a',
    domain: 'example.com',
    scope: 'PAGE',
    category: 'on-page-seo',
    title: 't',
    description: 'd',
    confidence: createConfidenceSummary({ score: 0.9 }),
    verificationState: 'CONFIRMED',
    ...overrides,
  };
}

describe('mapLegacyEvidenceToScoringSignalTypes', () => {
  it.each([
    ['title', 'About Example', 'TITLE_CONFIRMED'],
    ['meta-description', 'Learn about Example.', 'META_DESCRIPTION_CONFIRMED'],
    ['h1', 'About us', 'H1_CONFIRMED'],
    ['h2', ['Our history', 'Our team'], 'H2_CONFIRMED'],
    ['canonical', 'https://example.com/p', 'CANONICAL_CONFIRMED'],
    ['schema-organization', { '@type': 'Organization' }, 'VALID_SCHEMA_CONFIRMED'],
  ] as const)('maps a present "%s" value to %s', (issueCode, rawValue, expected) => {
    const result = mapLegacyEvidenceToScoringSignalTypes(evidence({ issueCode, rawValue: rawValue as never }));
    expect(result.signalTypes).toEqual([expected]);
    expect(result.diagnostics).toEqual([]);
  });

  it('maps http-status to both HEALTHY_STATUS_CONFIRMED and HTTPS_CONFIRMED for a healthy https page', () => {
    const result = mapLegacyEvidenceToScoringSignalTypes(evidence({ issueCode: 'http-status', rawValue: 200, url: 'https://example.com/p' }));
    expect(result.signalTypes.sort()).toEqual(['HEALTHY_STATUS_CONFIRMED', 'HTTPS_CONFIRMED']);
  });

  it('does not confirm HTTPS for an http:// url', () => {
    const result = mapLegacyEvidenceToScoringSignalTypes(evidence({ issueCode: 'http-status', rawValue: 200, url: 'http://example.com/p' }));
    expect(result.signalTypes).toEqual(['HEALTHY_STATUS_CONFIRMED']);
  });

  it('does not confirm a healthy status for a 4xx/5xx response, and does not fabricate a negative signal either', () => {
    const result = mapLegacyEvidenceToScoringSignalTypes(evidence({ issueCode: 'http-status', rawValue: 500, url: 'https://example.com/p' }));
    expect(result.signalTypes).toEqual(['HTTPS_CONFIRMED']);
  });

  it('emits no signal and a NO_SIGNAL_VALUE diagnostic when a value is genuinely absent (title/meta/canonical/h2)', () => {
    for (const issueCode of ['title', 'meta-description', 'canonical', 'h2'] as const) {
      const result = mapLegacyEvidenceToScoringSignalTypes(evidence({ issueCode, rawValue: null }));
      expect(result.signalTypes).toEqual([]);
      expect(result.diagnostics[0]?.code).toBe('NO_SIGNAL_VALUE');
    }
  });

  it('confirms H1_MISSING only when rendered-DOM extraction completed with usable confidence', () => {
    const rendered = mapLegacyEvidenceToScoringSignalTypes(evidence({
      issueCode: 'h1', rawValue: null, sourceLayer: 'RENDERED_DOM', confidence: createConfidenceSummary({ score: 0.9 }),
    }));
    expect(rendered.signalTypes).toEqual(['H1_MISSING']);
  });

  it('never confirms H1_MISSING for raw-only extraction (CSR/JS-shell protection)', () => {
    const raw = mapLegacyEvidenceToScoringSignalTypes(evidence({
      issueCode: 'h1', rawValue: null, sourceLayer: 'RAW_HTML', confidence: createConfidenceSummary({ score: 0.9 }),
    }));
    expect(raw.signalTypes).toEqual([]);
    expect(raw.diagnostics[0]?.code).toBe('ABSENCE_NOT_ESTABLISHED');
  });

  it('never confirms H1_MISSING for rendered evidence with low or unknown confidence', () => {
    const low = mapLegacyEvidenceToScoringSignalTypes(evidence({
      issueCode: 'h1', rawValue: null, sourceLayer: 'RENDERED_DOM', confidence: createConfidenceSummary({ score: 0.2 }),
    }));
    expect(low.signalTypes).toEqual([]);
    const unknown = mapLegacyEvidenceToScoringSignalTypes(evidence({
      issueCode: 'h1', rawValue: null, sourceLayer: 'RENDERED_DOM', confidence: createConfidenceSummary(),
    }));
    expect(unknown.signalTypes).toEqual([]);
  });

  it('never confirms H1_MISSING for missing source layer at all (no extraction-mode evidence)', () => {
    const result = mapLegacyEvidenceToScoringSignalTypes(evidence({ issueCode: 'h1', rawValue: null }));
    expect(result.signalTypes).toEqual([]);
  });

  it('still confirms H1_CONFIRMED for a present H1 regardless of source layer', () => {
    const result = mapLegacyEvidenceToScoringSignalTypes(evidence({ issueCode: 'h1', rawValue: 'About us', sourceLayer: 'RAW_HTML' }));
    expect(result.signalTypes).toEqual(['H1_CONFIRMED']);
  });

  it('leaves an unrecognized issue code unmapped with UNRECOGNIZED_EVIDENCE_CODE', () => {
    const result = mapLegacyEvidenceToScoringSignalTypes(evidence({ issueCode: 'thin_content', rawValue: 'x' }));
    expect(result.signalTypes).toEqual([]);
    expect(result.diagnostics[0]?.code).toBe('UNRECOGNIZED_EVIDENCE_CODE');
  });

  it.each(['PARTIAL', 'UNVERIFIED', 'CRAWL_FAILED', 'TEMPORARY_FAILURE', 'RENDERING_REQUIRED', 'PROVIDER_UNAVAILABLE', 'CONFLICTING', 'NOT_DETECTED'] as const)(
    'never confirms a signal for verification state %s, even with a present value',
    (verificationState) => {
      const result = mapLegacyEvidenceToScoringSignalTypes(evidence({ issueCode: 'title', rawValue: 'Example', verificationState }));
      expect(result.signalTypes).toEqual([]);
      expect(result.diagnostics[0]?.code).toBe('VERIFICATION_STATE_TOO_WEAK');
    },
  );

  it('accepts LIKELY as well as CONFIRMED', () => {
    const result = mapLegacyEvidenceToScoringSignalTypes(evidence({ issueCode: 'title', rawValue: 'Example', verificationState: 'LIKELY' }));
    expect(result.signalTypes).toEqual(['TITLE_CONFIRMED']);
  });

  it('is pure: does not mutate the input evidence', () => {
    const item = evidence({ issueCode: 'title', rawValue: 'Example' });
    const before = JSON.stringify(item);
    mapLegacyEvidenceToScoringSignalTypes(item);
    expect(JSON.stringify(item)).toBe(before);
  });
});
