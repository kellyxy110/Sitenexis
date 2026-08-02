import type {
  CanonicalScorePlaceholder,
  EvidenceContradiction,
  EvidenceProjection,
  EvidenceProjectionConfidence,
  IntelligenceReportV2Delivery,
  RootCauseGroup,
  ScoringV2CategoryTrace,
  VerificationState,
} from '@sitenexis/shared';

/**
 * Typed "Why This Score?" view-model boundary for the Intelligence Report v2
 * page. This does not calculate anything — every number here is read directly
 * from the Phase 15 trace already produced by
 * `calculateScoringV2Categories()` / `buildIntelligenceReportV2Delivery()`.
 * It only translates that trace into human-readable, UI-ready structures.
 */

// ─── Human-readable label maps ─────────────────────────────────────────────

const VERIFICATION_STATE_LABELS: Record<VerificationState, string> = {
  CONFIRMED: 'Confirmed from direct evidence',
  LIKELY: 'Likely, based on strong supporting evidence',
  INFERRED: 'Inferred from related evidence',
  PARTIAL: 'Partially supported',
  UNVERIFIED: 'Not verified',
  CONFLICTING: 'Evidence conflicts',
  NOT_DETECTED: 'Not detected',
  NOT_APPLICABLE: 'Not applicable',
  CRAWL_FAILED: 'Crawl failed — not evaluated',
  TEMPORARY_FAILURE: 'Temporary failure — not evaluated',
  RENDERING_REQUIRED: 'Rendering required to verify',
  EXTERNAL_DATA_REQUIRED: 'External data required to verify',
  PROVIDER_UNAVAILABLE: 'Data provider unavailable',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  HIGH: 'High confidence',
  MODERATE: 'Moderate confidence',
  LOW: 'Low confidence',
  UNKNOWN: 'Confidence unknown',
};

const CATEGORY_STATUS_LABELS: Record<string, string> = {
  CALCULATED: 'Measured',
  PARTIAL: 'Partially measured',
  UNAVAILABLE: 'Not available',
  NOT_APPLICABLE: 'Not applicable to this business',
  NOT_CALCULATED: 'Not yet calculated',
  INSUFFICIENT_EVIDENCE: 'Insufficient evidence to score',
};

const DIAGNOSTIC_LABELS: Record<string, string> = {
  UNMAPPED_SCORING_SIGNAL: 'Some evidence could not be matched to a known scoring signal and was excluded.',
  CATEGORY_NO_EVIDENCE: 'No eligible scoring signal was available for this category.',
  CATEGORY_MEASUREMENT_UNAVAILABLE: 'Some measurement inputs for this category are unavailable.',
  CATEGORY_PARTIAL_COVERAGE: 'This category is based on partial site coverage.',
  CATEGORY_INSUFFICIENT_EVIDENCE: 'There is not enough confirmed evidence to calculate a score for this category.',
  UNKNOWN_APPLICABILITY: 'Whether this category applies to this business was not determined.',
  MODULE_DATA_UNAVAILABLE: 'A module this category depends on did not produce data.',
  CONFIDENCE_CAPPED_BY_COVERAGE: 'Confidence was reduced because site coverage is incomplete.',
};

function humanize(code: string): string {
  const lower = code.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function verificationStateLabel(state: VerificationState): string {
  return VERIFICATION_STATE_LABELS[state] ?? humanize(state);
}

export function confidenceLabelFor(confidence: EvidenceProjectionConfidence | undefined): string {
  if (!confidence) return CONFIDENCE_LABELS['UNKNOWN']!;
  return CONFIDENCE_LABELS[confidence.label] ?? humanize(confidence.label);
}

export function categoryStatusLabel(status: string): string {
  return CATEGORY_STATUS_LABELS[status] ?? humanize(status);
}

export function diagnosticLabel(code: string): string {
  return DIAGNOSTIC_LABELS[code] ?? humanize(code);
}

function coverageLabelFor(coverage: number | undefined): string {
  if (coverage === undefined) return 'Coverage unknown';
  return `${Math.round(coverage * 100)}% of applicable pages measured`;
}

// ─── Trace narrowing ────────────────────────────────────────────────────────

/**
 * `CanonicalScorePlaceholder.metadata.trace` is typed `unknown` in the shared
 * package to avoid a circular import into the scoring engine. This is the one
 * place that value is narrowed, with a runtime shape check — the delivery
 * payload crosses an HTTP fetch boundary before it reaches this view-model,
 * so it is untrusted JSON, not a same-process value.
 */
export function isScoringV2CategoryTrace(value: unknown): value is ScoringV2CategoryTrace {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v['usedSignalIds'])
    && Array.isArray(v['signalTraces'])
    && Array.isArray(v['rootCauseTraces'])
    && Array.isArray(v['diagnostics'])
    && (v['preClampScore'] === null || typeof v['preClampScore'] === 'number')
    && (v['finalScore'] === null || typeof v['finalScore'] === 'number');
}

// ─── Category explanation ("Why This Score?") ──────────────────────────────

export interface ScoreAdjustmentLine {
  label: string;
  /** Positive = added to the score, negative = deducted. */
  amount: number;
  detail?: string | undefined;
}

