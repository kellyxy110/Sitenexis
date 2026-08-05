/**
 * Second Brain — deterministic core types.
 *
 * Every type here describes plain data: foreign keys, timestamps,
 * classification labels, and values copied verbatim from existing canonical
 * tables (AuditScore, AIVisibilityScore, MachineTrustScore, Issue). Nothing
 * in this module or its siblings (change-engine, issue-fingerprint,
 * issue-lifecycle-engine, website-memory) calls routeTask, callAI, or any
 * AI provider — see the "LLM-independence proof" section of the SB1 report
 * for how this is tested, not just asserted.
 */

export type DedupeSeverity = 'critical' | 'warning' | 'info';

export type AuditChangeClassification =
  | 'IMPROVED'
  | 'REGRESSED'
  | 'UNCHANGED'
  | 'INTRODUCED'
  | 'RESOLVED'
  | 'PERSISTENT';

export type IssueLifecycleState = 'FIRST_SEEN' | 'PERSISTING' | 'RESOLVED' | 'REGRESSED';

export type IssueLifecycleEventType = 'OPENED' | 'PERSISTED' | 'RESOLVED' | 'REGRESSED';

/**
 * The eight canonical headline metrics compared audit-to-audit in SB1.
 * `machineTrustScore` is sourced from `machine_trust_scores.overall` ONLY —
 * never AIVisibilityScore.semanticTrustScore, which is a different, v2
 * metric that a prior bug once confused it with (see project history:
 * "Fix MRS Machine Trust card reading wrong field").
 */
export const CANONICAL_METRIC_KEYS = [
  'overall',
  'seoScore',
  'aiVisibilityScore',
  'entityConfidenceScore',
  'retrievalReadinessScore',
  'citationProbabilityScore',
  'semanticTrustScore',
  'machineTrustScore',
] as const;

export type MetricKey = (typeof CANONICAL_METRIC_KEYS)[number];

/** null means the underlying score row does not exist for this audit — unavailable, never coerced to 0. */
export type AuditScoreSnapshot = {
  auditId: string;
} & Record<MetricKey, number | null>;

export interface MetricChange {
  metricKey: MetricKey;
  previousValue: number | null;
  currentValue: number | null;
  classification: AuditChangeClassification;
}

export interface RawIssueForFingerprint {
  module: string;
  type: string;
  severity: DedupeSeverity;
  pageUrl?: string | null;
}

export interface CurrentIssueGroup {
  fingerprint: string;
  fingerprintVersion: string;
  module: string;
  type: string;
  severity: DedupeSeverity;
  affectedPageCount: number;
}

export interface IssueMemorySnapshot {
  fingerprint: string;
  fingerprintVersion: string;
  module: string;
  type: string;
  severity: DedupeSeverity;
  lifecycleState: IssueLifecycleState;
}

export interface IssueLifecycleTransition {
  fingerprint: string;
  fingerprintVersion: string;
  module: string;
  type: string;
  severity: DedupeSeverity;
  affectedPageCount: number;
  eventType: IssueLifecycleEventType;
  newLifecycleState: IssueLifecycleState;
}

export interface WebsiteMemoryCandidate {
  auditId: string;
  /** Canonical audit timestamp — Audit.completedAt, falling back to createdAt. ISO 8601. */
  auditAt: string;
}

export interface WebsiteMemoryResolution {
  firstAuditId: string;
  firstAuditAt: string;
  changed: boolean;
}
