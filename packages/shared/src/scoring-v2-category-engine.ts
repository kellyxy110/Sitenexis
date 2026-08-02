import {
  createConfidenceSummary,
  type EvidenceProjectionConfidence,
  type VerificationState,
} from './intelligence-report-v2';
import {
  SCORING_V2_METHODOLOGY_VERSION,
  SCORING_V2_POLICY,
  SCORING_V2_SIGNAL_POLICY,
  type ScoringSignal,
  type ScoringV2Category,
  type ScoringV2CategoryInput,
  type ScoringV2InputProjection,
  validateScoringV2Policy,
} from './scoring-v2-input-projection';

export type ScoringV2CategoryStatus = 'CALCULATED' | 'PARTIAL' | 'UNAVAILABLE' | 'NOT_APPLICABLE' | 'INSUFFICIENT_EVIDENCE';
export type RootCauseImpactRole = 'PRIMARY' | 'SECONDARY' | 'SYMPTOM';

export interface ScoringSignalCalculationTrace {
  signalId: string;
  mapped: boolean;
  category: ScoringV2Category;
  polarity: ScoringSignal['polarity'];
  magnitude?: number | undefined;
  verificationFactor?: number | undefined;
  rawEffect: number;
  appliedEffect: number;
  rootCauseId?: string | undefined;
  rootCauseRole?: RootCauseImpactRole | undefined;
  suppressionFactor?: number | undefined;
  ignoredReason?: 'UNMAPPED' | 'ZERO_VERIFICATION_FACTOR' | 'POLARITY_MISMATCH' | 'NEUTRAL_OR_UNAVAILABLE' | 'WRONG_CATEGORY' | undefined;
  diagnostics: string[];
}

export interface RootCauseScoringTrace {
  rootCauseId: string;
  primaryCategory?: ScoringV2Category | undefined;
  secondaryCategories: ScoringV2Category[];
  rawPrimaryEffect: number;
  appliedPrimaryEffect: number;
  rawSecondaryEffect: number;
  appliedSecondaryEffect: number;
  rawGroupedSymptomEffect: number;
  appliedGroupedSymptomEffect: number;
  categoryCapSuppression: number;
  globalCapSuppression: number;
  associatedSignalIds: string[];
}

export interface ScoringV2CategoryTrace {
  baseline: number | null;
  positiveContribution: number;
  rawNegativeDeduction: number;
  directNegativeDeduction: number;
  groupedSymptomRawDeduction: number;
  groupedSymptomAppliedDeduction: number;
  groupedSymptomSuppression: number;
  rootCausePrimaryRawDeduction: number;
  rootCausePrimaryAppliedDeduction: number;
  rootCauseSecondaryRawDeduction: number;
  rootCauseSecondaryAppliedDeduction: number;
  rootCauseCategoryCapSuppression: number;
  rootCauseGlobalCapSuppression: number;
  deduplicatedNegativeDeduction: number;
  preClampScore: number | null;
  finalScore: number | null;
  usedSignalIds: string[];
  ignoredSignalIds: string[];
  unmappedSignalIds: string[];
  suppressedSignalIds: string[];
  rootCauseIds: string[];
  contradictionIds: string[];
  evidenceIds: string[];
  limitations: string[];
  diagnostics: string[];
  eligibleSignalCount: number;
  categoryDefiningSignalIds: string[];
  unavailableSignalCount: number;
  unmappedSignalCount: number;
  signalTraces: ScoringSignalCalculationTrace[];
  rootCauseTraces: RootCauseScoringTrace[];
}

export interface ScoringV2CategoryResult {
  category: ScoringV2Category;
  status: ScoringV2CategoryStatus;
  score: number | null;
  grade?: string | undefined;
  weight: number;
  baseline: number | null;
  positiveContribution: number;
  negativeDeduction: number;
  rawNegativeDeduction: number;
  deduplicatedNegativeDeduction: number;
  rootCauseAdjustment: number;
  coverage?: number | undefined;
  confidence: EvidenceProjectionConfidence;
  signalIds: string[];
  ignoredSignalIds: string[];
  unmappedSignalIds: string[];
  suppressedSignalIds: string[];
  rootCauseIds: string[];
  diagnostics: string[];
  trace: ScoringV2CategoryTrace;
  methodologyVersion: string;
}

