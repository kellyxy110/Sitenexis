// Score Explainer — produces ExplainableScore for all 11 score dimensions.
// Each score has a reason, positive signals, negative signals, top 3 fixes,
// and an estimated score after fixes. Every deduction is named and attributable.

import type { CrawledPage, AuditIssue, ExplainableScore, EnhancedScores } from '@sitenexis/shared';

export interface ScoreInput {
  seoScore: number;
  schemaScore: number;
  aiScore: number;
  machineReadabilityScore: number;
  entityConfidenceScore: number;
  retrievalReadinessScore: number;
  citationProbabilityScore: number;
  semanticTrustScore: number;
  recommendationConfidence: number;
  overall: number;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function topIssueGains(
  issues: AuditIssue[],
  relevantCategories: AuditIssue['category'][],
  gainField: 'aiVisibilityGain' | 'seoGain' | 'trustGain',
  limit = 3,
): Array<{ action: string; estimatedGain: number }> {
  return issues
    .filter((i) => relevantCategories.includes(i.category) && i.expectedImprovement[gainField] > 0)
    .sort((a, b) => b.expectedImprovement[gainField] - a.expectedImprovement[gainField])
    .slice(0, limit)
    .map((i) => ({ action: i.title, estimatedGain: i.expectedImprovement[gainField] }));
}

export function explainScores(
  raw: ScoreInput,
  pages: CrawledPage[],
  issues: AuditIssue[],
): EnhancedScores {
  const allSchemaTypes = new Set(pages.flatMap((p) => p.schemaTypes ?? []));
  const pagesWithSchema = pages.filter((p) => p.hasStructuredData ?? (p.schemaTypes?.length ?? 0) > 0);
  const pagesWithH1 = pages.filter((p) => p.h1);
  const pagesWithDesc = pages.filter((p) => p.metaDescription);
  const pagesWithCanonical = pages.filter((p) => p.canonicalUrl);
  const hasFAQSchema = allSchemaTypes.has('FAQPage');
  const hasOrgSchema = allSchemaTypes.has('Organization') || allSchemaTypes.has('LocalBusiness');
  const hasSameAs = pages.some((p) => p.schemaMarkup.some((s) => typeof s === 'object' && s !== null && 'sameAs' in s));
  const avgWordCount = pages.reduce((s, p) => s + p.wordCount, 0) / Math.max(1, pages.length);
  const allExternal = pages.flatMap((p) => p.externalLinks);
  const criticalIssues = issues.filter((i) => i.severity === 'critical');
  const highIssues = issues.filter((i) => i.severity === 'high');

  // ── Overall ──────────────────────────────────────────────────────────────────
  const overallPositive: string[] = [];
  const overallNegative: string[] = [];
  if (raw.overall >= 70) overallPositive.push('Site-wide intelligence score is in the Good range');
  if (hasOrgSchema) overallPositive.push('Organization schema defines the primary entity');
  if (hasSameAs) overallPositive.push('sameAs links enable external entity validation');
  if (hasFAQSchema) overallPositive.push('FAQPage schema improves AI retrieval candidacy');
  if (pagesWithH1.length === pages.length) overallPositive.push('All pages have H1 headings');
  if (pagesWithCanonical.length === pages.length) overallPositive.push('All pages declare canonical URLs');
  if (criticalIssues.length > 0) overallNegative.push(`${criticalIssues.length} critical issue${criticalIssues.length > 1 ? 's' : ''} requiring immediate attention`);
  if (highIssues.length > 0) overallNegative.push(`${highIssues.length} high-priority issue${highIssues.length > 1 ? 's' : ''} suppressing scores`);
  if (!hasOrgSchema) overallNegative.push('Primary entity identity undefined — Organization schema missing');
  if (!hasSameAs) overallNegative.push('No sameAs links — entity cannot be cross-validated');

  const overallGain = issues.reduce((s, i) => s + (i.expectedImprovement.aiVisibilityGain + i.expectedImprovement.seoGain) / 2, 0);
  const overallTopFixes = issues
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 3)
    .map((i) => ({ action: i.title, estimatedGain: Math.round((i.expectedImprovement.aiVisibilityGain + i.expectedImprovement.seoGain) / 2) }));

