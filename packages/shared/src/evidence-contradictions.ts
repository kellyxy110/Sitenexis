import {
  createConfidenceSummary,
  type EvidenceProjection,
  type EvidenceProjectionConfidence,
  type EvidenceScope,
  type EvidenceValue,
} from './intelligence-report-v2';
import type { IntelligenceReportV2Input } from './intelligence-report-v2-input';
import type { PageClassificationEvidence } from './finding-integrity';

export const EVIDENCE_CONTRADICTION_TYPES = [
  'ENTITY_NAME_CONFLICT', 'LEGAL_NAME_CONFLICT', 'EMAIL_CONFLICT', 'EMAIL_DOMAIN_CONFLICT', 'PHONE_CONFLICT',
  'ADDRESS_CONFLICT', 'LOCATION_CONFLICT', 'CANONICAL_CONFLICT', 'TITLE_CONFLICT', 'H1_CONFLICT',
  'SCHEMA_VISIBLE_CONTENT_CONFLICT', 'SCHEMA_ENTITY_CONFLICT', 'PAGE_CLASSIFICATION_CONFLICT',
  'SOCIAL_IDENTITY_CONFLICT', 'PRODUCT_RELATIONSHIP_CONFLICT', 'CRAWLER_POLICY_CONFLICT',
  'GOVERNANCE_POLICY_CONFLICT', 'MODULE_STATE_CLAIM_CONFLICT', 'CURRENT_HISTORICAL_CONFLICT',
  'RAW_RENDERED_CONFLICT', 'PROVIDER_EVIDENCE_CONFLICT',
] as const;
export type EvidenceContradictionType = (typeof EVIDENCE_CONTRADICTION_TYPES)[number];

export const CONTRADICTION_RESOLUTION_STATUSES = [
  'UNRESOLVED', 'POSSIBLE_VARIANT', 'REQUIRES_VERIFICATION', 'RESOLVED_BY_EVIDENCE',
] as const;
export type ContradictionResolutionStatus = (typeof CONTRADICTION_RESOLUTION_STATUSES)[number];

export interface ContradictionValue {
  value: string;
  normalizedValue: string;
  evidenceIds: string[];
  sourceLayers: string[];
  urls: string[];
  observedAt?: string | undefined;
  moduleIds: string[];
  confidence: EvidenceProjectionConfidence;
}

/** Read-time conflict record. It never declares one conflicting value correct. */
export interface EvidenceContradiction {
  id: string;
  type: EvidenceContradictionType;
  subject: string;
  scope: EvidenceScope;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'warning' | 'info';
  confidence: EvidenceProjectionConfidence;
  evidenceIds: string[];
  values: ContradictionValue[];
  affectedUrls: string[];
  modules: string[];
  reason: string;
  resolutionStatus: ContradictionResolutionStatus;
  metadata?: Record<string, EvidenceValue> | undefined;
}

/** Structured claims only. This phase never parses narrative prose. */
export interface ModuleOutputClaim {
  id: string;
  moduleId: string;
  assertion: 'ABSENCE' | 'ZERO_FINDINGS';
  evidenceIds?: readonly string[] | undefined;
}

export interface ContradictionDetectionInput {
  input: IntelligenceReportV2Input;
  claims?: readonly ModuleOutputClaim[] | undefined;
  pageClassifications?: readonly PageClassificationEvidence[] | undefined;
  /** Enables an explicit continuity check; history is otherwise excluded. */
  compareHistoricalContinuity?: boolean | undefined;
}

/**
 * Detects deterministic, evidence-backed current-state disagreements only.
 * Historical evidence is excluded unless a caller explicitly requests continuity.
 */
export function detectEvidenceContradictions(request: ContradictionDetectionInput): EvidenceContradiction[] {
  const current = request.input.evidence.filter(isEligibleCurrentEvidence.bind(null, request.input));
  const contradictions = [
    ...detectGroupedEvidenceConflicts(current),
    ...detectRawRenderedConflicts(request.input),
    ...detectModuleStateClaimConflicts(request.input, request.claims ?? []),
    ...detectPageClassificationConflicts(request.pageClassifications ?? []),
    ...detectProviderEvidenceConflicts(request.input, current),
  ];
  if (request.compareHistoricalContinuity) contradictions.push(...detectHistoricalContinuityConflicts(request.input, current));
  return deduplicate(contradictions);
}

