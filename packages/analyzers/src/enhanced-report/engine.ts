// Enhanced Report Engine — orchestrates all enrichment modules into EnhancedAuditReport.
// Input: crawled pages + basic computed scores.
// Output: full intelligence report with evidence, fixes, roadmap, and explainable scores.

import type {
  EnhancedAuditReport,
  EnhancedReportInput,
  AuditIssue,
  SchemaRecommendation,
  AIVisibilityRecommendation,
  GeneratedFixSummary,
  RoadmapItem,
  ExpectedImprovement,
  EvidenceRecord,
  ExecutiveSummary,
} from '@sitenexis/shared';
import { enrichSEOIssues, detectSchemaGapIssues, detectContentGapIssues } from './issue-enricher';
import { explainScores } from './score-explainer';
import { analyzePages } from './page-analyzer';
// schema-generator utilities reserved for future use

const ENGINE_VERSION = '2.0.0';

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

// ── Schema recommendations ────────────────────────────────────────────────────

function buildSchemaRecommendations(issues: AuditIssue[]): SchemaRecommendation[] {
  return issues
    .filter((i) => i.category === 'schema' && i.generatedFix?.type === 'json_ld' && i.generatedFix.code)
    .map((i) => ({
      pageUrl: i.affectedPages[0] ?? '',
      schemaType: i.title.split(' ')[0] ?? 'Schema',
      reason: i.whyItMatters.slice(0, 200),
      generatedCode: i.generatedFix!.code!,
      priority: i.severity === 'critical' ? 'high' : i.severity === 'high' ? 'medium' : 'low' as 'high' | 'medium' | 'low',
    }));
}

// ── AI visibility recommendations ─────────────────────────────────────────────

function buildAIVisibilityRecommendations(issues: AuditIssue[], scores: EnhancedAuditReport['scores']): AIVisibilityRecommendation[] {
  const recs: AIVisibilityRecommendation[] = [];

  // Surface gap-specific recommendations
  const aiScore = scores.aiVisibility.value;
  if (aiScore < 60) {
    recs.push({
      title: 'Add FAQPage schema to enable AI Overview inclusion',
      description: 'FAQPage schema is the primary trigger for AI Overview inclusion. AI systems use it to extract direct Q&A answers for conversational queries.',
      impact: 'high',
      effort: 'easy',
      affectedScore: 'AI Visibility, Citation Probability',
      estimatedGain: 14,
    });
  }
  if (scores.entityClarity.value < 70) {
    recs.push({
      title: 'Strengthen entity identity with Organization schema and sameAs links',
      description: 'AI systems use Organization schema to identify the primary entity. sameAs links enable cross-validation against Wikipedia and LinkedIn.',
      impact: 'high',
      effort: 'easy',
      affectedScore: 'Entity Clarity, Machine Trust',
      estimatedGain: 12,
    });
  }
  if (scores.conversionReadiness.value < 60) {
    recs.push({
      title: 'Add speakable schema for voice assistant inclusion',
      description: 'Speakable schema tells voice assistants which page sections to read aloud. Without it, voice assistant inclusion is near-zero.',
      impact: 'medium',
      effort: 'medium',
      affectedScore: 'Voice Retrieval Probability',
      estimatedGain: 8,
    });
  }

  // Add top issue-based AI recommendations
  const aiIssues = issues
    .filter((i) => ['schema', 'entity', 'ai_visibility'].includes(i.category))
    .sort((a, b) => b.expectedImprovement.aiVisibilityGain - a.expectedImprovement.aiVisibilityGain)
    .slice(0, 4);

  for (const issue of aiIssues) {
    if (recs.length >= 6) break;
    recs.push({
      title: issue.title,
      description: issue.whyItMatters.slice(0, 200),
      impact: issue.severity === 'critical' || issue.severity === 'high' ? 'high' : 'medium',
      effort: issue.recommendedSolution.difficulty === 'hard' ? 'medium' : issue.recommendedSolution.difficulty,
      affectedScore: issue.aiVisibilityImpact.affectedSignals.slice(0, 2).join(', '),
      estimatedGain: issue.expectedImprovement.aiVisibilityGain,
    });
  }

  // Deduplicate by title
  const seen = new Set<string>();
  return recs.filter((r) => {
    if (seen.has(r.title)) return false;
    seen.add(r.title);
    return true;
  });
}

