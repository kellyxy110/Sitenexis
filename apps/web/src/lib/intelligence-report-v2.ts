import 'server-only';
import {
  assembleCanonicalIntelligenceReportV2,
  buildIntelligenceReportV2Delivery,
  calculateScoringV2Categories,
  composeIntelligenceReportV2Input,
  createConfidenceSummary,
  evaluateFindingEligibility,
  projectLegacyAuditEvidence,
  projectScoringV2Input,
  type IntelligenceReportV2Delivery,
  type LegacyIssueEvidenceRecord,
  type LegacyPageEvidenceRecord,
  type ScoutAnalysisResult,
} from '@sitenexis/shared';
import { deriveModuleAndProviderState, type RawAgentManifestLike } from './intelligence-report-v2-modules';

export interface ProjectStoredAuditToIntelligenceReportV2Options {
  /** Already-fetched ScoutAnalysis row for this audit, if the caller has one. Never fetched here. */
  scoutAnalysis?: ScoutAnalysisResult | null | undefined;
}

/**
 * Read-only adapter: callers supply the already-owned stored audit (and, if
 * available, its already-fetched Scout analysis). No database access,
 * external calls, or module execution occurs here.
 */
export function projectStoredAuditToIntelligenceReportV2(
  audit: Record<string, unknown>,
  options: ProjectStoredAuditToIntelligenceReportV2Options = {},
): IntelligenceReportV2Delivery {
  const pages = (Array.isArray(audit.pages) ? audit.pages : []) as LegacyPageEvidenceRecord[];
  const issues = (Array.isArray(audit.issues) ? audit.issues : []) as LegacyIssueEvidenceRecord[];
  const auditId = String(audit.id);
  const domain = String(audit.domain);
  const completedAt = audit.completedAt instanceof Date ? audit.completedAt.toISOString() : typeof audit.completedAt === 'string' ? audit.completedAt : undefined;
  const startedAt = audit.startedAt instanceof Date ? audit.startedAt.toISOString() : typeof audit.startedAt === 'string' ? audit.startedAt : undefined;

  const evidence = projectLegacyAuditEvidence({ pages, issues }, { domain, ...(completedAt ? { auditTimestamp: completedAt } : {}) });

  const aiVisibilityScores = audit.aiVisibilityScores as { citationProbabilityScore?: number } | null | undefined;
  const { modules, providers } = deriveModuleAndProviderState({
    agentManifest: (audit.agentManifest ?? undefined) as RawAgentManifestLike | undefined,
    citationProbabilityScore: aiVisibilityScores?.citationProbabilityScore,
    scoutAnalysis: options.scoutAnalysis,
  });
  const unavailableProviders = providers.filter((provider) => !provider.available).map((provider) => provider.provider);

  const coverage = pages.length ? {
    discoveredUrls: pages.length,
    attemptedUrls: pages.length,
    successfulUrls: pages.filter((p) => typeof p.statusCode === 'number' && p.statusCode < 400).length,
    renderedUrls: pages.filter((p) => /render|headless/i.test(p.extractionMode ?? '')).length,
    partialUrls: 0,
    failedUrls: pages.filter((p) => (p.statusCode ?? 200) >= 400).length,
    blockedUrls: 0,
    redirectedUrls: pages.filter((p) => typeof p.statusCode === 'number' && p.statusCode >= 300 && p.statusCode < 400).length,
    excludedUrls: 0,
    providersAvailable: providers.filter((provider) => provider.available).map((provider) => provider.provider),
    providersUnavailable: unavailableProviders,
    externalSourcesChecked: 0,
    coverageRatio: pages.length ? pages.filter((p) => typeof p.statusCode === 'number' && p.statusCode < 400).length / pages.length : undefined,
  } : undefined;

  const composed = composeIntelligenceReportV2Input({
    audit: { auditId, domain, auditStartedAt: startedAt, auditCompletedAt: completedAt },
    evidence,
    modules,
    providers,
    coverage,
    confidence: createConfidenceSummary({ reasons: ['Read-time projection from stored audit records.'] }),
    metadata: {
      sourceAuditVersion: 'legacy-stored-audit',
      dataCompletenessNotes: ['No provider, crawler, or module execution is triggered while viewing this report.'],
    },
  });

  const eligibilityByIssueId = Object.fromEntries(issues.map((issue) => [
    issue.id,
    evaluateFindingEligibility({
      audit: composed.input.audit,
      candidate: {
        intendedScope: issue.pageId || issue.pageUrl ? 'PAGE' : 'DOMAIN',
        intendedVerificationState: 'CONFIRMED',
        evidenceIds: [`legacy:issue:${issue.id}`],
        affectedUrls: issue.pageUrl ? [issue.pageUrl] : undefined,
      },
      evidence: composed.input.evidence,
    }),
  ]));

  const assembled = assembleCanonicalIntelligenceReportV2({ input: composed.input, findingProjection: { legacyIssues: issues, eligibilityByIssueId } });
  const calculation = calculateScoringV2Categories(projectScoringV2Input(assembled.report));
  return buildIntelligenceReportV2Delivery(assembled.report, calculation);
}