function detectGroupedEvidenceConflicts(evidence: readonly EvidenceProjection[]): EvidenceContradiction[] {
  const groups = new Map<string, EvidenceProjection[]>();
  for (const item of evidence) {
    const subject = subjectFor(item);
    const value = valueFor(item);
    if (!subject || value === undefined || value === '') continue;
    const key = subject.scope === 'PAGE' ? `${subject.name}:${item.url ?? item.pageId ?? item.id}` : subject.name;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].flatMap(([key, items]) => {
    let type = typeForSubject(key, items);
    if (!type) return [];
    const values = groupValues(items, key);
    if (values.length < 2 || values.every((value) => value.normalizedValue === values[0]?.normalizedValue)) return [];
    if (type === 'EMAIL_CONFLICT' && sameEmailDomain(values) && !hasPrimaryEmailRole(items)) return [];
    if (type === 'EMAIL_CONFLICT' && !sameEmailDomain(values)) type = 'EMAIL_DOMAIN_CONFLICT';
    const scope = items.some((item) => item.scope === 'PAGE') ? 'PAGE' : items[0]?.scope ?? 'DOMAIN';
    return [contradiction({ type, subject: stripPageKey(key), scope, values, reason: reasonFor(type), resolutionStatus: type === 'EMAIL_CONFLICT' ? 'POSSIBLE_VARIANT' : 'REQUIRES_VERIFICATION' })];
  });
}

function detectRawRenderedConflicts(input: IntelligenceReportV2Input): EvidenceContradiction[] {
  return input.rawRenderedComparisons.flatMap((comparison) => {
    if (comparison.relationship !== 'DIFFERENT') return [];
    const type = comparison.field === 'canonicalUrl' ? 'CANONICAL_CONFLICT'
      : comparison.field === 'title' ? 'TITLE_CONFLICT'
        : comparison.field === 'h1' ? 'H1_CONFLICT' : 'RAW_RENDERED_CONFLICT';
    const url = comparison.url;
    const values = [
      rawRenderedValue('raw', comparison.rawValue, `raw:${input.audit.auditId}:${url ?? comparison.field}:${comparison.field}`, url, comparison.confidence),
      rawRenderedValue('rendered', comparison.renderedValue, `rendered:${input.audit.auditId}:${url ?? comparison.field}:${comparison.field}`, url, comparison.confidence),
    ].filter((value): value is ContradictionValue => value !== undefined);
    if (values.length < 2) return [];
    return [contradiction({ type, subject: `page.${comparison.field}`, scope: 'PAGE', values, reason: `Raw and rendered ${comparison.field} values differ.`, resolutionStatus: 'REQUIRES_VERIFICATION' })];
  });
}

function detectModuleStateClaimConflicts(input: IntelligenceReportV2Input, claims: readonly ModuleOutputClaim[]): EvidenceContradiction[] {
  return claims.flatMap((claim) => {
    const module = input.modules.find((summary) => summary.moduleId === claim.moduleId);
    if (!module || module.state === 'COMPLETED') return [];
    const evidenceIds = [...(claim.evidenceIds ?? [])];
    const values: ContradictionValue[] = [
      valueFromText(`module:${module.state}`, `module:${module.moduleId}`, undefined, createConfidenceSummary({ reasons: ['Module state supplied by caller.'] }), module.moduleId),
      valueFromText(`claim:${claim.assertion}`, `claim:${claim.id}`, undefined, createConfidenceSummary({ reasons: ['Structured claim supplied by caller.'] }), claim.moduleId),
    ];
    return [contradiction({
      type: 'MODULE_STATE_CLAIM_CONFLICT', subject: `module.${claim.moduleId}.state`, scope: 'DOMAIN', values,
      reason: `A ${claim.assertion.toLowerCase()} claim is incompatible with module state ${module.state}.`,
      resolutionStatus: 'REQUIRES_VERIFICATION', additionalEvidenceIds: evidenceIds,
    })];
  });
}

