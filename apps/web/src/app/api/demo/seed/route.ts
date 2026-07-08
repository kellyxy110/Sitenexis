export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';

const DEMO_USER_ID = '45f3fbf3-11a2-4ad8-a4ed-ce016c51fcb8';

const demos = [
  {
    domain: 'tryprofound.com',
    pages: [
      { url: 'https://tryprofound.com/', statusCode: 200, title: 'Profound - AI-Powered Analytics', metaDescription: 'Transform your data into actionable insights with AI-powered analytics platform.', h1: 'Transform Data Into Decisions', canonicalUrl: 'https://tryprofound.com/', wordCount: 1420, isIndexable: true, internalLinks: 12, externalLinks: 3, seoScore: 72, aiScore: 65 },
      { url: 'https://tryprofound.com/pricing', statusCode: 200, title: 'Pricing - Profound', metaDescription: 'Choose the right plan for your analytics needs. Free, Pro, and Enterprise tiers available.', h1: 'Simple, Transparent Pricing', canonicalUrl: 'https://tryprofound.com/pricing', wordCount: 890, isIndexable: true, internalLinks: 8, externalLinks: 1, seoScore: 58, aiScore: 42 },
      { url: 'https://tryprofound.com/features', statusCode: 200, title: 'Features - Profound Analytics', metaDescription: 'Explore powerful features: real-time dashboards, predictive analytics, team collaboration.', h1: 'Features Built for Modern Teams', canonicalUrl: 'https://tryprofound.com/features', wordCount: 2100, isIndexable: true, internalLinks: 15, externalLinks: 2, seoScore: 74, aiScore: 68 },
      { url: 'https://tryprofound.com/about', statusCode: 200, title: 'About Us - Profound', metaDescription: 'Meet the team behind Profound. Founded in 2023, we are building the future of data analytics.', h1: 'About Profound', canonicalUrl: 'https://tryprofound.com/about', wordCount: 650, isIndexable: true, internalLinks: 6, externalLinks: 4, seoScore: 68, aiScore: 55 },
      { url: 'https://tryprofound.com/blog', statusCode: 200, title: 'Blog - Profound', metaDescription: 'Insights and updates from the Profound team on AI, analytics, and data science.', h1: 'Blog', canonicalUrl: 'https://tryprofound.com/blog', wordCount: 320, isIndexable: true, internalLinks: 18, externalLinks: 0, seoScore: 52, aiScore: 38 },
      { url: 'https://tryprofound.com/contact', statusCode: 200, title: 'Contact - Profound', metaDescription: 'Get in touch with our team for demos, support, or partnership inquiries.', h1: 'Contact Us', canonicalUrl: 'https://tryprofound.com/contact', wordCount: 180, isIndexable: true, internalLinks: 4, externalLinks: 2, seoScore: 45, aiScore: 32 },
      { url: 'https://tryprofound.com/docs', statusCode: 200, title: 'Documentation - Profound', metaDescription: 'Complete documentation for integrating and using Profound analytics platform.', h1: 'Documentation', canonicalUrl: 'https://tryprofound.com/docs', wordCount: 3200, isIndexable: true, internalLinks: 42, externalLinks: 8, seoScore: 78, aiScore: 72 },
    ],
    issues: [
      { module: 'seo', type: 'missing-meta-description', severity: 'warning', message: 'Blog listing page has a generic meta description that doesn\'t differentiate content', recommendation: 'Write a unique meta description highlighting recent topics and value proposition', pageUrl: 'https://tryprofound.com/blog' },
      { module: 'seo', type: 'thin-content', severity: 'warning', message: 'Contact page has only 180 words — insufficient for AI entity extraction', recommendation: 'Add structured information about support channels, office locations, and response times', pageUrl: 'https://tryprofound.com/contact' },
      { module: 'seo', type: 'missing-structured-data', severity: 'critical', message: 'Pricing page lacks Product/Offer schema — invisible to AI price comparison queries', recommendation: 'Add Product schema with Offer sub-type for each pricing tier', pageUrl: 'https://tryprofound.com/pricing' },
      { module: 'ai', type: 'low-entity-clarity', severity: 'critical', message: 'Primary entity "Profound" is not defined with consistent attributes across pages', recommendation: 'Define Organisation schema on homepage with consistent name, description, and founding date across all pages' },
      { module: 'ai', type: 'poor-chunk-extractability', severity: 'warning', message: 'Features page uses image-heavy layout — 60% of feature descriptions are in images not text', recommendation: 'Ensure all feature descriptions exist as indexable text, not only in graphics' },
      { module: 'ai', type: 'missing-faq-structure', severity: 'warning', message: 'Pricing page FAQ section not marked up with FAQPage schema', recommendation: 'Wrap FAQ section in FAQPage structured data for direct AI extraction' },
      { module: 'schema', type: 'missing-organisation-schema', severity: 'critical', message: 'No Organisation schema detected on any page — primary entity is undefined to AI', recommendation: 'Add Organisation schema to homepage with name, url, logo, description, foundingDate, sameAs links' },
      { module: 'schema', type: 'missing-breadcrumb', severity: 'info', message: 'No BreadcrumbList schema — navigation hierarchy invisible to retrieval systems', recommendation: 'Add BreadcrumbList to all interior pages' },
      { module: 'performance', type: 'slow-lcp', severity: 'warning', message: 'Homepage LCP is 3.2s — hero image loads without priority hint', recommendation: 'Add fetchpriority="high" to hero image and preload it in <head>' },
      { module: 'links', type: 'orphan-page', severity: 'info', message: 'Contact page receives only 4 internal links — low PageRank signal', recommendation: 'Add contextual links to contact page from footer and relevant content pages' },
      { module: 'ai', type: 'pricing-invisible-to-ai', severity: 'critical', message: 'Pricing page renders plan details via client-side JavaScript — content absent in SSR HTML', recommendation: 'Server-side render all pricing tier information so crawlers and AI systems can extract it without JS execution' },
      { module: 'citation', type: 'low-factual-density', severity: 'warning', message: 'About page lacks specific factual claims (founding year, team size, customers served)', recommendation: 'Add verifiable facts: founding date, team size, customers served, funding raised' },
    ],
    scores: {
      overall: 58, seoScore: 64, aiScore: 52, schemaScore: 28, linkGraphScore: 71, performanceScore: 62,
      breakdown: {
        seo: { titleOptimisation: 78, metaOptimisation: 62, headingStructure: 72, canonicalisation: 85, crawlability: 68, imageOptimisation: 45 },
        ai: { entityClarity: 42, conversationalReadiness: 55, aiExtractability: 48, knowledgeGraphStructure: 35 },
        machineReadability: { renderingFidelity: 55, boilerplateRatio: 72, chunkBoundaryQuality: 60, signalToNoiseRatio: 58, headingHierarchy: 75, readingOrderConsistency: 80, linkAnchorQuality: 62 },
        entityIntelligence: { entityConfidenceScore: 38, entityConsistencyScore: 45, entityCoverageScore: 52, disambiguationScore: 40 },
        citationAnalysis: { citationProbabilityScore: 32 },
        semanticTrust: { score: 48, breakdown: { authorshipTrust: 35, organisationalTrust: 42, contentTrust: 58, structuralTrust: 55 } },
        performance: { lcp: 3200, cls: 0.12, ttfb: 420 },
      },
    },
    aiVisibility: { aiVisibilityScore: 42, entityConfidenceScore: 38, citationProbabilityScore: 32, machineReadabilityScore: 62, semanticTrustScore: 48, retrievalReadinessScore: 45, recommendationConfidence: 28, providerScores: {}, breakdown: {} },
  },
  {
    domain: 'alwajudproperties.com',
    pages: [
      { url: 'https://alwajudproperties.com/', statusCode: 200, title: 'Al Wajud Properties - Premium Real Estate in Dubai', metaDescription: 'Al Wajud Properties offers premium residential and commercial real estate in Dubai.', h1: 'Premium Real Estate in Dubai', canonicalUrl: 'https://alwajudproperties.com/', wordCount: 1850, isIndexable: true, internalLinks: 18, externalLinks: 5, seoScore: 76, aiScore: 70 },
      { url: 'https://alwajudproperties.com/properties', statusCode: 200, title: 'Properties for Sale - Al Wajud Properties', metaDescription: 'Browse luxury apartments, villas, and commercial properties in Dubai Marina, Downtown, Palm Jumeirah.', h1: 'Properties for Sale', canonicalUrl: 'https://alwajudproperties.com/properties', wordCount: 2400, isIndexable: true, internalLinks: 35, externalLinks: 2, seoScore: 72, aiScore: 65 },
      { url: 'https://alwajudproperties.com/about', statusCode: 200, title: 'About Al Wajud Properties', metaDescription: 'Established in 2018, Al Wajud Properties is a RERA-licensed real estate brokerage.', h1: 'About Us', canonicalUrl: 'https://alwajudproperties.com/about', wordCount: 920, isIndexable: true, internalLinks: 8, externalLinks: 6, seoScore: 80, aiScore: 75 },
      { url: 'https://alwajudproperties.com/services', statusCode: 200, title: 'Our Services - Al Wajud Properties', metaDescription: 'Property management, investment advisory, buyer representation, and rental services in Dubai.', h1: 'Services', canonicalUrl: 'https://alwajudproperties.com/services', wordCount: 1100, isIndexable: true, internalLinks: 12, externalLinks: 3, seoScore: 74, aiScore: 68 },
      { url: 'https://alwajudproperties.com/contact', statusCode: 200, title: 'Contact Al Wajud Properties', metaDescription: 'Visit our office in Business Bay, Dubai or call us for property consultation.', h1: 'Get in Touch', canonicalUrl: 'https://alwajudproperties.com/contact', wordCount: 280, isIndexable: true, internalLinks: 5, externalLinks: 2, seoScore: 62, aiScore: 58 },
      { url: 'https://alwajudproperties.com/blog', statusCode: 200, title: 'Real Estate Blog - Al Wajud Properties', metaDescription: 'Dubai real estate market insights, investment guides, and property news.', h1: 'Market Insights', canonicalUrl: 'https://alwajudproperties.com/blog', wordCount: 450, isIndexable: true, internalLinks: 22, externalLinks: 4, seoScore: 68, aiScore: 60 },
    ],
    issues: [
      { module: 'schema', type: 'missing-local-business-schema', severity: 'critical', message: 'No LocalBusiness or RealEstateAgent schema — invisible to local AI queries', recommendation: 'Add RealEstateAgent schema with address, geo coordinates, openingHours, RERA license number' },
      { module: 'ai', type: 'low-entity-clarity', severity: 'warning', message: 'Entity "Al Wajud Properties" lacks consistent founding date across pages', recommendation: 'Standardize founding year (2018) in schema and body text across all pages' },
      { module: 'seo', type: 'missing-geo-meta', severity: 'warning', message: 'No geo meta tags or hreflang for Dubai-targeted content', recommendation: 'Add geo.region, geo.placename meta tags and consider hreflang for English/Arabic' },
      { module: 'ai', type: 'missing-review-schema', severity: 'warning', message: 'No AggregateRating or Review schema — client testimonials exist but are not structured', recommendation: 'Add Review schema with author, datePublished, and ratingValue for each testimonial' },
      { module: 'citation', type: 'low-factual-density', severity: 'info', message: 'Service pages lack specific metrics (properties sold, average days on market)', recommendation: 'Add verifiable performance metrics to build citation eligibility' },
      { module: 'performance', type: 'large-images', severity: 'warning', message: 'Property listing images average 1.8MB — no WebP or responsive srcset', recommendation: 'Convert to WebP, add srcset for responsive loading, lazy-load below-fold images' },
      { module: 'links', type: 'deep-pages', severity: 'info', message: '3 property detail pages require 4+ clicks from homepage', recommendation: 'Add category landing pages to flatten site architecture' },
      { module: 'seo', type: 'duplicate-meta', severity: 'warning', message: 'Properties listing and individual property pages share similar meta descriptions', recommendation: 'Write unique meta descriptions for each property page highlighting specific features' },
    ],
    scores: {
      overall: 68, seoScore: 72, aiScore: 65, schemaScore: 42, linkGraphScore: 74, performanceScore: 58,
      breakdown: {
        seo: { titleOptimisation: 82, metaOptimisation: 70, headingStructure: 78, canonicalisation: 90, crawlability: 72, imageOptimisation: 40 },
        ai: { entityClarity: 62, conversationalReadiness: 68, aiExtractability: 65, knowledgeGraphStructure: 55 },
        machineReadability: { renderingFidelity: 78, boilerplateRatio: 70, chunkBoundaryQuality: 72, signalToNoiseRatio: 65, headingHierarchy: 80, readingOrderConsistency: 82, linkAnchorQuality: 68 },
        entityIntelligence: { entityConfidenceScore: 58, entityConsistencyScore: 55, entityCoverageScore: 62, disambiguationScore: 65 },
        citationAnalysis: { citationProbabilityScore: 48 },
        semanticTrust: { score: 62, breakdown: { authorshipTrust: 55, organisationalTrust: 68, contentTrust: 62, structuralTrust: 60 } },
        performance: { lcp: 2800, cls: 0.08, ttfb: 380 },
      },
    },
    aiVisibility: { aiVisibilityScore: 58, entityConfidenceScore: 58, citationProbabilityScore: 48, machineReadabilityScore: 72, semanticTrustScore: 62, retrievalReadinessScore: 60, recommendationConfidence: 45, providerScores: {}, breakdown: {} },
  },
  {
    domain: 'genshipyard.com',
    pages: [
      { url: 'https://genshipyard.com/', statusCode: 200, title: 'GenShipyard - AI Agent Development Platform', metaDescription: 'Build, deploy, and scale AI agents with GenShipyard.', h1: 'Ship AI Agents at Scale', canonicalUrl: 'https://genshipyard.com/', wordCount: 2200, isIndexable: true, internalLinks: 16, externalLinks: 4, seoScore: 82, aiScore: 78 },
      { url: 'https://genshipyard.com/platform', statusCode: 200, title: 'Platform - GenShipyard', metaDescription: 'Agent orchestration, tool integration, memory management, and deployment infrastructure.', h1: 'The Complete Agent Platform', canonicalUrl: 'https://genshipyard.com/platform', wordCount: 3100, isIndexable: true, internalLinks: 22, externalLinks: 6, seoScore: 85, aiScore: 80 },
      { url: 'https://genshipyard.com/docs', statusCode: 200, title: 'Documentation - GenShipyard', metaDescription: 'Complete API reference, quickstart guides, and architecture documentation.', h1: 'Developer Documentation', canonicalUrl: 'https://genshipyard.com/docs', wordCount: 5200, isIndexable: true, internalLinks: 68, externalLinks: 12, seoScore: 88, aiScore: 85 },
      { url: 'https://genshipyard.com/pricing', statusCode: 200, title: 'Pricing - GenShipyard', metaDescription: 'Usage-based pricing for AI agent deployment. Free tier included.', h1: 'Pricing', canonicalUrl: 'https://genshipyard.com/pricing', wordCount: 780, isIndexable: true, internalLinks: 8, externalLinks: 1, seoScore: 75, aiScore: 72 },
      { url: 'https://genshipyard.com/blog', statusCode: 200, title: 'Blog - GenShipyard', metaDescription: 'Technical deep dives on AI agent architecture, LLM orchestration.', h1: 'Engineering Blog', canonicalUrl: 'https://genshipyard.com/blog', wordCount: 1200, isIndexable: true, internalLinks: 28, externalLinks: 8, seoScore: 78, aiScore: 75 },
      { url: 'https://genshipyard.com/use-cases', statusCode: 200, title: 'Use Cases - GenShipyard', metaDescription: 'Real-world AI agent deployments: customer support, data pipelines, code review.', h1: 'Use Cases', canonicalUrl: 'https://genshipyard.com/use-cases', wordCount: 2800, isIndexable: true, internalLinks: 18, externalLinks: 5, seoScore: 80, aiScore: 77 },
      { url: 'https://genshipyard.com/about', statusCode: 200, title: 'About GenShipyard', metaDescription: 'Founded by ex-Google and DeepMind engineers.', h1: 'About Us', canonicalUrl: 'https://genshipyard.com/about', wordCount: 950, isIndexable: true, internalLinks: 10, externalLinks: 8, seoScore: 78, aiScore: 72 },
      { url: 'https://genshipyard.com/changelog', statusCode: 200, title: 'Changelog - GenShipyard', metaDescription: 'Latest platform updates, new features, and API changes.', h1: 'Changelog', canonicalUrl: 'https://genshipyard.com/changelog', wordCount: 1800, isIndexable: true, internalLinks: 14, externalLinks: 2, seoScore: 70, aiScore: 68 },
    ],
    issues: [
      { module: 'schema', type: 'missing-software-application-schema', severity: 'warning', message: 'No SoftwareApplication schema — AI systems cannot classify this as a developer tool', recommendation: 'Add SoftwareApplication schema with applicationCategory, operatingSystem, offers' },
      { module: 'ai', type: 'entity-consistency', severity: 'info', message: 'Entity "GenShipyard" consistently described across 7/8 pages (changelog lacks entity context)', recommendation: 'Add brief platform description to changelog page header' },
      { module: 'seo', type: 'missing-article-schema', severity: 'info', message: 'Blog posts lack Article schema with author and datePublished', recommendation: 'Add Article or TechArticle schema to blog posts' },
      { module: 'citation', type: 'high-factual-density', severity: 'info', message: 'Documentation pages have high factual density — excellent citation eligibility', recommendation: 'Maintain current factual precision; consider adding version-specific dates' },
      { module: 'performance', type: 'good-cwv', severity: 'info', message: 'Core Web Vitals are within Good thresholds across all tested pages', recommendation: 'Monitor LCP on documentation pages as content grows' },
      { module: 'ai', type: 'strong-conversational-readiness', severity: 'info', message: 'Use cases page well-structured for AI question-answering', recommendation: 'Consider adding FAQ schema to reinforce AI extraction' },
    ],
    scores: {
      overall: 79, seoScore: 80, aiScore: 76, schemaScore: 58, linkGraphScore: 82, performanceScore: 85,
      breakdown: {
        seo: { titleOptimisation: 88, metaOptimisation: 82, headingStructure: 85, canonicalisation: 92, crawlability: 78, imageOptimisation: 72 },
        ai: { entityClarity: 78, conversationalReadiness: 82, aiExtractability: 75, knowledgeGraphStructure: 68 },
        machineReadability: { renderingFidelity: 88, boilerplateRatio: 80, chunkBoundaryQuality: 78, signalToNoiseRatio: 75, headingHierarchy: 88, readingOrderConsistency: 85, linkAnchorQuality: 78 },
        entityIntelligence: { entityConfidenceScore: 72, entityConsistencyScore: 78, entityCoverageScore: 75, disambiguationScore: 70 },
        citationAnalysis: { citationProbabilityScore: 68 },
        semanticTrust: { score: 72, breakdown: { authorshipTrust: 68, organisationalTrust: 75, contentTrust: 78, structuralTrust: 70 } },
        performance: { lcp: 1800, cls: 0.04, ttfb: 220 },
      },
    },
    aiVisibility: { aiVisibilityScore: 72, entityConfidenceScore: 72, citationProbabilityScore: 68, machineReadabilityScore: 82, semanticTrustScore: 72, retrievalReadinessScore: 75, recommendationConfidence: 62, providerScores: {}, breakdown: {} },
  },
  {
    domain: 'inforsphere.com',
    pages: [
      { url: 'https://inforsphere.com/', statusCode: 200, title: 'InforSphere - Enterprise Data Intelligence', metaDescription: 'InforSphere delivers enterprise data intelligence solutions.', h1: 'Enterprise Data Intelligence', canonicalUrl: 'https://inforsphere.com/', wordCount: 1600, isIndexable: true, internalLinks: 14, externalLinks: 3, seoScore: 70, aiScore: 62 },
      { url: 'https://inforsphere.com/solutions', statusCode: 200, title: 'Solutions - InforSphere', metaDescription: 'Data governance, master data management, data quality, and analytics solutions.', h1: 'Our Solutions', canonicalUrl: 'https://inforsphere.com/solutions', wordCount: 2100, isIndexable: true, internalLinks: 20, externalLinks: 4, seoScore: 72, aiScore: 65 },
      { url: 'https://inforsphere.com/platform', statusCode: 200, title: 'Platform Overview - InforSphere', metaDescription: 'Unified data platform connecting governance, quality, and intelligence layers.', h1: 'The InforSphere Platform', canonicalUrl: 'https://inforsphere.com/platform', wordCount: 2800, isIndexable: true, internalLinks: 16, externalLinks: 5, seoScore: 75, aiScore: 68 },
      { url: 'https://inforsphere.com/industries', statusCode: 200, title: 'Industries - InforSphere', metaDescription: 'Serving healthcare, financial services, manufacturing, and government.', h1: 'Industries We Serve', canonicalUrl: 'https://inforsphere.com/industries', wordCount: 1900, isIndexable: true, internalLinks: 12, externalLinks: 2, seoScore: 68, aiScore: 60 },
      { url: 'https://inforsphere.com/resources', statusCode: 200, title: 'Resources - InforSphere', metaDescription: 'Whitepapers, case studies, and webinars on data governance and enterprise AI.', h1: 'Resources', canonicalUrl: 'https://inforsphere.com/resources', wordCount: 580, isIndexable: true, internalLinks: 32, externalLinks: 6, seoScore: 62, aiScore: 52 },
      { url: 'https://inforsphere.com/about', statusCode: 200, title: 'About InforSphere', metaDescription: 'Founded in 2015, InforSphere serves 200+ enterprise clients across 4 continents.', h1: 'About InforSphere', canonicalUrl: 'https://inforsphere.com/about', wordCount: 1100, isIndexable: true, internalLinks: 8, externalLinks: 7, seoScore: 74, aiScore: 70 },
      { url: 'https://inforsphere.com/contact', statusCode: 200, title: 'Contact - InforSphere', metaDescription: 'Schedule a demo or talk to our enterprise sales team.', h1: 'Contact Us', canonicalUrl: 'https://inforsphere.com/contact', wordCount: 320, isIndexable: true, internalLinks: 5, externalLinks: 1, seoScore: 55, aiScore: 48 },
    ],
    issues: [
      { module: 'schema', type: 'partial-organisation-schema', severity: 'warning', message: 'Organisation schema present but missing foundingDate, numberOfEmployees, and sameAs links', recommendation: 'Complete Organisation schema with all verifiable attributes and sameAs to LinkedIn, Crunchbase' },
      { module: 'ai', type: 'entity-disambiguation-weak', severity: 'warning', message: '"InforSphere" may conflict with IBM InfoSphere — disambiguation signals are insufficient', recommendation: 'Add explicit disambiguation signal and ensure sameAs links clearly identify this entity' },
      { module: 'seo', type: 'thin-content', severity: 'info', message: 'Resources page is mostly a link list with minimal contextual text', recommendation: 'Add brief descriptions for each resource to improve chunk extractability' },
      { module: 'ai', type: 'poor-conversational-readiness', severity: 'warning', message: 'Solutions page uses enterprise jargon without direct answers to common questions', recommendation: 'Add a "What is [solution]?" section at the top of each solution page' },
      { module: 'citation', type: 'missing-case-study-schema', severity: 'warning', message: 'Case studies exist but lack Article schema with specific results and metrics', recommendation: 'Add Article schema and ensure quantified results are in plain text' },
      { module: 'links', type: 'hub-spoke-imbalance', severity: 'info', message: 'Homepage receives 85% of internal link equity — interior pages starved', recommendation: 'Add cross-links between solution pages and industry pages' },
      { module: 'performance', type: 'slow-ttfb', severity: 'warning', message: 'Platform page TTFB is 580ms — likely server-side rendering delay', recommendation: 'Implement caching layer or static generation for marketing pages' },
      { module: 'ai', type: 'low-factual-density', severity: 'warning', message: 'Industries page makes broad claims without specific numbers or verifiable facts', recommendation: 'Add client counts per industry, deployment metrics, and named case studies' },
    ],
    scores: {
      overall: 64, seoScore: 68, aiScore: 60, schemaScore: 48, linkGraphScore: 65, performanceScore: 62,
      breakdown: {
        seo: { titleOptimisation: 75, metaOptimisation: 68, headingStructure: 72, canonicalisation: 88, crawlability: 70, imageOptimisation: 55 },
        ai: { entityClarity: 55, conversationalReadiness: 58, aiExtractability: 62, knowledgeGraphStructure: 52 },
        machineReadability: { renderingFidelity: 72, boilerplateRatio: 68, chunkBoundaryQuality: 65, signalToNoiseRatio: 62, headingHierarchy: 75, readingOrderConsistency: 78, linkAnchorQuality: 60 },
        entityIntelligence: { entityConfidenceScore: 52, entityConsistencyScore: 58, entityCoverageScore: 55, disambiguationScore: 42 },
        citationAnalysis: { citationProbabilityScore: 42 },
        semanticTrust: { score: 58, breakdown: { authorshipTrust: 52, organisationalTrust: 62, contentTrust: 58, structuralTrust: 55 } },
        performance: { lcp: 2400, cls: 0.06, ttfb: 580 },
      },
    },
    aiVisibility: { aiVisibilityScore: 55, entityConfidenceScore: 52, citationProbabilityScore: 42, machineReadabilityScore: 68, semanticTrustScore: 58, retrievalReadinessScore: 58, recommendationConfidence: 38, providerScores: {}, breakdown: {} },
  },
];

