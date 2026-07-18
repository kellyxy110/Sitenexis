/**
 * Page Intelligence — deterministic finding pool + traceability enforcement.
 *
 * Hard rule: an AI-generated recommendation is only real if it can be traced back
 * to something SiteNexis's deterministic engines actually found. This module builds
 * the closed set of citable findings for one page (real Issue records, retrieval
 * simulation failures, and page-level score/content facts), and validates that
 * every recommendation the LLM proposes cites only ids from that set — anything
 * that fails is discarded, never surfaced to the user.
 *
 * Pure and DB/LLM-free by design, so the safety property is directly unit-testable.
 */

export interface Finding {
  id: string;
  label: string;
}

export interface PageFacts {
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  wordCount: number;
  seoScore: number | null;
  aiScore: number | null;
}

export interface IssueFinding {
  id: string;
  module: string;
  type: string;
  severity: string;
  message: string;
}

export interface RetrievalFailureFinding {
  stage: string;
  description: string;
  severity: string;
}

export function buildFindingPool(params: {
  page: PageFacts;
  issues: IssueFinding[];
  retrievalFailures?: RetrievalFailureFinding[];
}): Finding[] {
  const findings: Finding[] = [];

  for (const issue of params.issues) {
    findings.push({ id: `issue:${issue.id}`, label: `[${issue.severity}] ${issue.module}/${issue.type}: ${issue.message}` });
  }

  if (params.page.seoScore != null) {
    findings.push({ id: 'score:seo', label: `SEO score is ${params.page.seoScore}/100` });
  }
  if (params.page.aiScore != null) {
    findings.push({ id: 'score:ai', label: `AI extractability score is ${params.page.aiScore}/100` });
  }
  findings.push({ id: 'fact:wordCount', label: `Page has ${params.page.wordCount} words` });
  if (!params.page.title) findings.push({ id: 'fact:missingTitle', label: 'Page has no <title> tag' });
  if (!params.page.metaDescription) findings.push({ id: 'fact:missingMeta', label: 'Page has no meta description' });
  if (!params.page.h1) findings.push({ id: 'fact:missingH1', label: 'Page has no H1 tag' });

  (params.retrievalFailures ?? []).forEach((f, i) => {
    findings.push({ id: `retrieval:${i}`, label: `[${f.severity}] ${f.stage}: ${f.description}` });
  });

  return findings;
}

export interface RecommendationCandidate {
  action: string;
  rationale: string;
  sourceFindingIds: string[];
  expectedImpact: string;
}

/**
 * Discard any recommendation that cites zero findings, or cites an id outside the
 * pool (a hallucinated finding). This is the actual enforcement of the Engineering
 * Rule — prompting the LLM to cite findings is necessary but not sufficient.
 */
export function filterTraceableRecommendations(
  recommendations: RecommendationCandidate[],
  findingPool: Finding[],
): RecommendationCandidate[] {
  const validIds = new Set(findingPool.map((f) => f.id));
  return recommendations.filter(
    (r) => r.sourceFindingIds.length > 0 && r.sourceFindingIds.every((id) => validIds.has(id)),
  );
}