function detectPageClassificationConflicts(classifications: readonly PageClassificationEvidence[]): EvidenceContradiction[] {
  const groups = new Map<string, PageClassificationEvidence[]>();
  for (const item of classifications) {
    if (item.classification === 'UNKNOWN' || item.confidence.score === undefined || item.confidence.score < 0.5) continue;
    const key = item.url ?? item.pageId;
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].flatMap(([key, items]) => {
    const kinds = new Set(items.map((item) => item.classification));
    if (kinds.size < 2) return [];
    const values = items.map((item) => ({ value: item.classification, normalizedValue: item.classification, evidenceIds: [...item.evidenceIds], sourceLayers: [], urls: item.url ? [item.url] : [], moduleIds: [], confidence: item.confidence }));
    return [contradiction({ type: 'PAGE_CLASSIFICATION_CONFLICT', subject: 'page.classification', scope: 'PAGE', values, reason: `Multiple supported classifications were supplied for ${key}.`, resolutionStatus: 'POSSIBLE_VARIANT' })];
  });
}

function detectProviderEvidenceConflicts(input: IntelligenceReportV2Input, evidence: readonly EvidenceProjection[]): EvidenceContradiction[] {
  return input.providers.flatMap((provider) => {
    if (provider.available) return [];
    const providerEvidence = evidence.filter((item) => item.sourceLayer === 'BACKLINK_PROVIDER' || item.sourceLayer === 'PROVIDER_API').filter((item) => providerName(item) === provider.provider.toLowerCase());
    if (providerEvidence.length === 0) return [];
    const values = [
      valueFromText('provider:unavailable', `provider:${provider.provider}:unavailable`, undefined, createConfidenceSummary({ reasons: [provider.reason ?? 'Provider unavailable.'] })),
      ...groupValues(providerEvidence, `provider.${provider.provider}`),
    ];
    return [contradiction({ type: 'PROVIDER_EVIDENCE_CONFLICT', subject: `provider.${provider.provider}.availability`, scope: 'PROVIDER_DATA', values, reason: 'Provider-backed evidence was supplied while the provider is marked unavailable.', resolutionStatus: 'REQUIRES_VERIFICATION' })];
  });
}

function detectHistoricalContinuityConflicts(input: IntelligenceReportV2Input, current: readonly EvidenceProjection[]): EvidenceContradiction[] {
  const historical = input.historicalEvidence ?? [];
  return current.flatMap((item) => {
    const subject = subjectFor(item);
    const currentValue = valueFor(item);
    if (!subject || currentValue === undefined) return [];
    const old = historical.filter((other) => subjectFor(other)?.name === subject.name).filter((other) => valueFor(other) !== undefined && normalize(subject.name, valueFor(other)!) !== normalize(subject.name, currentValue));
    if (old.length === 0) return [];
    const values = groupValues([item, ...old], subject.name);
    return [contradiction({ type: 'CURRENT_HISTORICAL_CONFLICT', subject: subject.name, scope: 'HISTORICAL_TREND', values, reason: 'Current and historical values differ under an explicit continuity comparison.', resolutionStatus: 'REQUIRES_VERIFICATION' })];
  });
}

function isEligibleCurrentEvidence(input: IntelligenceReportV2Input, item: EvidenceProjection): boolean {
  return item.auditId === input.audit.auditId
    && sameDomain(item.domain, input.audit.domain)
    && item.observationType !== 'INFERENCE'
    && !['CRAWL_FAILED', 'TEMPORARY_FAILURE', 'PROVIDER_UNAVAILABLE', 'EXTERNAL_DATA_REQUIRED'].includes(item.verificationState);
}

