import type { CrawledPage, CitationEvidence, CitationGap, CitationIntelligenceRecommendation, CitationIntelligenceResult } from '@sitenexis/shared';

export const CITATION_INTELLIGENCE_ENGINE_VERSION = '1.0.0';

function hostOf(value: string): string | null {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
}

function classify(host: string): CitationEvidence['type'] {
  if (host.endsWith('.gov') || host.includes('.gov.') || host.includes('gov.')) return 'government';
  if (host.endsWith('.edu') || host.includes('.ac.')) return 'education';
  if (host.endsWith('doi.org') || host.includes('crossref') || host.includes('pubmed') || host.includes('arxiv') || host.includes('researchgate')) return 'research';
  if (/rfc-editor|ietf\.org|w3\.org|iso\.org|owasp\.org/.test(host)) return 'standards';
  if (/github\.com|gitlab\.com|npmjs\.com|pypi\.org|readthedocs\.io|developer\./.test(host)) return 'developer';
  if (/reddit\.com|stackoverflow\.com|stackexchange\.com|discourse\./.test(host)) return 'community';
  if (/linkedin\.com|x\.com|twitter\.com|facebook\.com|youtube\.com|tiktok\.com/.test(host)) return 'social';
  if (/news|medium\.com|substack\.com/.test(host)) return 'news';
  return 'external_reference';
}

function clamp(value: number): number { return Math.max(0, Math.min(100, Math.round(value))); }

function evidenceId(index: number, source: string, target: string): string {
  return `cit-${index}-${source.length}-${target.length}`;
}

function recommendation(id: string, title: string, why: string, priority: CitationIntelligenceRecommendation['priority'], effort: CitationIntelligenceRecommendation['effort'], impact: CitationIntelligenceRecommendation['expectedImpact'], pages: string[], evidenceIds: string[], verification: string): CitationIntelligenceRecommendation {
  return { id, title, why, priority, effort, expectedImpact: impact, affectedPages: pages, evidenceIds, verification };
}