export interface CategoryExplanation {
  category: string;
  status: string;
  statusLabel: string;
  /** Never coerced to 0 — null means "not scored," which is displayed as such. */
  score: number | null;
  weight: number | undefined;
  confidenceLabel: string;
  confidenceReasons: string[];
  coverageLabel: string;
  baseline: number | null;
  adjustments: ScoreAdjustmentLine[];
  preClampScore: number | null;
  finalScore: number | null;
  unavailableReason: string | undefined;
  diagnostics: string[];
  affectedUrls: string[];
  supportingEvidence: EvidenceProjection[];
  contradictions: EvidenceContradiction[];
  rootCauses: RootCauseGroup[];
  traceAvailable: boolean;
}

function buildAdjustments(trace: ScoringV2CategoryTrace): ScoreAdjustmentLine[] {
  const lines: ScoreAdjustmentLine[] = [];
  if (trace.positiveContribution) {
    lines.push({ label: 'Positive contribution', amount: trace.positiveContribution });
  }
  if (trace.directNegativeDeduction) {
    lines.push({ label: 'Direct deductions', amount: -trace.directNegativeDeduction });
  }
  if (trace.groupedSymptomAppliedDeduction) {
    lines.push({
      label: 'Grouped-symptom effects',
      amount: -trace.groupedSymptomAppliedDeduction,
      detail: trace.groupedSymptomSuppression
        ? `${trace.groupedSymptomSuppression} point(s) suppressed to avoid double-counting a shared root cause`
        : undefined,
    });
  }
  if (trace.rootCausePrimaryAppliedDeduction) {
    lines.push({ label: 'Primary root-cause deduction', amount: -trace.rootCausePrimaryAppliedDeduction });
  }
  if (trace.rootCauseSecondaryAppliedDeduction) {
    lines.push({ label: 'Secondary root-cause deduction (from a root cause primarily affecting another category)', amount: -trace.rootCauseSecondaryAppliedDeduction });
  }
  if (trace.rootCauseCategoryCapSuppression) {
    lines.push({ label: 'Per-category cap suppression', amount: trace.rootCauseCategoryCapSuppression, detail: "Deductions above this category's root-cause cap were not applied" });
  }
  if (trace.rootCauseGlobalCapSuppression) {
    lines.push({ label: 'Global cap suppression', amount: trace.rootCauseGlobalCapSuppression, detail: 'Deductions above the audit-wide root-cause cap were not applied' });
  }
  return lines;
}

export function buildCategoryExplanation(
  score: CanonicalScorePlaceholder,
  report: { evidence: readonly EvidenceProjection[]; contradictions: readonly EvidenceContradiction[]; rootCauses: readonly RootCauseGroup[] },
): CategoryExplanation {
  const rawTrace = score.metadata?.trace;
  const trace = isScoringV2CategoryTrace(rawTrace) ? rawTrace : undefined;
  // `score.state` is a coarse 3-value rollup (CALCULATED/NOT_CALCULATED/UNAVAILABLE).
  // `score.metadata.status` carries the real Phase 15 5-value status
  // (adds PARTIAL/NOT_APPLICABLE/INSUFFICIENT_EVIDENCE) — prefer it so the UI
  // can distinguish "insufficient evidence" from "not applicable" instead of
  // collapsing both into an undifferentiated "not calculated."
  const status = score.metadata?.status || score.state;

  const evidenceIds = new Set(score.evidenceIds);
  const contradictionIds = new Set(score.contradictionIds);
  const rootCauseIds = new Set(score.rootCauseIds);
  const supportingEvidence = report.evidence.filter((item) => evidenceIds.has(item.id));
  const contradictions = report.contradictions.filter((item) => contradictionIds.has(item.id));
  const rootCauses = report.rootCauses.filter((item) => rootCauseIds.has(item.id));
  const affectedUrls = [...new Set(supportingEvidence.flatMap((item) => (item.url ? [item.url] : [])))];

  return {
    category: score.category,
    status,
    statusLabel: categoryStatusLabel(status),
    score: score.score ?? null,
    weight: score.weight,
    confidenceLabel: confidenceLabelFor(score.confidence),
    confidenceReasons: score.confidence?.reasons ?? [],
    coverageLabel: coverageLabelFor(score.coverage),
    baseline: trace?.baseline ?? null,
    adjustments: trace ? buildAdjustments(trace) : [],
    preClampScore: trace?.preClampScore ?? null,
    finalScore: trace?.finalScore ?? score.score ?? null,
    unavailableReason: score.unavailableReason,
    diagnostics: (trace?.diagnostics ?? []).map(diagnosticLabel),
    affectedUrls,
    supportingEvidence,
    contradictions,
    rootCauses,
    traceAvailable: Boolean(trace),
  };
}

// ─── Shallow response guard ─────────────────────────────────────────────────

/**
 * A minimal structural check on the fetched JSON before it is trusted as
 * `IntelligenceReportV2Delivery`. This is not a full schema validator — the
 * payload comes from our own authenticated, same-origin API route — but a
 * fetch response is still untyped JSON until this boundary, so a malformed
 * or error-shaped response degrades to a readable error instead of a runtime
 * crash deep inside a render tree.
 */
export function isLikelyIntelligenceReportV2Delivery(value: unknown): value is IntelligenceReportV2Delivery {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v['report'] === 'object' && v['report'] !== null
    && typeof v['overall'] === 'object' && v['overall'] !== null
    && Array.isArray(v['recommendations'])
    && Array.isArray(v['opportunities'])
    && typeof v['narrative'] === 'object' && v['narrative'] !== null;
}
