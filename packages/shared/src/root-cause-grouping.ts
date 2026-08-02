import { createConfidenceSummary, type EvidenceProjectionConfidence, type EvidenceScope } from './intelligence-report-v2';
import type { IntelligenceReportV2Input } from './intelligence-report-v2-input';
import type { EvidenceContradiction } from './evidence-contradictions';

export const ROOT_CAUSE_TYPES = [
  'ENTITY_IDENTITY_INCONSISTENCY', 'CONTACT_IDENTITY_INCONSISTENCY', 'CANONICAL_CONFIGURATION_CONFLICT',
  'RENDERING_DEPENDENCY', 'STRUCTURED_DATA_IDENTITY_CONFLICT', 'PAGE_CLASSIFICATION_UNCERTAINTY',
  'PROVIDER_UNAVAILABILITY', 'MODULE_EXECUTION_LIMITATION', 'CRAWL_RETRIEVAL_LIMITATION',
  'GOVERNANCE_POLICY_CONFLICT', 'CONTENT_EVIDENCE_GAP', 'TRUST_EVIDENCE_GAP',
  'LOCAL_IDENTITY_INCONSISTENCY', 'EXTERNAL_AUTHORITY_EVIDENCE_GAP', 'HISTORICAL_COMPARABILITY_LIMITATION',
] as const;
export type RootCauseType = (typeof ROOT_CAUSE_TYPES)[number];

export interface RootCauseGroup {
  id: string;
  type: RootCauseType;
  subject: string;
  scope: EvidenceScope;
  title: string;
  description?: string | undefined;
  evidenceIds: string[];
  contradictionIds: string[];
  findingCandidateIds: string[];
  affectedUrls: string[];
  modules: string[];
  primaryCategory: string;
  secondaryCategories: string[];
  confidence: EvidenceProjectionConfidence;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'warning' | 'info';
  groupingReason: string;
  metadata?: Record<string, string | number | boolean | null> | undefined;
}

/** Optional caller-supplied, already eligible symptom metadata. */
export interface RootCauseFindingCandidate {
  id: string;
  rootCauseType?: RootCauseType | undefined;
  subject?: string | undefined;
  scope?: EvidenceScope | undefined;
  evidenceIds?: readonly string[] | undefined;
  affectedUrls?: readonly string[] | undefined;
  modules?: readonly string[] | undefined;
  confidence?: EvidenceProjectionConfidence | undefined;
}

export interface RootCauseGroupingInput {
  input: IntelligenceReportV2Input;
  contradictions?: readonly EvidenceContradiction[] | undefined;
  findingCandidates?: readonly RootCauseFindingCandidate[] | undefined;
}

