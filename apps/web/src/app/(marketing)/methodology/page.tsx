import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { MarketingNav } from '@/components/marketing/MarketingNav';

export const metadata: Metadata = {
  title: 'SiteNexis Methodology — How We Measure AI Visibility',
  description:
    'A transparent, layer-by-layer explanation of how SiteNexis measures AI visibility and machine trust. Every score, every formula, every dimension — fully documented.',
};

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sitenexis.vercel.app';

const METHOD_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: 'SiteNexis AI Visibility & Machine Trust Methodology',
  description:
    'A transparent explanation of how SiteNexis measures AI visibility and machine trust across four intelligence layers: Crawl & Structure, Semantic Intelligence, AI Visibility, and Machine Trust.',
  author: { '@id': 'https://sitenexis.com/#founder' },
  publisher: { '@id': 'https://sitenexis.com/#organization' },
  url: `${appUrl}/methodology`,
  datePublished: '2025-01-01',
  dateModified: '2026-06-10',
  speakable: {
    '@type': 'SpeakableSpecification',
    cssSelector: ['h1', 'h2', '.speakable'],
  },
  about: [
    { '@type': 'Thing', name: 'AI Visibility Scoring' },
    { '@type': 'Thing', name: 'Machine Trust Intelligence' },
    { '@type': 'Thing', name: 'Retrieval-Augmented Generation' },
    { '@type': 'Thing', name: 'Entity SEO' },
  ],
};

function PentagonMark({ size = 16 }: { size?: number }) {
  const cx = size / 2, cy = size / 2, r = size * 0.42;
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden>
      <polygon points={pts} stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" fill="rgba(255,255,255,0.04)" />
      <polygon points={pts} stroke="rgba(11,206,188,0.35)" strokeWidth="0.6" fill="none"
        style={{ transform: `scale(0.55) translate(${size * 0.45}px, ${size * 0.45}px)` }} />
    </svg>
  );
}

// ── Layer data ────────────────────────────────────────────────────────────────