export function analyzeCitationIntelligence(input: { auditId?: string; domain: string; pages: CrawledPage[]; generatedAt?: Date }): CitationIntelligenceResult {
  const generatedAt = (input.generatedAt ?? new Date()).toISOString();
  const pages = input.pages.filter((page) => Boolean(page.url));
  const rootHost = hostOf(input.domain) ?? hostOf(`https://${input.domain}`) ?? input.domain.toLowerCase();
  if (pages.length === 0) {
    return {
      status: 'no_data', availabilityState: 'unavailable', providerState: 'not_configured', evidenceState: 'no_evidence_found', ...(input.auditId ? { auditId: input.auditId } : {}), domain: input.domain, summary: 'No crawled pages were available, so Citation Intelligence could not measure first-party evidence.', generatedAt, engineVersion: CITATION_INTELLIGENCE_ENGINE_VERSION, confidence: 0,
      limitations: ['External backlinks and unlinked mentions are outside the free crawl-only measurement boundary and were not measured.'],
      scores: { citation: null, authority: null, trust: null, aiCitation: null, entity: null, brandRecognition: null, evidence: null, recommendation: null, digitalAuthority: null },
      counts: { pagesAnalyzed: 0, signals: 0, externalReferences: 0, internalCitations: 0, sameAsReferences: 0, sourceCategories: 0 }, signals: [], gaps: [], recommendations: [],
    };
  }

  const pageHosts = new Set(pages.map((page) => hostOf(page.url)).filter(Boolean));
  const signals: CitationEvidence[] = [];
  let index = 0;
  const add = (signal: Omit<CitationEvidence, 'id' | 'observedAt'>) => signals.push({ ...signal, id: evidenceId(index++, signal.sourceUrl, signal.targetUrl), observedAt: generatedAt });

  for (const page of pages) {
    for (const target of page.internalLinks) {
      if (!pageHosts.has(hostOf(target))) continue;
      add({ type: 'internal_citation', sourceUrl: page.url, targetUrl: target, sourcePage: page.url, confidence: 0.98, provenance: 'first_party_crawl' });
    }
    for (const target of page.externalLinks) {
      const targetHost = hostOf(target);
      if (!targetHost || targetHost === rootHost) continue;
      add({ type: classify(targetHost), sourceUrl: page.url, targetUrl: target, sourcePage: page.url, confidence: 0.95, provenance: 'first_party_crawl' });
    }
    for (const rawItem of page.schemaMarkup) {
      if (!rawItem || typeof rawItem !== 'object') continue;
      const item = rawItem as Record<string, unknown>;
      const sameAs = item.sameAs;
      const urls = Array.isArray(sameAs) ? sameAs : typeof sameAs === 'string' ? [sameAs] : [];
      for (const target of urls) if (typeof target === 'string') add({ type: 'same_as', sourceUrl: page.url, targetUrl: target, sourcePage: page.url, confidence: 0.99, provenance: 'structured_data' });
    }
  }

  const internal = signals.filter((s) => s.type === 'internal_citation');
  const external = signals.filter((s) => s.type !== 'internal_citation' && s.type !== 'same_as');
  const sameAs = signals.filter((s) => s.type === 'same_as');
  const categories = new Set(external.map((s) => s.type));
  const inbound = new Map<string, number>();
  for (const signal of internal) inbound.set(signal.targetUrl, (inbound.get(signal.targetUrl) ?? 0) + 1);
  const orphanPages = pages.filter((page) => (inbound.get(page.url) ?? 0) === 0 && page.url !== pages[0]?.url);
  const structuredPages = pages.filter((page) => page.schemaMarkup.length > 0).length;
  const evidenceDensity = Math.min(100, (external.length / Math.max(pages.length, 1)) * 25 + categories.size * 10 + sameAs.length * 8);
  const internalCoverage = ((pages.length - orphanPages.length) / pages.length) * 100;
  const entityScore = clamp((sameAs.length > 0 ? 55 : 25) + Math.min(30, sameAs.length * 10) + (structuredPages / pages.length) * 15);
  const trust = clamp(30 + (structuredPages / pages.length) * 30 + Math.min(25, categories.size * 5) + (sameAs.length > 0 ? 15 : 0));
  const aiCitation = clamp(35 + evidenceDensity * 0.25 + internalCoverage * 0.2 + (structuredPages / pages.length) * 20);
  const citation = clamp(evidenceDensity * 0.45 + internalCoverage * 0.3 + entityScore * 0.25);
  const authority = clamp(citation * 0.45 + evidenceDensity * 0.35 + entityScore * 0.2);
  const brandRecognition = clamp(sameAs.length * 15 + categories.size * 10 + (external.length > 0 ? 20 : 0));
  const evidence = clamp(evidenceDensity * 0.7 + (external.length > 0 ? 30 : 0));
  const recommendationScore = clamp(100 - citation);
  const digitalAuthority = clamp(authority * 0.35 + trust * 0.2 + aiCitation * 0.2 + entityScore * 0.15 + evidence * 0.1);
  const gaps: CitationGap[] = [];
  const expected: Array<[CitationGap['category'], string, string, string]> = [
    ['research', 'Research references', 'No research-oriented source was observed in the audited pages.', 'Reference primary studies or publish original research with clear attribution.'],
    ['government', 'Government references', 'No government source was observed in the audited pages.', 'Support regulated or factual claims with relevant government sources.'],
    ['standards', 'Standards references', 'No standards-body or specification reference was observed in the audited pages.', 'Cite relevant standards, RFCs, or specifications where they support the subject.'],
    ['developer', 'Developer ecosystem references', 'No developer documentation or public code reference was observed in the audited pages.', 'Publish stable documentation or link to the canonical implementation and API references.'],
    ['entity', 'Entity identity coverage', 'No sameAs references were observed in structured data.', 'Add accurate sameAs links for official profiles and canonical entity references.'],
  ];
  for (const [category, title, reason, nextStep] of expected) {
    const observed = category === 'entity' ? sameAs.length > 0 : external.some((s) => s.type === category);
    if (!observed) gaps.push({ category, title, reason, priority: category === 'entity' ? 'high' : 'medium', effort: 'low', expectedImpact: 'medium', evidence: [], nextStep, verification: 'Rerun the audit and confirm a relevant, canonical reference is present.' });
  }
  if (orphanPages.length > 0) gaps.push({ category: 'entity', title: 'Internal citation coverage', reason: `${orphanPages.length} analyzed page${orphanPages.length === 1 ? '' : 's'} had no inbound internal citation.`, priority: 'high', effort: 'low', expectedImpact: 'high', evidence: orphanPages.slice(0, 10).map((page, i) => ({ id: `orphan-${i}`, type: 'internal_citation', sourceUrl: page.url, targetUrl: page.url, observedAt: generatedAt, confidence: 0.99, provenance: 'first_party_crawl' })), nextStep: 'Add contextual links from related authority pages to the orphan URLs.', verification: 'Rerun the audit and confirm inbound links and crawl depth improve.' });
  const recommendations = gaps.slice(0, 8).map((gap, i) => recommendation(`citation-rec-${i}`, gap.title, gap.reason, gap.priority, gap.effort, gap.expectedImpact, gap.evidence.map((e) => e.targetUrl), gap.evidence.map((e) => e.id), gap.verification));
  return {
    status: 'completed', availabilityState: signals.length > 0 ? 'partially_available' : 'available_no_evidence', providerState: 'not_configured', evidenceState: signals.length > 0 ? 'evidence_found' : 'no_evidence_found', ...(input.auditId ? { auditId: input.auditId } : {}), domain: input.domain,
    summary: `SiteNexis analyzed ${pages.length} crawled page${pages.length === 1 ? '' : 's'} and found ${signals.length} first-party citation signal${signals.length === 1 ? '' : 's'}. The free crawl-only core does not claim complete external backlink, unlinked-mention, or off-site AI citation coverage.`,
    generatedAt, engineVersion: CITATION_INTELLIGENCE_ENGINE_VERSION, confidence: 0.82,
    limitations: ['This snapshot measures links and structured references observed from the audited pages. It does not claim to discover every backlink, mention, ranking, or AI citation.', 'External backlink and mention discovery is an optional enhanced capability; its absence does not reduce the free-core measurements to zero.'],
    scores: { citation, authority, trust, aiCitation, entity: entityScore, brandRecognition, evidence, recommendation: recommendationScore, digitalAuthority },
    counts: { pagesAnalyzed: pages.length, signals: signals.length, externalReferences: external.length, internalCitations: internal.length, sameAsReferences: sameAs.length, sourceCategories: categories.size },
    signals: signals.slice(0, 500), gaps, recommendations,
  };
}