  const overall: ExplainableScore = {
    dimension: 'Overall Machine Intelligence Score',
    value: raw.overall,
    reason: raw.overall >= 70
      ? 'Above the baseline threshold — core signals are present but material improvements are available.'
      : raw.overall >= 50
      ? 'Below the Good threshold — several foundational signals are missing or weak, limiting AI visibility and trust formation.'
      : 'Critical gaps in foundational AI visibility signals — significant remediation needed before this site can be reliably retrieved by AI systems.',
    positiveSignals: overallPositive.length > 0 ? overallPositive : ['Site is crawlable and pages return valid HTTP 200 responses'],
    negativeSignals: overallNegative.length > 0 ? overallNegative : ['No critical gaps detected'],
    topFixes: overallTopFixes,
    estimatedAfterFixes: clamp(raw.overall + Math.min(30, overallGain * 0.4)),
  };

  // ── SEO Health ───────────────────────────────────────────────────────────────
  const seoPositive: string[] = [];
  const seoNegative: string[] = [];
  if (pagesWithH1.length > pages.length * 0.9) seoPositive.push(`${pagesWithH1.length}/${pages.length} pages have H1 headings`);
  if (pagesWithDesc.length > pages.length * 0.8) seoPositive.push('Most pages have meta descriptions');
  if (pagesWithCanonical.length > pages.length * 0.8) seoPositive.push('Most pages declare canonical URLs');
  if (pagesWithH1.length < pages.length) seoNegative.push(`${pages.length - pagesWithH1.length} page${pages.length - pagesWithH1.length > 1 ? 's are' : ' is'} missing H1 headings`);
  if (pagesWithDesc.length < pages.length * 0.7) seoNegative.push(`${pages.length - pagesWithDesc.length} page${pages.length - pagesWithDesc.length > 1 ? 's are' : ' is'} missing meta descriptions`);
  if (pagesWithCanonical.length < pages.length * 0.5) seoNegative.push('Less than half of pages declare canonical URLs');
  const seoTopFixes = topIssueGains(issues, ['seo', 'technical'], 'seoGain', 3);
  const seoGainTotal = seoTopFixes.reduce((s, f) => s + f.estimatedGain, 0);

  const seoHealth: ExplainableScore = {
    dimension: 'SEO Health',
    value: raw.seoScore,
    reason: raw.seoScore >= 70
      ? 'Core SEO signals are present. Improvement opportunities exist in meta optimisation and structural completeness.'
      : 'Core SEO signals are incomplete. Missing titles, descriptions, or H1s are preventing accurate topic classification by search engines.',
    positiveSignals: seoPositive.length > 0 ? seoPositive : ['Pages return valid HTTP responses'],
    negativeSignals: seoNegative.length > 0 ? seoNegative : ['No critical SEO issues detected'],
    topFixes: seoTopFixes.length > 0 ? seoTopFixes : [{ action: 'Improve meta descriptions across key pages', estimatedGain: 5 }],
    estimatedAfterFixes: clamp(raw.seoScore + Math.min(25, seoGainTotal * 0.6)),
  };

  // ── AI Visibility ─────────────────────────────────────────────────────────────
  const aiPositive: string[] = [];
  const aiNegative: string[] = [];
  if (raw.aiScore >= 65) aiPositive.push('AI extractability score is above baseline');
  if (hasOrgSchema) aiPositive.push('Organization schema provides entity anchor for AI systems');
  if (hasFAQSchema) aiPositive.push('FAQPage schema enables direct Q&A extraction by AI systems');
  if (avgWordCount > 400) aiPositive.push(`Average word count (${Math.round(avgWordCount)}) supports stable chunk formation`);
  if (!hasFAQSchema) aiNegative.push('No FAQPage schema — AI Overview inclusion significantly reduced');
  if (!hasOrgSchema) aiNegative.push('No entity schema — AI systems cannot identify primary entity');
  if (raw.aiScore < 60) aiNegative.push('AI extractability is below threshold for reliable retrieval');
  if (avgWordCount < 300) aiNegative.push(`Average word count (${Math.round(avgWordCount)}) is too low for stable retrieval chunks`);
  const aiTopFixes = topIssueGains(issues, ['schema', 'ai_visibility', 'entity', 'content'], 'aiVisibilityGain', 3);
  const aiGainTotal = aiTopFixes.reduce((s, f) => s + f.estimatedGain, 0);