const LAYERS = [
  {
    number: '01',
    name: 'Technical Intelligence',
    tagline: 'Can AI systems reach your content?',
    color: 'from-slate-500/20 to-slate-600/10',
    border: 'border-slate-500/20',
    accent: 'text-slate-300',
    description: 'The foundation layer. No other dimension of AI visibility is meaningful if AI systems cannot reliably access and extract your content. Layer 1 measures every property that determines whether content enters the AI retrieval pipeline at all.',
    dimensions: [
      {
        name: 'Crawl Accessibility Score',
        definition: 'Whether AI-specific crawlers (GPTBot, ClaudeBot, Google-Extended, Bingbot) can reach and render page content.',
        why: 'AI systems cannot process content they cannot access. A page blocked by robots.txt for AI crawlers is AI-invisible regardless of content quality.',
        how: 'Evaluates robots.txt directives per crawler agent, JavaScript rendering completeness, response time consistency, and HTTP response codes.',
        problems: 'Accidental AI crawler blocks in robots.txt, JavaScript-only content not rendered server-side, inconsistent response times causing crawler timeouts.',
        fix: 'SiteNexis identifies the specific crawler identifiers blocked and the specific pages affected, with corrective robots.txt directives ready to implement.',
      },
      {
        name: 'Technical SEO Health Score',
        definition: 'Correctness of the crawl and indexation infrastructure: canonicals, redirects, sitemaps, meta robots.',
        why: 'Technical errors dilute authority signals and cause AI systems to encounter inconsistent or duplicate content, reducing per-URL trust accumulation.',
        how: 'Programmatic audit of canonical tag correctness, redirect chain depth, sitemap URL accuracy, meta robots consistency, and internal link structural integrity.',
        problems: 'Duplicate canonical targets, multi-hop redirect chains, sitemap URLs mismatching canonical tags, accidental noindex on priority pages.',
        fix: 'Full issue list with severity classification and exact corrective actions per issue type.',
      },
      {
        name: 'Core Web Vitals Score',
        definition: 'Page performance as measured by LCP (Largest Contentful Paint), CLS (Cumulative Layout Shift), and INP (Interaction to Next Paint).',
        why: 'Rendering performance determines whether AI crawlers receive complete content within timeout thresholds. Slow-rendering pages are frequently extracted with missing content.',
        how: 'Lighthouse integration on top 5 pages by PageRank. Field data from Chrome User Experience Report where available.',
        problems: 'Slow LCP from unoptimised images or render-blocking resources, CLS from dynamically injected content, INP from heavy JavaScript execution.',
        fix: 'Per-page performance issues with specific resource-level recommendations.',
      },
    ],
  },
  {
    number: '02',
    name: 'Semantic Intelligence',
    tagline: 'Does your content mean something clear to a machine?',
    color: 'from-blue-500/20 to-blue-600/10',
    border: 'border-blue-500/20',
    accent: 'text-blue-300',
    description: 'The meaning layer. Accessible content must also be clearly interpretable — entities defined, relationships mapped, and semantic structure coherent enough for AI systems to extract accurate knowledge. Layer 2 measures whether machine understanding is possible.',
    dimensions: [
      {
        name: 'Entity Confidence Score',
        definition: 'How clearly and consistently the primary entity is defined, attributed, and externally validated across the domain.',
        why: 'Entities are the atomic units of AI knowledge. Ambiguous entity identity prevents AI systems from confidently associating content with a specific real-world object, reducing citation probability across all pages.',
        how: 'Four sub-dimensions: entity detection (are primary entities explicitly named?), entity consistency (same entity described identically across all pages?), entity coverage (are key entity attributes present?), entity disambiguation (is the entity distinguishable from similarly named objects?).',
        problems: 'Different entity descriptions on homepage vs. about page vs. schema. Missing founding date, category, or description attributes. No disambiguation context for common names.',
        fix: 'Entity inconsistency report with specific attribute-level conflicts across pages and schema, with corrective content and schema snippets.',
      },
      {
        name: 'Schema Completeness Score',
        definition: 'Whether structured data is present, correct, and accurately represents page content.',
        why: 'Schema is the primary machine-readable communication channel between web content and AI systems. Incomplete or inaccurate schema forces AI systems to infer attributes from body text — introducing uncertainty that reduces trust.',
        how: 'Validation of schema type coverage per page type, attribute completeness per schema type, semantic accuracy (schema claims verifiable in body text), and nested entity relationship coherence.',
        problems: 'Missing dateModified, author without worksFor, schema type mismatched to page category, attributes asserted in schema but absent from body text.',
        fix: 'Generated schema snippets for each detected gap, ready to implement with accuracy requirements noted.',
      },
      {
        name: 'Machine Readability Score',
        definition: 'How much meaning survives the AI extraction pipeline from raw HTML to usable semantic chunk.',
        why: 'AI systems do not read pages — they extract chunks. A page that communicates well to humans but fragments into incoherent chunks produces no AI visibility benefit from its content quality.',
        how: 'Seven extraction pipeline stages: rendering fidelity, boilerplate ratio, chunk boundary quality, signal-to-noise ratio, heading hierarchy depth, reading order consistency, link anchor quality.',
        problems: 'High boilerplate ratio from navigation and footer contaminating extracted chunks, paragraph breaks misaligned with semantic units, generic anchor text providing no chunk context.',
        fix: 'Stage-by-stage breakdown with specific extraction failure points identified per page.',
      },
    ],
  },
  {
    number: '03',
    name: 'Authority Intelligence',
    tagline: 'Does your content satisfy what AI systems are looking for?',
    color: 'from-cyan-500/20 to-teal-500/10',
    border: 'border-cyan-500/20',
    accent: 'text-cyan-300',
    description: 'The retrieval layer. Semantically clear content must also be structured for AI retrieval — chunk-extractable, query-answer aligned, citation-ready. Layer 3 measures whether your content competes successfully when AI systems are selecting sources.',
    dimensions: [
      {
        name: 'AI Extractability Score',
        definition: 'Four-dimension measure of how completely an AI system can derive accurate knowledge from a single chunk or small cluster.',
        why: 'AI retrieval is chunk-level, not page-level. Each chunk must independently pass quality evaluation. Content that requires multi-chunk context to make sense produces systematically lower retrieval scores.',
        how: 'Dimension 1: Entity Clarity (0–25) — named entities explicit and defined in-chunk. Dimension 2: Conversational Readiness (0–25) — H1/title match query form, FAQ structures present. Dimension 3: Chunk Extractability (0–25) — semantic self-containment. Dimension 4: Summarisability (0–25) — clear central claim, no internal contradictions.',
        problems: 'Chunks with dangling pronoun references, entities mentioned but not defined, arguments that span multiple chunks without intermediate summary.',
        fix: 'Per-chunk extractability issues with specific content restructuring recommendations.',
      },
      {
        name: 'Citation Probability Score',
        definition: 'Modelled likelihood that an AI system selects this content as a citation source for relevant queries.',
        why: 'Citation eligibility requires more than accessibility and quality — it requires the specific structural properties that AI citation selection filters evaluate.',
        how: 'Weighted formula: Factual density (20%) + Claim specificity (15%) + Primary entity authority (15%) + Topical authority depth (15%) + Structural citation readiness (15%) + Temporal freshness (10%) + Trust signal density (10%). Weights configurable in /config/citation-weights.json.',
        problems: 'Generic assertions without supporting specifics, claims presented without attribution or external validation, broad topic coverage without depth on any single topic.',
        fix: 'Factor-level breakdown showing which of the seven dimensions is suppressing citation probability, with specific content interventions per factor.',
      },
      {
        name: 'Semantic Trust Score',
        definition: 'Whether the content demonstrates the authorship, organisational, content, and structural trust signals that AI systems evaluate for source credibility.',
        why: 'AI systems filter sources against trust thresholds before citation. Content from domains that fail trust signal evaluation is systematically deprioritised regardless of individual page quality.',
        how: 'Authorship trust signals (byline presence, author entity schema, author expertise attribution), organisational trust signals (About page completeness, company schema, policy pages), content trust signals (factual attribution, claim consistency), structural trust signals (HTTPS, schema completeness, contradiction absence).',
        problems: 'Missing author attribution, no About page entity definition, unattributed factual claims, internal contradictions across pages.',
        fix: 'Trust signal gap report with implementation priority based on score impact per fix.',
      },
      {
        name: 'Retrieval Readiness Score',
        definition: 'Composite of machine readability, chunk quality, and query-answer alignment across six query type models.',
        why: 'Retrieval readiness determines whether content competes successfully when AI systems are ranking candidate chunks against a query. High machine readability alone is insufficient if content is not structured for the specific query types that generate retrieval events.',
        how: 'Query type alignment across: Definitional ("What is X?"), Comparative ("Is A better than B?"), Procedural ("How do I X?"), Evaluative ("Is X good?"), Factual ("When was X founded?"), Navigational ("Find X in Y location"). Per-query-type gap identification.',
        problems: 'Procedural content not in numbered list form, evaluative content without schema-backed review signals, factual content without Organization schema anchor.',
        fix: 'Query-type specific content structure recommendations with HowTo/FAQ/Organization schema implementation guidance.',
      },
    ],
  },
  {
    number: '04',
    name: 'Machine Trust Intelligence',
    tagline: 'Does the AI ecosystem trust and recommend your brand?',
    color: 'from-teal-500/20 to-teal-600/10',
    border: 'border-teal-500/20',
    accent: 'text-teal-300',
    description: 'The trust and recommendation layer. Layer 4 models the dynamic properties of AI trust — how it forms, how it is maintained, how it decays, and how it translates into recommendation surface presence. This is the layer most tools do not reach.',
    dimensions: [
      {
        name: 'Machine Trust Score',
        definition: 'Composite trust state of the domain from the perspective of AI citation systems — entity credibility consistency, schema trust alignment, external validation depth, contradiction absence, and trust degradation resistance.',
        why: 'Trust in AI systems is domain-level. A single trust signal failure can suppress citation probability across all pages on the domain, not just the page with the issue.',
        how: 'Entity Credibility Consistency (30%) + Schema Trust Alignment (20%) + External Validation Depth (25%) + Contradiction Absence Score (15%) + Trust Degradation Resistance (10%). Contradiction detection via Claude API on top 20 pages by PageRank.',
        problems: 'Cross-page entity attribute conflicts, schema claiming attributes absent from body text, sameAs links resolving to 404 or wrong entities, contradictory factual claims across pages.',
        fix: 'Trust issue report with source conflict identification, sameAs link health check, and schema alignment gap analysis.',
      },
      {
        name: 'Retrieval Quality Score',
        definition: 'Six-stage simulation of the AI retrieval pipeline: chunk extraction, ranking pressure, summarisation degradation, context truncation, answer formation probability, and citation eligibility filtering.',
        why: 'AI retrieval is a multi-stage process where content can succeed at early stages and fail at later ones. Understanding exactly which stage causes failure is required to fix it efficiently.',
        how: 'Deterministic simulation on top 30 pages by PageRank. Same content always produces same result. Parameters in /config/retrieval-simulation-model.json. Chunk Stability Index (25%) + Answer Formation Probability (25%) + Summarisation Loss Score (25%) + Citation Eligibility Score (25%).',
        problems: 'Chunks that fragment across tokenizer boundaries, facts that distort when compressed into AI summaries, claims that require multi-chunk context to be accurate.',
        fix: 'Per-page retrieval failure report by stage, with fragile claim identification and truncation zone warnings.',
      },
      {
        name: 'Authority Velocity Score',
        definition: 'Rate of AI visibility growth or decline — change in Entity Confidence, Citation Probability, and external validation signals across consecutive audit cycles.',
        why: 'Velocity distinguishes growing domains from stable or declining ones. A site with a score of 65 growing from 50 is in a fundamentally different position from one declining from 80.',
        how: 'Delta calculation across consecutive audits: ΔEntity Confidence (30%) + ΔCitation Probability (30%) + ΔExternal Validation (20%) + Update Frequency Score (20%). Requires minimum two audit snapshots.',
        problems: 'Declining entity confidence without corresponding content changes, external validation sources going offline, update frequency classified as stale (3+ months) or abandoned (6+ months).',
        fix: 'Velocity trend identification with specific decay signal attribution — which signal is declining and when the decline began.',
      },
      {
        name: 'Recommendation Surface Score',
        definition: 'Presence and inclusion probability across four AI recommendation surfaces: AI Overviews, chat-based AI, voice assistant retrieval, and autonomous agent discovery.',
        why: 'AI recommendations do not all happen in the same place. A brand visible in AI Overviews but absent from voice and agent surfaces has an incomplete recommendation footprint.',
        how: 'AI Overviews inclusion probability (30%) + Chat recommendation probability (30%) + Voice retrieval probability (20%) + Agent discovery probability (20%). All surface scores are probabilistic estimates labelled as such in the UI.',
        problems: 'No speakable schema for voice, no well-known discovery endpoints for agents, FAQ schema missing for AI Overviews inclusion, entity confidence too low for chat recommendation threshold.',
        fix: 'Per-surface gap analysis with surface-specific implementation requirements — speakable schema, FAQ markup, robots.txt agent directives, discovery endpoint structure.',
      },
    ],
  },
];