export interface ScoringV2CalculationResult {
  auditId: string;
  domain: string;
  methodologyVersion: string;
  categories: ScoringV2CategoryResult[];
  calculatedCategoryCount: number;
  unavailableCategoryCount: number;
  applicableWeight: number;
  diagnostics: string[];
  metadata: { globalRootCauseCap: number; globalRootCauseCapEnforced: true; categoryOrder: readonly ScoringV2Category[] };
}

type RootCauseLedger = Map<string, number>;
type CategoryRootCauseLedger = Map<string, number>;
const verificationFactors: Record<VerificationState, number> = SCORING_V2_POLICY.verification;

/**
 * Pure Phase 15 category calculation. It accepts only normalized Phase 14
 * scoring inputs and never reads audits, persistence, crawlers, or modules.
 */
export function calculateScoringV2Categories(projection: ScoringV2InputProjection): ScoringV2CalculationResult {
  const policyValidation = validateScoringV2Policy();
  const globalRootCauseLedger: RootCauseLedger = new Map();
  const categoryByName = new Map(projection.categories.map((category) => [category.category, category]));
  const categories = SCORING_V2_POLICY.weights
    ? Object.keys(SCORING_V2_POLICY.weights).map((category) => categoryByName.get(category as ScoringV2Category) ?? emptyCategory(category as ScoringV2Category, projection))
    : projection.categories;
  const results = categories.map((category) => calculateCategory(category, globalRootCauseLedger));
  return {
    auditId: projection.auditId,
    domain: projection.domain,
    methodologyVersion: SCORING_V2_METHODOLOGY_VERSION,
    categories: results,
    calculatedCategoryCount: results.filter((result) => result.score !== null).length,
    unavailableCategoryCount: results.filter((result) => result.status === 'UNAVAILABLE').length,
    applicableWeight: results.filter((result) => result.status !== 'NOT_APPLICABLE').reduce((total, result) => total + result.weight, 0),
    diagnostics: policyValidation.errors,
    metadata: { globalRootCauseCap: SCORING_V2_POLICY.globalRootCauseCap, globalRootCauseCapEnforced: true, categoryOrder: Object.keys(SCORING_V2_POLICY.weights) as ScoringV2Category[] },
  };
}