function subjectFor(item: EvidenceProjection): { name: string; scope: 'PAGE' | 'DOMAIN' } | undefined {
  const explicit = text(item.metadata?.subject) ?? text(item.metadata?.identitySubject) ?? text(item.metadata?.policySubject);
  const code = (item.issueCode ?? '').toLowerCase();
  const map: Record<string, string> = {
    'organization-name': 'organization.name', 'legal-name': 'organization.legalName', email: 'organization.email',
    phone: 'organization.phone', address: 'organization.address', location: 'organization.location', canonical: 'page.canonical',
    canonicalurl: 'page.canonical', title: 'page.title', h1: 'page.h1', 'social-identity': 'organization.socialIdentity',
    'product-relationship': 'organization.productRelationship', 'crawler-policy': 'crawler.policy', 'governance-policy': 'governance.policy',
  };
  const name = explicit ?? map[code];
  if (!name) return undefined;
  return { name, scope: name.startsWith('page.') ? 'PAGE' : 'DOMAIN' };
}

function valueFor(item: EvidenceProjection): string | undefined {
  return text(item.normalizedValue) ?? text(item.rawValue) ?? (item.issueCode === 'canonical' ? item.canonicalUrl ?? undefined : undefined);
}

function groupValues(items: readonly EvidenceProjection[], subject: string): ContradictionValue[] {
  const groups = new Map<string, EvidenceProjection[]>();
  for (const item of items) {
    const value = valueFor(item);
    if (value === undefined) continue;
    const normalized = normalize(subject, value);
    groups.set(normalized, [...(groups.get(normalized) ?? []), item]);
  }
  return [...groups.entries()].map(([normalizedValue, group]) => ({
    value: valueFor(group[0]!)!, normalizedValue, evidenceIds: group.map((item) => item.id),
    sourceLayers: unique(group.flatMap((item) => item.sourceLayer ? [item.sourceLayer] : [])),
    urls: unique(group.flatMap((item) => item.url ? [item.url] : [])), observedAt: group[0]?.detectedAt,
    moduleIds: unique(group.flatMap((item) => item.moduleId ? [item.moduleId] : [])), confidence: combinedConfidence(group.map((item) => item.confidence)),
  }));
}

function typeForSubject(key: string, items: readonly EvidenceProjection[]): EvidenceContradictionType | undefined {
  const subject = stripPageKey(key);
  if (subject.startsWith('crawler.')) return 'CRAWLER_POLICY_CONFLICT';
  if (subject.startsWith('governance.')) return 'GOVERNANCE_POLICY_CONFLICT';
  if (subject === 'organization.name') return items.some((item) => item.sourceLayer === 'STRUCTURED_DATA') ? 'SCHEMA_VISIBLE_CONTENT_CONFLICT' : 'ENTITY_NAME_CONFLICT';
  return ({ 'organization.legalName': 'LEGAL_NAME_CONFLICT', 'organization.email': 'EMAIL_CONFLICT', 'organization.phone': 'PHONE_CONFLICT', 'organization.address': 'ADDRESS_CONFLICT', 'organization.location': 'LOCATION_CONFLICT', 'page.canonical': 'CANONICAL_CONFLICT', 'page.title': 'TITLE_CONFLICT', 'page.h1': 'H1_CONFLICT', 'organization.socialIdentity': 'SOCIAL_IDENTITY_CONFLICT', 'organization.productRelationship': 'PRODUCT_RELATIONSHIP_CONFLICT', 'crawler.policy': 'CRAWLER_POLICY_CONFLICT', 'governance.policy': 'GOVERNANCE_POLICY_CONFLICT' } as Record<string, EvidenceContradictionType | undefined>)[subject];
}

function contradiction(input: { type: EvidenceContradictionType; subject: string; scope: EvidenceScope; values: ContradictionValue[]; reason: string; resolutionStatus: ContradictionResolutionStatus; additionalEvidenceIds?: string[] }): EvidenceContradiction {
  const evidenceIds = unique([...input.values.flatMap((value) => value.evidenceIds), ...(input.additionalEvidenceIds ?? [])]);
  return {
    id: `${input.type}:${input.subject}:${input.scope}:${input.values.map((value) => value.normalizedValue).sort().join('|')}`,
    type: input.type, subject: input.subject, scope: input.scope, severity: severityFor(input.type),
    confidence: combinedConfidence(input.values.map((value) => value.confidence)), evidenceIds, values: input.values,
    affectedUrls: unique(input.values.flatMap((value) => value.urls)), modules: unique(input.values.flatMap((value) => value.moduleIds)),
    reason: input.reason, resolutionStatus: input.resolutionStatus,
  };
}

