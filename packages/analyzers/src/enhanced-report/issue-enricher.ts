// Issue Enricher — transforms raw crawl signals into full AuditIssue objects.
// Every issue has evidence, business impact, AI visibility impact, SEO impact,
// a generated fix, and expected improvement. No black boxes.

import type { CrawledPage, AuditIssue, AuditIssueSeverity } from '@sitenexis/shared';
import {
  extractOrgSignals,
  detectFAQOpportunities,
  generateOrganizationSchema,
  generateFAQSchema,
  generateBreadcrumbSchema,
  generateServiceSchema,
  generateWebSiteSchema,
  detectServicePages,
} from './schema-generator';
import {
  generateMetaDescription,
  generateCanonicalTag,
  generateOGTags,
  generateAltTextSuggestion,
  generateAltTextHTML,
  generateTitleTag,
  generateH1Tag,
  generateSpeakableSchema,
} from './fix-generator';

let _issueCounter = 0;
function nextId(type: string): string {
  return `issue_${type}_${++_issueCounter}`;
}

function priorityScore(
  severity: AuditIssueSeverity,
  aiGain: number,
  seoGain: number,
  trustGain: number,
): number {
  const severityWeight: Record<AuditIssueSeverity, number> = { critical: 1.5, high: 1.25, medium: 1.0, low: 0.75 };
  const composite = aiGain * 0.35 + seoGain * 0.35 + trustGain * 0.30;
  return Math.min(100, Math.round(composite * severityWeight[severity]));
}

// ── Raw SEO issue enrichment ─────────────────────────────────────────────────

export interface RawSEOIssue {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  url: string;
  message: string;
  problem: string;
  cause: string;
  solution: string;
  recommendation: string;
}

function severityMap(s: 'critical' | 'warning' | 'info'): AuditIssueSeverity {
  if (s === 'critical') return 'critical';
  if (s === 'warning') return 'high';
  return 'medium';
}