const COMPOSITE_SCORES = [
  { name: 'AI Visibility Score', formula: 'Machine Readability (15%) + Entity Confidence (20%) + Retrieval Readiness (20%) + Citation Probability (20%) + Semantic Trust (15%) + Schema Completeness (10%)' },
  { name: 'Machine Trust Intelligence Score', formula: 'Retrieval Quality (20%) + Machine Trust (25%) + Authority Velocity (15%) + Recommendation Surface (20%) + Entity Authenticity Confidence (20%)' },
];

const FAQS = [
  {
    q: 'Are SiteNexis scores reproducible?',
    a: 'Yes. Reproducibility is a hard requirement. The same content always produces the same score. The only exception is Claude API-based analysis (contradiction detection, entity extraction) which is cached by content hash — the same content hash always returns the same cached result.',
  },
  {
    q: 'How does SiteNexis differ from a technical SEO audit?',
    a: 'Technical SEO audits address Layers 1 and 2 — crawl accessibility and on-page structure. SiteNexis extends to Layers 3 and 4: AI retrievability, citation probability, machine trust signal analysis, temporal authority modeling, and recommendation surface coverage. Technical audits are a subset of what SiteNexis measures.',
  },
  {
    q: 'Are AI provider scores exact or estimated?',
    a: 'Estimated. SiteNexis does not make live queries to AI systems and cannot access proprietary model internals. All provider-specific scores are modelled estimates based on measurable content signals, labelled as estimates in the UI. The methodology is transparent and based on documented behaviour patterns.',
  },
  {
    q: 'Why does Layer 4 analysis require Pro or Agency tier?',
    a: 'Layer 4 analysis (Retrieval Simulation, Machine Trust, Temporal Authority, Recommendation Surface Mapping, Synthetic Entity Detection) is computationally expensive — it runs 5 additional agents, makes external validation probe requests, uses Claude API for contradiction detection, and requires historical audit data for velocity calculations. The compute cost requires revenue to sustain.',
  },
  {
    q: 'What does "temporal authority requires two audits" mean?',
    a: 'Authority velocity and semantic drift are inherently comparative — they measure change between two states, not the state at any single point. On the first audit, SiteNexis establishes a baseline with velocity: null and status: baseline_established. Subsequent audits compute the delta from that baseline.',
  },
];

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-midnight font-ui text-white antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(METHOD_SCHEMA) }}
      />
      <MarketingNav />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-32 pb-20 px-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(0,200,255,0.06),transparent)]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Methodology</p>
          <h1 className="mt-4 text-[42px] font-bold leading-[1.1] tracking-[-0.03em] text-white md:text-[52px]">
            How SiteNexis<br />
            <span className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">measures AI visibility</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-[1.75] text-slate-300">
            Every score, every formula, every measurement decision — documented transparently.
            We build like a research institution: everything is explainable,
            everything is reproducible, nothing is a black box.
          </p>
        </div>
      </section>

      {/* ── Four-Layer Stack Overview ── */}
      <section className="border-t border-white/[0.05] bg-[#0A1628] py-20 px-6">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/70">Architecture</p>
          <h2 className="mb-4 text-[28px] font-bold text-white">Four-Layer Intelligence Stack</h2>
          <p className="mb-10 max-w-2xl text-[15px] leading-[1.75] text-slate-400">
            Every audit runs through four dependency layers. Layer 4 cannot produce meaningful output
            without the entity graph, trust signals, and retrieval scores from Layers 2 and 3.
            The architecture enforces correctness by requiring each layer to be sound before the next builds on it.
          </p>
          <div className="space-y-2">
            {[
              { n: '04', label: 'Machine Trust Layer', detail: 'Retrieval simulation · Trust modeling · Temporal authority · Recommendation surfaces', gradient: 'from-teal-500/20' },
              { n: '03', label: 'AI Visibility Layer', detail: 'AI Perception Graph · Citation probability · Retrieval readiness · Visibility scoring', gradient: 'from-cyan-500/20' },
              { n: '02', label: 'Semantic Intelligence Layer', detail: 'Entity intelligence · Schema analysis · Content quality · Machine readability', gradient: 'from-blue-500/20' },
              { n: '01', label: 'Crawl & Structure Layer', detail: 'Puppeteer crawl · Chunk extraction · Link graph · SEO signals · Technical performance', gradient: 'from-slate-500/20' },
            ].map(({ n, label, detail, gradient }) => (
              <div key={n} className={`flex items-center gap-4 rounded-xl border border-white/[0.06] bg-gradient-to-r ${gradient} to-transparent p-4`}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.1] bg-black/20 text-[11px] font-bold text-slate-400">{n}</div>
                <div>
                  <p className="text-[14px] font-semibold text-white">{label}</p>
                  <p className="text-[12px] text-slate-500">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Layer Deep Dives ── */}
      {LAYERS.map((layer) => (
        <section key={layer.number} className="py-20 px-6">
          <div className="mx-auto max-w-4xl">
            {/* Layer header */}
            <div className={`mb-10 rounded-2xl border bg-gradient-to-br ${layer.color} ${layer.border} p-8`}>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-black/20 text-[18px] font-bold text-slate-300">
                  {layer.number}
                </div>
                <div>
                  <h2 className="text-[26px] font-bold text-white">{layer.name}</h2>
                  <p className={`mt-1 text-[15px] font-medium ${layer.accent}`}>{layer.tagline}</p>
                  <p className="mt-3 text-[14px] leading-[1.75] text-slate-400 max-w-2xl">{layer.description}</p>
                </div>
              </div>
            </div>

            {/* Dimensions */}
            <div className="space-y-6">
              {layer.dimensions.map((dim) => (
                <div key={dim.name} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                  <div className="border-b border-white/[0.05] px-6 py-4">
                    <div className="flex items-center gap-3">
                      <PentagonMark size={16} />
                      <h3 className="text-[15px] font-semibold text-white">{dim.name}</h3>
                    </div>
                  </div>
                  <div className="grid gap-0 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/[0.05]">
                    {[
                      { label: 'Definition', body: dim.definition },
                      { label: 'Why it matters', body: dim.why },
                      { label: 'How measured', body: dim.how },
                      { label: 'How SiteNexis fixes it', body: dim.fix },
                    ].map(({ label, body }) => (
                      <div key={label} className="p-5">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">{label}</p>
                        <p className="text-[12px] leading-[1.7] text-slate-400">{body}</p>
                      </div>
                    ))}
                  </div>
                  {dim.problems && (
                    <div className="border-t border-white/[0.05] px-5 py-3">
                      <p className="text-[11px] text-slate-600"><span className="font-semibold text-amber-500/70">Common problems: </span>{dim.problems}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* ── Composite Score Formulas ── */}
      <section className="border-t border-white/[0.05] bg-[#0A1628] py-20 px-6">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/70">Score Formulas</p>
          <h2 className="mb-4 text-[28px] font-bold text-white">Composite score calculations</h2>
          <p className="mb-8 max-w-2xl text-[15px] leading-[1.75] text-slate-400">
            Every composite score is the weighted sum of its sub-scores. All weights are documented.
            All sub-scores are individually explainable. No black boxes.
          </p>
          <div className="space-y-4">
            {COMPOSITE_SCORES.map((score) => (
              <div key={score.name} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h3 className="mb-3 text-[15px] font-semibold text-white">{score.name}</h3>
                <code className="block rounded-lg border border-white/[0.06] bg-black/30 px-4 py-3 text-[12px] leading-[1.8] text-cyan-300 font-mono">
                  {score.formula}
                </code>
              </div>
            ))}
          </div>
          {/* Score thresholds */}
          <div className="mt-8">
            <h3 className="mb-4 text-[16px] font-semibold text-white">Score thresholds (used consistently across all scores)</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { range: '90–100', label: 'Excellent', color: 'text-green-400', bg: 'bg-green-500/5 border-green-500/15' },
                { range: '70–89', label: 'Good', color: 'text-teal-400', bg: 'bg-teal-500/5 border-teal-500/15' },
                { range: '50–69', label: 'Needs Work', color: 'text-amber-400', bg: 'bg-amber-500/5 border-amber-500/15' },
                { range: '0–49', label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/5 border-red-500/15' },
              ].map(({ range, label, color, bg }) => (
                <div key={label} className={`rounded-xl border ${bg} p-4 text-center`}>
                  <p className={`text-[20px] font-bold ${color}`}>{range}</p>
                  <p className="mt-1 text-[12px] text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Explainability Commitment ── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/70">Principles</p>
          <h2 className="mb-8 text-[28px] font-bold text-white">Universal explainability requirements</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { title: 'Traceability', body: 'Every point deduction maps to a named Issue record with type, severity, description, and recommendation. No score changes without a causal Issue.' },
              { title: 'Reproducibility', body: 'Same content produces the same score. Claude API calls are cached by content hash. No stochastic elements without explicit documentation.' },
              { title: 'Decomposability', body: 'Every composite score exposes its sub-score breakdown. You can inspect exactly which factor is suppressing the overall score.' },
              { title: 'Delta attribution', body: 'Score changes between audit runs map to specific changed issues. You know not just that the score changed but exactly what changed it.' },
            ].map(({ title, body }) => (
              <div key={title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h3 className="mb-2 text-[14px] font-semibold text-white">{title}</h3>
                <p className="text-[13px] leading-[1.7] text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-t border-white/[0.05] bg-[#0A1628] py-20 px-6">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/70">FAQ</p>
          <h2 className="mb-8 text-[28px] font-bold text-white">Methodology questions</h2>
          <div className="space-y-4">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h3 className="mb-2 text-[14px] font-semibold text-white">{q}</h3>
                <p className="text-[13px] leading-[1.7] text-slate-400">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-[28px] font-bold text-white">See it in practice</h2>
          <p className="mb-8 text-[15px] text-slate-400">Run a free audit and see every score, every sub-score, and every issue explained.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/signup"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-6 py-3 text-[14px] font-semibold text-[#050816] hover:-translate-y-0.5 transition-transform"
            >
              Run a free audit <ArrowRight size={14} />
            </Link>
            <Link
              href="/founder"
              className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-6 py-3 text-[14px] font-medium text-white hover:border-white/[0.2] transition-colors"
            >
              About the founder →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
