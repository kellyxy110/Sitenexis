import { type Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'AI Visibility Knowledge Graph — SiteNexis Content Map',
  description:
    'Semantic map of SiteNexis content: five knowledge clusters covering AI discovery, citation, authority, volatility, and machine trust.',
  alternates: { canonical: '/content-map' },
  robots: { index: true, follow: true },
};

// ── Cluster definitions ───────────────────────────────────────────────────────

const CLUSTERS = [
  {
    id: 'discovery',
    label: 'AI Discovery & Retrieval',
    color: 'cyan',
    accent: '#00C8FF',
    description:
      'How AI systems find, crawl, and extract content. The gap between indexing and retrieval readiness.',
    connects: ['citation', 'meta'],
    posts: [
      { slug: 'indexing-speed-vs-ai-visibility',           title: 'Why Indexing Speed No Longer Guarantees AI Visibility' },
      { slug: 'publishing-to-ai-awareness-delay',           title: 'The Hidden Delay Between Publishing and AI Search Awareness' },
      { slug: 'indexed-but-not-cited-by-ai',                title: 'Why Some Pages Are Indexed in Minutes but Never Cited by AI' },
      { slug: 'how-ai-systems-discover-content-beyond-google', title: 'How AI Systems Actually Discover New Content' },
      { slug: 'retrieval-simulation-why-best-content-gets-skipped', title: 'Retrieval Simulation: Why Your Best Content Gets Skipped by AI' },
      { slug: 'why-ai-systems-ignore-70-percent-of-your-content', title: 'Why AI Systems Ignore 70% of Your Content' },
      { slug: 'crawlability-gap-technical-seo-ai-visibility', title: 'The Crawlability Gap: Why Traditional Technical SEO Misses 40% of AI Issues' },
      { slug: 'agentic-rag-what-it-means-for-content-discovery', title: 'Agentic RAG: What the Next Generation of AI Retrieval Means for Discovery' },
      { slug: 'llm-search-vs-agentic-crawl',                 title: 'The Difference Between LLM Search and Agentic Crawl' },
      { slug: 'how-autonomous-ai-agents-discover-websites',  title: 'How Autonomous AI Agents Discover and Vet Websites' },
    ],
  },
  {
    id: 'citation',
    label: 'AI Citation & Visibility',
    color: 'teal',
    accent: '#0BCEBC',
    description:
      'What determines whether AI systems select, use, and attribute your content in generated answers.',
    connects: ['authority', 'meta'],
    posts: [
      { slug: 'why-chatgpt-prefers-best-x-content',          title: 'Why ChatGPT Prefers "Best X" Content Over Traditional Blog Posts' },
      { slug: 'retrieved-vs-cited-by-ai',                     title: 'The Difference Between Being Retrieved and Being Cited by AI' },
      { slug: 'why-wikipedia-homepages-dominate-ai-citations', title: 'Why Wikipedia and Homepages Dominate AI Citations' },
      { slug: 'page-invisible-to-ai-despite-google-ranking',  title: 'What Makes a Page Invisible to AI Even If It Ranks on Google' },
      { slug: 'how-to-increase-citation-probability-ai-search', title: 'How to Increase Your Citation Probability in AI Search Results' },
      { slug: 'how-chatgpt-perplexity-claude-choose-citations', title: 'How ChatGPT, Perplexity, and Claude Choose What to Cite' },
      { slug: 'how-perplexity-decides-what-to-cite',          title: 'How Perplexity Decides What to Cite: A Signal-by-Signal Breakdown' },
      { slug: 'building-citation-authority-ai-systems',       title: 'Building Citation Authority for AI Systems: The Long Game' },
      { slug: 'recommendation-surface-coverage-brand-ai-visibility', title: 'Recommendation Surface Coverage: Where Is Your Brand Visible to AI?' },
      { slug: 'tool-calling-citations-ai-agents',             title: 'Tool Calling, Citations, and Source Trust: Inside How AI Agents Reference Websites' },
    ],
  },
  {
    id: 'authority',
    label: 'Authority & Trust Systems',
    color: 'purple',
    accent: '#A855F7',
    description:
      'How trust is formed, validated, and maintained in AI ecosystems. Entity authority, schema trust, and contradiction detection.',
    connects: ['volatility', 'meta'],
    posts: [
      { slug: 'first-party-brands-win-google-core-updates',   title: 'Why First-Party Brands Win Every Google Core Update' },
      { slug: 'aggregator-websites-losing-ai-visibility',     title: 'Why Aggregator Websites Are Losing Visibility in AI Search' },
      { slug: 'machine-trust-score-replacing-domain-authority', title: 'Machine Trust Score: Why It\'s Replacing Domain Authority' },
      { slug: 'synthetic-entity-detection-what-seos-need-to-know', title: 'Synthetic Entity Detection: What SEOs Need to Know' },
      { slug: 'cross-page-contradictions-kill-ai-trust',       title: 'Why Contradicting Yourself Across Pages Kills AI Trust Signals' },
      { slug: 'why-ai-ignores-schema-markup',                  title: 'Why AI Systems Ignore Schema Markup (And What They Actually Use)' },
      { slug: 'schema-markup-is-a-trust-signal',               title: 'Schema Markup Is a Trust Signal, Not a Tag' },
      { slug: 'building-knowledge-graph-ai-visibility',        title: 'How to Build a Knowledge Graph That AI Systems Trust' },
      { slug: 'entity-optimization-the-signal-ai-systems-weight-most', title: 'Entity Optimization: The Signal AI Systems Weight Most' },
      { slug: 'entity-disambiguation-ai-visibility',           title: 'Entity Disambiguation: The One Thing Separating AI-Visible Brands' },
    ],
  },
  {
    id: 'volatility',
    label: 'AI Volatility & Stability',
    color: 'amber',
    accent: '#F59E0B',
    description:
      'The dynamics of AI search volatility, content freshness decay, and building resilience against algorithm change.',
    connects: ['discovery', 'meta'],
    posts: [
      { slug: 'ai-overviews-change-every-two-days',            title: 'Why AI Overviews Change Every 2 Days but Still Mean the Same Thing' },
      { slug: 'two-google-core-updates-43-days',               title: 'Two Core Updates in 43 Days: What Google Is Really Trying to Fix' },
      { slug: 'ai-overviews-core-updates-same-signals',        title: 'Why AI Overviews and Google Core Updates Reward the Same Signals' },
      { slug: 'survive-google-core-updates-2026',              title: 'What Makes a Website Survive Google Core Updates in 2026' },
      { slug: 'temporal-authority-content-freshness-ai-seo',   title: 'Temporal Authority: Why Stale Content Is Now an Active Trust Penalty' },
      { slug: 'temporal-authority-stale-content-ai-visibility', title: 'Temporal Authority: Why Stale Content Loses AI Visibility' },
      { slug: 'why-google-ai-overviews-ignore-your-best-content', title: 'Why Google AI Overviews Ignore Your Best Content' },
      { slug: 'complete-guide-optimizing-google-ai-overviews', title: 'The Complete Guide to Optimizing for Google AI Overviews' },
    ],
  },
  {
    id: 'meta',
    label: 'Machine Trust Intelligence (Meta Hub)',
    color: 'navy',
    accent: '#00C8FF',
    description:
      'The core SiteNexis framework: AI visibility as a measurable, improvable system. Every cluster connects here.',
    connects: ['discovery', 'citation', 'authority', 'volatility'],
    posts: [
      { slug: 'four-layer-ai-intelligence-stack-seo',          title: 'The Four-Layer AI Intelligence Stack Every SEO Needs to Understand' },
      { slug: 'what-is-geo-generative-engine-optimisation-guide', title: 'What Is GEO? The Complete Guide to Generative Engine Optimisation' },
      { slug: 'technical-seo-audit-is-dead-what-comes-next',   title: 'The Technical SEO Audit Is Dead. Here\'s What Comes Next.' },
      { slug: 'the-end-of-keyword-seo-what-comes-next',        title: 'The End of Keyword SEO: What Replaces It in an AI-First World' },
      { slug: 'ai-first-content-architecture-pages-machines-trust', title: 'AI-First Content Architecture: Building Pages That Machines Trust' },
      { slug: 'rag-seo-retrieval-augmented-generation-content-strategy', title: 'RAG and SEO: How Retrieval Augmented Generation Changes Content Strategy' },
      { slug: 'ai-perception-graph-semantic-topology',         title: 'The AI Perception Graph: Understanding Your Site\'s Semantic Topology' },
      { slug: 'semantic-clarity-vs-keyword-density-ai-search', title: 'Semantic Clarity vs. Keyword Density: What AI Search Actually Rewards' },
    ],
  },
] as const;