export function enrichSEOIssues(
  raw: RawSEOIssue[],
  pages: CrawledPage[],
  domain: string,
): AuditIssue[] {
  const results: AuditIssue[] = [];

  // Group by type, collect all affected pages
  const byType = new Map<string, { raw: RawSEOIssue; urls: string[] }>();
  for (const issue of raw) {
    const existing = byType.get(issue.type);
    if (existing) {
      existing.urls.push(issue.url);
    } else {
      byType.set(issue.type, { raw: issue, urls: [issue.url] });
    }
  }

  const pageMap = new Map(pages.map((p) => [p.url, p]));

  for (const [type, { raw: r, urls }] of byType) {
    const affectedPages = [...new Set(urls)];
    const samplePage = pageMap.get(affectedPages[0] ?? '') ?? pages[0];
    const severity = severityMap(r.severity);

    switch (type) {
      case 'missing_title': {
        const aiGain = 12; const seoGain = 14; const trustGain = 6;
        const fix = samplePage ? generateTitleTag(samplePage, domain) : null;
        results.push({
          id: nextId('missing_title'),
          title: 'Missing <title> tag',
          category: 'seo',
          severity,
          affectedPages,
          evidence: affectedPages.slice(0, 5).map((url) => ({
            pageUrl: url,
            observedValue: 'No <title> element found',
            expectedValue: '<title> of 50–60 characters',
            crawlDataField: 'title',
            confidence: 1.0,
          })),
          whyItMatters: 'The <title> tag is the primary signal crawlers use to classify page topic. Without it, search engines assign arbitrary classifications and AI retrieval systems cannot confidently match this page to query intent — making the page effectively invisible for most AI-generated answers.',
          businessImpact: {
            summary: `${affectedPages.length} page${affectedPages.length > 1 ? 's are' : ' is'} invisible to search and AI ranking — direct revenue impact from lost organic discovery.`,
            impactLevel: 'very_high',
            affectedAreas: ['Search engine ranking', 'AI Overview inclusion', 'Click-through rate', 'Brand visibility'],
          },
          aiVisibilityImpact: {
            summary: 'Without a title tag, AI retrieval systems cannot classify the page topic or retrieve it for relevant queries. Entity clarity and machine readability both suffer.',
            affectedSignals: ['Machine Readability', 'Entity Clarity', 'Retrieval Readiness'],
            estimatedScoreLoss: aiGain,
          },
          seoImpact: { summary: 'Title tags are a primary on-page relevance signal. Missing titles prevent any meaningful keyword association for the page.', estimatedScoreLoss: seoGain },
          recommendedSolution: {
            summary: 'Add a unique <title> tag to every page. Lead with the primary keyword, include the entity name, and keep it under 60 characters.',
            steps: [
              'Open your CMS or site template for each affected page.',
              'Add a <title> tag inside the <head> element: <title>[Primary Keyword] | [Brand Name]</title>.',
              'Keep titles under 60 characters; lead with the most important keyword.',
              'Make every title unique — no two pages should share a title.',
              'Republish and re-crawl to verify the tag appears in source.',
            ],
            difficulty: 'easy',
            estimatedTime: '30 minutes',
          },
          ...(fix ? { generatedFix: { type: 'html' as const, code: fix, placementInstructions: 'Place inside <head> — first element after the opening tag.' } } : {}),
          expectedImprovement: { aiVisibilityGain: aiGain, seoGain, trustGain, confidence: 0.92 },
          priorityScore: priorityScore(severity, aiGain, seoGain, trustGain),
        });
        break;
      }

      case 'missing_meta_description': {
        const aiGain = 6; const seoGain = 7; const trustGain = 3;
        const firstFixPage = samplePage;
        const fix = firstFixPage ? generateMetaDescription(firstFixPage) : null;
        results.push({
          id: nextId('missing_meta_description'),
          title: 'Missing meta description',
          category: 'seo',
          severity,
          affectedPages,
          evidence: affectedPages.slice(0, 5).map((url) => ({
            pageUrl: url,
            observedValue: 'No <meta name="description"> found',
            expectedValue: 'Meta description of 120–155 characters',
            crawlDataField: 'metaDescription',
            confidence: 1.0,
          })),
          whyItMatters: 'AI retrieval systems use meta descriptions as page summaries when building context for generated answers. Without one, the system extracts an arbitrary text snippet — often mid-sentence navigation text that misrepresents the page\'s actual purpose.',
          businessImpact: {
            summary: `${affectedPages.length} page${affectedPages.length > 1 ? 's have' : ' has'} no description — search engines auto-generate snippets that rarely represent the page accurately, reducing click-through rates.`,
            impactLevel: 'medium',
            affectedAreas: ['Click-through rate', 'AI snippet quality', 'Search result appearance'],
          },
          aiVisibilityImpact: {
            summary: 'Meta descriptions are used by AI retrieval systems as page context summaries. Missing descriptions reduce retrieval readiness and citation eligibility.',
            affectedSignals: ['Retrieval Readiness', 'Machine Readability', 'Citation Probability'],
            estimatedScoreLoss: aiGain,
          },
          seoImpact: { summary: 'Search engines generate click-optimised snippets from descriptions. Auto-generated snippets from body text typically underperform by 15–20% on CTR.', estimatedScoreLoss: seoGain },
          recommendedSolution: {
            summary: 'Write a unique meta description (120–155 characters) for each page. Lead with the primary value proposition and include the primary keyword naturally.',
            steps: [
              'Write a 120–155 character description that summarises the page\'s key value.',
              'Include the primary keyword naturally within the first 100 characters.',
              'End with a soft call to action where appropriate (e.g., "Learn more", "Get started").',
              'Add via CMS SEO field or directly in <head>: <meta name="description" content="...">.',
              'Ensure every page has a unique description — no duplicates across pages.',
            ],
            difficulty: 'easy',
            estimatedTime: '15 minutes per page',
          },
          ...(fix ? {
            generatedFix: {
              type: 'meta' as const,
              code: fix,
              placementInstructions: `Example generated from page content. Place inside <head>. Review and refine before publishing.`,
            },
          } : {}),
          expectedImprovement: { aiVisibilityGain: aiGain, seoGain, trustGain, confidence: 0.88 },
          priorityScore: priorityScore(severity, aiGain, seoGain, trustGain),
        });
        break;
      }

      case 'missing_h1': {
        const aiGain = 9; const seoGain = 11; const trustGain = 4;
        const fix = samplePage ? generateH1Tag(samplePage) : null;
        results.push({
          id: nextId('missing_h1'),
          title: 'Missing H1 heading',
          category: 'seo',
          severity,
          affectedPages,
          evidence: affectedPages.slice(0, 5).map((url) => ({
            pageUrl: url,
            observedValue: 'No <h1> element found',
            expectedValue: 'Single H1 that states the page\'s primary topic',
            crawlDataField: 'h1',
            confidence: 1.0,
          })),
          whyItMatters: 'The H1 is the semantic anchor of every page — the statement that AI retrieval systems use to confirm what the page is about. Without it, chunk extraction during AI retrieval produces ambiguous chunks with no clear topic anchor, reducing retrieval accuracy and citation eligibility.',
          businessImpact: {
            summary: 'Pages without H1 headings are structurally ambiguous — AI systems and search engines cannot confirm the page\'s primary topic, reducing its chance of appearing in relevant results.',
            impactLevel: 'high',
            affectedAreas: ['Search relevance', 'AI retrieval accuracy', 'User experience', 'Content hierarchy'],
          },
          aiVisibilityImpact: {
            summary: 'H1 tags are a primary chunk anchor in AI retrieval. Without them, semantic chunks have no clear topic label, reducing chunk stability and answer formation probability.',
            affectedSignals: ['Machine Readability', 'Retrieval Readiness', 'Chunk Stability'],
            estimatedScoreLoss: aiGain,
          },
          seoImpact: { summary: 'The H1 is the single most important on-page content signal for topic relevance. Its absence is a fundamental content hierarchy failure.', estimatedScoreLoss: seoGain },
          recommendedSolution: {
            summary: 'Add exactly one H1 per page that clearly states the main topic, aligns with the title tag, and contains the primary keyword.',
            steps: [
              'Write a single H1 that names the page\'s primary topic in 5–12 words.',
              'Align the H1 with the title tag — they should describe the same thing, in different forms.',
              'Include the primary keyword naturally in the H1.',
              'Place the H1 as the first visible heading on the page — above all H2s.',
              'Use exactly one H1 per page; multiple H1s confuse topic classification.',
            ],
            difficulty: 'easy',
            estimatedTime: '10 minutes per page',
          },
          ...(fix ? { generatedFix: { type: 'html' as const, code: fix, placementInstructions: 'Place as the first visible heading inside <body>. Wrap in appropriate container.' } } : {}),
          expectedImprovement: { aiVisibilityGain: aiGain, seoGain, trustGain, confidence: 0.90 },
          priorityScore: priorityScore(severity, aiGain, seoGain, trustGain),
        });
        break;
      }

      case 'missing_canonical': {
        const aiGain = 5; const seoGain = 6; const trustGain = 4;
        results.push({
          id: nextId('missing_canonical'),
          title: 'Missing canonical URL declaration',
          category: 'technical',
          severity,
          affectedPages,
          evidence: affectedPages.slice(0, 5).map((url) => ({
            pageUrl: url,
            observedValue: 'No <link rel="canonical"> found',
            expectedValue: `<link rel="canonical" href="${url}">`,
            crawlDataField: 'canonicalUrl',
            confidence: 1.0,
          })),
          whyItMatters: 'Without canonical declarations, URL variations (www vs. non-www, query strings, trailing slashes) appear as duplicate content. AI retrieval systems encountering multiple versions of the same content split trust signals, reducing citation probability for each version.',
          businessImpact: {
            summary: 'Unmanaged duplicate content fragments ranking signals across URL variations, silently reducing authority for the target URL.',
            impactLevel: 'medium',
            affectedAreas: ['Duplicate content management', 'PageRank consolidation', 'AI trust signals', 'Crawl efficiency'],
          },
          aiVisibilityImpact: {
            summary: 'Canonical signals inform AI trust systems about the preferred version of a page. Without them, cross-source validation is unreliable.',
            affectedSignals: ['Semantic Trust', 'Entity Credibility Consistency', 'Machine Trust'],
            estimatedScoreLoss: aiGain,
          },
          seoImpact: { summary: 'Google uses canonical declarations to consolidate PageRank to the preferred URL. Missing canonicals can silently dilute link authority.', estimatedScoreLoss: seoGain },
          recommendedSolution: {
            summary: 'Add a self-referencing canonical tag to every page pointing to its absolute preferred URL.',
            steps: [
              'Decide on your canonical URL pattern (www vs non-www, trailing slash or not).',
              'Add <link rel="canonical" href="[ABSOLUTE URL]"> to every page <head>.',
              'Ensure the canonical URL matches your preferred domain pattern exactly.',
              'For paginated content, canonicalize to page 1 or use rel=next/prev.',
              'Verify canonicals with a crawl tool after deployment.',
            ],
            difficulty: 'easy',
            estimatedTime: '1 hour (template change)',
          },
          generatedFix: {
            type: 'canonical',
            code: affectedPages.slice(0, 3).map((url) => generateCanonicalTag(url)).join('\n'),
            placementInstructions: 'Add to <head> of each affected page. Use the full absolute URL including protocol (https://).',
          },
          expectedImprovement: { aiVisibilityGain: aiGain, seoGain, trustGain, confidence: 0.85 },
          priorityScore: priorityScore(severity, aiGain, seoGain, trustGain),
        });
        break;
      }

      case 'low_word_count': {
        const aiGain = 5; const seoGain = 5; const trustGain = 2;
        const wordCounts = affectedPages.map((url) => {
          const p = pageMap.get(url);
          return p ? `${url}: ${p.wordCount} words` : url;
        });
        results.push({
          id: nextId('low_word_count'),
          title: 'Thin content — insufficient word count for AI retrieval',
          category: 'content',
          severity,
          affectedPages,
          evidence: affectedPages.slice(0, 5).map((url) => {
            const p = pageMap.get(url);
            return {
              pageUrl: url,
              observedValue: p ? `${p.wordCount} words` : 'Unknown',
              expectedValue: '500+ words for substantive pages',
              crawlDataField: 'wordCount',
              confidence: 1.0,
            };
          }),
          whyItMatters: 'AI retrieval systems split content into semantic chunks of 300–600 tokens. Pages below 300 words cannot form a complete, self-contained chunk — they produce unstable, truncated semantic units that are rarely selected for AI-generated answers and almost never cited.',
          businessImpact: {
            summary: `${affectedPages.length} page${affectedPages.length > 1 ? 's are' : ' is'} too thin to contribute meaningfully to AI retrieval. Thin content is weighted down in ranking and retrieval scoring.`,
            impactLevel: 'medium',
            affectedAreas: ['Topical authority', 'AI retrieval candidacy', 'Content depth scoring', 'User engagement'],
          },
          aiVisibilityImpact: {
            summary: 'Thin pages produce unstable chunks that AI systems filter out during retrieval. Pages below 300 words have near-zero answer formation probability.',
            affectedSignals: ['Machine Readability', 'Retrieval Readiness', 'Chunk Stability', 'Citation Probability'],
            estimatedScoreLoss: aiGain,
          },
          seoImpact: { summary: 'Content depth is a significant ranking factor. Thin pages signal low topical authority and are typically not considered comprehensive enough to rank.', estimatedScoreLoss: seoGain },
          recommendedSolution: {
            summary: 'Expand thin pages to at least 500 words with substantive, entity-rich content that directly addresses the page\'s stated topic.',
            steps: [
              'Audit each thin page to understand its intended purpose.',
              'Add a clear H1 + introduction paragraph (100–150 words) that names the topic and entity.',
              'Add 3–5 H2 sections that address related subtopics (100–200 words each).',
              'Include at least 2–3 specific facts, statistics, or examples to increase factual density.',
              'If the page is intentionally minimal (e.g., a contact page), add FAQPage schema to signal purpose.',
            ],
            difficulty: 'medium',
            estimatedTime: '2–3 hours per page',
          },
          generatedFix: {
            type: 'copy',
            copy: wordCounts.slice(0, 5).join('\n'),
            placementInstructions: 'Expand each listed page to at least 500 words. Prioritise pages with the most traffic potential.',
          },
          expectedImprovement: { aiVisibilityGain: aiGain, seoGain, trustGain, confidence: 0.75 },
          priorityScore: priorityScore(severity, aiGain, seoGain, trustGain),
        });
        break;
      }

      case 'noindex_page': {
        const aiGain = 8; const seoGain = 10; const trustGain = 3;
        results.push({
          id: nextId('noindex_page'),
          title: 'Pages blocked from indexing with noindex directive',
          category: 'technical',
          severity,
          affectedPages,
          evidence: affectedPages.slice(0, 5).map((url) => ({
            pageUrl: url,
            observedValue: 'robots meta: noindex',
            expectedValue: 'No noindex directive (or intentional)',
            crawlDataField: 'robotsDirectives',
            confidence: 1.0,
          })),
          whyItMatters: 'A noindex directive instructs all crawlers — including AI retrieval systems — to ignore this page entirely. Any content, entity signals, or trust signals on these pages are completely invisible to AI systems.',
          businessImpact: {
            summary: `${affectedPages.length} page${affectedPages.length > 1 ? 's are' : ' is'} intentionally hidden from crawlers. Verify each is genuinely non-indexable or remove the directive.`,
            impactLevel: 'high',
            affectedAreas: ['Search engine indexation', 'AI retrieval candidacy', 'Content discoverability'],
          },
          aiVisibilityImpact: {
            summary: 'Noindex pages are excluded from all AI retrieval pipelines. Content on these pages contributes zero to AI visibility scores.',
            affectedSignals: ['Machine Readability', 'Entity Clarity', 'Citation Probability'],
            estimatedScoreLoss: aiGain,
          },
          seoImpact: { summary: 'Noindex pages are completely removed from search indexes. If these pages should rank, this is a critical configuration error.', estimatedScoreLoss: seoGain },
          recommendedSolution: {
            summary: 'Review each noindex page. Remove the directive if the page should be discoverable. Retain it only for genuinely private or utility pages.',
            steps: [
              'List all noindex pages and their intended purpose.',
              'For each page, decide: should this be visible to search/AI? (landing pages, service pages, and content pages should be yes).',
              'Remove <meta name="robots" content="noindex"> for pages that should be indexed.',
              'Retain noindex for: admin pages, thank-you pages, duplicate/staging pages.',
              'Submit the URL to Google Search Console for re-crawling after removing noindex.',
            ],
            difficulty: 'easy',
            estimatedTime: '30 minutes review + changes',
          },
          generatedFix: {
            type: 'html',
            code: '<!-- Remove this tag from pages that should be indexed: -->\n<!-- <meta name="robots" content="noindex"> -->\n\n<!-- Or replace with: -->\n<meta name="robots" content="index, follow">',
            placementInstructions: 'Remove the noindex directive from the <head> of each listed page. If using a CMS, find the SEO/indexing settings for each page.',
          },
          expectedImprovement: { aiVisibilityGain: aiGain, seoGain, trustGain, confidence: 0.80 },
          priorityScore: priorityScore(severity, aiGain, seoGain, trustGain),
        });
        break;
      }

      default: {
        // Generic enrichment for unmapped types
        const aiGain = r.severity === 'critical' ? 8 : r.severity === 'warning' ? 5 : 2;
        const seoGain = r.severity === 'critical' ? 10 : r.severity === 'warning' ? 6 : 2;
        const trustGain = 2;
        results.push({
          id: nextId(type),
          title: r.message,
          category: 'seo',
          severity,
          affectedPages,
          evidence: affectedPages.slice(0, 3).map((url) => ({
            pageUrl: url,
            observedValue: r.problem,
            expectedValue: r.recommendation,
            crawlDataField: type,
            confidence: 0.9,
          })),
          whyItMatters: r.cause,
          businessImpact: {
            summary: r.problem,
            impactLevel: r.severity === 'critical' ? 'high' : 'medium',
            affectedAreas: ['SEO performance', 'Content visibility'],
          },
          aiVisibilityImpact: {
            summary: r.cause,
            affectedSignals: ['Machine Readability'],
            estimatedScoreLoss: aiGain,
          },
          seoImpact: { summary: r.cause, estimatedScoreLoss: seoGain },
          recommendedSolution: {
            summary: r.solution,
            steps: [r.solution],
            difficulty: 'medium',
            estimatedTime: '1 hour',
          },
          expectedImprovement: { aiVisibilityGain: aiGain, seoGain, trustGain, confidence: 0.70 },
          priorityScore: priorityScore(severity, aiGain, seoGain, trustGain),
        });
      }
    }
  }

  return results;
}

