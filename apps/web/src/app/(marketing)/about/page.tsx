import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { ArrowRight } from 'lucide-react';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sitenexis.vercel.app';

const FOUNDER_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': 'https://sitenexis.com/#founder',
  name: 'Ekeleme David Kelechi',
  alternateName: ['Kellyxyhub', 'kellyxy110'],
  url: `${appUrl}/about`,
  jobTitle: 'Founder & CEO',
  description: 'Founder and CEO of SiteNexis. Builder of AI retrieval and machine trust intelligence systems. Expert in entity SEO, knowledge graph optimization, and how AI systems retrieve and recommend web content.',
  worksFor: {
    '@id': 'https://sitenexis.com/#organization',
    '@type': 'Organization',
    name: 'SiteNexis',
    url: appUrl,
  },
  knowsAbout: [
    'AI Retrieval Systems',
    'Machine Trust Intelligence',
    'Retrieval-Augmented Generation',
    'Knowledge Graph Optimization',
    'Entity SEO',
    'AI Visibility Engineering',
    'Large Language Models',
    'Schema Markup',
    'Semantic Search',
    'Next.js',
    'TypeScript',
    'Generative AI',
  ],
  sameAs: [
    'https://github.com/kellyxy110',
    'https://x.com/Sitenexis',
    'https://www.linkedin.com/in/sitenexis',
    'https://www.reddit.com/user/Sitenexis',
  ],
};