/** Pure grouping only. It creates no persistence, score impacts, or recommendations. */
export function groupRootCauses(request: RootCauseGroupingInput): RootCauseGroup[] {
  const groups = new Map<string, RootCauseGroup>();
  for (const contradiction of request.contradictions ?? []) {
    const target = targetForContradiction(contradiction);
    if (!target) continue;
    add(groups, target, contradiction);
  }
  for (const comparison of request.input.rawRenderedComparisons) {
    if (!['h1', 'bodyTextLength', 'contentHash'].includes(comparison.field) || comparison.relationship !== 'RENDERED_ONLY') continue;
    const subject = `page:${comparison.url ?? 'unknown'}:rendering`;
    addSynthetic(groups, { type: 'RENDERING_DEPENDENCY', subject, scope: 'PAGE', evidenceIds: [], affectedUrls: comparison.url ? [comparison.url] : [], modules: [], confidence: comparison.confidence, severity: 'medium', reason: `Rendered-only ${comparison.field} evidence indicates a rendering dependency.` });
  }
  for (const provider of request.input.providers) {
    if (provider.available) continue;
    const relatedModules = request.input.modules.filter((module) => module.provider?.toLowerCase() === provider.provider.toLowerCase() && ['UNAVAILABLE', 'BLOCKED', 'FAILED', 'PARTIAL'].includes(module.state));
    if (relatedModules.length === 0) continue;
    addSynthetic(groups, { type: 'PROVIDER_UNAVAILABILITY', subject: `provider:${provider.provider.toLowerCase()}`, scope: 'PROVIDER_DATA', evidenceIds: [], affectedUrls: [], modules: relatedModules.map((module) => module.moduleId), confidence: createConfidenceSummary({ reasons: [provider.reason ?? 'Provider unavailable.'] }), severity: 'medium', reason: `${relatedModules.length} module limitation(s) share unavailable provider ${provider.provider}.` });
  }
  for (const candidate of request.findingCandidates ?? []) {
    if (!candidate.rootCauseType || !candidate.subject) continue;
    addSynthetic(groups, { type: candidate.rootCauseType, subject: candidate.subject, scope: candidate.scope ?? 'DOMAIN', evidenceIds: [...(candidate.evidenceIds ?? [])], affectedUrls: [...(candidate.affectedUrls ?? [])], modules: [...(candidate.modules ?? [])], confidence: candidate.confidence ?? createConfidenceSummary(), severity: 'low', reason: 'Caller supplied eligible candidate metadata.', findingCandidateId: candidate.id });
  }
  return [...groups.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function targetForContradiction(item: EvidenceContradiction): { type: RootCauseType; subject: string; scope: EvidenceScope } | undefined {
  if (['ENTITY_NAME_CONFLICT', 'LEGAL_NAME_CONFLICT', 'EMAIL_DOMAIN_CONFLICT', 'SOCIAL_IDENTITY_CONFLICT'].includes(item.type)) return { type: 'ENTITY_IDENTITY_INCONSISTENCY', subject: 'organization.identity', scope: 'ORGANISATION' };
  if (['EMAIL_CONFLICT', 'PHONE_CONFLICT', 'ADDRESS_CONFLICT', 'LOCATION_CONFLICT'].includes(item.type)) return { type: item.type === 'ADDRESS_CONFLICT' || item.type === 'LOCATION_CONFLICT' ? 'LOCAL_IDENTITY_INCONSISTENCY' : 'CONTACT_IDENTITY_INCONSISTENCY', subject: item.type.startsWith('PHONE') || item.type.startsWith('EMAIL') ? 'organization.contact' : 'organization.localIdentity', scope: item.type === 'ADDRESS_CONFLICT' || item.type === 'LOCATION_CONFLICT' ? 'LOCAL_PRESENCE' : 'ORGANISATION' };
  if (item.type === 'CANONICAL_CONFLICT') return { type: 'CANONICAL_CONFIGURATION_CONFLICT', subject: `page:${item.affectedUrls[0] ?? item.subject}:canonical`, scope: 'PAGE' };
  if (item.type === 'SCHEMA_VISIBLE_CONTENT_CONFLICT' || item.type === 'SCHEMA_ENTITY_CONFLICT') return { type: 'STRUCTURED_DATA_IDENTITY_CONFLICT', subject: item.subject, scope: item.scope };
  if (item.type === 'PAGE_CLASSIFICATION_CONFLICT') return { type: 'PAGE_CLASSIFICATION_UNCERTAINTY', subject: item.subject, scope: 'PAGE' };
  if (item.type === 'CRAWLER_POLICY_CONFLICT' || item.type === 'GOVERNANCE_POLICY_CONFLICT') return { type: 'GOVERNANCE_POLICY_CONFLICT', subject: item.subject, scope: 'DOMAIN' };
  if (item.type === 'PROVIDER_EVIDENCE_CONFLICT') return { type: 'PROVIDER_UNAVAILABILITY', subject: item.subject.replace('.availability', ''), scope: 'PROVIDER_DATA' };
  if (item.type === 'CURRENT_HISTORICAL_CONFLICT') return { type: 'HISTORICAL_COMPARABILITY_LIMITATION', subject: item.subject, scope: 'HISTORICAL_TREND' };
  if (item.type === 'MODULE_STATE_CLAIM_CONFLICT') return { type: 'MODULE_EXECUTION_LIMITATION', subject: item.subject, scope: 'DOMAIN' };
  return undefined;
}

function add(groups: Map<string, RootCauseGroup>, target: { type: RootCauseType; subject: string; scope: EvidenceScope }, contradiction: EvidenceContradiction): void {
  addSynthetic(groups, { type: target.type, subject: target.subject, scope: target.scope, evidenceIds: contradiction.evidenceIds, contradictionId: contradiction.id, affectedUrls: contradiction.affectedUrls, modules: contradiction.modules, confidence: contradiction.confidence, severity: contradiction.severity, reason: contradiction.reason });
}
function addSynthetic(groups: Map<string, RootCauseGroup>, item: { type: RootCauseType; subject: string; scope: EvidenceScope; evidenceIds: string[]; contradictionId?: string; findingCandidateId?: string; affectedUrls: string[]; modules: string[]; confidence: EvidenceProjectionConfidence; severity: RootCauseGroup['severity']; reason: string }): void {
  const id = `root-cause:${item.type}:${item.scope}:${item.subject}`;
  const existing = groups.get(id);
  if (existing) {
    existing.evidenceIds = unique([...existing.evidenceIds, ...item.evidenceIds]);
    existing.contradictionIds = unique([...existing.contradictionIds, ...(item.contradictionId ? [item.contradictionId] : [])]);
    existing.findingCandidateIds = unique([...existing.findingCandidateIds, ...(item.findingCandidateId ? [item.findingCandidateId] : [])]);
    existing.affectedUrls = unique([...existing.affectedUrls, ...item.affectedUrls]);
    existing.modules = unique([...existing.modules, ...item.modules]);
    existing.confidence = combine(existing.confidence, item.confidence);
    existing.severity = maxSeverity(existing.severity, item.severity);
    return;
  }
  const categories = categoriesFor(item.type);
  groups.set(id, { id, type: item.type, subject: item.subject, scope: item.scope, title: titleFor(item.type), evidenceIds: unique(item.evidenceIds), contradictionIds: item.contradictionId ? [item.contradictionId] : [], findingCandidateIds: item.findingCandidateId ? [item.findingCandidateId] : [], affectedUrls: unique(item.affectedUrls), modules: unique(item.modules), primaryCategory: categories.primary, secondaryCategories: categories.secondary, confidence: item.confidence, severity: item.severity, groupingReason: item.reason });
}
function categoriesFor(type: RootCauseType): { primary: string; secondary: string[] } { const map: Record<RootCauseType, { primary: string; secondary: string[] }> = { ENTITY_IDENTITY_INCONSISTENCY: { primary: 'Entity Consistency', secondary: ['Entity Authenticity', 'Machine Trust', 'Brand Consistency'] }, CONTACT_IDENTITY_INCONSISTENCY: { primary: 'Entity Consistency', secondary: ['Machine Trust', 'Local Visibility'] }, CANONICAL_CONFIGURATION_CONFLICT: { primary: 'Technical SEO', secondary: ['AI Retrievability'] }, RENDERING_DEPENDENCY: { primary: 'Web Health and Crawlability', secondary: ['AI Retrievability', 'On-Page SEO'] }, STRUCTURED_DATA_IDENTITY_CONFLICT: { primary: 'Structured Data', secondary: ['Entity Consistency', 'Machine Trust'] }, PAGE_CLASSIFICATION_UNCERTAINTY: { primary: 'On-Page SEO', secondary: ['AI Answer Readiness'] }, PROVIDER_UNAVAILABILITY: { primary: 'Citation Authority', secondary: [] }, MODULE_EXECUTION_LIMITATION: { primary: 'Web Health and Crawlability', secondary: [] }, CRAWL_RETRIEVAL_LIMITATION: { primary: 'Crawl Stability', secondary: ['AI Retrievability'] }, GOVERNANCE_POLICY_CONFLICT: { primary: 'Security and Governance', secondary: ['Machine Trust'] }, CONTENT_EVIDENCE_GAP: { primary: 'Content Depth and Information Gain', secondary: ['Citation Readiness'] }, TRUST_EVIDENCE_GAP: { primary: 'E-E-A-T', secondary: ['AI Recommendation Readiness'] }, LOCAL_IDENTITY_INCONSISTENCY: { primary: 'Local Visibility', secondary: ['Entity Consistency'] }, EXTERNAL_AUTHORITY_EVIDENCE_GAP: { primary: 'Citation Authority', secondary: ['E-E-A-T'] }, HISTORICAL_COMPARABILITY_LIMITATION: { primary: 'Temporal Authority', secondary: [] } }; return map[type]; }
function titleFor(type: RootCauseType): string { return type.split('_').map((word) => word[0] + word.slice(1).toLowerCase()).join(' '); }
function combine(left: EvidenceProjectionConfidence, right: EvidenceProjectionConfidence): EvidenceProjectionConfidence { const scores = [left.score, right.score].filter((score): score is number => score !== undefined); return createConfidenceSummary({ score: scores.length ? Math.min(...scores) : undefined, evidenceCount: (left.evidenceCount ?? 0) + (right.evidenceCount ?? 0), reasons: ['Root-cause confidence is bounded by weaker supporting evidence.'] }); }
function maxSeverity(left: RootCauseGroup['severity'], right: RootCauseGroup['severity']): RootCauseGroup['severity'] { const rank: Record<RootCauseGroup['severity'], number> = { info: 0, low: 1, warning: 2, medium: 3, high: 4, critical: 5 }; return rank[right] > rank[left] ? right : left; }
function unique(values: readonly string[]): string[] { return [...new Set(values.filter(Boolean))]; }