// ── Generated fix summaries ───────────────────────────────────────────────────

function buildGeneratedFixes(issues: AuditIssue[]): GeneratedFixSummary[] {
  return issues
    .filter((i) => i.generatedFix)
    .map((i) => ({
      issueId: i.id,
      issueTitle: i.title,
      fixType: i.generatedFix!.type,
      ...(i.generatedFix!.code ? { code: i.generatedFix!.code } : {}),
      ...(i.generatedFix!.copy ? { copy: i.generatedFix!.copy } : {}),
      ...(i.generatedFix!.placementInstructions ? { placementInstructions: i.generatedFix!.placementInstructions } : {}),
    }));
}

// ── Implementation roadmap ────────────────────────────────────────────────────

function buildRoadmap(issues: AuditIssue[]): RoadmapItem[] {
  const sorted = [...issues].sort((a, b) => b.priorityScore - a.priorityScore);

  const week1Issues = sorted.filter((i) => i.severity === 'critical' || (i.severity === 'high' && i.recommendedSolution.difficulty === 'easy'));
  const week2Issues = sorted.filter((i) => i.severity === 'high' && i.recommendedSolution.difficulty !== 'easy');
  const week3Issues = sorted.filter((i) => i.severity === 'medium' && i.recommendedSolution.difficulty !== 'hard');
  const week4Issues = sorted.filter((i) => i.severity === 'low' || i.recommendedSolution.difficulty === 'hard');

  const sumGain = (issList: AuditIssue[]) => ({
    aiVisibility: issList.reduce((s, i) => s + i.expectedImprovement.aiVisibilityGain, 0),
    seo: issList.reduce((s, i) => s + i.expectedImprovement.seoGain, 0),
    trust: issList.reduce((s, i) => s + i.expectedImprovement.trustGain, 0),
  });

  const roadmap: RoadmapItem[] = [];

  if (week1Issues.length > 0) {
    roadmap.push({
      week: 1,
      title: 'Critical fixes — entity schema and primary SEO signals',
      description: 'Address all critical issues and easy high-priority fixes. These have the highest ROI for AI visibility and trust formation.',
      issueIds: week1Issues.slice(0, 6).map((i) => i.id),
      estimatedImpact: sumGain(week1Issues.slice(0, 6)),
      effort: 'easy',
    });
  }

  if (week2Issues.length > 0) {
    roadmap.push({
      week: 2,
      title: 'High-priority improvements — AI retrieval and citation readiness',
      description: 'Implement remaining high-priority fixes. Focus on FAQPage schema, content depth, and external validation.',
      issueIds: week2Issues.slice(0, 5).map((i) => i.id),
      estimatedImpact: sumGain(week2Issues.slice(0, 5)),
      effort: 'medium',
    });
  }

  if (week3Issues.length > 0) {
    roadmap.push({
      week: 3,
      title: 'Medium improvements — schema completeness and trust signals',
      description: 'Complete medium-priority schema and trust improvements. Includes BreadcrumbList, Service schema, and OG tags.',
      issueIds: week3Issues.slice(0, 5).map((i) => i.id),
      estimatedImpact: sumGain(week3Issues.slice(0, 5)),
      effort: 'medium',
    });
  }

  if (week4Issues.length > 0) {
    roadmap.push({
      week: 4,
      title: 'Content and structural optimisation',
      description: 'Expand thin content, improve heading hierarchy, and address remaining low-priority issues.',
      issueIds: week4Issues.slice(0, 5).map((i) => i.id),
      estimatedImpact: sumGain(week4Issues.slice(0, 5)),
      effort: 'hard',
    });
  }

  return roadmap;
}

