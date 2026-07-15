/**
 * Builds a COMPACT audit summary for the SiteNexis Intelligence assistant.
 *
 * Hard rule: only a small, bounded digest of an already-completed audit is sent to
 * Agnes — never the full crawl, page bodies, or chunk text. Pure and unit-testable.
 * The deterministic scores here are SiteNexis's source of truth; Agnes only reasons
 * over them.
 */

export interface AuditSummaryInput {
  domain: string;
  status: string;
  pageCount: number | null;
  scores: { overall: number; seoScore: number; aiScore: number } | null;
  aiVisibilityScores: {
    aiVisibilityScore: number;
    entityConfidenceScore: number;
    citationProbabilityScore: number;
    machineReadabilityScore: number;
    semanticTrustScore: number;
  } | null;
  issues: Array<{
    module: string;
    type: string;
    severity: string;
    message: string;
    recommendation: string | null;
  }>;
  entities: Array<{ name: string; type: string }> | null;
}

export interface CompactAuditSummary {
  domain: string;
  pageCount: number | null;
  scores: Record<string, number>;
  topIssues: Array<{ module: string; type: string; severity: string; message: string; recommendation: string | null }>;
  issueCounts: { critical: number; warning: number; info: number };
  primaryEntities: Array<{ name: string; type: string }>;
}

const MAX_ISSUES = 12;
const MAX_ENTITIES = 8;
const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

export function buildCompactAuditSummary(input: AuditSummaryInput): CompactAuditSummary {
  const scores: Record<string, number> = {};
  if (input.scores) {
    scores.overall = input.scores.overall;
    scores.seo = input.scores.seoScore;
    scores.ai = input.scores.aiScore;
  }
  if (input.aiVisibilityScores) {
    const v = input.aiVisibilityScores;
    scores.aiVisibility = v.aiVisibilityScore;
    scores.entityConfidence = v.entityConfidenceScore;
    scores.citationProbability = v.citationProbabilityScore;
    scores.machineReadability = v.machineReadabilityScore;
    scores.semanticTrust = v.semanticTrustScore;
  }

  const sorted = [...input.issues].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3),
  );
  const topIssues = sorted.slice(0, MAX_ISSUES).map((i) => ({
    module: i.module,
    type: i.type,
    severity: i.severity,
    // Bound each field so a hostile audit record can't bloat the prompt.
    message: (i.message ?? '').slice(0, 240),
    recommendation: i.recommendation ? i.recommendation.slice(0, 240) : null,
  }));

  const issueCounts = {
    critical: input.issues.filter((i) => i.severity === 'critical').length,
    warning: input.issues.filter((i) => i.severity === 'warning').length,
    info: input.issues.filter((i) => i.severity === 'info').length,
  };

  const primaryEntities = (input.entities ?? [])
    .slice(0, MAX_ENTITIES)
    .map((e) => ({ name: (e.name ?? '').slice(0, 80), type: e.type }));

  return { domain: input.domain, pageCount: input.pageCount, scores, topIssues, issueCounts, primaryEntities };
}

/** Serialize the compact summary to a stable, token-efficient JSON block for the prompt. */
export function summaryToPromptBlock(summary: CompactAuditSummary): string {
  return JSON.stringify(summary);
}
