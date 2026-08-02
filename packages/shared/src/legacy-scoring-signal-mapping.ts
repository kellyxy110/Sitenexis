import type { EvidenceProjection } from './intelligence-report-v2';

/**
 * Deterministic legacy-evidence -> Phase 15 scoring vocabulary boundary.
 *
 * `legacy-evidence-projection.ts` projects stored Page/Issue rows using their
 * own lowercase issue codes ('http-status', 'title', 'h1', ...). The Phase 15
 * signal policy (`SCORING_V2_SIGNAL_POLICY` in `scoring-v2-input-projection.ts`)
 * is keyed by an explicit uppercase vocabulary ('HEALTHY_STATUS_CONFIRMED',
 * 'TITLE_CONFIRMED', ...). Nothing translated between the two, so every
 * legacy-page-derived positive signal was silently dropped as
 * UNMAPPED_SCORING_SIGNAL. This module is that translation, and nothing else:
 * it never invents a value, never infers failure from an absent field, and
 * only asserts a confirmed-missing signal when the evidence itself already
 * establishes the absence (see `establishesConfirmedAbsence`).
 */

export const LEGACY_SCORING_MAPPING_DIAGNOSTIC_CODES = [
  'UNRECOGNIZED_EVIDENCE_CODE',
  'ABSENCE_NOT_ESTABLISHED',
  'VERIFICATION_STATE_TOO_WEAK',
  'NO_SIGNAL_VALUE',
] as const;

export type LegacyScoringMappingDiagnosticCode = (typeof LEGACY_SCORING_MAPPING_DIAGNOSTIC_CODES)[number];

export interface LegacyScoringMappingDiagnostic {
  code: LegacyScoringMappingDiagnosticCode;
  evidenceId: string;
  message: string;
}

export interface LegacyScoringSignalMappingResult {
  /** Phase 15 signal-policy keys this evidence item establishes. May be empty. */
  signalTypes: string[];
  diagnostics: LegacyScoringMappingDiagnostic[];
}

/**
 * Only CONFIRMED/LIKELY page-and-issue evidence is eligible to become a
 * scoring signal. CRAWL_FAILED, TEMPORARY_FAILURE, PARTIAL, RENDERING_REQUIRED,
 * PROVIDER_UNAVAILABLE, etc. must never be read as a confirmed defect.
 */
const ELIGIBLE_VERIFICATION_STATES = new Set(['CONFIRMED', 'LIKELY']);

/**
 * A missing value may become a confirmed-absence signal only when rendered-DOM
 * extraction actually completed with usable confidence. A raw-only crawl that
 * found nothing may simply require rendering (CSR/JS shell) — that is
 * insufficient evidence, not a defect.
 */
function establishesConfirmedAbsence(evidence: EvidenceProjection): boolean {
  return evidence.sourceLayer === 'RENDERED_DOM'
    && evidence.confidence.label !== 'LOW'
    && evidence.confidence.label !== 'UNKNOWN';
}

function hasValue(value: EvidenceProjection['rawValue']): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function diagnostic(code: LegacyScoringMappingDiagnosticCode, evidence: EvidenceProjection, message: string): LegacyScoringMappingDiagnostic {
  return { code, evidenceId: evidence.id, message };
}

/**
 * Maps one legacy evidence projection to zero or more Phase 15 signal-policy
 * keys. Pure: no lookups, no I/O, no mutation of the input.
 */
export function mapLegacyEvidenceToScoringSignalTypes(evidence: EvidenceProjection): LegacyScoringSignalMappingResult {
  if (!ELIGIBLE_VERIFICATION_STATES.has(evidence.verificationState)) {
    return {
      signalTypes: [],
      diagnostics: [diagnostic('VERIFICATION_STATE_TOO_WEAK', evidence, `Verification state ${evidence.verificationState} does not establish a confirmed scoring signal.`)],
    };
  }

  const code = (evidence.issueCode ?? '').toLowerCase();
  const value = evidence.normalizedValue ?? evidence.rawValue;
  const present = hasValue(value);
  const types: string[] = [];
  const diagnostics: LegacyScoringMappingDiagnostic[] = [];

  if (code === 'http-status') {
    if (present && typeof value === 'number' && value >= 200 && value < 400) types.push('HEALTHY_STATUS_CONFIRMED');
    if (evidence.url && /^https:\/\//i.test(evidence.url)) types.push('HTTPS_CONFIRMED');
    if (types.length === 0) diagnostics.push(diagnostic('NO_SIGNAL_VALUE', evidence, 'HTTP status/protocol evidence does not establish a confirmed positive signal.'));
  } else if (code === 'title') {
    if (present) types.push('TITLE_CONFIRMED');
    else diagnostics.push(diagnostic('NO_SIGNAL_VALUE', evidence, 'Title value is not present.'));
  } else if (code === 'meta-description') {
    if (present) types.push('META_DESCRIPTION_CONFIRMED');
    else diagnostics.push(diagnostic('NO_SIGNAL_VALUE', evidence, 'Meta description value is not present.'));
  } else if (code === 'canonical') {
    if (present) types.push('CANONICAL_CONFIRMED');
    else diagnostics.push(diagnostic('NO_SIGNAL_VALUE', evidence, 'Canonical value is not present.'));
  } else if (code === 'h1') {
    if (present) {
      types.push('H1_CONFIRMED');
    } else if (establishesConfirmedAbsence(evidence)) {
      types.push('H1_MISSING');
    } else {
      diagnostics.push(diagnostic('ABSENCE_NOT_ESTABLISHED', evidence, 'H1 is absent from this evidence, but rendered-DOM extraction did not establish confirmed absence.'));
    }
  } else if (code === 'h2') {
    if (present) types.push('H2_CONFIRMED');
    else diagnostics.push(diagnostic('NO_SIGNAL_VALUE', evidence, 'H2 headings are not present.'));
  } else if (code.includes('schema')) {
    if (present) types.push('VALID_SCHEMA_CONFIRMED');
    else diagnostics.push(diagnostic('NO_SIGNAL_VALUE', evidence, 'Schema evidence value is not present.'));
  } else if (code === 'missing_sitemap') {
    // The issue's own existence with an eligible verification state already
    // establishes confirmed absence — there is no "value" to check presence of.
    types.push('SITEMAP_MISSING');
  } else if (code === 'missing_robots_txt') {
    types.push('ROBOTS_MISSING');
  } else if (code === 'sitemap-accessible') {
    if (present) types.push('SITEMAP_ACCESSIBLE');
    else diagnostics.push(diagnostic('NO_SIGNAL_VALUE', evidence, 'Sitemap-accessible evidence does not establish a confirmed positive signal.'));
  } else if (code === 'robots-accessible') {
    if (present) types.push('ROBOTS_ACCESSIBLE');
    else diagnostics.push(diagnostic('NO_SIGNAL_VALUE', evidence, 'Robots-accessible evidence does not establish a confirmed positive signal.'));
  } else {
    diagnostics.push(diagnostic('UNRECOGNIZED_EVIDENCE_CODE', evidence, `Legacy evidence code "${evidence.issueCode ?? evidence.category}" has no Phase 15 scoring vocabulary mapping.`));
  }

  return { signalTypes: types, diagnostics };
}