function calculateCategory(input: ScoringV2CategoryInput, globalLedger: RootCauseLedger): ScoringV2CategoryResult {
  const allSignals = [...input.positiveSignals, ...input.negativeSignals, ...input.neutralSignals, ...input.unavailableSignals];
  const used: Array<{ signal: ScoringSignal; raw: number; magnitude: number; factor: number; categoryDefining: boolean }> = [];
  const traces: ScoringSignalCalculationTrace[] = [];
  const ignored: string[] = [];
  const unmapped: string[] = [];
  const diagnostics: string[] = [];

  for (const signal of allSignals) {
    const policy = SCORING_V2_SIGNAL_POLICY[signal.type];
    if (!policy) {
      ignored.push(signal.id); unmapped.push(signal.id); diagnostics.push('UNMAPPED_SCORING_SIGNAL');
      traces.push({ signalId: signal.id, mapped: false, category: input.category, polarity: signal.polarity, rawEffect: 0, appliedEffect: 0, ignoredReason: 'UNMAPPED', diagnostics: ['UNMAPPED_SCORING_SIGNAL'] });
      continue;
    }
    if (!policy.categories.includes(input.category)) {
      ignored.push(signal.id);
      traces.push({ signalId: signal.id, mapped: true, category: input.category, polarity: signal.polarity, rawEffect: 0, appliedEffect: 0, ignoredReason: 'WRONG_CATEGORY', diagnostics: [] });
      continue;
    }
    if (signal.polarity === 'NEUTRAL' || signal.polarity === 'UNAVAILABLE') {
      ignored.push(signal.id);
      traces.push({ signalId: signal.id, mapped: true, category: input.category, polarity: signal.polarity, rawEffect: 0, appliedEffect: 0, ignoredReason: 'NEUTRAL_OR_UNAVAILABLE', diagnostics: [] });
      continue;
    }
    if (policy.polarity !== signal.polarity) {
      ignored.push(signal.id);
      traces.push({ signalId: signal.id, mapped: true, category: input.category, polarity: signal.polarity, rawEffect: 0, appliedEffect: 0, ignoredReason: 'POLARITY_MISMATCH', diagnostics: [] });
      continue;
    }
    const factor = verificationFactors[signal.verificationState] ?? 0;
    const magnitude = SCORING_V2_POLICY.magnitudes[policy.magnitude];
    if (factor === 0) {
      ignored.push(signal.id);
      traces.push({ signalId: signal.id, mapped: true, category: input.category, polarity: signal.polarity, magnitude, verificationFactor: factor, rawEffect: 0, appliedEffect: 0, ignoredReason: 'ZERO_VERIFICATION_FACTOR', diagnostics: [] });
      continue;
    }
    used.push({ signal, raw: magnitude * factor, magnitude, factor, categoryDefining: Boolean(policy.categoryDefining) });
  }

  const unavailableCount = input.unavailableSignals.length;
  const definingIds = used.filter((entry) => entry.categoryDefining && entry.magnitude >= SCORING_V2_POLICY.magnitudes.HIGH).map((entry) => entry.signal.id);
  const common = createTrace(input, traces, ignored, unmapped, diagnostics, used.length, definingIds, unavailableCount);
  if (input.applicable === 'NOT_APPLICABLE') return finish(input, 'NOT_APPLICABLE', common);
  if (used.length === 0) return finish(input, unavailableCount > 0 ? 'UNAVAILABLE' : 'INSUFFICIENT_EVIDENCE', common);
  if (input.coverage !== undefined && input.coverage < SCORING_V2_POLICY.coverage.lowConfidenceCap) return finish(input, 'INSUFFICIENT_EVIDENCE', common);
  if (used.length < 2 && definingIds.length === 0) return finish(input, 'INSUFFICIENT_EVIDENCE', common);

  let positive = 0;
  let directNegative = 0;
  let groupedRaw = 0;
  let groupedApplied = 0;
  let primaryRaw = 0;
  let primaryApplied = 0;
  let secondaryRaw = 0;
  let secondaryApplied = 0;
  let categoryCapSuppression = 0;
  let globalCapSuppression = 0;
  const suppressed = new Set<string>();
  const rootCauseTraces = new Map<string, RootCauseScoringTrace>();
  const categoryLedger: CategoryRootCauseLedger = new Map();

  for (const entry of used) {
    const { signal, raw, magnitude, factor } = entry;
    if (signal.polarity === 'POSITIVE') {
      positive += raw;
      traces.push({ signalId: signal.id, mapped: true, category: input.category, polarity: signal.polarity, magnitude, verificationFactor: factor, rawEffect: raw, appliedEffect: raw, diagnostics: [] });
      continue;
    }

    const rootCauseId = signal.rootCauseIds[0] ?? signal.deduplicationGroup;
    const role: RootCauseImpactRole | undefined = rootCauseId
      ? (signal.rootCauseRole ?? (signal.isPrimaryRootCauseSignal ? 'PRIMARY' : 'SYMPTOM'))
      : undefined;
    let requested = raw;
    let suppressionFactor: number | undefined;
    if (role === 'SECONDARY') { requested = raw * SCORING_V2_POLICY.secondaryRootCauseFactor; secondaryRaw += raw; }
    if (role === 'SYMPTOM') { requested = raw * SCORING_V2_POLICY.groupedSymptomFactor; groupedRaw += raw; suppressionFactor = SCORING_V2_POLICY.groupedSymptomFactor; }
    if (role === 'PRIMARY') primaryRaw += raw;
    if (!rootCauseId) directNegative += requested;

    let applied = requested;
    let capSuppression = 0;
    let globalSuppression = 0;
    if (rootCauseId) {
      const alreadyInCategory = categoryLedger.get(rootCauseId) ?? 0;
      const categoryAvailable = Math.max(0, SCORING_V2_POLICY.perCategoryRootCauseCap - alreadyInCategory);
      if (applied > categoryAvailable) { capSuppression = applied - categoryAvailable; applied = categoryAvailable; }
      const globallyApplied = globalLedger.get(rootCauseId) ?? 0;
      const globalAvailable = Math.max(0, SCORING_V2_POLICY.globalRootCauseCap - globallyApplied);
      if (applied > globalAvailable) { globalSuppression = applied - globalAvailable; applied = globalAvailable; }
      categoryLedger.set(rootCauseId, alreadyInCategory + applied);
      globalLedger.set(rootCauseId, globallyApplied + applied);
      const rootTrace = rootCauseTraces.get(rootCauseId) ?? { rootCauseId, primaryCategory: role === 'PRIMARY' ? input.category : undefined, secondaryCategories: [], rawPrimaryEffect: 0, appliedPrimaryEffect: 0, rawSecondaryEffect: 0, appliedSecondaryEffect: 0, rawGroupedSymptomEffect: 0, appliedGroupedSymptomEffect: 0, categoryCapSuppression: 0, globalCapSuppression: 0, associatedSignalIds: [] };
      rootTrace.associatedSignalIds.push(signal.id);
      if (role === 'PRIMARY') { rootTrace.rawPrimaryEffect += raw; rootTrace.appliedPrimaryEffect += applied; }
      if (role === 'SECONDARY') { rootTrace.rawSecondaryEffect += raw; rootTrace.appliedSecondaryEffect += applied; if (!rootTrace.secondaryCategories.includes(input.category)) rootTrace.secondaryCategories.push(input.category); }
      if (role === 'SYMPTOM') { rootTrace.rawGroupedSymptomEffect += raw; rootTrace.appliedGroupedSymptomEffect += applied; }
      rootTrace.categoryCapSuppression += capSuppression;
      rootTrace.globalCapSuppression += globalSuppression;
      rootCauseTraces.set(rootCauseId, rootTrace);
    }
    if (role === 'PRIMARY') primaryApplied += applied;
    if (role === 'SECONDARY') secondaryApplied += applied;
    if (role === 'SYMPTOM') groupedApplied += applied;
    categoryCapSuppression += capSuppression;
    globalCapSuppression += globalSuppression;
    if (applied < raw) suppressed.add(signal.id);
    traces.push({ signalId: signal.id, mapped: true, category: input.category, polarity: signal.polarity, magnitude, verificationFactor: factor, rawEffect: raw, appliedEffect: applied, rootCauseId, rootCauseRole: role, suppressionFactor, diagnostics: applied < raw ? ['ROOT_CAUSE_DUPLICATE_SUPPRESSED'] : [] });
  }

  const rawNegative = directNegative + groupedRaw + primaryRaw + secondaryRaw;
  const deduction = directNegative + groupedApplied + primaryApplied + secondaryApplied;
  const preClamp = SCORING_V2_POLICY.baseline + positive - deduction;
  const score = clamp(preClamp, 0, 100);
  const status = coverageStatus(input.coverage);
  if (status === 'PARTIAL') diagnostics.push('CATEGORY_PARTIAL_COVERAGE');
  const trace = createTrace(input, traces, ignored, unmapped, diagnostics, used.length, definingIds, unavailableCount);
  trace.baseline = SCORING_V2_POLICY.baseline;
  trace.positiveContribution = positive;
  trace.rawNegativeDeduction = rawNegative;
  trace.directNegativeDeduction = directNegative;
  trace.groupedSymptomRawDeduction = groupedRaw;
  trace.groupedSymptomAppliedDeduction = groupedApplied;
  trace.groupedSymptomSuppression = groupedRaw - groupedApplied;
  trace.rootCausePrimaryRawDeduction = primaryRaw;
  trace.rootCausePrimaryAppliedDeduction = primaryApplied;
  trace.rootCauseSecondaryRawDeduction = secondaryRaw;
  trace.rootCauseSecondaryAppliedDeduction = secondaryApplied;
  trace.rootCauseCategoryCapSuppression = categoryCapSuppression;
  trace.rootCauseGlobalCapSuppression = globalCapSuppression;
  trace.deduplicatedNegativeDeduction = deduction;
  trace.preClampScore = preClamp;
  trace.finalScore = score;
  trace.suppressedSignalIds = [...suppressed];
  trace.rootCauseIds = [...rootCauseTraces.keys()];
  trace.rootCauseTraces = [...rootCauseTraces.values()];
  return finish(input, status, trace, score);
}

