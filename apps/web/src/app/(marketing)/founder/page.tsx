import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { Footer } from '@/components/marketing/Footer';

export const metadata: Metadata = {
  title: 'Ekeleme David Kelechi — Founder of SiteNexis',
  description:
    'AI Visibility Researcher and founder of SiteNexis. Building the intelligence layer for AI retrieval and machine trust.',
  alternates: { canonical: '/founder' },
};

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sitenexis.vercel.app';

const FOUNDER_PERSON_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': `${appUrl}/#founder`,
  name: 'Ekeleme David Kelechi',
  alternateName: 'KellyxyHub',
  url: `${appUrl}/founder`,
  jobTitle: 'Founder & CEO',
  description:
    'AI Visibility Researcher, educator, web developer, and prompt engineer. Founder of SiteNexis, the AI Retrieval and Machine Trust Intelligence platform.',
  worksFor: {
    '@id': `${appUrl}/#organization`,
    '@type': 'Organization',
    name: 'SiteNexis',
  },
  knowsAbout: [
    'AI Retrieval Systems',
    'Machine Trust Intelligence',
    'Entity SEO',
    'AI Visibility Engineering',
    'Prompt Engineering',
    'Next.js',
    'Generative AI',
    'Web Development',
    'AI Search',
    'Semantic SEO',
  ],
  sameAs: [
    'https://github.com/kellyxy110',
    'https://x.com/Sitenexis',
    'https://www.linkedin.com/in/ekeleme-kelechi-18b56a340/',
    'https://web.facebook.com/david.k.ekeleme',
    'https://www.reddit.com/user/Sitenexis',
  ],
};