  const aiVisibility: ExplainableScore = {
    dimension: 'AI Visibility',
    value: raw.aiScore,
    reason: raw.aiScore >= 70
      ? 'AI extractability is above baseline. Entity signals and chunk quality are adequate for selective retrieval.'
      : 'AI extractability is below the threshold for reliable retrieval. Entity signals, FAQ schema, or chunk quality are limiting AI system access.',
    positiveSignals: aiPositive.length > 0 ? aiPositive : ['Pages are crawlable by AI systems'],
    negativeSignals: aiNegative.length > 0 ? aiNegative : ['No critical AI visibility gaps detected'],
    topFixes: aiTopFixes.length > 0 ? aiTopFixes : [{ action: 'Add FAQPage schema to improve AI retrieval candidacy', estimatedGain: 14 }],
    estimatedAfterFixes: clamp(raw.aiScore + Math.min(35, aiGainTotal * 0.55)),
  };

  // ── Entity Clarity ────────────────────────────────────────────────────────────
  const entityPositive: string[] = [];
  const entityNegative: string[] = [];
  if (hasOrgSchema) entityPositive.push('Organization schema defines primary entity type and name');
  if (hasSameAs) entityPositive.push('sameAs links connect entity to external knowledge bases');
  if (allSchemaTypes.has('Person')) entityPositive.push('Person schema identifies key individuals');
  if (!hasOrgSchema) entityNegative.push('Primary entity type undefined — Organization schema missing');
  if (!hasSameAs) entityNegative.push('Entity cannot be cross-validated — no sameAs links');
  if (raw.entityConfidenceScore < 60) entityNegative.push('Entity confidence is below threshold for reliable knowledge graph association');
  const entityTopFixes = topIssueGains(issues, ['entity', 'schema'], 'aiVisibilityGain', 3);

  const entityClarity: ExplainableScore = {
    dimension: 'Entity Clarity',
    value: raw.entityConfidenceScore,
    reason: raw.entityConfidenceScore >= 70
      ? 'Primary entity signals are detectable. Schema and external validation could be strengthened.'
      : 'Entity signals are weak or missing. AI systems cannot reliably identify who this site belongs to or what it represents.',
    positiveSignals: entityPositive.length > 0 ? entityPositive : ['Entity name detectable from title/H1'],
    negativeSignals: entityNegative.length > 0 ? entityNegative : ['No critical entity gaps detected'],
    topFixes: entityTopFixes.length > 0 ? entityTopFixes : [{ action: 'Add Organization schema with sameAs links', estimatedGain: 14 }],
    estimatedAfterFixes: clamp(raw.entityConfidenceScore + Math.min(30, entityTopFixes.reduce((s, f) => s + f.estimatedGain, 0) * 0.65)),
  };