function createTrace(input: ScoringV2CategoryInput, signalTraces: ScoringSignalCalculationTrace[], ignored: string[], unmapped: string[], diagnostics: string[], eligibleSignalCount: number, definingIds: string[], unavailableCount: number): ScoringV2CategoryTrace {
  return { baseline: null, positiveContribution: 0, rawNegativeDeduction: 0, directNegativeDeduction: 0, groupedSymptomRawDeduction: 0, groupedSymptomAppliedDeduction: 0, groupedSymptomSuppression: 0, rootCausePrimaryRawDeduction: 0, rootCausePrimaryAppliedDeduction: 0, rootCauseSecondaryRawDeduction: 0, rootCauseSecondaryAppliedDeduction: 0, rootCauseCategoryCapSuppression: 0, rootCauseGlobalCapSuppression: 0, deduplicatedNegativeDeduction: 0, preClampScore: null, finalScore: null, usedSignalIds: signalTraces.filter((trace) => trace.appliedEffect !== 0).map((trace) => trace.signalId), ignoredSignalIds: [...ignored], unmappedSignalIds: [...unmapped], suppressedSignalIds: [], rootCauseIds: [], contradictionIds: [...input.contradictionIds], evidenceIds: [...input.evidenceIds], limitations: [...input.limitations], diagnostics: [...diagnostics], eligibleSignalCount, categoryDefiningSignalIds: [...definingIds], unavailableSignalCount: unavailableCount, unmappedSignalCount: unmapped.length, signalTraces, rootCauseTraces: [] };
}