// ── Schema gap detection ──────────────────────────────────────────────────────

export function detectSchemaGapIssues(pages: CrawledPage[], domain: string): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const homepage = pages[0];
  if (!homepage) return issues;

  const allSchemaTypes = new Set(pages.flatMap((p) => p.schemaTypes ?? []));
  const orgSignals = extractOrgSignals(pages);

  // 1. Missing Organization schema
  const hasOrgSchema = allSchemaTypes.has('Organization') || allSchemaTypes.has('LocalBusiness') || allSchemaTypes.has('Corporation');
  if (!hasOrgSchema) {
    const aiGain = 14; const seoGain = 8; const trustGain = 16;
    const schemaCode = generateOrganizationSchema(orgSignals, domain);
    issues.push({
      id: nextId('missing_organization_schema'),
      title: 'Missing Organization schema — primary entity identity undefined',
      category: 'schema',
      severity: 'critical',
      affectedPages: [homepage.url],
      evidence: [{
        pageUrl: homepage.url,
        observedValue: 'No Organization, LocalBusiness, or Corporation schema found',
        expectedValue: 'Organization JSON-LD on homepage with name, url, description, sameAs',
        crawlDataField: 'schemaMarkup',
        confidence: 1.0,
      }],
      whyItMatters: 'Organization schema is the primary mechanism by which AI systems identify and verify the primary entity of a website. Without it, AI systems cannot confidently link this site to a real-world entity, blocking entity knowledge graph association, cross-source validation, and all knowledge panel signals. This is the single highest-impact schema fix available.',
      businessImpact: {
        summary: 'Without Organization schema, the business\'s identity is invisible to AI systems. No knowledge panel, no entity association, no AI-recommended entity. Direct impact on brand presence in AI-generated answers.',
        impactLevel: 'very_high',
        affectedAreas: ['Knowledge graph association', 'AI entity recognition', 'Brand trust signals', 'Citation eligibility', 'Voice assistant answers'],
      },
      aiVisibilityImpact: {
        summary: 'Organization schema is the foundation of entity clarity. Without it, AI systems treat the site as an anonymous content source rather than a verified entity, reducing citation probability and trust scores dramatically.',
        affectedSignals: ['Entity Clarity', 'Machine Trust', 'Citation Probability', 'External Validation', 'Recommendation Confidence'],
        estimatedScoreLoss: aiGain,
      },
      seoImpact: {
        summary: 'Organization schema enables Google Knowledge Panel, sitelinks search box, and rich entity features. Its absence blocks all entity-based rich results.',
        estimatedScoreLoss: seoGain,
      },
      recommendedSolution: {
        summary: 'Add an Organization JSON-LD block to the homepage <head> with name, url, description, logo, telephone, and sameAs links.',
        steps: [
          'Copy the generated Organization schema below.',
          'Replace the sameAs URLs with your actual Wikipedia, LinkedIn, and Wikidata URLs.',
          'Add your actual telephone number, address, and logo URL.',
          'Place the JSON-LD inside a <script type="application/ld+json"> tag in the homepage <head>.',
          'Validate using Google\'s Rich Results Test: https://search.google.com/test/rich-results',
          'Submit the homepage for re-crawling in Google Search Console.',
        ],
        difficulty: 'easy',
        estimatedTime: '45 minutes',
      },
      generatedFix: {
        type: 'json_ld',
        code: `<script type="application/ld+json">\n${schemaCode}\n</script>`,
        placementInstructions: 'Place inside <head> on the homepage. Replace all placeholder values before publishing.',
      },
      expectedImprovement: { aiVisibilityGain: aiGain, seoGain, trustGain, confidence: 0.92 },
      priorityScore: priorityScore('critical', aiGain, seoGain, trustGain),
    });
  }

  // 2. Missing sameAs links
  const hasSameAs = pages.some((p) =>
    p.schemaMarkup.some((s) => typeof s === 'object' && s !== null && 'sameAs' in s),
  );
  if (!hasSameAs) {
    const aiGain = 10; const seoGain = 5; const trustGain = 14;
    const sampleSchema = hasOrgSchema
      ? `// Add sameAs to your existing Organization schema:\n"sameAs": [\n  "https://en.wikipedia.org/wiki/${encodeURIComponent((orgSignals.name ?? domain).replace(/\s+/g, '_'))}",\n  "https://www.linkedin.com/company/${(orgSignals.name ?? domain).toLowerCase().replace(/[^a-z0-9]+/g, '-')}",\n  "https://www.wikidata.org/wiki/Q_REPLACE_WITH_QNUMBER"\n]`
      : generateOrganizationSchema(orgSignals, domain);

    issues.push({
      id: nextId('missing_same_as'),
      title: 'No sameAs links — entity cannot be cross-validated by AI systems',
      category: 'entity',
      severity: 'high',
      affectedPages: [homepage.url],
      evidence: [{
        pageUrl: homepage.url,
        observedValue: 'No sameAs property in any schema markup',
        expectedValue: 'sameAs array with Wikipedia, LinkedIn, Wikidata URLs',
        crawlDataField: 'schemaMarkup[].sameAs',
        confidence: 1.0,
      }],
      whyItMatters: 'AI systems use sameAs links to cross-validate entity identity against trusted external knowledge bases (Wikipedia, Wikidata, LinkedIn). Without sameAs, the AI system cannot confirm that the entity described on this site matches any known real-world entity, treating all entity claims as unverified assertions. This directly reduces citation probability and trust scores.',
      businessImpact: {
        summary: 'Without sameAs links, the business entity cannot be matched to external knowledge bases. AI systems cannot recommend a brand they cannot verify.',
        impactLevel: 'high',
        affectedAreas: ['Entity knowledge graph', 'Cross-source validation', 'AI trust formation', 'Brand authority'],
      },
      aiVisibilityImpact: {
        summary: 'sameAs enables the external validation score that feeds Machine Trust scoring. Without it, External Validation Score is near-zero, reducing overall trust by up to 25%.',
        affectedSignals: ['External Validation', 'Machine Trust', 'Entity Credibility', 'Cross-Source Validation Index'],
        estimatedScoreLoss: aiGain,
      },
      seoImpact: { summary: 'Google uses sameAs to connect entities to its Knowledge Graph. Without it, knowledge panel eligibility is significantly reduced.', estimatedScoreLoss: seoGain },
      recommendedSolution: {
        summary: 'Add sameAs links to your Organization schema pointing to your entity\'s profiles on Wikipedia, LinkedIn, Wikidata, and any other verified external sources.',
        steps: [
          'Find your Wikipedia article (or create one if none exists).',
          'Find your Wikidata item (search at wikidata.org).',
          'Find your LinkedIn Company Page URL.',
          'Add all URLs to a sameAs array in your Organization schema.',
          'Include any official government registries, industry directories, or major publication profiles.',
          'Validate the updated schema at https://validator.schema.org',
        ],
        difficulty: 'medium',
        estimatedTime: '1 hour',
      },
      generatedFix: {
        type: 'json_ld',
        code: `<script type="application/ld+json">\n${sampleSchema}\n</script>`,
        placementInstructions: 'Update your existing Organization schema with the sameAs property. Replace placeholder URLs with your actual profile URLs.',
      },
      expectedImprovement: { aiVisibilityGain: aiGain, seoGain, trustGain, confidence: 0.88 },
      priorityScore: priorityScore('high', aiGain, seoGain, trustGain),
    });
  }

  // 3. Missing FAQPage schema (if FAQ-eligible content exists)
  const hasFAQSchema = allSchemaTypes.has('FAQPage');
  if (!hasFAQSchema) {
    const faqOpps = detectFAQOpportunities(pages);
    if (faqOpps.length > 0) {
      const firstOpp = faqOpps[0]!;
      const aiGain = 14; const seoGain = 12; const trustGain = 5;
      issues.push({
        id: nextId('missing_faq_schema'),
        title: 'FAQ-eligible content found — FAQPage schema missing',
        category: 'schema',
        severity: 'high',
        affectedPages: faqOpps.map((o) => o.url).slice(0, 10),
        evidence: faqOpps.slice(0, 3).map((opp) => ({
          pageUrl: opp.url,
          observedValue: `${opp.faqs.length} question-style heading${opp.faqs.length > 1 ? 's' : ''} found without FAQPage schema`,
          expectedValue: 'FAQPage JSON-LD wrapping the Q&A content',
          crawlDataField: 'headings',
          confidence: 0.85,
        })),
        whyItMatters: 'FAQPage schema is the primary trigger for AI Overview inclusion. When Google or other AI systems encounter a FAQPage schema, the Q&A pairs become direct candidates for AI-generated answer extraction. Without it, this content is extracted less reliably and is substantially less likely to appear in AI responses.',
        businessImpact: {
          summary: 'FAQ content exists but is invisible to AI systems for direct Q&A extraction. Adding FAQPage schema can trigger AI Overview inclusion — the most valuable AI visibility surface.',
          impactLevel: 'high',
          affectedAreas: ['AI Overview inclusion', 'Voice assistant answers', 'Featured snippets', 'Conversational query matching'],
        },
        aiVisibilityImpact: {
          summary: 'FAQPage schema enables direct Q&A extraction by AI systems. It is the primary driver of AI Overview inclusion and voice assistant answer candidacy.',
          affectedSignals: ['Retrieval Readiness', 'Citation Probability', 'AI Overviews Inclusion', 'Voice Retrieval Probability'],
          estimatedScoreLoss: aiGain,
        },
        seoImpact: { summary: 'FAQPage schema enables FAQ rich results in Google search — expanding your SERP real estate and visibility above the fold.', estimatedScoreLoss: seoGain },
        recommendedSolution: {
          summary: 'Add FAQPage JSON-LD schema to pages with Q&A-style content, wrapping the detected question headings and their answer text.',
          steps: [
            'Identify pages with question-style headings (How, What, Why, When, Where, Can).',
            'For each question heading, identify the paragraph(s) that follow as the answer.',
            'Ensure each answer is at least 50 words and directly answers the question.',
            'Add FAQPage JSON-LD schema wrapping all Q&A pairs.',
            'Place the schema in the page <head>.',
            'Validate with Google\'s Rich Results Test.',
          ],
          difficulty: 'easy',
          estimatedTime: '30 minutes per page',
        },
        generatedFix: {
          type: 'faq',
          code: `<script type="application/ld+json">\n${generateFAQSchema(firstOpp.faqs.slice(0, 5))}\n</script>`,
          placementInstructions: `Generated from question-style headings on ${firstOpp.url}. Review and refine answer text before publishing. Add to the page <head>.`,
        },
        expectedImprovement: { aiVisibilityGain: aiGain, seoGain, trustGain, confidence: 0.82 },
        priorityScore: priorityScore('high', aiGain, seoGain, trustGain),
      });
    }
  }

  // 4. Missing BreadcrumbList schema (for sites with deep URL structure)
  const hasBreadcrumb = allSchemaTypes.has('BreadcrumbList');
  const deepPages = pages.filter((p) => {
    try { return new URL(p.url).pathname.split('/').filter(Boolean).length > 1; } catch { return false; }
  });
  if (!hasBreadcrumb && deepPages.length > 3) {
    const aiGain = 4; const seoGain = 6; const trustGain = 3;
    const examplePage = deepPages[0]!;
    issues.push({
      id: nextId('missing_breadcrumb_schema'),
      title: 'Missing BreadcrumbList schema on deep pages',
      category: 'schema',
      severity: 'medium',
      affectedPages: deepPages.slice(0, 10).map((p) => p.url),
      evidence: [{
        pageUrl: examplePage.url,
        observedValue: 'No BreadcrumbList schema found on deep URL pages',
        expectedValue: 'BreadcrumbList JSON-LD on all pages deeper than the homepage',
        crawlDataField: 'schemaMarkup',
        confidence: 0.95,
      }],
      whyItMatters: 'BreadcrumbList schema helps AI systems understand site hierarchy and the relationship between pages. It signals topical authority structure and enables breadcrumb rich results in search, which improve click-through rates.',
      businessImpact: {
        summary: 'Site hierarchy is not machine-readable. AI systems and search engines must infer page relationships from URL patterns alone, which is less reliable.',
        impactLevel: 'low',
        affectedAreas: ['Site hierarchy signals', 'Rich results eligibility', 'Navigation clarity for AI systems'],
      },
      aiVisibilityImpact: {
        summary: 'Breadcrumb schema improves topical authority modeling by making page hierarchy explicit for AI retrieval systems.',
        affectedSignals: ['Machine Readability', 'Entity Coverage', 'Topical Authority'],
        estimatedScoreLoss: aiGain,
      },
      seoImpact: { summary: 'BreadcrumbList schema enables breadcrumb rich results in Google, improving SERP appearance and click-through rates for deep pages.', estimatedScoreLoss: seoGain },
      recommendedSolution: {
        summary: 'Add BreadcrumbList JSON-LD to all pages deeper than the homepage, derived from the URL path structure.',
        steps: [
          'Identify all pages with more than one path segment in their URL.',
          'Generate BreadcrumbList schema for each, mapping URL segments to readable names.',
          'Add the schema to each page\'s <head>.',
          'Consider automating breadcrumb schema generation in your CMS template.',
        ],
        difficulty: 'medium',
        estimatedTime: '2 hours (template change)',
      },
      generatedFix: {
        type: 'json_ld',
        code: `<script type="application/ld+json">\n${generateBreadcrumbSchema(examplePage.url)}\n</script>`,
        placementInstructions: `Example generated for ${examplePage.url}. Generate equivalent schema for each deep page.`,
      },
      expectedImprovement: { aiVisibilityGain: aiGain, seoGain, trustGain, confidence: 0.80 },
      priorityScore: priorityScore('medium', aiGain, seoGain, trustGain),
    });
  }

  // 5. Missing WebSite schema on homepage
  const hasWebSiteSchema = allSchemaTypes.has('WebSite');
  if (!hasWebSiteSchema) {
    const aiGain = 5; const seoGain = 4; const trustGain = 3;
    const wsCode = generateWebSiteSchema(domain, orgSignals.name ?? domain, orgSignals.description ?? `${orgSignals.name ?? domain} — official website`);
    issues.push({
      id: nextId('missing_website_schema'),
      title: 'Missing WebSite schema — sitelinks search box not enabled',
      category: 'schema',
      severity: 'medium',
      affectedPages: [homepage.url],
      evidence: [{
        pageUrl: homepage.url,
        observedValue: 'No WebSite schema found',
        expectedValue: 'WebSite JSON-LD on homepage with potentialAction SearchAction',
        crawlDataField: 'schemaMarkup',
        confidence: 1.0,
      }],
      whyItMatters: 'WebSite schema with potentialAction enables the Google Sitelinks Search Box — users can search your site directly from Google SERPs. AI systems also use WebSite schema to understand the site\'s primary purpose and scope.',
      businessImpact: {
        summary: 'Sitelinks Search Box is not enabled. Users cannot search the site from Google results, reducing engagement and authority signals.',
        impactLevel: 'low',
        affectedAreas: ['Search appearance', 'User navigation', 'Brand authority signals'],
      },
      aiVisibilityImpact: {
        summary: 'WebSite schema provides a foundational site-level entity anchor that improves overall entity confidence scoring.',
        affectedSignals: ['Entity Clarity', 'Schema Completeness'],
        estimatedScoreLoss: aiGain,
      },
      seoImpact: { summary: 'WebSite schema is a prerequisite for Google\'s Sitelinks Search Box feature.', estimatedScoreLoss: seoGain },
      recommendedSolution: {
        summary: 'Add WebSite JSON-LD to the homepage with name, url, description, and a SearchAction pointing to your search functionality.',
        steps: [
          'Copy the generated WebSite schema below.',
          'Update the urlTemplate to match your actual site search URL pattern.',
          'Add to homepage <head> alongside Organization schema.',
          'Validate with Google Rich Results Test.',
        ],
        difficulty: 'easy',
        estimatedTime: '20 minutes',
      },
      generatedFix: {
        type: 'json_ld',
        code: `<script type="application/ld+json">\n${wsCode}\n</script>`,
        placementInstructions: 'Place in homepage <head>. Update the search URL pattern to match your site\'s search functionality.',
      },
      expectedImprovement: { aiVisibilityGain: aiGain, seoGain, trustGain, confidence: 0.80 },
      priorityScore: priorityScore('medium', aiGain, seoGain, trustGain),
    });
  }

  // 6. Missing speakable schema (voice retrieval)
  const hasSpeakable = pages.some((p) =>
    p.schemaMarkup.some((s) => typeof s === 'object' && s !== null && 'speakable' in s),
  );
  if (!hasSpeakable) {
    const aiGain = 8; const seoGain = 3; const trustGain = 2;
    issues.push({
      id: nextId('missing_speakable_schema'),
      title: 'No speakable schema — voice assistant retrieval blocked',
      category: 'schema',
      severity: 'medium',
      affectedPages: [homepage.url],
      evidence: [{
        pageUrl: homepage.url,
        observedValue: 'No speakable property in any schema markup',
        expectedValue: 'speakable schema on homepage and key content pages',
        crawlDataField: 'schemaMarkup[].speakable',
        confidence: 1.0,
      }],
      whyItMatters: 'Speakable schema tells voice assistants (Google Assistant, Alexa) which sections of your page are suitable for spoken retrieval. Without it, voice assistants must guess what to read aloud — typically selecting suboptimal content — or may skip the page entirely.',
      businessImpact: {
        summary: 'Voice assistant retrieval is not enabled. As voice search grows, this represents an increasingly significant discovery gap.',
        impactLevel: 'medium',
        affectedAreas: ['Voice assistant inclusion', 'Voice search visibility', 'Recommendation Surface — Voice'],
      },
      aiVisibilityImpact: {
        summary: 'Speakable schema is the primary driver of voice retrieval inclusion probability. Its absence limits recommendation surface coverage to non-voice channels.',
        affectedSignals: ['Voice Retrieval Probability', 'Recommendation Surface Score'],
        estimatedScoreLoss: aiGain,
      },
      seoImpact: { summary: 'Voice search represents a growing portion of queries. Speakable schema is a direct eligibility signal for voice-first retrieval.', estimatedScoreLoss: seoGain },
      recommendedSolution: {
        summary: 'Add speakable schema to homepage and key content pages, pointing to CSS selectors that identify concise, directly answerable content.',
        steps: [
          'Identify 2–3 CSS selectors on your key pages that contain short, direct factual answers.',
          'Add WebPage JSON-LD with a speakable property specifying those selectors.',
          'Prioritise the homepage, FAQ page, and About page.',
          'Ensure the speakable content is under 30 words per section for optimal voice output.',
        ],
        difficulty: 'medium',
        estimatedTime: '1 hour',
      },
      generatedFix: {
        type: 'json_ld',
        code: `<script type="application/ld+json">\n${generateSpeakableSchema(homepage.url, ['h1', '.summary', '.key-fact', 'article > p:first-of-type'])}\n</script>`,
        placementInstructions: 'Add to homepage and FAQ page. Update cssSelector values to match your site\'s CSS class names.',
      },
      expectedImprovement: { aiVisibilityGain: aiGain, seoGain, trustGain, confidence: 0.75 },
      priorityScore: priorityScore('medium', aiGain, seoGain, trustGain),
    });
  }

  // 7. Missing OG tags
  const missingOGPages = pages.filter((p) => {
    const og = p.openGraph;
    return !og || (!og.title && !og.description);
  });
  if (missingOGPages.length > pages.length * 0.5) {
    const aiGain = 4; const seoGain = 5; const trustGain = 3;
    const sampleOGPage = missingOGPages[0];
    issues.push({
      id: nextId('missing_og_tags'),
      title: 'Open Graph tags missing — poor social sharing appearance',
      category: 'seo',
      severity: 'medium',
      affectedPages: missingOGPages.slice(0, 10).map((p) => p.url),
      evidence: missingOGPages.slice(0, 3).map((p) => ({
        pageUrl: p.url,
        observedValue: 'No og:title or og:description found',
        expectedValue: 'og:title, og:description, og:image, og:url',
        crawlDataField: 'openGraph',
        confidence: 0.95,
      })),
      whyItMatters: 'Open Graph tags control how pages appear when shared on social media and messaging platforms. AI systems increasingly use social sharing signals as secondary trust validation. Poor OG data also reduces click-through from social channels.',
      businessImpact: {
        summary: 'Social shares of site pages will use auto-extracted metadata — typically the first sentence of body text — which rarely represents the page accurately.',
        impactLevel: 'medium',
        affectedAreas: ['Social sharing appearance', 'Click-through from social', 'Secondary trust signals'],
      },
      aiVisibilityImpact: {
        summary: 'Social engagement signals are used as secondary validation in some AI trust models. Consistent OG data strengthens content authority perception.',
        affectedSignals: ['Semantic Trust', 'External Validation'],
        estimatedScoreLoss: aiGain,
      },
      seoImpact: { summary: 'OG tags directly control social media previews, affecting click-through rates from social sharing.', estimatedScoreLoss: seoGain },
      recommendedSolution: {
        summary: 'Add og:title, og:description, og:image, og:url, and og:type to all pages. Include Twitter card meta tags for Twitter/X sharing.',
        steps: [
          'Add OG tags to your site template or CMS SEO settings.',
          'Set og:title to the page title, og:description to the meta description.',
          'Create a default og:image (1200×630px) for pages without a featured image.',
          'Use an OG debugger to verify the output.',
        ],
        difficulty: 'easy',
        estimatedTime: '1 hour (template change)',
      },
      ...(sampleOGPage ? {
        generatedFix: {
          type: 'meta' as const,
          code: generateOGTags(sampleOGPage, domain),
          placementInstructions: `Example generated for ${sampleOGPage.url}. Add to all page templates. Update og:image to use a real image URL.`,
        },
      } : {}),
      expectedImprovement: { aiVisibilityGain: aiGain, seoGain, trustGain, confidence: 0.82 },
      priorityScore: priorityScore('medium', aiGain, seoGain, trustGain),
    });
  }

  // 8. Missing alt text
  const imagesWithoutAlt = pages.flatMap((p) =>
    p.images.filter((img) => !img.alt || img.alt.trim() === '').map((img) => ({ url: p.url, src: img.src })),
  );
  if (imagesWithoutAlt.length > 0) {
    const aiGain = 4; const seoGain = 6; const trustGain = 2;
    issues.push({
      id: nextId('missing_alt_text'),
      title: `Missing alt text on ${imagesWithoutAlt.length} image${imagesWithoutAlt.length > 1 ? 's' : ''}`,
      category: 'accessibility',
      severity: 'medium',
      affectedPages: [...new Set(imagesWithoutAlt.map((i) => i.url))].slice(0, 10),
      evidence: imagesWithoutAlt.slice(0, 5).map((img) => ({
        pageUrl: img.url,
        observedValue: `<img src="${img.src}" alt="">`,
        expectedValue: 'Descriptive alt text describing the image content',
        crawlDataField: 'images[].alt',
        confidence: 1.0,
      })),
      whyItMatters: 'Alt text serves dual purposes: accessibility (screen readers) and AI image context. AI retrieval systems use alt text as a signal for image content classification and page relevance. Missing alt text reduces accessibility compliance and prevents AI image understanding.',
      businessImpact: {
        summary: `${imagesWithoutAlt.length} images have no alt text — accessibility compliance risk and missed image SEO opportunity.`,
        impactLevel: 'medium',
        affectedAreas: ['Accessibility compliance', 'Image SEO', 'AI image understanding', 'Screen reader UX'],
      },
      aiVisibilityImpact: {
        summary: 'Alt text provides image context for AI content classification. Missing alt text reduces content completeness scores.',
        affectedSignals: ['Machine Readability', 'Content Depth'],
        estimatedScoreLoss: aiGain,
      },
      seoImpact: { summary: 'Alt text is a primary image SEO signal for Google Images ranking. Missing alt text blocks image search visibility.', estimatedScoreLoss: seoGain },
      recommendedSolution: {
        summary: 'Add descriptive alt text to all images. Describe what the image shows, not what you want it to rank for. For decorative images, use alt="".',
        steps: [
          'Audit all images across the site for missing alt text.',
          'Write a 5–10 word description of each image\'s content (what it shows, not why it\'s there).',
          'For decorative images (borders, dividers), use alt="" to skip them for screen readers.',
          'Never stuff keywords in alt text — describe the image naturally.',
          'Add alt text via CMS image settings or directly in HTML.',
        ],
        difficulty: 'medium',
        estimatedTime: '2–4 hours',
      },
      generatedFix: {
        type: 'alt_text',
        code: imagesWithoutAlt.slice(0, 5).map((img) =>
          generateAltTextHTML(img.src, generateAltTextSuggestion(img.src, null)),
        ).join('\n'),
        placementInstructions: 'Update each image element with the suggested alt text. Review each suggestion — they are derived from filenames and may need adjustment.',
      },
      expectedImprovement: { aiVisibilityGain: aiGain, seoGain, trustGain, confidence: 0.85 },
      priorityScore: priorityScore('medium', aiGain, seoGain, trustGain),
    });
  }

  // 9. No external validation links
  const authorityDomains = ['wikipedia.org', 'wikidata.org', 'linkedin.com', 'companies', 'bloomberg', 'reuters', 'gov.uk', 'gov.', 'yelp', 'trustpilot', 'g2.com'];
  const allExternal = pages.flatMap((p) => p.externalLinks);
  const hasAuthorityLinks = allExternal.some((u) => authorityDomains.some((d) => u.includes(d)));
  if (!hasAuthorityLinks) {
    const aiGain = 6; const seoGain = 4; const trustGain = 10;
    issues.push({
      id: nextId('no_external_validation'),
      title: 'No links to authoritative external sources',
      category: 'trust',
      severity: 'medium',
      affectedPages: [homepage.url],
      evidence: [{
        pageUrl: homepage.url,
        observedValue: 'No outbound links to Wikipedia, Wikidata, LinkedIn, or government sources',
        expectedValue: 'Links to 2–5 authoritative external sources that validate entity claims',
        crawlDataField: 'externalLinks',
        confidence: 0.90,
      }],
      whyItMatters: 'AI trust systems are not self-contained. They validate entity claims by checking external sources. A site with no outbound links to authoritative sources appears self-referential — all its trust signals are internal and unverifiable. External validation links are one of the most under-used trust signals available.',
      businessImpact: {
        summary: 'All trust signals are self-referential. AI systems cannot cross-verify any entity claim against an external source, reducing Machine Trust score significantly.',
        impactLevel: 'medium',
        affectedAreas: ['Machine trust formation', 'External validation', 'Citation credibility', 'Entity verification'],
      },
      aiVisibilityImpact: {
        summary: 'External Validation Score is a 25% component of Machine Trust Score. Without authority links, this sub-score is near-minimum, suppressing overall trust.',
        affectedSignals: ['External Validation Score', 'Machine Trust', 'Cross-Source Validation Index', 'Citation Probability'],
        estimatedScoreLoss: aiGain,
      },
      seoImpact: { summary: 'Outbound authority links are a secondary trust signal for Google. They indicate editorial quality and factual grounding.', estimatedScoreLoss: seoGain },
      recommendedSolution: {
        summary: 'Add 3–5 outbound links to authoritative sources that validate key claims on your site — not reciprocal links, but genuine references.',
        steps: [
          'Identify 3–5 factual claims on your homepage or about page (founding date, location, certifications, etc.).',
          'Find authoritative sources that verify each claim (Wikipedia, Companies House, LinkedIn, industry bodies).',
          'Add natural in-text links to these sources on relevant pages.',
          'Ensure links open in a new tab for user experience, but do not add nofollow unless appropriate.',
          'Add sameAs links in your Organization schema pointing to the same sources.',
        ],
        difficulty: 'easy',
        estimatedTime: '1 hour',
      },
      generatedFix: {
        type: 'copy',
        copy: `Add natural outbound links from your About or homepage to:\n- Your Wikipedia article (or create one)\n- Your LinkedIn Company page\n- Your Wikidata item (https://www.wikidata.org)\n- Any industry certification or regulatory body that lists your business\n- Companies House or equivalent business registry`,
        placementInstructions: 'Add these links naturally in your About page, homepage, or footer. They should appear as genuine citations, not forced link lists.',
      },
      expectedImprovement: { aiVisibilityGain: aiGain, seoGain, trustGain, confidence: 0.80 },
      priorityScore: priorityScore('medium', aiGain, seoGain, trustGain),
    });
  }

  return issues;
}