// ── Expected improvement projection ──────────────────────────────────────────

function buildExpectedImprovement(issues: AuditIssue[], scores: EnhancedAuditReport['scores']): ExpectedImprovement {
  const current = {
    aiVisibility: scores.aiVisibility.value,
    seo: scores.seoHealth.value,
    trust: scores.trustAndEEAT.value,
    overall: scores.overall.value,
  };

  const week1Issues = issues.filter((i) => i.severity === 'critical' || (i.severity === 'high' && i.recommendedSolution.difficulty === 'easy'));
  const allIssues = issues;

  const w1AIGain = clamp(week1Issues.reduce((s, i) => s + i.expectedImprovement.aiVisibilityGain * 0.6, 0));
  const w1SEOGain = clamp(week1Issues.reduce((s, i) => s + i.expectedImprovement.seoGain * 0.6, 0));
  const w1TrustGain = clamp(week1Issues.reduce((s, i) => s + i.expectedImprovement.trustGain * 0.6, 0));

  const totalAIGain = clamp(allIssues.reduce((s, i) => s + i.expectedImprovement.aiVisibilityGain * 0.5, 0));
  const totalSEOGain = clamp(allIssues.reduce((s, i) => s + i.expectedImprovement.seoGain * 0.5, 0));
  const totalTrustGain = clamp(allIssues.reduce((s, i) => s + i.expectedImprovement.trustGain * 0.5, 0));

  const afterWeek1AI = clamp(current.aiVisibility + w1AIGain);
  const afterWeek1SEO = clamp(current.seo + w1SEOGain);
  const afterWeek1Trust = clamp(current.trust + w1TrustGain);

  const afterAllAI = clamp(current.aiVisibility + totalAIGain);
  const afterAllSEO = clamp(current.seo + totalSEOGain);
  const afterAllTrust = clamp(current.trust + totalTrustGain);

  return {
    current,
    afterWeek1: {
      aiVisibility: afterWeek1AI,
      seo: afterWeek1SEO,
      trust: afterWeek1Trust,
      overall: clamp((afterWeek1AI * 0.40 + afterWeek1SEO * 0.35 + afterWeek1Trust * 0.25)),
    },
    afterAllFixes: {
      aiVisibility: afterAllAI,
      seo: afterAllSEO,
      trust: afterAllTrust,
      overall: clamp((afterAllAI * 0.40 + afterAllSEO * 0.35 + afterAllTrust * 0.25)),
    },
    confidence: 0.75,
  };
}

// ── Evidence appendix ─────────────────────────────────────────────────────────

function buildEvidenceAppendix(issues: AuditIssue[]): EvidenceRecord[] {
  return issues.flatMap((issue) =>
    issue.evidence.slice(0, 2).map((ev) => ({
      issueId: issue.id,
      issueTitle: issue.title,
      pageUrl: ev.pageUrl,
      crawlDataField: ev.crawlDataField ?? 'unknown',
      observedValue: ev.observedValue ?? '',
      expectedValue: ev.expectedValue ?? '',
      confidence: ev.confidence,
    })),
  );
}

// ── Executive summary ─────────────────────────────────────────────────────────

