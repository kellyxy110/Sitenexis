import type { MRSInput, MRSInputIssue, MRSRecommendation, MRSReport, MRSScore } from '@sitenexis/shared';

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const severityWeight = { critical: 3, warning: 2, info: 1 } as const;

function scoreCard(key: string, label: string, value: number | null, formula: string, evidenceCount: number): MRSScore {
  return { key, label, value: value == null ? null : clamp(value), confidence: evidenceCount ? Math.min(1, 0.55 + evidenceCount / 100) : 0, formula, evidenceCount };
}

function recommendationFor(issue: MRSInputIssue): MRSRecommendation {
  const priority = issue.severity === 'critical' ? 'P0' : issue.severity === 'warning' ? 'P1' : 'P2';
  const lowEffort = /schema|canonical|robots|metadata|sitemap/i.test(`${issue.module} ${issue.type}`);
  const difficulty = lowEffort ? 'low' : /performance|content|link/i.test(`${issue.module} ${issue.type}`) ? 'medium' : 'high';
  return {
    id: `recommendation:${issue.id}`,
    priority,
    module: issue.module,
    title: issue.message,
    explanation: `This recommendation is based on the ${issue.severity} finding recorded by the ${issue.module} module. The affected evidence is ${issue.pageUrl ?? 'site-wide'}.`,
    implementationGuide: issue.recommendation,
    businessImpact: priority === 'P0' ? 'Reduces a material risk to discovery, trust, or conversion.' : 'Improves the reliability of site signals used in discovery and evaluation.',
    seoImpact: 'Supports cleaner crawling, indexing, or search presentation when the issue affects search signals.',
    aiImpact: 'Improves the evidence available to retrieval and citation systems when the issue affects machine interpretation.',
    difficulty,
    estimatedTime: difficulty === 'low' ? '15 to 30 minutes' : difficulty === 'medium' ? '1 to 3 hours' : '1 to 2 days',
    confidence: issue.severity === 'critical' ? 0.92 : issue.severity === 'warning' ? 0.8 : 0.66,
    evidenceIds: [`issue:${issue.id}`],
  };
}

export function buildMachineResourceStudioReport(input: MRSInput): MRSReport {
  const timestamp = input.audit.completedAt ?? new Date().toISOString();
  const pageCount = input.pages.length;
  const ai = input.aiVisibility;
  const scores = input.scores;
  const evidence = [
    ...input.pages.slice(0, 100).map((page) => ({ id: `page:${page.id}`, source: 'crawl' as const, module: 'crawl', detail: `${page.url} returned HTTP ${page.statusCode}, has ${page.wordCount} words, ${page.internalLinks} internal links, and ${page.externalLinks} external links.`, timestamp, confidence: 0.98 })),
    ...input.issues.map((issue) => ({ id: `issue:${issue.id}`, source: 'issue' as const, module: issue.module, detail: issue.message, timestamp: issue.createdAt, confidence: issue.severity === 'critical' ? 0.92 : issue.severity === 'warning' ? 0.8 : 0.66 })),
  ];
  const scoreCards = [
    scoreCard('overall', 'Overall health', scores?.overall ?? null, 'Stored audit overall score.', pageCount),
    scoreCard('seo', 'Google readiness', scores?.seoScore ?? null, 'Stored SEO score from crawl and page signals.', pageCount),
    scoreCard('ai', 'AI visibility', ai?.aiVisibilityScore ?? scores?.aiScore ?? null, 'AI visibility composite from stored machine signals.', pageCount),
    scoreCard('schema', 'Structured data', scores?.schemaScore ?? null, 'Stored schema coverage score.', pageCount),
    scoreCard('links', 'Authority flow', scores?.linkGraphScore ?? null, 'Stored internal link graph score.', pageCount),
    scoreCard('performance', 'Performance', scores?.performanceScore ?? null, 'Stored performance score.', pageCount),
    scoreCard('citation', 'Citation readiness', ai?.citationProbabilityScore ?? null, 'Stored citation probability score.', ai ? pageCount : 0),
    scoreCard('retrieval', 'Retrieval readiness', ai?.retrievalReadinessScore ?? null, 'Stored retrieval readiness score.', ai ? pageCount : 0),
    scoreCard('trust', 'Machine trust', ai?.semanticTrustScore ?? null, 'Stored semantic trust score.', ai ? pageCount : 0),
  ];
  const available = scoreCards.map((item) => item.value).filter((value): value is number => value != null);
  const overallScore = scores?.overall ?? (available.length ? clamp(available.reduce((sum, value) => sum + value, 0) / available.length) : null);
  const critical = input.issues.filter((issue) => issue.severity === 'critical').length;
  const warnings = input.issues.filter((issue) => issue.severity === 'warning').length;
  const infos = input.issues.filter((issue) => issue.severity === 'info').length;
  const topIssue = [...input.issues].sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity])[0];
  const scoreText = overallScore == null ? 'No overall score is available' : `The audit has an overall health score of ${overallScore} out of 100`;
  return {
    auditId: input.audit.id,
    domain: input.audit.domain,
    generatedAt: new Date().toISOString(),
    overallScore,
    executiveSummary: topIssue ? `${scoreText}. The main action is to address the ${topIssue.severity} ${topIssue.module} finding: ${topIssue.message}. This report uses ${pageCount} crawled pages and ${input.issues.length} stored findings as evidence.` : `${scoreText}. No stored issues are available for this audit. Run a completed audit with the required modules to produce recommendations.`,
    technicalExplanation: pageCount ? `The crawl found ${pageCount} pages. ${input.pages.filter((page) => page.isIndexable).length} pages are marked indexable. The score cards show how crawl, page structure, links, schema, and performance contribute to technical readiness.` : 'The audit has no stored page evidence. Technical scores cannot be interpreted until a crawl completes.',
    aiExplanation: ai ? 'The AI visibility record includes machine readability, entity confidence, retrieval readiness, citation probability, semantic trust, and recommendation confidence. These values describe machine interpretation signals. They do not guarantee a citation or recommendation from any AI provider.' : 'No AI visibility record is available. AI interpretation risks remain unknown until the related agents complete.',
    strengths: scoreCards.filter((item) => (item.value ?? 0) >= 80).map((item) => `${item.label} is ${item.value}/100.`),
    weaknesses: scoreCards.filter((item) => item.value != null && item.value < 50).map((item) => `${item.label} is ${item.value}/100 and needs attention.`),
    scoreCards,
    issueDistribution: [{ label: 'Critical', value: critical, color: '#F87171' }, { label: 'Warning', value: warnings, color: '#FBBF24' }, { label: 'Info', value: infos, color: '#38BDF8' }],
    recommendations: [...input.issues].sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity]).slice(0, 10).map(recommendationFor),
    evidence,
    limitations: [ ...(pageCount ? [] : ['No crawl pages are stored for this audit.']), ...(input.issues.length ? [] : ['No issue records are stored for this audit.']), ...(ai ? [] : ['AI visibility scores are unavailable for this audit.']) ],
  };
}