function PentagonMark({ size = 20 }: { size?: number }) {
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

const EXPERTISE_AREAS = [
  {
    title: 'AI Retrieval Systems',
    description: 'Modeling how large language models and embedding-based retrieval systems process, chunk, and evaluate web content for citation eligibility.',
  },
  {
    title: 'Machine Trust Intelligence',
    description: 'Researching the trust signal architecture that AI systems use to determine source credibility — entity consistency, schema alignment, external validation.',
  },
  {
    title: 'Entity SEO',
    description: 'Advancing the practice of entity-first content strategy: structuring web content as knowledge graph contributions rather than keyword collections.',
  },
  {
    title: 'Prompt Engineering',
    description: 'Designing structured AI prompts for content evaluation, entity extraction, contradiction detection, and retrieval simulation at scale.',
  },
  {
    title: 'Web Development',
    description: 'Full-stack development with Next.js, TypeScript, and modern web infrastructure — from architecture design to production deployment.',
  },
  {
    title: 'AI Visibility Measurement',
    description: 'Building scoring systems that produce deterministic, explainable AI visibility metrics — every deduction maps to a named, actionable issue.',
  },
];

const JOURNEY_ITEMS = [
  {
    period: 'Foundation',
    title: 'Educator & Developer',
    description: 'Spent years teaching digital skills and building web projects for businesses — developing a detailed understanding of how the web works from both the human and machine perspective.',
  },
  {
    period: 'Observation',
    title: 'AI Search Emergence',
    description: 'Tracked the rise of ChatGPT, Gemini, Claude, Perplexity, and Google AI Overviews. Observed a consistent pattern: well-ranked content was often invisible in AI-generated responses.',
  },
  {
    period: 'Research',
    title: 'AI Retrieval Investigation',
    description: 'Spent months researching why the gap existed — studying how AI systems chunk, embed, evaluate, and select content. Identified entity clarity, trust signals, and machine readability as the primary determinants.',
  },
  {
    period: 'Building',
    title: 'SiteNexis',
    description: 'Built SiteNexis to systematically measure and explain AI visibility — a four-layer intelligence stack that models everything from technical crawl accessibility to machine trust formation and recommendation surface coverage.',
  },
];

const RESEARCH_PRINCIPLES = [
  {
    principle: 'Mechanism before conclusion',
    body: 'Every finding starts with the mechanism: why does this pattern exist? What specific property of the AI retrieval pipeline produces this outcome? Conclusions without mechanisms are difficult to act on.',
  },
  {
    principle: 'Deterministic over probabilistic',
    body: 'Where measurement is possible, it should be reproducible. The same content should produce the same score. Stochastic evaluation creates doubt that prevents trust in the findings.',
  },
  {
    principle: 'Explainability as a hard requirement',
    body: 'A score without a sub-score breakdown is a black box. A deduction without a named cause cannot be fixed. Every metric in SiteNexis traces to a specific, actionable reason.',
  },
  {
    principle: 'Semantic quality over signal gaming',
    body: 'AI visibility that is manufactured without corresponding content quality is fragile — it decays as AI systems improve their detection of inauthentic signals. Durable visibility requires genuine quality.',
  },
];

export default function FounderPage() {
  return (
    <div className="min-h-screen bg-midnight font-ui text-white antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FOUNDER_PERSON_SCHEMA) }}
      />
      <MarketingNav />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-32 pb-24 px-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(0,200,255,0.07),transparent)]" />
        <div className="relative mx-auto max-w-4xl">
          <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left md:gap-12">
            {/* Founder photo */}
            <div className="mb-8 shrink-0 md:mb-0">
              <div className="relative h-28 w-28 overflow-hidden rounded-2xl border border-cyan-500/20 shadow-[0_0_40px_rgba(0,200,255,0.12)]">
                <Image
                  src="/founder.jpg"
                  alt="Ekeleme David Kelechi — Founder of SiteNexis"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
            {/* Text */}
            <div className="flex-1">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-500/70">Founder</p>
              <h1 className="text-[40px] font-bold leading-[1.1] tracking-[-0.03em] text-white md:text-[52px]">
                Ekeleme David Kelechi
              </h1>
              <p className="mt-2 text-[17px] font-medium text-cyan-400">KellyxyHub · Founder of SiteNexis</p>
              <p className="mt-5 max-w-xl text-[16px] leading-[1.75] text-slate-300">
                AI Visibility Researcher, educator, and the person who asked why excellent content
                was consistently invisible to AI systems — then built the infrastructure to answer that question.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
                <Link
                  href="/signup"
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-5 py-2.5 text-[13px] font-bold text-[#050816] transition-all hover:-translate-y-0.5"
                >
                  Explore SiteNexis <ArrowRight size={13} />
                </Link>
                <a
                  href="https://github.com/kellyxy110"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-5 py-2.5 text-[13px] font-medium text-slate-300 transition-colors hover:border-white/[0.18] hover:text-white"
                >
                  GitHub <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Founder Story ── */}
      <section className="border-t border-white/[0.05] bg-[#0A1628] py-20 px-6">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/70">Founder Story</p>
          <h2 className="mb-6 text-[30px] font-bold leading-tight text-white">
            The gap that became the platform
          </h2>
          <div className="space-y-5 text-[15px] leading-[1.85] text-slate-300">
            <p>
              I spent years teaching, building websites, and helping businesses improve their digital presence.
              During that time, I developed a detailed working understanding of how search engines operate,
              how content gets ranked, and what the gap between publishing and being found actually consists of.
            </p>
            <p>
              Then AI search changed the question.
            </p>
            <p>
              As ChatGPT, Gemini, Claude, Perplexity, and Google AI Overviews became significant discovery
              surfaces, I started noticing a consistent pattern: content that ranked well in traditional search
              was often completely absent from AI-generated responses on the same topics. The SEO was working
              — the rankings were there. But the AI systems were not citing those pages.
            </p>
            <p>
              No existing tool could explain why. Traditional SEO audits reported healthy scores.
              Schema validators showed no errors. The technical foundation was sound. But the AI systems
              kept ignoring the content.
            </p>
            <p>
              I spent months researching the mechanism: how AI systems chunk content into semantic units,
              how they evaluate entity clarity, how they apply trust signals at the domain level before
              evaluating individual pages, and how citation eligibility filtering works as a final screen
              that well-structured content can still fail. That research became SiteNexis.
            </p>
          </div>
        </div>
      </section>

      {/* ── Why SiteNexis Exists ── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/70">Why SiteNexis Exists</p>
          <h2 className="mb-6 text-[30px] font-bold leading-tight text-white">
            Traditional SEO tools measure rankings.<br />
            <span className="text-slate-400">No one was measuring machine trust.</span>
          </h2>
          <div className="space-y-5 text-[15px] leading-[1.85] text-slate-300">
            <p>
              The tools available to website owners in 2024 were all built for the traditional search model:
              a user inputs a query, a search engine returns a ranked list of results, the user clicks.
              Every metric in the standard stack — rankings, impressions, CTR — measures performance in
              that click-mediated model.
            </p>
            <p>
              AI search systems do not work that way. They receive a query, generate an answer using
              sources they select based on their own trust and citation logic, and return a synthesised
              response. The user may not see a ranked list. They may not click through to any source.
              The brand that gets cited in the AI response receives the visibility benefit. The brand
              that does not is invisible to that user, regardless of how highly it ranks in traditional search.
            </p>
            <p>
              SiteNexis exists to close that measurement gap. It models the complete AI retrieval and
              trust pipeline — from technical crawl accessibility through entity clarity, machine trust
              signal consistency, retrieval simulation, temporal authority, and recommendation surface
              coverage — and makes every dimension measurable, explainable, and improvable.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-4 text-center">
            {[
              { label: 'Intelligence Layers', value: '4' },
              { label: 'Analysis Agents', value: '16' },
              { label: 'Scored Dimensions', value: '12' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
                <p className="text-[32px] font-bold text-cyan-400">{value}</p>
                <p className="mt-1 text-[12px] text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Professional Journey ── */}
      <section className="border-t border-white/[0.05] bg-[#0A1628] py-20 px-6">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/70">Professional Journey</p>
          <h2 className="mb-10 text-[30px] font-bold leading-tight text-white">From the classroom to the intelligence layer</h2>
          <div className="relative space-y-0">
            {/* Vertical line */}
            <div className="absolute left-[19px] top-3 bottom-3 w-px bg-gradient-to-b from-cyan-500/30 via-teal-500/20 to-transparent" aria-hidden />
            {JOURNEY_ITEMS.map((item, i) => (
              <div key={i} className="relative flex gap-6 pb-10 last:pb-0">
                <div className="relative z-10 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-[#0A1628]">
                  <PentagonMark size={18} />
                </div>
                <div className="flex-1 pt-1">
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-500/60">{item.period}</p>
                  <h3 className="mb-2 text-[16px] font-semibold text-white">{item.title}</h3>
                  <p className="text-[14px] leading-[1.75] text-slate-400">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Research Philosophy ── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/70">Research Philosophy</p>
          <h2 className="mb-10 text-[30px] font-bold leading-tight text-white">How I approach every problem</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {RESEARCH_PRINCIPLES.map((item) => (
              <div key={item.principle} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h3 className="mb-2 text-[14px] font-semibold text-white">{item.principle}</h3>
                <p className="text-[13px] leading-[1.7] text-slate-400">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Expertise Areas ── */}
      <section className="border-t border-white/[0.05] bg-[#0A1628] py-20 px-6">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/70">Expertise</p>
          <h2 className="mb-10 text-[30px] font-bold leading-tight text-white">Areas of deep focus</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {EXPERTISE_AREAS.map((area) => (
              <div key={area.title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                  <PentagonMark size={16} />
                </div>
                <h3 className="mb-1.5 text-[13px] font-semibold text-white">{area.title}</h3>
                <p className="text-[12px] leading-[1.65] text-slate-500">{area.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Future of AI Visibility ── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/70">Vision</p>
          <h2 className="mb-6 text-[30px] font-bold leading-tight text-white">
            The future of AI visibility
          </h2>
          <div className="space-y-5 text-[15px] leading-[1.85] text-slate-300">
            <p>
              The transition from keyword-based search to AI-mediated discovery is the largest structural
              change in how web content is found since the invention of PageRank. It is not a complete
              replacement — traditional search ranking will remain significant for years. It is an
              expansion: a new layer of the discovery stack that operates on different principles and
              requires different measurement.
            </p>
            <p>
              The organisations that understand this transition early will build structural advantages
              that compound: better entity clarity produces better AI citation rates, which produces
              stronger brand recognition in AI-generated responses, which produces higher branded search
              volume, which produces more external validation signals, which produces better entity clarity.
              The loop is self-reinforcing.
            </p>
            <p>
              The future I am building toward is one where every brand — regardless of size — can access
              the same intelligence layer about their AI visibility that currently only the most
              sophisticated AI-native companies have. That means not just scores, but explanations.
              Not just diagnosis, but prioritised action. Not just a snapshot, but a temporal model
              that tracks how machine trust is growing, stable, or declining.
            </p>
            <p>
              That is what SiteNexis is. And we are only at the beginning of what that intelligence
              layer can produce.
            </p>
          </div>
        </div>
      </section>

      {/* ── Speaking & Thought Leadership ── */}
      <section className="border-t border-white/[0.05] bg-[#0A1628] py-20 px-6">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/70">Thought Leadership</p>
          <h2 className="mb-6 text-[30px] font-bold leading-tight text-white">
            Writing, research, and speaking
          </h2>
          <p className="mb-8 text-[15px] leading-[1.75] text-slate-400">
            My research and writing on AI visibility, machine trust intelligence, and the evolution
            of search is published on the SiteNexis blog. I write from direct observation of AI
            retrieval behaviour — not from second-hand summaries of industry trends.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/blog"
              className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-5 py-2.5 text-[13px] font-medium text-slate-300 transition-colors hover:border-white/[0.18] hover:text-white"
            >
              Read the research blog <ArrowRight size={13} />
            </Link>
            <Link
              href="/methodology"
              className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-5 py-2.5 text-[13px] font-medium text-slate-300 transition-colors hover:border-white/[0.18] hover:text-white"
            >
              See the methodology <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Mission Statement ── */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-3xl">
          <blockquote className="rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/5 to-teal-500/5 p-8 md:p-10">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/70">Mission</p>
            <p className="text-[22px] font-bold leading-[1.45] text-white md:text-[26px]">
              &ldquo;Every brand that produces genuine value deserves to be understood and trusted
              by AI systems — not just by human readers. Building that understanding is not a
              luxury. It is the next infrastructure layer of the web.&rdquo;
            </p>
            <p className="mt-4 text-[14px] text-slate-400">— Ekeleme David Kelechi</p>
          </blockquote>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-white/[0.05] bg-[#0A1628] py-20 px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-[28px] font-bold text-white">See how SiteNexis works</h2>
          <p className="mb-8 text-[15px] text-slate-400">
            Run a free AI visibility audit on any domain. Understand exactly where and why AI systems
            are or are not citing your content.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/signup"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-6 py-3 text-[14px] font-semibold text-[#050816] hover:-translate-y-0.5 transition-transform"
            >
              Start free audit <ArrowRight size={14} />
            </Link>
            <Link
              href="/methodology"
              className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-6 py-3 text-[14px] font-medium text-white hover:border-white/[0.2] transition-colors"
            >
              How we measure it →
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