function finish(input: ScoringV2CategoryInput, status: ScoringV2CategoryStatus, trace: ScoringV2CategoryTrace, score: number | null = null): ScoringV2CategoryResult {
  const confidence = cappedConfidence(input.confidence, input.coverage, trace.diagnostics);
  if (status === 'UNAVAILABLE') trace.diagnostics.push('CATEGORY_MEASUREMENT_UNAVAILABLE');
  if (status === 'INSUFFICIENT_EVIDENCE') trace.diagnostics.push('CATEGORY_INSUFFICIENT_EVIDENCE');
  trace.finalScore = score;
  return { category: input.category, status, score, ...(score === null ? {} : { grade: grade(score) }), weight: SCORING_V2_POLICY.weights[input.category], baseline: score === null ? null : SCORING_V2_POLICY.baseline, positiveContribution: trace.positiveContribution, negativeDeduction: trace.deduplicatedNegativeDeduction, rawNegativeDeduction: trace.rawNegativeDeduction, deduplicatedNegativeDeduction: trace.deduplicatedNegativeDeduction, rootCauseAdjustment: trace.rawNegativeDeduction - trace.deduplicatedNegativeDeduction, coverage: input.coverage, confidence, signalIds: [...trace.usedSignalIds], ignoredSignalIds: [...trace.ignoredSignalIds], unmappedSignalIds: [...trace.unmappedSignalIds], suppressedSignalIds: [...trace.suppressedSignalIds], rootCauseIds: [...trace.rootCauseIds], diagnostics: [...trace.diagnostics], trace, methodologyVersion: input.methodologyVersion };
}

function coverageStatus(coverage?: number): ScoringV2CategoryStatus {
  if (coverage === undefined) return 'CALCULATED';
  if (coverage >= SCORING_V2_POLICY.coverage.moderateConfidenceCap) return 'CALCULATED';
  return 'PARTIAL';
}

function cappedConfidence(confidence: EvidenceProjectionConfidence, coverage: number | undefined, diagnostics: string[]): EvidenceProjectionConfidence {
  const result = createConfidenceSummary(confidence);
  if (coverage !== undefined && coverage >= SCORING_V2_POLICY.coverage.moderateConfidenceCap && coverage < SCORING_V2_POLICY.coverage.calculated && result.label === 'HIGH') { result.label = 'MODERATE'; diagnostics.push('CONFIDENCE_CAPPED_BY_COVERAGE'); }
  if (coverage !== undefined && coverage >= SCORING_V2_POLICY.coverage.lowConfidenceCap && coverage < SCORING_V2_POLICY.coverage.partial && result.label !== 'UNKNOWN' && result.label !== 'LOW') { result.label = 'LOW'; diagnostics.push('CONFIDENCE_CAPPED_BY_COVERAGE'); }
  return result;
}

function grade(score: number): string { return SCORING_V2_POLICY.grades.find((entry) => score >= entry.minimum)?.grade ?? 'CRITICAL'; }
function clamp(value: number, minimum: number, maximum: number): number { return Math.min(maximum, Math.max(minimum, value)); }
function emptyCategory(category: ScoringV2Category, projection: ScoringV2InputProjection): ScoringV2CategoryInput { return { category, applicable: 'UNKNOWN', evidenceIds: [], findingIds: [], contradictionIds: [], rootCauseIds: [], moduleIds: [], positiveSignals: [], negativeSignals: [], neutralSignals: [], unavailableSignals: [], confidence: createConfidenceSummary(), limitations: [], providerDependencies: [], methodologyVersion: projection.methodologyVersion }; }