/**
 * Educational content shown while an audit runs. Each card is a short,
 * factually-grounded explanation — no unsupported claims about how any named
 * AI system (ChatGPT, Gemini, Claude, Perplexity, Google) internally ranks or
 * cites content. Content is data, kept separate from the carousel/card
 * presentation components so it can be edited without touching rendering.
 */

export interface EducationCard {
  id: string;
  title: string;
  body: string;
  category: string;
  learnMoreHref?: string;
}

export const EDUCATION_CARDS: EducationCard[] = [
  {
    id: 'ai-visibility',
    title: 'What is AI Visibility?',
    category: 'AI Visibility',
    body: 'AI Visibility measures how likely an AI system is to retrieve, understand, and reference your content when answering a relevant query. It combines machine readability, entity clarity, retrieval readiness, citation signals, and semantic trust into one composite score — a different discipline from traditional search ranking.',
  },
  {
    id: 'citation-probability',
    title: 'Citation Probability',
    category: 'Citation Probability',
    body: 'Citation probability estimates how likely an AI system is to select your content as a source when generating an answer. It weighs factual density, claim specificity, entity authority, topical depth, structural readiness, freshness, and trust signal density — not backlink count.',
  },
  {
    id: 'machine-trust',
    title: 'What Machine Trust Measures',
    category: 'Machine Trust',
    body: 'Machine Trust models the confidence an AI system would place in your content across repeated interactions over time. It looks at entity consistency across pages and schema, external validation signals, absence of contradictions, and whether trust signals are decaying rather than strengthening.',
  },
  {
    id: 'information-gain',
    title: 'What Is Information Gain?',
    category: 'Information Gain',
    body: 'Information Gain measures how much unique, non-redundant value your content adds relative to what already exists elsewhere on the topic. Pages that only restate widely-available facts score lower than pages contributing original data, analysis, or a genuinely distinct angle.',
  },
  {
    id: 'semantic-clarity',
    title: 'Semantic Clarity',
    category: 'Semantic Clarity',
    body: 'Semantic clarity is how unambiguously a page communicates its subject, claims, and relationships. Clear heading structure, explicit entity naming (rather than pronouns and vague references), and direct sentence construction all help an AI system parse meaning without guesswork.',
  },
  {
    id: 'entity-optimisation',
    title: 'Entity Optimisation',
    category: 'Entity Optimisation',
    body: 'An entity is a named, real-world thing — a person, organisation, product, or place — that an AI system can identify as a distinct concept. Entity optimisation means naming your primary entity explicitly and consistently, rather than relying on implied context a reader (or model) has to infer.',
  },
  {
    id: 'structured-data',
    title: 'Why Structured Data Matters',
    category: 'Structured Data',
    body: 'Structured data (schema.org markup) gives machines an explicit, typed description of your content instead of asking them to infer it from prose. Accurate schema reduces ambiguity, but schema that overstates what the page actually contains can undermine trust once cross-checked.',
  },
  {
    id: 'canonical-urls',
    title: 'Canonical URLs',
    category: 'Canonical URLs',
    body: 'A canonical URL tells crawlers and AI retrieval systems which version of a page is authoritative when duplicates or near-duplicates exist. Missing, conflicting, or self-contradicting canonical signals can split authority across multiple URLs instead of consolidating it on one.',
  },
  {
    id: 'internal-linking',
    title: 'Internal Linking',
    category: 'Internal Linking',
    body: 'Internal links help both crawlers and AI systems understand which pages on your site are most central to a topic, and how concepts relate to one another. Descriptive anchor text carries more signal than generic phrases like "click here" or "read more".',
  },
  {
    id: 'ai-retrievability',
    title: 'AI Retrievability',
    category: 'AI Retrievability',
    body: 'Retrievability is whether your content can be cleanly extracted and chunked by an AI system in the first place — before relevance or trust are even considered. Content buried in JavaScript-only rendering, thin boilerplate, or inconsistent chunk boundaries can be invisible before it is ever evaluated.',
  },
  {
    id: 'ai-answer-readiness',
    title: 'AI Answer Readiness',
    category: 'AI Answer Readiness',
    body: 'Answer readiness is how directly your content resolves a specific question without requiring the reader (or model) to synthesise the answer from scattered fragments. FAQ sections, direct definitional sentences, and clear conclusions all raise answer readiness.',
  },
  {
    id: 'ai-recommendation-readiness',
    title: 'AI Recommendation Readiness',
    category: 'AI Recommendation Readiness',
    body: 'Recommendation readiness goes beyond answering a direct question — it is whether an AI system has enough signal to proactively suggest your site or product when a user has not named it explicitly. This depends heavily on topical depth and consistent entity identity.',
  },
  {
    id: 'knowledge-graphs',
    title: 'Knowledge Graphs',
    category: 'Knowledge Graphs',
    body: 'A knowledge graph represents entities as nodes and their relationships as typed edges — "is a", "part of", "located in", and similar. Sites with clear, interconnected entity relationships give AI systems a coherent structure to reason over, rather than isolated, disconnected facts.',
  },
  {
    id: 'rag',
    title: 'What Is RAG?',
    category: 'RAG',
    body: 'Retrieval-Augmented Generation (RAG) is the pattern where an AI system retrieves relevant chunks of external content and includes them in its context before generating a response, rather than relying purely on what it learned during training. Your content\'s chunk quality directly affects how well it survives this retrieval step.',
  },
  {
    id: 'citation-networks',
    title: 'Citation Networks',
    category: 'Citation Networks',
    body: 'A citation network is the web of sources that reference and corroborate one another on a topic. Content that is independently referenced by multiple unrelated, credible sources reads as more trustworthy than a small cluster of pages that only cite each other.',
  },
  {
    id: 'ai-trust-signals',
    title: 'AI Trust Signals',
    category: 'AI Trust Signals',
    body: 'Trust signals are structural indicators — consistent authorship, organisational schema, verifiable external references, and internally coherent claims — that an AI system can use as a proxy for content reliability, since it cannot independently fact-check every statement in real time.',
  },
  {
    id: 'content-citability',
    title: 'Content Citability',
    category: 'Content Citability',
    body: 'Citable content states specific, verifiable claims rather than vague generalities. "Response times improved by 34% after the change" is citable; "response times got a lot better" is not, because there is nothing concrete for an AI system to quote or attribute.',
  },
  {
    id: 'entity-consistency',
    title: 'Entity Consistency',
    category: 'Entity Consistency',
    body: 'Entity consistency means your organisation, product, or personal brand is described the same way across every page, in the schema markup, and in the visible body text. Conflicting names, founding dates, or descriptions across pages actively erode an AI system\'s confidence in which facts are correct.',
  },
  {
    id: 'topical-authority',
    title: 'Topical Authority',
    category: 'Topical Authority',
    body: 'Topical authority is the depth and interconnection of your coverage on a subject, not just the presence of a single well-written page. A site with ten shallow pages on a topic typically demonstrates less authority than one with three deeply interlinked, comprehensive pages.',
  },
  {
    id: 'temporal-authority',
    title: 'Temporal Authority',
    category: 'Temporal Authority',
    body: 'Temporal authority accounts for time as an active signal — content that is regularly updated and confirmed current tends to be weighted more heavily than content that has gone stale, especially for time-sensitive facts like statistics, prices, or version numbers.',
  },
  {
    id: 'schema-markup',
    title: 'Schema Markup Basics',
    category: 'Schema',
    body: 'Schema is a shared vocabulary (schema.org) for describing entities and content types in a machine-readable format embedded in your HTML. The schema type should match what the page actually contains — a Product schema on a page with no purchasable product creates a mismatch AI systems can detect.',
  },
  {
    id: 'duplicate-content',
    title: 'Duplicate Content',
    category: 'Duplicate Content',
    body: 'Duplicate or near-duplicate content across multiple URLs forces crawlers and AI systems to choose which version to trust, diluting the authority any single version could have accumulated. Consolidating near-duplicates or using canonical tags helps concentrate that signal.',
  },
  {
    id: 'ai-readability',
    title: 'AI Readability',
    category: 'AI Readability',
    body: 'AI readability is distinct from human readability — it is about whether content survives HTML parsing, boilerplate stripping, and chunking with its meaning intact. A page that reads beautifully to a person can still lose critical context if key facts are split across chunk boundaries.',
  },
  {
    id: 'crawler-accessibility',
    title: 'Crawler Accessibility',
    category: 'Crawler Accessibility',
    body: 'A page must first be technically reachable — not blocked by robots.txt, not returning error codes, and not gated behind client-side rendering that never completes for a non-browser client — before any content quality can even be assessed.',
  },
  {
    id: 'robots-txt',
    title: 'Robots.txt',
    category: 'Robots.txt',
    body: 'robots.txt tells automated clients, including AI crawlers, which parts of your site they may access. An overly broad disallow rule can unintentionally block legitimate AI crawlers from ever seeing content you want discovered — it is worth auditing which agents are actually named.',
  },
  {
    id: 'sitemaps',
    title: 'Sitemaps',
    category: 'Sitemaps',
    body: 'An XML sitemap gives crawlers a direct, explicit list of your URLs rather than relying solely on discovering pages through links. A missing or stale sitemap does not block indexing outright, but it does make discovery slower and less complete, especially on large sites.',
  },
  {
    id: 'eeat',
    title: 'What Is E-E-A-T?',
    category: 'E-E-A-T',
    body: 'E-E-A-T stands for Experience, Expertise, Authoritativeness, and Trustworthiness — a framework for evaluating content quality that originated in search quality guidelines and has since become a useful lens for AI-native trust signals too, particularly authorship clarity and verifiable credentials.',
  },
  {
    id: 'recommendation-surfaces',
    title: 'Recommendation Surfaces',
    category: 'Recommendation Surfaces',
    body: 'AI recommendations do not happen in one place — search-integrated AI overviews, chat assistants, voice assistants, and autonomous agents each have distinct structural requirements. A site can be strong on one surface and effectively invisible on another.',
  },
  {
    id: 'machine-readable-content',
    title: 'Machine-Readable Content',
    category: 'Machine-readable Content',
    body: 'Machine-readable content is structured so its meaning does not depend on visual layout alone — proper heading hierarchy, semantic HTML, and explicit labelling let an AI system reconstruct the content\'s logical structure even without rendering it visually.',
  },
  {
    id: 'ai-governance',
    title: 'AI Governance',
    category: 'AI Governance',
    body: 'AI governance signals — like clear policies on AI-generated content, transparent sourcing, and machine-accessible disclosure — are an emerging trust dimension as AI systems increasingly need to distinguish genuine human-authored analysis from purely synthetic content.',
  },
  {
    id: 'what-makes-sitenexis-different',
    title: 'What Makes SiteNexis Different?',
    category: 'SiteNexis',
    body: 'SiteNexis does not optimise for search engine rankings. It models how AI retrieval systems extract, interpret, trust, and recommend your content — a distinct discipline focused on machine perception rather than human-facing search results pages.',
  },
  {
    id: 'seo-vs-ai-visibility',
    title: 'SEO vs. AI Visibility',
    category: 'SiteNexis',
    body: 'Traditional SEO optimises for how search engines rank whole pages against a query. AI Visibility optimises for how AI systems extract, chunk, and cite specific pieces of your content — a page can rank well in search while still being poorly structured for AI retrieval.',
  },
  {
    id: 'how-sitenexis-evaluates',
    title: 'How SiteNexis Evaluates Websites',
    category: 'SiteNexis',
    body: 'SiteNexis crawls your site, then runs it through layered analysis: technical SEO and schema, entity and citation intelligence, and finally machine trust and retrieval simulation — each layer building on real signals from the one before it, not a single black-box score.',
  },
  {
    id: 'what-machine-trust-measures-sitenexis',
    title: 'What Machine Trust Measures (SiteNexis)',
    category: 'SiteNexis',
    body: 'SiteNexis\'s Machine Trust score combines entity credibility consistency, schema-to-content alignment, depth of external validation, absence of contradictions, and resistance to trust degradation over time — all measured from real crawl data, not estimated from reputation alone.',
  },
  {
    id: 'how-citation-intelligence-works',
    title: 'How Citation Intelligence Works',
    category: 'SiteNexis',
    body: 'Citation Intelligence estimates the likelihood an AI system would select your content as a citation source, using measurable factors — factual density, claim specificity, entity authority, topical depth, structural readiness, freshness, and trust signal density — each individually explainable.',
  },
  {
    id: 'what-scout-does',
    title: 'What Scout Does',
    category: 'SiteNexis',
    body: 'Scout classifies the search intent behind each page on your site — informational, commercial, navigational, and more — so you can see whether your content coverage is balanced across the query types AI systems actually route toward you.',
  },
  {
    id: 'what-information-gain-means-sitenexis',
    title: 'What Information Gain Means Here',
    category: 'SiteNexis',
    body: 'SiteNexis flags pages that mostly restate information already widely available, versus pages contributing genuinely original data, analysis, or perspective — because AI systems have less reason to cite a page that adds nothing beyond what a dozen other sources already say.',
  },
  {
    id: 'why-contradictions-matter',
    title: 'Why Contradictions Matter',
    category: 'SiteNexis',
    body: 'When the same fact is stated differently across your own pages, schema, and metadata, an AI system has no reliable way to know which version is correct — so it may simply discount the entity\'s trustworthiness rather than guess. SiteNexis actively checks for these internal contradictions.',
  },
  {
    id: 'why-evidence-quality-matters',
    title: 'Why Evidence Quality Matters',
    category: 'SiteNexis',
    body: 'Every score SiteNexis produces is backed by a named, explainable piece of evidence — never a black-box number. If a recommendation cannot be traced to a specific, verifiable signal on your site, SiteNexis treats it as not yet ready to report.',
  },
  {
    id: 'why-not-treat-unavailable-as-zero',
    title: 'Why Unavailable Data Isn\'t Scored as Zero',
    category: 'SiteNexis',
    body: 'When a signal genuinely cannot be measured yet — a provider is unavailable, or not enough audit history exists — SiteNexis reports it as unavailable rather than silently scoring it zero, which would unfairly penalise you for a measurement gap rather than an actual weakness.',
  },
];