  // ── Schema Completeness ───────────────────────────────────────────────────────
  const schemaPositive: string[] = [];
  const schemaNegative: string[] = [];
  const schemaTypes = [...allSchemaTypes];
  if (schemaTypes.length > 0) schemaPositive.push(`${schemaTypes.length} schema type${schemaTypes.length > 1 ? 's' : ''} detected: ${schemaTypes.join(', ')}`);
  if (hasOrgSchema) schemaPositive.push('Organization schema present');
  if (hasFAQSchema) schemaPositive.push('FAQPage schema present');
  if (allSchemaTypes.has('BreadcrumbList')) schemaPositive.push('BreadcrumbList schema present');
  if (!hasOrgSchema) schemaNegative.push('Organization schema missing — most critical schema type');
  if (!hasFAQSchema) schemaNegative.push('FAQPage schema missing — primary trigger for AI Overviews');
  if (!allSchemaTypes.has('WebSite')) schemaNegative.push('WebSite schema missing — sitelinks search box not enabled');
  if (pagesWithSchema.length < pages.length * 0.5) schemaNegative.push(`Only ${pagesWithSchema.length}/${pages.length} pages have schema markup`);
  const schemaTopFixes = topIssueGains(issues, ['schema'], 'seoGain', 3);

  const schemaCompleteness: ExplainableScore = {
    dimension: 'Schema Completeness',
    value: raw.schemaScore,
    reason: raw.schemaScore >= 70
      ? 'Core schema types are present. Additional schema types would improve AI surface coverage.'
      : 'Schema coverage is incomplete. Critical types (Organization, FAQPage) are missing, blocking AI entity recognition and AI Overview candidacy.',
    positiveSignals: schemaPositive.length > 0 ? schemaPositive : ['Some schema markup is present'],
    negativeSignals: schemaNegative.length > 0 ? schemaNegative : ['No critical schema gaps detected'],
    topFixes: schemaTopFixes.length > 0 ? schemaTopFixes : [{ action: 'Add Organization and FAQPage JSON-LD schemas', estimatedGain: 15 }],
    estimatedAfterFixes: clamp(raw.schemaScore + Math.min(35, schemaTopFixes.reduce((s, f) => s + f.estimatedGain, 0) * 0.7)),
  };

  // ── Machine Readability ────────────────────────────────────────────────────────
  const mrPositive: string[] = [];
  const mrNegative: string[] = [];
  const avgHeadings = pages.reduce((s, p) => s + p.headings.length, 0) / Math.max(1, pages.length);
  if (avgHeadings > 3) mrPositive.push(`Average ${avgHeadings.toFixed(1)} headings per page supports chunk anchoring`);
  if (avgWordCount > 400) mrPositive.push(`Average ${Math.round(avgWordCount)} words per page — adequate chunk depth`);
  if (pagesWithH1.length > pages.length * 0.9) mrPositive.push('Nearly all pages have H1 anchors for chunk extraction');
  if (avgWordCount < 300) mrNegative.push('Average word count is too low to form stable retrieval chunks');
  if (avgHeadings < 2) mrNegative.push('Insufficient heading structure — pages lack semantic section anchors');
  if (pagesWithH1.length < pages.length * 0.7) mrNegative.push('Many pages lack H1 — primary chunk topic anchors missing');
  const mrTopFixes = topIssueGains(issues, ['content', 'seo'], 'aiVisibilityGain', 3);

  const machineReadability: ExplainableScore = {
    dimension: 'Machine Readability',
    value: raw.machineReadabilityScore,
    reason: raw.machineReadabilityScore >= 65
      ? 'Content structure is adequate for AI chunk extraction. Heading hierarchy and content depth support stable semantic chunking.'
      : 'Content structure is insufficient for reliable AI chunk extraction. Thin pages, missing headings, or flat structure are reducing chunk quality.',
    positiveSignals: mrPositive.length > 0 ? mrPositive : ['Pages have some structural markup'],
    negativeSignals: mrNegative.length > 0 ? mrNegative : ['No critical readability gaps detected'],
    topFixes: mrTopFixes.length > 0 ? mrTopFixes : [{ action: 'Improve content depth to 500+ words per page', estimatedGain: 7 }],
    estimatedAfterFixes: clamp(raw.machineReadabilityScore + Math.min(25, mrTopFixes.reduce((s, f) => s + f.estimatedGain, 0) * 0.6)),
  };

