import type { IssueContext, GeneratedFix } from './types.js';

type TemplateFn = (ctx: IssueContext) => GeneratedFix;

const TEMPLATES: Partial<Record<string, TemplateFn>> = {

  // ─── SEO: Title ─────────────────────────────────────────────────────────────

  missing_title: () => ({
    problem: 'This page has no <title> tag. AI systems and search engines rely on the title as the primary signal for page topic identity.',
    solution: 'Add a descriptive <title> tag that includes the primary entity or topic keyword for this page within 50–60 characters.',
    fixCode: `<!-- In <head> -->
<title>Your Page Topic — Site Name</title>`,
    fixLanguage: 'html',
    expectedImpact: 'high',
    effort: 'low',
    source: 'template',
  }),

  duplicate_title: (ctx) => ({
    problem: `Multiple pages share the same title tag. This creates entity disambiguation failure — AI systems cannot distinguish between these pages.`,
    solution: 'Make each title unique by incorporating the specific entity, product, service, or topic that differentiates this page.',
    fixCode: `<!-- In <head> — make every title unique per page -->
<title>${ctx.pageUrl ? extractSlug(ctx.pageUrl) + ' — Site Name' : 'Specific Page Topic — Site Name'}</title>`,
    fixLanguage: 'html',
    expectedImpact: 'high',
    effort: 'low',
    source: 'template',
  }),

  title_too_long: () => ({
    problem: 'The title tag exceeds 60 characters and will be truncated in search results. AI systems that extract titles may also clip the primary entity signal.',
    solution: 'Trim the title to 50–60 characters, keeping the primary entity or topic keyword at the front.',
    fixCode: `<!-- Keep under 60 characters — primary entity first -->
<title>Primary Topic Keyword — Brand (max 60 chars)</title>`,
    fixLanguage: 'html',
    expectedImpact: 'medium',
    effort: 'low',
    source: 'template',
  }),

  title_too_short: () => ({
    problem: 'The title tag is too short to convey meaningful topic or entity context. AI systems use the title as a primary disambiguation signal.',
    solution: 'Expand the title to 40–60 characters with explicit mention of the primary entity and topic.',
    fixCode: `<!-- Aim for 40–60 characters with clear entity context -->
<title>Full Descriptive Topic Name — Brand Name</title>`,
    fixLanguage: 'html',
    expectedImpact: 'medium',
    effort: 'low',
    source: 'template',
  }),

  // ─── SEO: Meta description ───────────────────────────────────────────────────

  missing_meta_description: () => ({
    problem: 'No meta description found. AI systems use the meta description as a secondary entity summary when the page body is ambiguous.',
    solution: 'Add a meta description of 140–160 characters that directly summarises the primary entity or service on this page.',
    fixCode: `<!-- In <head> -->
<meta name="description" content="A direct 140–160 character summary of what this page is about, including the primary entity and a clear value statement." />`,
    fixLanguage: 'html',
    expectedImpact: 'medium',
    effort: 'low',
    source: 'template',
  }),

  meta_description_too_long: () => ({
    problem: 'Meta description exceeds 160 characters and is truncated in AI and search summaries, cutting off key entity context.',
    solution: 'Shorten the meta description to 140–160 characters, front-loading the most important entity and value signal.',
    fixCode: `<!-- 140–160 characters; entity + value statement first -->
<meta name="description" content="Concise page summary under 160 characters — entity name and primary benefit." />`,
    fixLanguage: 'html',
    expectedImpact: 'low',
    effort: 'low',
    source: 'template',
  }),

  // ─── SEO: Headings ──────────────────────────────────────────────────────────

  missing_h1: () => ({
    problem: 'No H1 heading found on this page. AI systems use H1 as the primary topic signal for chunk-level context and entity association.',
    solution: 'Add exactly one H1 that matches the page\'s primary entity or topic. It should align with the title tag but can be slightly longer.',
    fixCode: `<!-- One H1 per page, matching the primary topic/entity -->
<h1>Your Primary Page Topic or Entity Name</h1>`,
    fixLanguage: 'html',
    expectedImpact: 'high',
    effort: 'low',
    source: 'template',
  }),

  multiple_h1: () => ({
    problem: 'Multiple H1 tags found. This creates ambiguity for AI systems — only one entity/topic can be the primary signal per page.',
    solution: 'Keep exactly one H1 for the primary topic. Demote all secondary headings to H2 or H3.',
    fixCode: `<!-- Only one H1, demote the rest -->
<h1>Primary Topic</h1>
<!-- These were H1s — change to H2 -->
<h2>Secondary Topic</h2>
<h2>Another Secondary Topic</h2>`,
    fixLanguage: 'html',
    expectedImpact: 'medium',
    effort: 'low',
    source: 'template',
  }),

  // ─── SEO: Canonical ─────────────────────────────────────────────────────────

  missing_canonical: () => ({
    problem: 'No canonical tag found. Without a canonical, AI systems may index duplicate content signals across URL variants, splitting entity authority.',
    solution: 'Add a self-referencing canonical tag to every page to consolidate entity authority to a single URL.',
    fixCode: `<!-- In <head> — replace with the page's primary URL -->
<link rel="canonical" href="https://example.com/this-page/" />`,
    fixLanguage: 'html',
    expectedImpact: 'medium',
    effort: 'low',
    source: 'template',
  }),

  broken_canonical: () => ({
    problem: 'The canonical tag points to a URL that returns a non-200 status. This creates a broken authority signal that AI systems will ignore or penalise.',
    solution: 'Update the canonical href to the correct live URL, or remove it and add a self-referencing canonical.',
    fixCode: `<!-- Replace with the correct live canonical URL -->
<link rel="canonical" href="https://example.com/correct-url/" />`,
    fixLanguage: 'html',
    expectedImpact: 'medium',
    effort: 'low',
    source: 'template',
  }),

  // ─── SEO: Images ────────────────────────────────────────────────────────────

  missing_alt_text: () => ({
    problem: 'Images are missing alt text. AI systems that process images use alt text as the semantic label — without it, image context is invisible to retrieval pipelines.',
    solution: 'Add descriptive alt text to every meaningful image. Describe what the image shows and its relevance to the surrounding content.',
    fixCode: `<!-- Describe the image content and its context -->
<img src="/path/to/image.jpg" alt="Descriptive label of what this image shows and why it matters" />

<!-- For decorative images, use empty alt to signal decorative intent -->
<img src="/decorative.png" alt="" role="presentation" />`,
    fixLanguage: 'html',
    expectedImpact: 'medium',
    effort: 'medium',
    source: 'template',
  }),

  // ─── SEO: Infrastructure ────────────────────────────────────────────────────

  missing_robots_txt: () => ({
    problem: 'No robots.txt found. AI crawlers that use robots.txt allowlists (GPTBot, ClaudeBot, Perplexity) cannot confirm permission to crawl this site.',
    solution: 'Create a robots.txt at the root of the domain that explicitly allows major AI crawlers.',
    fixCode: `# robots.txt — allow all AI crawlers
User-agent: *
Allow: /
Disallow: /dashboard/
Disallow: /api/
Disallow: /admin/

# AI training and retrieval crawlers
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

Sitemap: https://example.com/sitemap.xml`,
    fixLanguage: 'text',
    expectedImpact: 'high',
    effort: 'low',
    source: 'template',
  }),

  missing_sitemap: () => ({
    problem: 'No XML sitemap found. Sitemaps are the primary mechanism AI crawlers use to discover and index all pages on a domain.',
    solution: 'Generate and submit an XML sitemap. In Next.js App Router, create app/sitemap.ts.',
    fixCode: `// app/sitemap.ts — Next.js App Router
import { type MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://example.com';
  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: \`\${base}/about\`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // Add all important pages here
  ];
}`,
    fixLanguage: 'typescript',
    expectedImpact: 'high',
    effort: 'low',
    source: 'template',
  }),

  noindex_page: () => ({
    problem: 'This page has a noindex directive. If this is unintentional, AI crawlers and search engines will not index this page.',
    solution: 'Remove the noindex tag or meta robots directive unless this page is intentionally excluded from AI retrieval.',
    fixCode: `<!-- Remove this line if the page should be indexed -->
<!-- <meta name="robots" content="noindex" /> -->

<!-- Replace with: -->
<meta name="robots" content="index, follow" />

<!-- Or in Next.js metadata: -->
export const metadata = {
  robots: { index: true, follow: true },
};`,
    fixLanguage: 'html',
    expectedImpact: 'high',
    effort: 'low',
    source: 'template',
  }),

  // ─── Schema issues ───────────────────────────────────────────────────────────

  missing_organization_schema: () => ({
    problem: 'No Organization schema found. This is the primary entity identity signal for AI systems — without it, the brand entity cannot be reliably disambiguated.',
    solution: 'Add an Organization schema block to the root layout. Include sameAs links to all brand profiles for cross-source validation.',
    fixCode: `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://example.com/#organization",
  "name": "Your Organisation Name",
  "legalName": "Your Legal Entity Name",
  "url": "https://example.com",
  "logo": {
    "@type": "ImageObject",
    "url": "https://example.com/logo.png",
    "width": 512,
    "height": 512
  },
  "description": "Clear one-sentence description of what your organisation does.",
  "foundingDate": "2024",
  "email": "contact@example.com",
  "sameAs": [
    "https://x.com/yourhandle",
    "https://www.linkedin.com/company/yourcompany",
    "https://github.com/yourhandle"
  ]
}`,
    fixLanguage: 'json-ld',
    expectedImpact: 'high',
    effort: 'medium',
    source: 'template',
  }),

  missing_faqpage_schema: () => ({
    problem: 'No FAQPage schema found. FAQPage schema is the primary driver for Google AI Overviews inclusion and ChatGPT direct-answer retrieval for informational queries.',
    solution: 'Add FAQPage schema with 3–5 common questions about your primary entity or service. Questions should match real user queries.',
    fixCode: `{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is [Your Service/Product]?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Direct, factual answer in 2–3 sentences. Define the primary entity clearly."
      }
    },
    {
      "@type": "Question",
      "name": "How does [Your Service] work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Step-by-step explanation or direct description of the core process."
      }
    },
    {
      "@type": "Question",
      "name": "Who is [Your Service] for?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Clear description of the target audience and primary use cases."
      }
    }
  ]
}`,
    fixLanguage: 'json-ld',
    expectedImpact: 'high',
    effort: 'medium',
    source: 'template',
  }),

  missing_breadcrumb_schema: () => ({
    problem: 'No BreadcrumbList schema found. Breadcrumb schema signals page hierarchy to AI systems, improving contextual placement in knowledge graphs.',
    solution: 'Add BreadcrumbList schema to interior pages to communicate their position in the site hierarchy.',
    fixCode: `{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://example.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Category",
      "item": "https://example.com/category"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Current Page",
      "item": "https://example.com/category/current-page"
    }
  ]
}`,
    fixLanguage: 'json-ld',
    expectedImpact: 'low',
    effort: 'low',
    source: 'template',
  }),

  missing_article_schema: () => ({
    problem: 'Blog/article pages missing Article schema. Article schema enables AI systems to identify the author, publication date, and topic — critical for citation probability.',
    solution: 'Add Article or BlogPosting schema to all content pages with author, datePublished, and dateModified fields.',
    fixCode: `{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "Your Article Title",
  "description": "A 2–3 sentence summary of the article's key claim.",
  "datePublished": "2025-06-01T00:00:00Z",
  "dateModified": "2025-06-10T00:00:00Z",
  "author": {
    "@type": "Person",
    "name": "Author Name",
    "url": "https://example.com/about"
  },
  "publisher": {
    "@id": "https://example.com/#organization"
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://example.com/blog/article-slug"
  }
}`,
    fixLanguage: 'json-ld',
    expectedImpact: 'medium',
    effort: 'medium',
    source: 'template',
  }),

  // ─── Low word count ──────────────────────────────────────────────────────────

  low_word_count: () => ({
    problem: 'This page has insufficient content for reliable AI chunk extraction. Pages with fewer than 300 words rarely form a complete semantic unit in retrieval pipelines.',
    solution: 'Expand content to at least 400–600 words of substantive, on-topic text. Each chunk should be a self-contained semantic unit.',
    fixCode: `<!-- Content structure for AI-retrievable pages -->

<!-- 1. H1 establishes primary entity/topic -->
<h1>Primary Topic</h1>

<!-- 2. First paragraph = direct answer / entity definition (100–150 words) -->
<p>This page is about [entity]. [Define it clearly in the first paragraph.]</p>

<!-- 3. H2 sections = distinct subtopics (each 150–200 words) -->
<h2>How [Entity] Works</h2>
<p>[Substantive explanation...]</p>

<h2>Key Benefits of [Entity]</h2>
<p>[Specific, factual claims with detail...]</p>

<!-- 4. FAQ section = direct-answer retrieval targets -->
<h2>Frequently Asked Questions</h2>
<dl>
  <dt>What is [entity]?</dt>
  <dd>[Direct answer]</dd>
</dl>`,
    fixLanguage: 'html',
    expectedImpact: 'medium',
    effort: 'medium',
    source: 'template',
  }),
};

function extractSlug(url: string): string {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    const slug = parts[parts.length - 1] ?? '';
    return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return 'This Page';
  }
}

export function getTemplateFixForIssue(ctx: IssueContext): GeneratedFix | null {
  const templateFn = TEMPLATES[ctx.type];
  if (!templateFn) return null;
  return templateFn(ctx);
}