// ── Content gap detection ─────────────────────────────────────────────────────

export function detectContentGapIssues(pages: CrawledPage[], domain: string): AuditIssue[] {
  const issues: AuditIssue[] = [];

  // Service pages without Service schema
  const servicePages = detectServicePages(pages);
  const allSchemaTypes = new Set(pages.flatMap((p) => p.schemaTypes ?? []));
  if (servicePages.length > 0 && !allSchemaTypes.has('Service')) {
    const aiGain = 6; const seoGain = 5; const trustGain = 4;
    const firstService = servicePages[0]!;
    const orgSignals = extractOrgSignals(pages);
    issues.push({
      id: nextId('missing_service_schema'),
      title: `Service pages found — Service schema missing (${servicePages.length} page${servicePages.length > 1 ? 's' : ''})`,
      category: 'schema',
      severity: 'medium',
      affectedPages: servicePages.map((s) => s.url),
      evidence: servicePages.slice(0, 3).map((s) => ({
        pageUrl: s.url,
        observedValue: 'Service-like page found without Service schema',
        expectedValue: 'Service JSON-LD with name, description, provider',
        crawlDataField: 'schemaMarkup',
        confidence: 0.75,
      })),
      whyItMatters: 'Service schema helps AI systems understand what services a business offers, enabling service-query matching. AI systems generating "best X service" recommendations rely on Service schema to identify eligible businesses.',
      businessImpact: {
        summary: 'Service offerings are not machine-readable. AI systems generating recommendation responses for relevant service queries cannot easily identify this business as a candidate.',
        impactLevel: 'medium',
        affectedAreas: ['Service query matching', 'AI recommendation candidacy', 'Local service search'],
      },
      aiVisibilityImpact: {
        summary: 'Service schema enables service-intent query matching. Without it, the site misses AI-recommended service queries for its primary offerings.',
        affectedSignals: ['Entity Coverage', 'Retrieval Readiness', 'Recommendation Confidence'],
        estimatedScoreLoss: aiGain,
      },
      seoImpact: { summary: 'Service schema improves local and vertical search visibility for service-intent queries.', estimatedScoreLoss: seoGain },
      recommendedSolution: {
        summary: 'Add Service JSON-LD to each service page, naming the service, describing it, and linking to the provider Organisation.',
        steps: [
          'Identify all service pages on the site.',
          'For each, add a Service schema with name, description, url, and provider.',
          'Link the provider to your Organisation schema using sameAs or by matching the name.',
          'Validate with schema.org validator.',
        ],
        difficulty: 'easy',
        estimatedTime: '30 minutes per service page',
      },
      generatedFix: {
        type: 'json_ld',
        code: `<script type="application/ld+json">\n${generateServiceSchema(firstService.name, firstService.description, firstService.url, orgSignals.name ?? domain)}\n</script>`,
        placementInstructions: `Example generated for ${firstService.url}. Replicate for each service page.`,
      },
      expectedImprovement: { aiVisibilityGain: aiGain, seoGain, trustGain, confidence: 0.75 },
      priorityScore: priorityScore('medium', aiGain, seoGain, trustGain),
    });
  }

  return issues;
}