  // ── Citation Probability ──────────────────────────────────────────────────────
  const cpPositive: string[] = [];
  const cpNegative: string[] = [];
  if (hasOrgSchema) cpPositive.push('Entity schema provides authority signals for citation eligibility');
  if (hasFAQSchema) cpPositive.push('FAQPage schema provides direct answer candidates for citation');
  if (hasSameAs) cpPositive.push('sameAs links increase citation credibility through external validation');
  if (allExternal.length > 10) cpPositive.push('Multiple outbound links signal editorial quality');
  if (!hasOrgSchema) cpNegative.push('Missing entity schema — citation authority signals weak');
  if (!hasFAQSchema) cpNegative.push('No FAQPage schema — AI systems lack direct answer candidates');
  if (allExternal.length === 0) cpNegative.push('No outbound links — content appears self-referential to AI trust systems');
  const cpTopFixes = topIssueGains(issues, ['schema', 'trust', 'entity'], 'aiVisibilityGain', 3);

  const citationProbability: ExplainableScore = {
    dimension: 'Citation Probability',
    value: raw.citationProbabilityScore,
    reason: raw.citationProbabilityScore >= 60
      ? 'Citation signals are above baseline. Entity authority and schema completeness are adequate for selective citation.'
      : 'Citation signals are weak. AI systems lack sufficient authority signals to confidently cite this content.',
    positiveSignals: cpPositive.length > 0 ? cpPositive : ['Content is retrievable'],
    negativeSignals: cpNegative.length > 0 ? cpNegative : ['No critical citation gaps detected'],
    topFixes: cpTopFixes.length > 0 ? cpTopFixes : [{ action: 'Add Organization schema with sameAs links', estimatedGain: 12 }],
    estimatedAfterFixes: clamp(raw.citationProbabilityScore + Math.min(30, cpTopFixes.reduce((s, f) => s + f.estimatedGain, 0) * 0.6)),
  };

  // ── Trust & E-E-A-T ──────────────────────────────────────────────────────────
  const trustPositive: string[] = [];
  const trustNegative: string[] = [];
  if (hasOrgSchema) trustPositive.push('Organization schema provides entity identity anchor');
  if (hasSameAs) trustPositive.push('External sameAs links enable cross-source validation');
  if (allSchemaTypes.has('Person')) trustPositive.push('Person/authorship schema signals content credibility');
  if (allExternal.length > 5) trustPositive.push('Outbound authority links signal editorial integrity');
  if (!hasSameAs) trustNegative.push('No sameAs links — entity cannot be verified by external knowledge bases');
  if (allExternal.length === 0) trustNegative.push('No external authority links — all trust signals are self-referential');
  if (!allSchemaTypes.has('Person') && !allSchemaTypes.has('Article')) trustNegative.push('No authorship signals — E-E-A-T expertise signals absent');
  const trustTopFixes = topIssueGains(issues, ['trust', 'entity', 'schema'], 'trustGain', 3);

  const trustAndEEAT: ExplainableScore = {
    dimension: 'Trust & E-E-A-T',
    value: raw.semanticTrustScore,
    reason: raw.semanticTrustScore >= 65
      ? 'Trust signals are above baseline. External validation and authorship signals could be strengthened.'
      : 'Trust signals are weak. Entity schema, sameAs links, and external authority validation are missing or insufficient.',
    positiveSignals: trustPositive.length > 0 ? trustPositive : ['Site is live with consistent content'],
    negativeSignals: trustNegative.length > 0 ? trustNegative : ['No critical trust gaps detected'],
    topFixes: trustTopFixes.length > 0 ? trustTopFixes : [{ action: 'Add sameAs links to Organization schema', estimatedGain: 12 }],
    estimatedAfterFixes: clamp(raw.semanticTrustScore + Math.min(30, trustTopFixes.reduce((s, f) => s + f.estimatedGain, 0) * 0.65)),
  };