export const metadata: Metadata = {
  title: 'About SiteNexis — AI Retrieval & Machine Trust Intelligence',
  description:
    'SiteNexis is an AI Retrieval and Machine Trust Intelligence platform. We model how AI systems — ChatGPT, Gemini, Perplexity, Claude — retrieve, interpret, trust, and recommend web content across a four-layer intelligence stack.',
  openGraph: {
    title: 'About SiteNexis — AI Retrieval & Machine Trust Intelligence',
    description: 'SiteNexis models how AI systems retrieve, interpret, trust, and recommend web content — across every layer from semantic structure to machine trust formation.',
    url: `${appUrl}/about`,
    siteName: 'SiteNexis',
    type: 'website',
  },
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

const TEAM_ROLES = [
  { role: 'AI Research', description: 'Modeling retrieval behavior across all major AI systems.' },
  { role: 'Engineering', description: 'Building the 16-agent analysis pipeline and real-time monitoring.' },
  { role: 'Product', description: 'Translating machine intelligence into actionable human insight.' },
  { role: 'Data & Scoring', description: 'Calibrating trust decay models, citation weights, and retrieval simulation parameters.' },
];

const VALUES = [
  {
    title: 'Semantic integrity over manipulation',
    body: 'We build tools that improve genuine content quality. SiteNexis will never help manufacture authority that isn\'t earned.',
  },
  {
    title: 'Explainability is non-negotiable',
    body: 'Every score deduction maps to a named, actionable issue. No black boxes. No composite scores without sub-score breakdowns.',
  },
  {
    title: 'Deterministic by design',
    body: 'The same content always produces the same score. Reproducibility enables trust. Trust enables improvement.',
  },
  {
    title: 'The machine-first web is already here',
    body: 'AI systems are already the primary discovery layer for millions of queries. We build for where the web is going, not where it was.',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-midnight font-ui text-white antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FOUNDER_SCHEMA) }}
      />
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-20 px-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(0,200,255,0.06),transparent)]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">About</p>
          <h1 className="mt-4 text-[42px] font-bold leading-[1.1] tracking-[-0.03em] text-white md:text-[52px]">
            Built for the<br />
            <span className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">machine-first web</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-[1.75] text-slate-300">
            SiteNexis is the first AI Visibility Operating System. We model how AI systems retrieve,
            interpret, trust, and recommend web content — and give every publisher the intelligence
            to be visible in the machine-first web.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="border-t border-white/[0.05] bg-[#0A1628] py-20 px-6">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-12 md:grid-cols-2">
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/70">Mission</p>
              <h2 className="mb-4 text-[26px] font-bold leading-tight text-white">
                Making web content visible to machines — and trustworthy to AI systems.
              </h2>
              <p className="text-[15px] leading-[1.75] text-slate-400">
                The transition from keyword-based search to AI-mediated discovery is the largest structural
                shift in how web content is found since the invention of PageRank. SiteNexis gives
                every publisher — from solo founders to enterprise teams — the same intelligence layer
                that only the most sophisticated AI-native companies currently have.
              </p>
            </div>
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/70">What we built</p>
              <h2 className="mb-4 text-[26px] font-bold leading-tight text-white">
                A four-layer intelligence stack for machine trust.
              </h2>
              <p className="text-[15px] leading-[1.75] text-slate-400">
                SiteNexis runs 16 intelligence agents across four layers: crawl and structure,
                semantic intelligence, AI visibility, and machine trust. Every scan produces a
                complete picture of how AI systems perceive, retrieve, trust, and recommend
                your content — with actionable recommendations at each layer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/70">Principles</p>
          <h2 className="mb-10 text-[28px] font-bold text-white">What we believe</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {VALUES.map((v) => (
              <div key={v.title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h3 className="mb-2 text-[15px] font-semibold text-white">{v.title}</h3>
                <p className="text-[13px] leading-[1.7] text-slate-400">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Founder */}
      <section className="border-t border-white/[0.05] bg-[#0A1628] py-20 px-6">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/70">Founder</p>
          <h2 className="mb-10 text-[28px] font-bold text-white">Built by someone who needed it</h2>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8 md:flex md:items-start md:gap-8">
            {/* Founder photo */}
            <div className="mb-6 shrink-0 md:mb-0">
              <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-cyan-500/20 shadow-[0_0_30px_rgba(0,200,255,0.1)]">
                <Image
                  src="/founder.jpg"
                  alt="Ekeleme David Kelechi — Founder & CEO, SiteNexis"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[18px] font-bold text-white">Ekeleme David Kelechi</p>
              <p className="mt-0.5 text-[13px] font-medium text-cyan-400">Founder &amp; CEO · Kellyxyhub</p>
              <p className="mt-4 text-[14px] leading-[1.8] text-slate-400">
                SiteNexis was built because existing SEO tools couldn&apos;t answer the questions that
                actually mattered: why was high-ranking content invisible to AI systems, why did schema
                markup seem to be ignored by retrieval pipelines, and why did entity inconsistencies
                produce trust failures that no traditional audit tool could diagnose?
              </p>
              <p className="mt-3 text-[14px] leading-[1.8] text-slate-400">
                The platform is the answer — a four-layer intelligence stack that models AI retrieval,
                trust formation, and recommendation probability from first principles. Built in public,
                audited by the tools it powers.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href="https://github.com/kellyxy110"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-[12px] font-medium text-slate-300 transition-colors hover:border-white/[0.18] hover:text-white"
                >
                  GitHub · kellyxy110
                </a>
                <a
                  href="https://x.com/Sitenexis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-[12px] font-medium text-slate-300 transition-colors hover:border-cyan-500/30 hover:text-cyan-400"
                >
                  𝕏 · @Sitenexis
                </a>
                <a
                  href="https://www.linkedin.com/in/sitenexis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-[12px] font-medium text-slate-300 transition-colors hover:border-blue-500/30 hover:text-blue-400"
                >
                  LinkedIn · SiteNexis
                </a>
                <a
                  href="https://www.reddit.com/user/Sitenexis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-[12px] font-medium text-slate-300 transition-colors hover:border-orange-500/30 hover:text-orange-400"
                >
                  Reddit · u/Sitenexis
                </a>
                <a
                  href="mailto:sitenexisintel@gmail.com"
                  className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-[12px] font-medium text-slate-300 transition-colors hover:border-teal-500/30 hover:text-teal-400"
                >
                  sitenexisintel@gmail.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="border-t border-white/[0.05] py-20 px-6">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/70">Disciplines</p>
          <h2 className="mb-10 text-[28px] font-bold text-white">The expertise behind the platform</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {TEAM_ROLES.map((t) => (
              <div key={t.role} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                  <PentagonMark size={16} />
                </div>
                <p className="mb-1.5 text-[13px] font-semibold text-white">{t.role}</p>
                <p className="text-[12px] leading-[1.65] text-slate-500">{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-[28px] font-bold text-white">See how SiteNexis works</h2>
          <p className="mb-8 text-[15px] text-slate-400">Run a free audit on any domain. No account required.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/signup"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-6 py-3 text-[14px] font-semibold text-[#050816] hover:-translate-y-0.5 transition-transform">
              Start free audit <ArrowRight size={14} />
            </Link>
            <Link href="/platform/health"
              className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-6 py-3 text-[14px] font-medium text-white hover:border-white/[0.2] transition-colors">
              See SiteNexis health score →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