const COLOR_MAP: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  cyan:   { border: 'border-cyan-500/30',   bg: 'bg-cyan-500/5',   text: 'text-cyan-400',   badge: 'bg-cyan-500/15 text-cyan-300' },
  teal:   { border: 'border-teal-500/30',   bg: 'bg-teal-500/5',   text: 'text-teal-400',   badge: 'bg-teal-500/15 text-teal-300' },
  purple: { border: 'border-purple-500/30', bg: 'bg-purple-500/5', text: 'text-purple-400', badge: 'bg-purple-500/15 text-purple-300' },
  amber:  { border: 'border-amber-500/30',  bg: 'bg-amber-500/5',  text: 'text-amber-400',  badge: 'bg-amber-500/15 text-amber-300' },
  navy:   { border: 'border-cyan-400/40',   bg: 'bg-cyan-500/8',   text: 'text-cyan-300',   badge: 'bg-cyan-500/20 text-cyan-200' },
};

// ── JSON-LD structured data ────────────────────────────────────────────────────

function buildJsonLd() {
  const base = 'https://sitenexis.com';
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${base}/content-map`,
        url: `${base}/content-map`,
        name: 'AI Visibility Knowledge Graph — SiteNexis Content Architecture',
        description: 'Semantic knowledge graph of SiteNexis AI visibility intelligence content, organised into five interconnected clusters: AI Discovery, Citation Mechanics, Authority Systems, Volatility Modeling, and Machine Trust Intelligence.',
        isPartOf: { '@id': base },
        about: { '@type': 'Thing', name: 'AI Visibility Intelligence', description: 'The discipline of measuring and improving how AI systems retrieve, interpret, trust, and recommend web content.' },
      },
      {
        '@type': 'ItemList',
        name: 'SiteNexis AI Visibility Knowledge Clusters',
        description: 'Five semantic content clusters forming the SiteNexis knowledge graph on AI visibility, machine trust, and AI-first content strategy.',
        numberOfItems: CLUSTERS.length,
        itemListElement: CLUSTERS.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.label,
          description: c.description,
          url: `${base}/content-map#${c.id}`,
        })),
      },
      ...CLUSTERS.flatMap((c) =>
        c.posts.map((p) => ({
          '@type': 'Article',
          headline: p.title,
          url: `${base}/blog/${p.slug}`,
          isPartOf: { '@type': 'CreativeWorkSeries', name: c.label },
          about: { '@type': 'Thing', name: 'AI Visibility Intelligence' },
          publisher: {
            '@type': 'Organization',
            name: 'SiteNexis',
            url: base,
          },
        }))
      ),
    ],
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContentMapPage() {
  const jsonLd = buildJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="min-h-screen bg-[#0A1628] text-slate-200">
        {/* Header */}
        <div className="border-b border-white/[0.06] bg-[#0A1628]/80 px-6 py-12 text-center">
          <div className="mx-auto max-w-3xl">
            <span className="mb-4 inline-block rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-cyan-400">
              Semantic Knowledge Graph
            </span>
            <h1 className="mb-4 font-serif text-4xl font-bold tracking-tight text-white md:text-5xl">
              AI Visibility Content Map
            </h1>
            <p className="text-lg leading-relaxed text-slate-400">
              64 articles organised into five interconnected knowledge clusters. Every cluster
              reinforces the others — forming a machine-readable authority graph that AI systems
              can traverse and cite.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
              <span><span className="text-white font-semibold">64</span> articles</span>
              <span className="text-slate-700">·</span>
              <span><span className="text-white font-semibold">5</span> knowledge clusters</span>
              <span className="text-slate-700">·</span>
              <span><span className="text-white font-semibold">1</span> meta hub</span>
            </div>
          </div>
        </div>

        {/* Cluster architecture diagram */}
        <div className="border-b border-white/[0.06] px-6 py-10">
          <div className="mx-auto max-w-4xl">
            <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-slate-600">
              Cluster Connections
            </p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {CLUSTERS.filter(c => c.id !== 'meta').map((c) => {
                const col = COLOR_MAP[c.color];
                return (
                  <a
                    key={c.id}
                    href={`#${c.id}`}
                    className={`rounded-xl border ${col.border} ${col.bg} p-4 text-center transition-opacity hover:opacity-80`}
                  >
                    <div className={`text-sm font-semibold ${col.text}`}>{c.label}</div>
                    <div className="mt-1 text-[11px] text-slate-600">{c.posts.length} articles</div>
                  </a>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-center gap-2">
              <div className="h-px flex-1 bg-white/[0.04]" />
              <a
                href="#meta"
                className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-6 py-3 text-center transition-opacity hover:opacity-80"
              >
                <div className="text-sm font-semibold text-cyan-300">Machine Trust Intelligence</div>
                <div className="mt-0.5 text-[11px] text-slate-500">Meta Hub · All clusters connect here</div>
              </a>
              <div className="h-px flex-1 bg-white/[0.04]" />
            </div>
          </div>
        </div>

        {/* Clusters */}
        <div className="mx-auto max-w-5xl space-y-16 px-6 py-16">
          {CLUSTERS.map((cluster) => {
            const col = COLOR_MAP[cluster.color];
            const isMeta = cluster.id === 'meta';
            return (
              <section key={cluster.id} id={cluster.id}>
                {/* Cluster header */}
                <div className={`mb-6 rounded-2xl border ${col.border} ${col.bg} p-6`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className={`mb-1 text-xs font-semibold uppercase tracking-widest ${col.text}`}>
                        {isMeta ? 'Meta Hub' : 'Knowledge Cluster'}
                      </div>
                      <h2 className="text-xl font-bold text-white">{cluster.label}</h2>
                      <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
                        {cluster.description}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {cluster.connects.map((c) => (
                        <a
                          key={c}
                          href={`#${c}`}
                          className={`rounded-full px-3 py-1 text-[11px] font-medium ${col.badge}`}
                        >
                          → {CLUSTERS.find(cl => cl.id === c)?.label.split(' ')[0]}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Post grid */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {cluster.posts.map((post) => (
                    <Link
                      key={post.slug}
                      href={`/blog/${post.slug}`}
                      className="group flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 transition-all hover:border-white/[0.10] hover:bg-white/[0.04]"
                    >
                      <span className={`mt-0.5 text-xs font-bold ${col.text}`}>→</span>
                      <span className="text-sm leading-snug text-slate-300 group-hover:text-white">
                        {post.title}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* Footer CTA */}
        <div className="border-t border-white/[0.06] px-6 py-16 text-center">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-3 font-serif text-2xl font-bold text-white">
              See How Your Site Scores Across All Five Layers
            </h2>
            <p className="mb-6 text-slate-400">
              SiteNexis audits your domain across 12 intelligence dimensions — from discovery readiness
              to machine trust — and produces an explainable, actionable report.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-[#0A1628] transition-opacity hover:opacity-90"
            >
              Start Free Audit — 10 Credits Included
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