function buildExecutiveSummary(
  issues: AuditIssue[],
  scores: EnhancedAuditReport['scores'],
  _pages: EnhancedAuditReport['pageAnalyses'],
): ExecutiveSummary {
  const criticals = issues.filter((i) => i.severity === 'critical');
  const highs = issues.filter((i) => i.severity === 'high');
  const overall = scores.overall.value;

  let headline: string;
  if (overall >= 80) {
    headline = 'Strong AI visibility foundation — targeted optimisations will push this site to top-quartile retrieval performance.';
  } else if (overall >= 65) {
    headline = 'Above-average AI readability with clear improvement opportunities — critical schema and entity gaps are suppressing citation probability and trust scores.';
  } else if (overall >= 50) {
    headline = 'Foundational AI visibility gaps detected — entity schema, FAQPage markup, and external validation are blocking reliable AI retrieval and trust formation.';
  } else {
    headline = 'Significant AI visibility barriers — critical schema, entity, and content gaps are preventing this site from being reliably retrieved, trusted, or cited by AI systems.';
  }

  const keyFindings: string[] = [
    ...scores.overall.negativeSignals.slice(0, 2),
    ...criticals.slice(0, 2).map((i) => i.title),
    ...highs.slice(0, 1).map((i) => i.title),
  ].slice(0, 4);

  const topOpportunities = issues
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 3)
    .map((i) => i.title);

  const estimatedTotalGain = {
    aiVisibility: Math.min(40, issues.reduce((s, i) => s + i.expectedImprovement.aiVisibilityGain * 0.5, 0)),
    seo: Math.min(35, issues.reduce((s, i) => s + i.expectedImprovement.seoGain * 0.5, 0)),
    trust: Math.min(35, issues.reduce((s, i) => s + i.expectedImprovement.trustGain * 0.5, 0)),
  };

  return {
    overallScore: overall,
    headline,
    keyFindings: keyFindings.length > 0 ? keyFindings : ['Analysis complete — see full score breakdown for details'],
    topOpportunities: topOpportunities.length > 0 ? topOpportunities : ['Improve schema completeness', 'Add FAQPage schema', 'Build external validation links'],
    estimatedTotalGain,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export function buildEnhancedReport(input: EnhancedReportInput): EnhancedAuditReport {
  const { auditId, domain, pages, scores, seoIssues, crawlDurationMs } = input;

  // 1. Collect all issues
  const enrichedSEOIssues = enrichSEOIssues(seoIssues, pages, domain);
  const schemaGapIssues = detectSchemaGapIssues(pages, domain);
  const contentGapIssues = detectContentGapIssues(pages, domain);
  const allIssues: AuditIssue[] = [...enrichedSEOIssues, ...schemaGapIssues, ...contentGapIssues];

  // 2. Sort by priority
  allIssues.sort((a, b) => b.priorityScore - a.priorityScore);

  // 3. Bucket by severity
  const criticalIssues = allIssues.filter((i) => i.severity === 'critical');
  const highIssues = allIssues.filter((i) => i.severity === 'high');
  const mediumIssues = allIssues.filter((i) => i.severity === 'medium');
  const lowIssues = allIssues.filter((i) => i.severity === 'low');

  // 4. Explain all 11 scores
  const enhancedScores = explainScores(scores, pages, allIssues);

  // 5. Page-by-page analysis
  const pageAnalyses = analyzePages(pages, allIssues);

  // 6. Schema recommendations
  const schemaRecommendations = buildSchemaRecommendations(allIssues);

  // 7. AI visibility recommendations
  const aiVisibilityRecommendations = buildAIVisibilityRecommendations(allIssues, enhancedScores);

  // 8. Generated fix summaries
  const generatedFixes = buildGeneratedFixes(allIssues);

  // 9. Implementation roadmap
  const implementationRoadmap = buildRoadmap(allIssues);

  // 10. Expected improvements
  const expectedImprovements = buildExpectedImprovement(allIssues, enhancedScores);

  // 11. Evidence appendix
  const evidenceAppendix = buildEvidenceAppendix(allIssues);

  // 12. Executive summary
  const executiveSummary = buildExecutiveSummary(allIssues, enhancedScores, pageAnalyses);

  return {
    meta: {
      auditId,
      domain,
      generatedAt: new Date(),
      pagesAnalyzed: pages.length,
      ...(crawlDurationMs !== undefined ? { crawlDurationMs } : {}),
      engineVersion: ENGINE_VERSION,
    },
    executiveSummary,
    scores: enhancedScores,
    criticalIssues,
    highIssues,
    mediumIssues,
    lowIssues,
    pageAnalyses,
    schemaRecommendations,
    aiVisibilityRecommendations,
    generatedFixes,
    implementationRoadmap,
    expectedImprovements,
    evidenceAppendix,
  };
}
