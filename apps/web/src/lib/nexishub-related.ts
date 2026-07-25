export type NexisHubRelatedGuide = {
  title: string
  description: string
  href: `https://nexishub.vercel.app/blog/${string}`
  anchor: string
}

export const NEXISHUB_RELATED_GUIDES: Readonly<Record<string, NexisHubRelatedGuide>> = {
  'link-graph-hub-pages': {
    title: 'The Complete Guide to AI Visibility and Machine Discovery (2026)',
    description: 'Connect hub architecture to the full crawl, understanding, retrieval, trust, and measurement pipeline.',
    href: 'https://nexishub.vercel.app/blog/complete-guide-ai-visibility',
    anchor: 'complete guide to AI visibility and machine discovery',
  },
  'what-is-geo-generative-engine-optimisation-guide': {
    title: 'AI Visibility vs Traditional SEO: What Changes and What Stays the Same',
    description: 'A practical comparison of ranked search documents and generated answers assembled from retrieved evidence.',
    href: 'https://nexishub.vercel.app/blog/ai-visibility-vs-traditional-seo',
    anchor: 'how AI visibility differs from traditional SEO',
  },
  'link-graph-internal-topology': {
    title: 'How to Design a Website Architecture That AI Systems Can Understand',
    description: 'Turn link-topology findings into a durable hub, route, navigation, and canonical architecture.',
    href: 'https://nexishub.vercel.app/blog/ai-readable-website-architecture',
    anchor: 'designing an AI-readable website architecture',
  },
  'link-graph-anchor-text-entity-signal': {
    title: 'Internal Linking for AI Discovery: A Practical Architecture Guide',
    description: 'Apply descriptive anchors, contextual links, hubs, and reciprocal relationships across a real content cluster.',
    href: 'https://nexishub.vercel.app/blog/internal-linking-ai-discovery',
    anchor: 'practical internal linking for AI discovery',
  },
  'schema-markup-ai-trust-signals-2025': {
    title: 'Structured Data for AI Products: Schema, Entities, and Machine Trust',
    description: 'Implement schema as an accurate description of visible content without treating markup as a ranking guarantee.',
    href: 'https://nexishub.vercel.app/blog/structured-data-ai-machine-trust',
    anchor: 'structured data, entities, and machine trust',
  },
  'entity-optimization-the-signal-ai-systems-weight-most': {
    title: 'Entity Clarity: How to Help AI Systems Understand Your Brand',
    description: 'Create a consistent, evidence-backed identity across canonical pages, product relationships, and external profiles.',
    href: 'https://nexishub.vercel.app/blog/entity-clarity-ai-systems',
    anchor: 'helping AI systems understand a brand entity',
  },
  'aive-chunk-engineering': {
    title: 'How to Structure Content for AI Retrieval and Semantic Chunking',
    description: 'Design self-contained sections that preserve context, evidence, and meaning after extraction.',
    href: 'https://nexishub.vercel.app/blog/content-structure-ai-retrieval',
    anchor: 'structuring content for semantic retrieval',
  },
  'pvf-citation-readiness-vs-retrieval': {
    title: 'How to Create Content AI Systems Can Cite With Confidence',
    description: 'Move from retrievability to defensible claims through provenance, authorship, freshness, and explicit limits.',
    href: 'https://nexishub.vercel.app/blog/create-citation-ready-content',
    anchor: 'creating content AI systems can cite responsibly',
  },
  'dom-robots-txt-audit': {
    title: 'The Technical AI Crawlability Checklist for Modern Websites',
    description: 'Audit responses, robots controls, rendering, canonicals, sitemaps, navigation, and content access in sequence.',
    href: 'https://nexishub.vercel.app/blog/technical-ai-crawlability-checklist',
    anchor: 'technical AI crawlability checklist',
  },
  'rag-seo-retrieval-augmented-generation-content-strategy': {
    title: 'RAG, Search, and the New Content Discovery Pipeline',
    description: 'Follow content from discovery and parsing through retrieval, reranking, context assembly, generation, and citation.',
    href: 'https://nexishub.vercel.app/blog/rag-search-content-discovery',
    anchor: 'the full RAG content discovery pipeline',
  },
  'how-chatgpt-perplexity-claude-choose-citations': {
    title: 'How ChatGPT, Claude, Gemini, and Perplexity Discover Sources',
    description: 'Compare observable discovery behavior without presenting inferred proprietary mechanisms as verified facts.',
    href: 'https://nexishub.vercel.app/blog/how-ai-platforms-discover-sources',
    anchor: 'how major AI platforms discover sources',
  },
  'how-to-increase-citation-probability-ai-search': {
    title: 'How to Measure AI Visibility Without Relying on Vanity Metrics',
    description: 'Separate technical readiness, observed citations, representation quality, estimates, and business outcomes.',
    href: 'https://nexishub.vercel.app/blog/measure-ai-visibility',
    anchor: 'measuring AI visibility without vanity metrics',
  },
  'why-ai-systems-ignore-70-percent-of-your-content': {
    title: 'Why Good Content Becomes Invisible to AI Systems',
    description: 'Diagnose access, extraction, relevance, evidence, and maintenance failures before rewriting a page.',
    href: 'https://nexishub.vercel.app/blog/why-content-becomes-ai-invisible',
    anchor: 'diagnosing why useful content becomes AI-invisible',
  },
  'aive-retrieval-readiness-checklist': {
    title: 'A Practical GEO Strategy for Technical and Content Teams',
    description: 'Coordinate engineering, content, analytics, subject expertise, and governance around one operating loop.',
    href: 'https://nexishub.vercel.app/blog/practical-geo-strategy',
    anchor: 'a cross-functional GEO operating strategy',
  },
  'dom-heading-hierarchy-extraction': {
    title: 'The 90-Day AI Visibility Roadmap for Growing Websites',
    description: 'Sequence baseline measurement, technical repair, content improvement, entity alignment, and review across twelve weeks.',
    href: 'https://nexishub.vercel.app/blog/90-day-ai-visibility-roadmap',
    anchor: 'a 90-day AI visibility roadmap',
  },
}

export function getNexisHubRelatedGuide(slug: string): NexisHubRelatedGuide | null {
  return NEXISHUB_RELATED_GUIDES[slug] ?? null
}