function rawRenderedValue(label: string, value: EvidenceValue | null | undefined, id: string, url: string | undefined, confidence: EvidenceProjectionConfidence): ContradictionValue | undefined {
  const textValue = text(value);
  if (textValue === undefined) return undefined;
  return { value: textValue, normalizedValue: normalize('raw-rendered', textValue), evidenceIds: [id], sourceLayers: [label === 'raw' ? 'RAW_HTML' : 'RENDERED_DOM'], urls: url ? [url] : [], moduleIds: [], confidence };
}

function valueFromText(value: string, id: string, url: string | undefined, confidence: EvidenceProjectionConfidence, moduleId?: string): ContradictionValue {
  return { value, normalizedValue: value.toLowerCase(), evidenceIds: [id], sourceLayers: [], urls: url ? [url] : [], moduleIds: moduleId ? [moduleId] : [], confidence };
}

function normalize(subject: string, value: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ').toLowerCase();
  if (subject.includes('email')) return trimmed;
  if (subject.includes('phone')) return trimmed.replace(/[\s()\-.]/g, '');
  if (subject.includes('canonical') || subject.includes('url')) {
    try { const url = new URL(trimmed); return `${url.protocol}//${url.hostname}${url.pathname.replace(/\/$/, '') || '/'}${url.search}`; } catch { return trimmed; }
  }
  return trimmed;
}

function sameEmailDomain(values: readonly ContradictionValue[]): boolean {
  const domains = values.map((value) => value.normalizedValue.split('@')[1]).filter(Boolean);
  return new Set(domains).size === 1;
}
function hasPrimaryEmailRole(items: readonly EvidenceProjection[]): boolean {
  return items.some((item) => ['PRIMARY_EMAIL', 'primary'].includes(text(item.metadata?.contactRole) ?? ''));
}
function providerName(item: EvidenceProjection): string | undefined { return text(item.metadata?.provider)?.toLowerCase(); }
function stripPageKey(value: string): string { return value.replace(/:(?:https?:\/\/|[^:]+$).*/, ''); }
function reasonFor(type: EvidenceContradictionType): string { return `Current eligible observations disagree about ${type.toLowerCase().replace(/_/g, ' ')}.`; }
function severityFor(type: EvidenceContradictionType): EvidenceContradiction['severity'] { return ['CANONICAL_CONFLICT', 'MODULE_STATE_CLAIM_CONFLICT', 'PROVIDER_EVIDENCE_CONFLICT'].includes(type) ? 'high' : ['EMAIL_CONFLICT', 'EMAIL_DOMAIN_CONFLICT', 'ADDRESS_CONFLICT', 'SCHEMA_VISIBLE_CONTENT_CONFLICT'].includes(type) ? 'medium' : 'low'; }
function combinedConfidence(values: readonly EvidenceProjectionConfidence[]): EvidenceProjectionConfidence { const scores = values.map((value) => value.score).filter((score): score is number => score !== undefined); return createConfidenceSummary({ score: scores.length ? Math.min(...scores) : undefined, evidenceCount: values.length, sourceLayerCount: undefined, reasons: ['Deterministic contradiction confidence is bounded by the weaker supplied evidence.'] }); }
function sameDomain(left: string, right: string): boolean { return normalize('url', left) === normalize('url', right) || left.toLowerCase() === right.toLowerCase(); }
function text(value: EvidenceValue | string | null | undefined): string | undefined { return typeof value === 'string' && value.trim() ? value.trim() : undefined; }
function unique(values: readonly string[]): string[] { return [...new Set(values.filter(Boolean))]; }
function deduplicate(items: readonly EvidenceContradiction[]): EvidenceContradiction[] { const groups = new Map<string, EvidenceContradiction>(); for (const item of items) { const existing = groups.get(item.id); if (!existing) groups.set(item.id, item); else groups.set(item.id, { ...existing, evidenceIds: unique([...existing.evidenceIds, ...item.evidenceIds]), affectedUrls: unique([...existing.affectedUrls, ...item.affectedUrls]), modules: unique([...existing.modules, ...item.modules]) }); } return [...groups.values()]; }