  // ── Content Depth ─────────────────────────────────────────────────────────────
  const cdPositive: string[] = [];
  const cdNegative: string[] = [];
  const richContentPages = pages.filter((p) => p.wordCount > 500 && p.headings.length > 3);
  if (richContentPages.length > 0) cdPositive.push(`${richContentPages.length} page${richContentPages.length > 1 ? 's have' : ' has'} rich content (500+ words, 3+ headings)`);
  if (avgWordCount > 400) cdPositive.push(`Average ${Math.round(avgWordCount)} words per page`);
  const thinPages = pages.filter((p) => p.wordCount < 300 && pages.indexOf(p) > 0);
  if (thinPages.length > 0) cdNegative.push(`${thinPages.length} thin page${thinPages.length > 1 ? 's' : ''} with fewer than 300 words`);
  if (avgWordCount < 300) cdNegative.push(`Average word count (${Math.round(avgWordCount)}) is below the minimum for stable retrieval chunks`);

  const contentDepthScore = clamp(
    40
    + Math.min(20, (avgWordCount / 600) * 20)
    + (richContentPages.length / Math.max(1, pages.length)) * 25
    + (avgWordCount > 400 ? 15 : 0),
  );
  const cdTopFixes = topIssueGains(issues, ['content'], 'aiVisibilityGain', 3);

  const contentDepth: ExplainableScore = {
    dimension: 'Content Depth',
    value: contentDepthScore,
    reason: contentDepthScore >= 65
      ? 'Content depth is adequate. Rich pages provide stable retrieval chunks; thin pages represent improvement opportunities.'
      : 'Content is too thin overall. Most pages lack the word count and structure needed for reliable AI retrieval.',
    positiveSignals: cdPositive.length > 0 ? cdPositive : ['Pages have some textual content'],
    negativeSignals: cdNegative.length > 0 ? cdNegative : ['No critical content depth gaps detected'],
    topFixes: cdTopFixes.length > 0 ? cdTopFixes : [{ action: 'Expand thin pages to 500+ words with entity-rich content', estimatedGain: 8 }],
    estimatedAfterFixes: clamp(contentDepthScore + Math.min(25, cdTopFixes.reduce((s, f) => s + f.estimatedGain, 0) * 0.5)),
  };

  // ── Technical Health ──────────────────────────────────────────────────────────
  const thPositive: string[] = [];
  const thNegative: string[] = [];
  const errorPages = pages.filter((p) => p.statusCode >= 400);
  const slowPages = pages.filter((p) => p.responseTimeMs > 3000);
  const noindexPages = pages.filter((p) => p.robotsDirectives.some((d) => d.toLowerCase().includes('noindex')));
  if (errorPages.length === 0) thPositive.push('No HTTP error pages detected');
  if (slowPages.length === 0) thPositive.push('All pages respond within 3 seconds');
  if (pagesWithCanonical.length === pages.length) thPositive.push('All pages have canonical declarations');
  if (errorPages.length > 0) thNegative.push(`${errorPages.length} page${errorPages.length > 1 ? 's return' : ' returns'} HTTP error codes`);
  if (slowPages.length > 0) thNegative.push(`${slowPages.length} page${slowPages.length > 1 ? 's exceed' : ' exceeds'} 3s response time`);
  if (noindexPages.length > 0) thNegative.push(`${noindexPages.length} page${noindexPages.length > 1 ? 's have' : ' has'} noindex directive — verify intentional`);
  if (pagesWithCanonical.length < pages.length * 0.5) thNegative.push('Less than half of pages have canonical declarations');

  const technicalHealthScore = clamp(
    80
    - errorPages.length * 10
    - slowPages.length * 5
    - noindexPages.length * 5
    + (pagesWithCanonical.length / Math.max(1, pages.length)) * 20
    - (pagesWithCanonical.length < pages.length * 0.5 ? 15 : 0),
  );
  const thTopFixes = topIssueGains(issues, ['technical'], 'seoGain', 3);