export async function POST(req: NextRequest): Promise<NextResponse> {
  const seedKey = process.env['SEED_DEMO_KEY'];
  const authHeader = req.headers.get('x-seed-key');
  if (!seedKey || authHeader !== seedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await import('@sitenexis/db');
    const results: string[] = [];

    for (const site of demos) {
      const existing = await db.audit.findFirst({ where: { domain: site.domain, isDemo: true } });
      if (existing) {
        await db.page.deleteMany({ where: { auditId: existing.id } });
        await db.issue.deleteMany({ where: { auditId: existing.id } });
        await db.auditScore.deleteMany({ where: { auditId: existing.id } });
        await db.aIVisibilityScore.deleteMany({ where: { auditId: existing.id } });
        await db.audit.delete({ where: { id: existing.id } });
      }

      const audit = await db.audit.create({
        data: {
          userId: DEMO_USER_ID,
          domain: site.domain,
          status: 'complete',
          isDemo: true,
          startedAt: new Date(Date.now() - 120_000),
          completedAt: new Date(),
          pageCount: site.pages.length,
          crawlDurationMs: 8500 + Math.floor(Math.random() * 4000),
        },
      });

      for (const page of site.pages) {
        await db.page.create({ data: { auditId: audit.id, crawledAt: new Date(), ...page } });
      }

      for (const issue of site.issues) {
        await db.issue.create({ data: { auditId: audit.id, ...issue, severity: issue.severity as 'critical' | 'warning' | 'info' } });
      }

      await db.auditScore.create({ data: { auditId: audit.id, ...site.scores } });
      await db.aIVisibilityScore.create({ data: { auditId: audit.id, ...site.aiVisibility } });

      results.push(`${site.domain}: ${site.pages.length} pages, ${site.issues.length} issues`);
    }

    return NextResponse.json({ success: true, seeded: results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