  const technicalHealth: ExplainableScore = {
    dimension: 'Technical Health',
    value: technicalHealthScore,
    reason: technicalHealthScore >= 75
      ? 'Technical health is good. No critical crawling or performance issues detected.'
      : 'Technical issues are present. Error pages, slow responses, or canonicalization gaps are affecting crawl efficiency and indexation.',
    positiveSignals: thPositive.length > 0 ? thPositive : ['Site is accessible and returns valid responses'],
    negativeSignals: thNegative.length > 0 ? thNegative : ['No critical technical issues detected'],
    topFixes: thTopFixes.length > 0 ? thTopFixes : [{ action: 'Add canonical declarations to all pages', estimatedGain: 6 }],
    estimatedAfterFixes: clamp(technicalHealthScore + Math.min(20, thTopFixes.reduce((s, f) => s + f.estimatedGain, 0) * 0.7)),
  };

  // ── Conversion Readiness ──────────────────────────────────────────────────────
  const crPositive: string[] = [];
  const crNegative: string[] = [];
  const hasContactPage = pages.some((p) => /contact|enquir|get.?in.?touch|call.?us/i.test(p.url + ' ' + (p.title ?? '') + ' ' + (p.h1 ?? '')));
  const hasServicesPage = pages.some((p) => /services?|solutions?|what.?we.?do|offerings?/i.test(p.url + ' ' + (p.title ?? '') + ' ' + (p.h1 ?? '')));
  const hasLocalBizSchema = allSchemaTypes.has('LocalBusiness');
  const homepageHasPhone = pages[0]?.bodyText.match(/\+?\d[\d\s\-()]{9,}/)?.[0] ?? null;
  if (hasContactPage) crPositive.push('Contact page detected — conversion path visible to AI systems');
  if (hasServicesPage) crPositive.push('Services page detected — offering clarity present');
  if (hasLocalBizSchema) crPositive.push('LocalBusiness schema provides phone, address, and hours signals');
  if (homepageHasPhone) crPositive.push('Phone number visible on homepage');
  if (!hasContactPage) crNegative.push('No contact page detected — conversion path unclear to AI systems');
  if (!hasServicesPage) crNegative.push('No dedicated services page — offering scope unclear');
  if (!hasLocalBizSchema && !hasOrgSchema) crNegative.push('No business schema — contact and conversion signals not machine-readable');

  const conversionScore = clamp(
    30
    + (hasContactPage ? 20 : 0)
    + (hasServicesPage ? 20 : 0)
    + (hasLocalBizSchema ? 15 : hasOrgSchema ? 10 : 0)
    + (homepageHasPhone ? 15 : 0),
  );
  const crTopFixes: Array<{ action: string; estimatedGain: number }> = [
    ...(!hasContactPage ? [{ action: 'Create a dedicated Contact page with schema markup', estimatedGain: 8 }] : []),
    ...(!hasServicesPage ? [{ action: 'Create a Services page with Service schema', estimatedGain: 7 }] : []),
    ...(!hasLocalBizSchema && !hasOrgSchema ? [{ action: 'Add LocalBusiness schema with telephone and address', estimatedGain: 10 }] : []),
  ].slice(0, 3);

  const conversionReadiness: ExplainableScore = {
    dimension: 'Conversion Readiness',
    value: conversionScore,
    reason: conversionScore >= 65
      ? 'Key conversion elements are present. Contact and service signals are visible to AI systems.'
      : 'Conversion path is unclear. Missing contact pages, service definitions, or business schema limit AI recommendation candidacy for commercial queries.',
    positiveSignals: crPositive.length > 0 ? crPositive : ['Site is live and accessible'],
    negativeSignals: crNegative.length > 0 ? crNegative : ['No critical conversion gaps detected'],
    topFixes: crTopFixes.length > 0 ? crTopFixes : [{ action: 'Add LocalBusiness schema with contact details', estimatedGain: 10 }],
    estimatedAfterFixes: clamp(conversionScore + Math.min(30, crTopFixes.reduce((s, f) => s + f.estimatedGain, 0) * 0.7)),
  };

  return {
    overall,
    seoHealth,
    aiVisibility,
    entityClarity,
    schemaCompleteness,
    machineReadability,
    citationProbability,
    trustAndEEAT,
    contentDepth,
    technicalHealth,
    conversionReadiness,
  };
}
