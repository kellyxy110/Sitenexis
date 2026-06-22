'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useInView, type Variants } from 'framer-motion';
import { ArrowRight, Globe } from 'lucide-react';
import { HeroCinematic } from '@/components/hero/HeroCinematic';
import { MarketingNav } from '@/components/marketing/MarketingNav';

// ─── Animation primitives ─────────────────────────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};



function Reveal({
  children,
  className = '',
  delay = 0,
  variants = fadeUp,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  variants?: Variants;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={variants}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

// ─── Pentagon logo mark ───────────────────────────────────────────────────────

function PentagonMark({ size = 20 }: { size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;
  const pts = Array.from({ length: 5 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      aria-hidden="true"
    >
      <polygon
        points={pts}
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="1.2"
        fill="rgba(255,255,255,0.04)"
      />
      <polygon
        points={pts}
        stroke="rgba(11,206,188,0.35)"
        strokeWidth="0.6"
        fill="none"
        style={{ transform: `scale(0.55) translate(${size * 0.45}px, ${size * 0.45}px)` }}
      />
    </svg>
  );
}

// ─── Intelligence card data ───────────────────────────────────────────────────

const INTEL_CARDS = [
  { label: 'AI Visibility',          sub: 'Layer 3' },
  { label: 'Retrieval Readiness',    sub: 'Layer 3' },
  { label: 'Entity Intelligence',    sub: 'Layer 2' },
  { label: 'Semantic Trust',         sub: 'Layer 2' },
  { label: 'Citation Readiness',     sub: 'Layer 2' },
  { label: 'Machine Readability',    sub: 'Layer 2' },
  { label: 'AI Extractability',      sub: 'Layer 2' },
  { label: 'Schema Intelligence',    sub: 'Layer 1' },
  { label: 'Machine Trust',          sub: 'Layer 4' },
  { label: 'Temporal Authority',     sub: 'Layer 4' },
  { label: 'Surface Mapping',        sub: 'Layer 4' },
  { label: 'Information Gain',       sub: 'IGE' },
  { label: 'Scout Intent Engine',    sub: 'Scout' },
  { label: 'Global Fix Plan',        sub: 'P0·P1·P2' },
  { label: 'Retrieval Simulation',   sub: '6-stage' },
  { label: 'Synthetic Entity',       sub: 'Layer 4' },
  { label: 'Perception Graph',       sub: 'Layer 3' },
  { label: 'Authority Velocity',     sub: 'Layer 4' },
];

const SCORES_PREVIEW = [
  { label: 'AI Visibility',    score: 74, delta: '+12' },
  { label: 'Entity Trust',     score: 61, delta: '+8'  },
  { label: 'Retrieval Ready',  score: 88, delta: '+3'  },
  { label: 'Machine Trust',    score: 52, delta: '+21' },
  { label: 'Citation Score',   score: 79, delta: '+6'  },
];


const PRICING = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    desc: 'One audit per month.',
    cta: 'Start Free',
    href: '/signup',
    pro: false,
    features: ['1 audit / month', 'All Layer 1–2 modules', 'PDF export', 'No credit card'],
  },
  {
    name: 'Starter',
    price: '$29',
    period: '/mo',
    desc: 'For independent developers.',
    cta: 'Get Started',
    href: '/signup?plan=starter',
    pro: false,
    features: ['50 audits / month', 'All Layer 1–3 modules', 'PDF reports', 'Email support'],
  },
  {
    name: 'Pro',
    price: '$79',
    period: '/mo',
    desc: 'Full intelligence stack.',
    cta: 'Start Trial',
    href: '/signup?plan=pro',
    pro: true,
    features: [
      'Unlimited audits',
      'All 4 intelligence layers',
      'Machine Trust (Layer 4)',
      'Competitive analysis',
      'Priority support',
    ],
  },
  {
    name: 'Agency',
    price: '$249',
    period: '/mo',
    desc: 'For managed client portfolios.',
    cta: 'Contact Sales',
    href: '/contact',
    pro: false,
    features: [
      'Unlimited audits',
      'Bulk domain scanning',
      'White-label reports',
      'API access',
      'Dedicated manager',
    ],
  },
];

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ label, score, delta }: { label: string; score: number; delta: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const color =
    score >= 80 ? '#22C55E' :
    score >= 60 ? '#0BCEBC' :
    score >= 40 ? '#F59E0B' : '#EF4444';

  return (
    <div ref={ref} className="group">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-slate-400">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-emerald-500/80">{delta}</span>
          <span className="text-sm font-semibold text-white">{score}</span>
        </div>
      </div>
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.05]">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={inView ? { width: `${score}%` } : { width: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        />
      </div>
    </div>
  );
}

// ─── Domain audit input ───────────────────────────────────────────────────────

function AuditInput({
  onSubmit,
  loading,
}: {
  onSubmit: (domain: string) => void;
  loading: boolean;
}) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim().replace(/^https?:\/\//, '');
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={[
        'relative flex items-center gap-2 rounded-2xl p-2 pl-4 transition-all duration-300',
        'bg-white/[0.03] backdrop-blur-2xl',
        focused
          ? 'border border-white/[0.14] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_8px_32px_rgba(0,0,0,0.4)]'
          : 'border border-white/[0.07] shadow-[0_4px_24px_rgba(0,0,0,0.3)]',
      ].join(' ')}
    >
      <Globe
        size={15}
        className="shrink-0 text-slate-500 transition-colors duration-200"
        strokeWidth={1.5}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Enter any domain — e.g. apple.com"
        autoComplete="off"
        spellCheck={false}
        className={[
          'min-w-0 flex-1 bg-transparent py-2 text-sm text-white outline-none',
          'placeholder:text-slate-600',
        ].join(' ')}
        aria-label="Domain to audit"
      />
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className={[
          'shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold',
          'bg-white text-[#030907] transition-all duration-200',
          'hover:bg-slate-100 hover:shadow-[0_4px_12px_rgba(255,255,255,0.12)]',
          'active:scale-[0.98]',
          'disabled:cursor-not-allowed disabled:opacity-40',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
        ].join(' ')}
        aria-label="Run audit"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#030907]/30 border-t-[#030907]" />
            Scanning
          </span>
        ) : (
          'Run Audit'
        )}
      </button>
    </form>
  );
}

// ─── Intelligence marquee ─────────────────────────────────────────────────────

function IntelligenceRail() {
  const doubled = [...INTEL_CARDS, ...INTEL_CARDS];

  return (
    <div
      className="marquee-container relative overflow-hidden py-1"
      aria-hidden="true"
    >
      {/* Edge fade left */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#050B09] to-transparent" />
      {/* Edge fade right */}
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#050B09] to-transparent" />

      <div className="marquee-track flex animate-marquee gap-3">
        {doubled.map((card, i) => (
          <div
            key={i}
            className={[
              'flex shrink-0 items-center gap-3 rounded-xl px-4 py-3',
              'border border-white/[0.06] bg-white/[0.025] backdrop-blur-sm',
              'shadow-[0_1px_2px_rgba(0,0,0,0.3)]',
            ].join(' ')}
          >
            <div className="h-1.5 w-1.5 rounded-full bg-teal-400/60" />
            <span className="whitespace-nowrap text-sm font-medium text-slate-300">
              {card.label}
            </span>
            <span className="whitespace-nowrap rounded-full border border-white/[0.06] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
              {card.sub}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleAudit = (domain: string) => {
    setLoading(true);
    router.push(`/audit/${encodeURIComponent(domain)}`);
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is SiteNexis?',
        acceptedAnswer: { '@type': 'Answer', text: 'SiteNexis is an AI Retrieval and Machine Trust Intelligence platform. It runs 16 autonomous agents across four dependency layers to model how AI systems retrieve, interpret, trust, and recommend web content — producing twelve intelligence scores, a Global Fix Plan, and a full PDF report in a single scan.' },
      },
      {
        '@type': 'Question',
        name: 'How does SiteNexis differ from traditional SEO tools?',
        acceptedAnswer: { '@type': 'Answer', text: 'Traditional SEO tools audit for human search engine bots. SiteNexis models the AI retrieval pipeline: chunk extraction, ranking pressure, summarization degradation, context truncation, answer formation, and citation eligibility filtering — the six stages where AI systems drop or include your content. It also measures Machine Trust (entity credibility, schema alignment, external validation, contradiction absence) and Recommendation Surface coverage across AI Overviews, chat, voice, and autonomous agent discovery.' },
      },
      {
        '@type': 'Question',
        name: 'What is the Global Fix Plan?',
        acceptedAnswer: { '@type': 'Answer', text: 'The Global Fix Plan aggregates every issue from all twelve intelligence modules into a single P0/P1/P2 priority queue. It maps cross-module dependency chains (schema must be fixed before trust scores improve, entity issues must resolve before citation probability improves), estimates effort hours per fix, and scores each item across three dimensions: SEO impact, AI Visibility impact, and Trust impact.' },
      },
      {
        '@type': 'Question',
        name: 'What is the Machine Trust Score?',
        acceptedAnswer: { '@type': 'Answer', text: 'The Machine Trust Score measures the confidence an AI system would have in using a domain as a reliable source. It is computed from five dimensions: entity credibility consistency (30%), schema trust alignment (20%), external validation depth (25%), contradiction absence (15%), and trust degradation resistance (10%). A low Machine Trust Score indicates that entity data conflicts, schema over-claims page content, or external validation sources are absent or broken.' },
      },
      {
        '@type': 'Question',
        name: 'What is the Information Gain Engine?',
        acceptedAnswer: { '@type': 'Answer', text: 'The Information Gain Engine measures what a page adds beyond what the top-ranking SERP results already cover. It collects the SERP cohort via Serper API, extracts entities, questions, and evidence from each result, and scores the target page on entity gaps filled, questions answered that the cohort does not answer, and evidence uniqueness. Pages with low information gain are adding little marginal value to the AI knowledge base.' },
      },
      {
        '@type': 'Question',
        name: 'What is the AI Visibility Score?',
        acceptedAnswer: { '@type': 'Answer', text: 'The AI Visibility Score is a 0–100 composite: Machine Readability (15%) + Entity Confidence (20%) + Retrieval Readiness (20%) + Citation Probability (20%) + Semantic Trust (15%) + Schema Completeness (10%). Every deduction maps to a named Issue with description, recommendation, and expected score impact. No black-box scoring.' },
      },
    ],
  };

  return (
    <main className="min-h-screen bg-midnight font-ui text-white antialiased">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <MarketingNav />

      {/* ── Cinematic Hero ────────────────────────────────────────────────── */}
      <HeroCinematic onSubmit={handleAudit} loading={loading} />

      {/* ── Intelligence rail ─────────────────────────────────────────────── */}
      <div className="border-y border-white/[0.05] bg-[#0A1628] py-5">
        <IntelligenceRail />
      </div>

      {/* ── Problem section ───────────────────────────────────────────────── */}
      <section className="py-32 px-6 bg-[#07111F]">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <Reveal>
              <div>
                <p className="mb-5 text-[11px] font-semibold tracking-[0.18em] text-cyan/70 uppercase">The Gap</p>
                <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em] text-white text-balance">
                  {"AI systems don't read pages."}
                  <br />
                  <span className="text-gradient-cyan">They retrieve, rank, and cite chunks.</span>
                </h2>
                <p className="mt-6 text-[16px] leading-[1.8] text-[#94A3B8]">
                  Your content is stripped of navigation, split into 300–600 token semantic units, embedded, ranked against competing chunks, compressed into a generated answer, and filtered for citation eligibility. That is six failure points before your name appears in an AI response.
                </p>
                <p className="mt-4 text-[16px] leading-[1.8] text-[#94A3B8]">
                  Traditional tools audit what humans see. SiteNexis audits what machines extract — running 16 autonomous agents across four dependency layers to model the complete AI retrieval and trust formation pipeline.
                </p>
                <div className="mt-10 flex items-center gap-4">
                  <a href="/signup" className="btn-primary px-6 py-3 text-sm font-semibold inline-flex items-center gap-2">
                    Start free audit <ArrowRight size={14} />
                  </a>
                  <a href="#features" className="text-sm text-slate-400 hover:text-white transition-colors duration-150">
                    See all modules →
                  </a>
                </div>
              </div>
            </Reveal>

            {/* Tool fragmentation visual */}
            <Reveal delay={0.15}>
              <div className="relative h-72 lg:h-80">
                {/* Fragmented tools */}
                {[
                  { label: 'Screaming Frog', x: '0%',  y: '5%',   size: 'sm', opacity: 0.35 },
                  { label: 'Ahrefs',         x: '60%', y: '0%',   size: 'sm', opacity: 0.3  },
                  { label: 'SEMrush',        x: '20%', y: '60%',  size: 'sm', opacity: 0.35 },
                  { label: 'PageSpeed',      x: '72%', y: '55%',  size: 'sm', opacity: 0.25 },
                  { label: 'Schema.org',     x: '5%',  y: '72%',  size: 'sm', opacity: 0.3  },
                  { label: 'Surfer SEO',     x: '45%', y: '75%',  size: 'sm', opacity: 0.25 },
                ].map((t, i) => (
                  <motion.div
                    key={t.label}
                    className="absolute rounded-button border border-white/[0.08] bg-[#0A1628] px-3 py-2 text-[11px] font-medium text-[#475569]"
                    style={{ left: t.x, top: t.y }}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: t.opacity, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 * i, duration: 0.5 }}
                    animate={mounted ? { y: [0, -4, 0] } : {}}
                  >
                    {t.label}
                  </motion.div>
                ))}
                {/* Converging arrows → SiteNexis */}
                <motion.div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                >
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-cyan/30 bg-[#07111F] shadow-cyan-glow">
                    <div className="absolute inset-2 rounded-full border border-cyan/15" />
                    <div className="absolute inset-4 rounded-full border border-cyan/10" />
                    <PentagonMark size={32} />
                  </div>
                  <p className="mt-2 text-center text-[11px] font-semibold text-cyan">SiteNexis</p>
                </motion.div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Intelligence layers ────────────────────────────────────────────── */}
      <section id="features" className="border-t border-white/[0.05] bg-[#0A1628] py-32 px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-16 text-center">
            <p className="mb-5 text-[11px] font-semibold tracking-[0.18em] text-cyan/70 uppercase">Intelligence Modules</p>
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em] text-white">
              Four intelligence layers.
              <br />
              <span className="text-slate-400 font-normal">All in one scan.</span>
            </h2>
          </Reveal>

          <motion.div
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            {[
              {
                icon: '⬡',
                label: 'SEO Intelligence',
                layer: 'Layer 1',
                color: 'cyan',
                body: 'Title, meta, canonicals, robots, sitemaps, broken links, crawlability signals.',
              },
              {
                icon: '◎',
                label: 'AI Readability',
                layer: 'Layer 2',
                color: 'teal',
                body: 'Chunk quality, entity clarity, conversational readiness, summarisability.',
              },
              {
                icon: '⬟',
                label: 'Schema Engine',
                layer: 'Layer 2',
                color: 'sapphire',
                body: 'Schema detection, field validation, auto-generated snippets, structured trust.',
              },
              {
                icon: '◈',
                label: 'Link Graph',
                layer: 'Layer 1',
                color: 'purple',
                body: 'Internal link topology, PageRank distribution, orphaned pages, anchor quality.',
              },
              {
                icon: '◐',
                label: 'Content Intelligence',
                layer: 'Layer 2',
                color: 'teal',
                body: 'Topical depth, entity coverage, citation readiness, semantic trust signals.',
              },
              {
                icon: '◆',
                label: 'Performance',
                layer: 'Layer 1',
                color: 'amber',
                body: 'Core Web Vitals, LCP, CLS, INP, TTFB, mobile performance benchmarks.',
              },
            ].map((card) => {
              const iconColor =
                card.color === 'cyan'     ? 'text-cyan'     :
                card.color === 'teal'     ? 'text-teal'     :
                card.color === 'sapphire' ? 'text-sapphire' :
                card.color === 'purple'   ? 'text-purple'   : 'text-amber';
              return (
                <motion.div
                  key={card.label}
                  variants={fadeUp}
                  className={`card-glow group relative flex flex-col gap-4 rounded-card border border-white/[0.06] bg-[#07111F] p-6`}
                >
                  {/* Top */}
                  <div className="flex items-start justify-between">
                    <span className={`text-2xl leading-none ${iconColor}`}>{card.icon}</span>
                    <span className="rounded-pill border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-[#475569] uppercase tracking-wide">
                      {card.layer}
                    </span>
                  </div>
                  <div>
                    <h3 className="mb-2 text-[15px] font-semibold tracking-tight text-white">{card.label}</h3>
                    <p className="text-[13px] leading-[1.75] text-slate-400">{card.body}</p>
                  </div>
                  {/* Hover glow accent line */}
                  <div className={`absolute inset-x-0 bottom-0 h-px rounded-b-card bg-gradient-to-r from-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300
                    ${card.color === 'cyan' ? 'via-cyan/40' : card.color === 'teal' ? 'via-teal/40' : card.color === 'sapphire' ? 'via-sapphire/40' : card.color === 'purple' ? 'via-purple/40' : 'via-amber/40'}
                    to-transparent`} />
                </motion.div>
              );
            })}
          </motion.div>

          {/* Layer 4 callout */}
          <Reveal className="mt-10">
            <div className="card-glow card-glow-purple relative overflow-hidden rounded-card border border-purple/[0.2] bg-[#07111F] p-8">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-purple/[0.04] via-transparent to-transparent" />
              <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-pill border border-purple/25 bg-purple/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-purple">Layer 4 — Machine Trust</span>
                    <span className="rounded-pill border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[10px] text-[#475569] uppercase">Pro+</span>
                  </div>
                  <h3 className="text-[17px] font-bold text-white">Retrieval Simulation · Machine Trust · Temporal Authority</h3>
                  <p className="mt-1.5 text-[14px] text-[#94A3B8]">Models how AI retrieval systems form, maintain, and decay trust in your content — from chunk extraction to recommendation surface presence.</p>
                </div>
                <a href="/signup?plan=pro" className="btn-primary shrink-0 px-6 py-3 text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap">
                  Unlock Layer 4 <ArrowRight size={14} />
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── AI Systems showcase ────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.05] bg-[#07111F] py-32 px-6 overflow-hidden">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-20 lg:grid-cols-2">
            {/* Left — copy */}
            <Reveal>
              <p className="mb-5 text-[11px] font-semibold tracking-[0.18em] text-cyan/70 uppercase">Surface Coverage</p>
              <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em] text-white text-balance">
                Four AI surfaces.
                <br />
                <span className="text-gradient-cyan">One coverage map.</span>
              </h2>
              <p className="mt-6 text-[16px] leading-[1.8] text-[#94A3B8]">
                Retrieval and recommendation are not the same thing. A page can score well on AI Visibility and still be absent from AI Overviews, chat responses, voice answers, and agent discovery. SiteNexis maps your inclusion probability across all four surfaces — and diagnoses exactly what is blocking each one.
              </p>
              <div className="mt-8 space-y-3">
                {[
                  { name: 'Google AI Overviews', score: 82, color: '#00C8FF' },
                  { name: 'ChatGPT (browsing)', score: 67, color: '#0BCEBC' },
                  { name: 'Perplexity',          score: 74, color: '#8B5CF6' },
                  { name: 'Claude (web search)', score: 91, color: '#3B82F6' },
                  { name: 'Gemini',              score: 58, color: '#F59E0B' },
                ].map(({ name, score, color }) => (
                  <div key={name}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[13px] text-[#94A3B8]">{name}</span>
                      <span className="text-[13px] font-semibold" style={{ color }}>{score}</span>
                    </div>
                    <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.05]">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: color }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${score}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-[11px] text-[#334155]">All surface scores are estimated from measurable content signals.</p>
            </Reveal>

            {/* Right — orbiting AI systems visual */}
            <Reveal delay={0.2}>
              <div className="relative flex h-80 items-center justify-center">
                {/* Centre hub */}
                <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full border border-cyan/30 bg-[#07111F] shadow-cyan-glow">
                  <div className="absolute inset-0 animate-pulse-slow rounded-full border border-cyan/15" />
                  <PentagonMark size={36} />
                </div>
                {/* Orbit rings */}
                <div className="absolute h-[200px] w-[200px] rounded-full border border-cyan/[0.08]" />
                <div className="absolute h-[300px] w-[300px] rounded-full border border-white/[0.04]" />
                {/* Orbiting entities — client-only to avoid SSR float precision mismatch */}
                {mounted && [
                  { label: 'ChatGPT',     color: '#10B981', deg: 0   },
                  { label: 'Gemini',      color: '#3B82F6', deg: 72  },
                  { label: 'Claude',      color: '#8B5CF6', deg: 144 },
                  { label: 'Perplexity',  color: '#0BCEBC', deg: 216 },
                  { label: 'AI Overview', color: '#00C8FF', deg: 288 },
                ].map(({ label, color, deg }, i) => {
                  const rad = (deg * Math.PI) / 180;
                  const r = 130;
                  const x = Math.round(Math.cos(rad) * r * 1000) / 1000;
                  const y = Math.round(Math.sin(rad) * r * 1000) / 1000;
                  return (
                    <motion.div
                      key={label}
                      className="absolute flex flex-col items-center gap-1"
                      style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, transform: 'translate(-50%,-50%)' }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.15 * i, duration: 0.5 }}
                      animate={mounted ? { y: [0, -4, 0] } : {}}
                    >
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full border text-[10px] font-bold text-white"
                        style={{ borderColor: `${color}40`, backgroundColor: `${color}12` }}
                      >
                        {label[0]}
                      </div>
                      <span className="text-[9px] text-[#475569] whitespace-nowrap">{label}</span>
                    </motion.div>
                  );
                })}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Interactive demo preview ───────────────────────────────────────── */}
      <section className="border-t border-white/[0.05] bg-[#0A1628] py-32 px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-16 text-center">
            <p className="mb-5 text-[11px] font-semibold tracking-[0.18em] text-cyan/70 uppercase">Intelligence Dashboard</p>
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em] text-white">
              {"One scan. Twelve scores."}
              <br />
              <span className="text-slate-400 font-normal">Complete explainability.</span>
            </h2>
          </Reveal>

          {/* Mock dashboard */}
          <Reveal delay={0.1}>
            <div className="overflow-hidden rounded-card border border-white/[0.08] bg-[#07111F] shadow-glass-lg">
              {/* Dashboard top bar */}
              <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <PentagonMark size={18} />
                    <span className="text-[13px] font-semibold text-white">SiteNexis</span>
                  </div>
                  <div className="hidden h-5 w-px bg-white/[0.06] md:block" />
                  <span className="hidden text-[12px] text-[#475569] md:block">example.com · Last scan 2 min ago</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-pill border border-success/20 bg-success/10 px-2.5 py-1 text-[10px] font-medium text-success">Complete</span>
                  <span className="text-[11px] text-[#334155]">16 agents · 142 pages</span>
                </div>
              </div>

              {/* Score gauges */}
              <div className="grid grid-cols-2 gap-px bg-white/[0.04] md:grid-cols-3 lg:grid-cols-6">
                {SCORES_PREVIEW.map(({ label, score, delta }) => {
                  const color = score >= 80 ? '#10B981' : score >= 60 ? '#0BCEBC' : score >= 40 ? '#F59E0B' : '#EF4444';
                  return (
                    <div key={label} className="flex flex-col items-center gap-2 bg-[#07111F] px-4 py-5">
                      <div className="relative h-14 w-14">
                        <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
                          <circle cx="28" cy="28" r="22" strokeWidth="4" fill="none" stroke="rgba(255,255,255,0.04)" />
                          <motion.circle
                            cx="28" cy="28" r="22" strokeWidth="4" fill="none"
                            stroke={color} strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 22}`}
                            initial={{ strokeDashoffset: 2 * Math.PI * 22 }}
                            whileInView={{ strokeDashoffset: 2 * Math.PI * 22 * (1 - score / 100) }}
                            viewport={{ once: true }}
                            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[15px] font-bold text-white">{score}</span>
                      </div>
                      <span className="text-center text-[10px] leading-tight text-[#475569]">{label}</span>
                      <span className="text-[10px] font-medium text-success/80">{delta}</span>
                    </div>
                  );
                })}
              </div>

              {/* Issue feed preview */}
              <div className="border-t border-white/[0.05] px-6 py-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#94A3B8] uppercase tracking-wide">Critical Issues</span>
                  <span className="rounded-pill bg-critical/10 border border-critical/20 px-2.5 py-1 text-[10px] font-medium text-critical">3 critical</span>
                </div>
                <div className="space-y-2.5">
                  {[
                    { sev: 'critical', title: 'Primary entity definition missing across 47 pages', impact: 'AI Visibility −18pts' },
                    { sev: 'critical', title: 'No sameAs validation — external trust signals absent', impact: 'Machine Trust −15pts' },
                    { sev: 'warning',  title: '12 pages lack structured data — retrieval risk', impact: 'Retrieval Score −8pts' },
                  ].map(({ sev, title, impact }, i) => (
                    <motion.div
                      key={i}
                      className="flex items-start gap-3 rounded-button border border-white/[0.04] bg-white/[0.02] px-4 py-3"
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.1 * i, duration: 0.4 }}
                    >
                      <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${sev === 'critical' ? 'badge-critical' : 'badge-warning'}`}>{sev}</span>
                      <span className="flex-1 text-[12px] text-[#94A3B8]">{title}</span>
                      <span className="shrink-0 text-[10px] font-medium text-[#475569]">{impact}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Live Audit Reports (demo showcase) ─────────────────────────────── */}
      <section className="border-t border-white/[0.05] bg-[#07111F] py-32 px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-16 text-center">
            <p className="mb-5 text-[11px] font-semibold tracking-[0.18em] text-cyan/70 uppercase">Live Audit Reports</p>
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em] text-white">
              See real results.
              <br />
              <span className="text-slate-400 font-normal">Before you run your own.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-[16px] leading-[1.8] text-[#94A3B8]">
              Explore full audit reports for real domains — every score, every issue, every recommendation — exactly as you will receive them.
            </p>
          </Reveal>

          <motion.div
            className="grid gap-5 md:grid-cols-2 lg:grid-cols-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            {[
              { domain: 'genshipyard.com', label: 'GenShipyard', desc: 'AI company website', icon: '🚀' },
              { domain: 'alwajudproperties.com', label: 'Alwajud Properties', desc: 'Real estate portfolio', icon: '🏢' },
              { domain: 'inforsphere.com', label: 'InforSphere', desc: 'Tech & information', icon: '🌐' },
              { domain: 'community.genhub.fun', label: 'GenHub Community', desc: 'Community platform', icon: '👥' },
            ].map((site) => (
              <motion.div
                key={site.domain}
                variants={fadeUp}
                className="card-glow group relative flex flex-col rounded-card border border-white/[0.06] bg-[#0A1628] p-6 transition-all duration-300 hover:border-cyan/20"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-lg">
                    {site.icon}
                  </span>
                  <div>
                    <h3 className="text-[14px] font-semibold text-white">{site.label}</h3>
                    <p className="text-[11px] text-slate-500">{site.desc}</p>
                  </div>
                </div>
                <p className="mb-5 text-[12px] text-slate-400 leading-relaxed">
                  Full 12-score audit with entity intelligence, machine trust, retrieval simulation, and fix plan.
                </p>
                <Link
                  href={`/audit/${encodeURIComponent(site.domain)}?demo=true`}
                  className="mt-auto inline-flex items-center gap-2 rounded-button border border-cyan/20 bg-cyan/[0.07] px-4 py-2.5 text-[13px] font-semibold text-cyan transition-all duration-200 hover:bg-cyan/[0.14] hover:border-cyan/30"
                >
                  View full report <ArrowRight size={13} />
                </Link>
              </motion.div>
            ))}
          </motion.div>

          <Reveal className="mt-8 text-center">
            <p className="text-[12px] text-slate-500">
              These are real audits run by SiteNexis — scores, issues, and recommendations are generated from live site data.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Score preview ─────────────────────────────────────────────────── */}
      <section className="py-32 px-6 bg-[#07111F]">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-16 lg:grid-cols-2">

            {/* Left — copy */}
            <Reveal>
              <div className="max-w-md">
                <p className="mb-4 text-[11px] font-medium tracking-[0.14em] text-slate-400 uppercase">
                  Intelligence Scoring
                </p>
                <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em] text-white">
                  Twelve scores.
                  <br />
                  <span className="text-slate-400 font-[350]">Every one explainable.</span>
                </h2>
                <p className="mt-5 text-[15px] leading-[1.75] text-slate-500">
                  Every deduction maps to a named, actionable issue. No composite
                  score without a sub-score breakdown. No black boxes.
                </p>
                <div className="mt-8 flex flex-col gap-3">
                  {['Layer 1 — Crawl & Structure', 'Layer 2 — Semantic Intelligence', 'Layer 3 — AI Visibility', 'Layer 4 — Machine Trust'].map((layer, i) => (
                    <div key={layer} className="flex items-center gap-3">
                      <div
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/[0.07] text-[10px] font-bold text-slate-500"
                      >
                        {i + 1}
                      </div>
                      <span className="text-[13px] text-slate-400">{layer.split(' — ')[1]}</span>
                    </div>
                  ))}
                </div>
                <a
                  href="/signup"
                  className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors duration-150 hover:text-white"
                >
                  View full score breakdown
                  <ArrowRight size={14} strokeWidth={2} />
                </a>
              </div>
            </Reveal>

            {/* Right — score card */}
            <Reveal delay={0.15}>
              <div
                className={[
                  'card-glow card-glow-teal rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6',
                  'shadow-[0_4px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04)]',
                  'backdrop-blur-xl',
                ].join(' ')}
              >
                {/* Card header */}
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">example.com</p>
                    <p className="mt-0.5 text-[10px] tracking-wide text-slate-700 uppercase">
                      Last audited 2 min ago
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
                    <span className="text-lg font-bold text-white">74</span>
                  </div>
                </div>

                {/* Score bars */}
                <div className="flex flex-col gap-4">
                  {SCORES_PREVIEW.map((s) => (
                    <ScoreBar key={s.label} {...s} />
                  ))}
                </div>

                {/* Footer */}
                <div className="mt-6 flex items-center justify-between border-t border-white/[0.04] pt-4">
                  <span className="text-[11px] text-slate-600">12 issues detected</span>
                  <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-400 border border-amber-500/[0.15]">
                    3 critical
                  </span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Methodology section ───────────────────────────────────────────── */}
      <section id="methodology" className="border-t border-white/[0.05] bg-[#07111F] py-32 px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-16 text-center">
            <p className="mb-5 text-[11px] font-semibold tracking-[0.18em] text-cyan/70 uppercase">Methodology</p>
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em] text-white">
              How SiteNexis works.
              <br />
              <span className="text-slate-400 font-normal">Every step, every agent, every score.</span>
            </h2>
          </Reveal>

          {/* Pipeline steps */}
          <div className="grid gap-5 md:grid-cols-2">
            {[
              {
                step: '01',
                heading: 'Full-Site Crawl',
                body: 'The Crawl Agent renders every page with Puppeteer, strips navigation and boilerplate, extracts semantic chunks of 300–600 tokens, and pre-identifies entities. Up to 500 pages per audit. Respects robots.txt.',
                color: '#00C8FF',
              },
              {
                step: '02',
                heading: 'Parallel Layer 1–2 Analysis',
                body: 'Six agents run simultaneously: SEO (title, meta, canonicals, sitemaps), Schema (structured data validation), AI Readability (chunk quality, extractability), Entity Intelligence (consistency, disambiguation), Citation Probability (7-factor weighted score), and Semantic Trust (contradiction detection via Claude API on top 20 pages).',
                color: '#0BCEBC',
              },
              {
                step: '03',
                heading: 'Layer 3 AI Visibility Scoring',
                body: 'AI Visibility Score = Machine Readability × 15% + Entity Confidence × 20% + Retrieval Readiness × 20% + Citation Probability × 20% + Semantic Trust × 15% + Schema Completeness × 10%. The AI Perception Graph is built from entity relationships and typed connections. Every deduction maps to a named, actionable Issue.',
                color: '#8B5CF6',
              },
              {
                step: '04',
                heading: 'Layer 4 Machine Trust (Pro+)',
                body: 'Five Layer 4 agents run in parallel after Layers 1–3 complete. Retrieval Simulation models 6 stages on top 30 pages by PageRank. Machine Trust scores entity credibility, schema alignment, external validation, contradiction absence, and decay signals. Temporal Authority tracks velocity and drift across audits. Recommendation Mapping scores inclusion probability across four AI surfaces. Synthetic Entity Detection identifies manufactured authority patterns.',
                color: '#F59E0B',
              },
              {
                step: '05',
                heading: 'Information Gain + Scout',
                body: 'The Information Gain Engine fetches the SERP cohort via Serper API and measures what your content adds that the top results do not already cover — entity gaps, question gaps, evidence uniqueness. Scout classifies every page by query intent (informational, commercial, research, voice, agent) and scores structural alignment between intent and page signals.',
                color: '#0BCEBC',
              },
              {
                step: '06',
                heading: 'Global Fix Plan + Reports',
                body: 'The Fix Plan aggregates every issue from all 12 modules into a single P0/P1/P2 queue with cross-module dependency chains, effort estimation, and three-dimension impact scoring (SEO / AI Visibility / Trust). The Reporting Agent generates a full PDF with all scores, issues, and recommendations. Every API route returns a GTL state envelope: complete, partial, or empty.',
                color: '#00C8FF',
              },
            ].map(({ step, heading, body, color }) => (
              <Reveal key={step}>
                <div className="flex gap-5 rounded-xl border border-white/[0.06] bg-[#0A1628] p-6">
                  <div className="shrink-0">
                    <span className="block h-8 w-8 rounded-lg text-center text-[11px] font-bold leading-8 border border-white/[0.07] bg-white/[0.03]" style={{ color }}>{step}</span>
                  </div>
                  <div>
                    <h3 className="mb-2 text-[15px] font-semibold text-white">{heading}</h3>
                    <p className="text-[13px] leading-[1.75] text-[#4A6280]">{body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-8 text-center">
            <a href="/methodology" className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors duration-150">
              Read the full methodology <ArrowRight size={13} />
            </a>
          </Reveal>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────────── */}
      <section id="pricing" className="border-t border-white/[0.05] bg-[#07111F] py-32 px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-16 text-center">
            <p className="mb-5 text-[11px] font-semibold tracking-[0.18em] text-cyan/70 uppercase">Pricing</p>
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em] text-white">
              Start free.
              <br />
              <span className="text-slate-400 font-normal">Scale with intelligence.</span>
            </h2>
          </Reveal>

          <motion.div
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            {PRICING.map((plan) => (
              <motion.div
                key={plan.name}
                variants={fadeUp}
                className={[
                  'card-glow relative flex flex-col rounded-card p-6',
                  plan.pro
                    ? 'card-glow-border border border-cyan/[0.25] bg-[#0A1628] shadow-[0_0_48px_rgba(0,200,255,0.08),inset_0_1px_0_rgba(0,200,255,0.08)] animate-glow-pulse'
                    : 'border border-white/[0.06] bg-[#0A1628]',
                ].join(' ')}
              >
                {plan.pro && (
                  <div className="absolute inset-x-6 -top-px h-px bg-gradient-to-r from-transparent via-cyan/50 to-transparent" />
                )}
                <div className="mb-6">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{plan.name}</span>
                    {plan.pro && (
                      <span className="rounded-pill border border-cyan/25 bg-cyan/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-cyan uppercase">
                        Most Popular
                      </span>
                    )}
                  </div>
                  <p className="mt-3 flex items-baseline gap-1">
                    <span className="text-[32px] font-bold tracking-tight text-white">{plan.price}</span>
                    {plan.period && <span className="text-sm text-[#475569]">{plan.period}</span>}
                  </p>
                  <p className="mt-1 text-[12px] text-slate-400">{plan.desc}</p>
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04]">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: plan.pro ? '#00C8FF' : '#334155' }} />
                      </span>
                      <span className="text-[13px] text-slate-400">{f}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={plan.href}
                  className={[
                    'block w-full rounded-button py-3 text-center text-[13px] font-semibold transition-all duration-200',
                    plan.pro
                      ? 'btn-primary'
                      : 'btn-ghost',
                  ].join(' ')}
                >
                  {plan.cta}
                </a>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Intelligence Suite ────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.05] bg-[#0A1628] py-32 px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-16 text-center">
            <p className="mb-5 text-[11px] font-semibold tracking-[0.18em] text-cyan/70 uppercase">Product Suite</p>
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em] text-white">
              Two platforms.
              <br />
              <span className="text-slate-400 font-normal">One intelligence suite.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[16px] leading-[1.8] text-[#94A3B8]">
              SiteNexis models how AI systems retrieve and trust your content.
              AdNexis models what creative drives conversion when they do.
              Together, they cover the full signal-to-conversion pipeline.
            </p>
          </Reveal>

          <div className="grid gap-5 md:grid-cols-2">

            {/* SiteNexis card */}
            <Reveal delay={0}>
              <div className="card-glow relative flex h-full flex-col overflow-hidden rounded-card border border-cyan/[0.15] bg-[#07111F] p-8">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan/[0.04] via-transparent to-transparent" />
                <div className="relative flex-1">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan/20 bg-cyan/[0.08]">
                      <PentagonMark size={20} />
                    </div>
                    <div>
                      <h3 className="text-[17px] font-bold text-white">SiteNexis</h3>
                      <p className="text-[11px] text-cyan/70">AI Retrieval & Machine Trust Intelligence</p>
                    </div>
                    <span className="ml-auto rounded-pill border border-cyan/20 bg-cyan/[0.07] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-cyan">You are here</span>
                  </div>
                  <p className="mb-6 text-[14px] leading-[1.75] text-[#94A3B8]">
                    Models how AI systems retrieve, interpret, trust, and recommend your website — across all four intelligence layers from crawl structure to machine trust formation.
                  </p>
                  <ul className="space-y-2.5">
                    {[
                      'Machine Trust Score — 5-dimension trust model',
                      'Entity Intelligence — consistency + disambiguation',
                      'Retrieval Simulation — 6-stage pipeline modeling',
                      'Recommendation Surfaces — AI Overviews, chat, voice, agents',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-[13px] text-slate-400">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan/40" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative mt-8 border-t border-white/[0.05] pt-6">
                  <a
                    href="/signup"
                    className="inline-flex items-center gap-2 rounded-button border border-cyan/20 bg-cyan/[0.07] px-5 py-2.5 text-[13px] font-semibold text-cyan transition-all duration-200 hover:bg-cyan/[0.12] hover:border-cyan/30"
                  >
                    Run your first audit <ArrowRight size={13} />
                  </a>
                </div>
              </div>
            </Reveal>

            {/* AdNexis card */}
            <Reveal delay={0.12}>
              <div className="card-glow relative flex h-full flex-col overflow-hidden rounded-card border border-[#6C3EFF]/[0.2] bg-[#07111F] p-8">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#6C3EFF]/[0.05] via-transparent to-transparent" />
                <div className="relative flex-1">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#6C3EFF]/25 bg-[#6C3EFF]/[0.1]">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="#6C3EFF" strokeWidth="1.4" fill="rgba(108,62,255,0.12)" />
                        <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="#6C3EFF" strokeWidth="1.4" fill="rgba(108,62,255,0.07)" />
                        <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="#6C3EFF" strokeWidth="1.4" fill="rgba(108,62,255,0.07)" />
                        <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="#00D4AA" strokeWidth="1.4" fill="rgba(0,212,170,0.07)" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-[17px] font-bold text-white">AdNexis</h3>
                      <p className="text-[11px] text-[#6C3EFF]/80">AI Creative Intelligence</p>
                    </div>
                    <span className="ml-auto rounded-pill border border-[#6C3EFF]/20 bg-[#6C3EFF]/[0.07] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#9B77FF]">New</span>
                  </div>
                  <p className="mb-6 text-[14px] leading-[1.75] text-[#94A3B8]">
                    Deconstructs top-performing ads with AI to extract what makes them convert — then generates platform-specific creative variations in seconds.
                  </p>
                  <ul className="space-y-2.5">
                    {[
                      'Hook Intelligence — classify, score, and rank ad hooks',
                      'Full Ad Analysis — funnel stage, CTA, emotion, audience',
                      'Swipe Vault — your AI-analysed ad library',
                      'Creative Generation — variations for Meta, TikTok, YouTube',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-[13px] text-slate-400">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#6C3EFF]/50" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative mt-8 border-t border-white/[0.05] pt-6">
                  <a
                    href="https://adnexis-ai.vercel.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-button border border-[#6C3EFF]/25 bg-[#6C3EFF]/[0.1] px-5 py-2.5 text-[13px] font-semibold text-[#9B77FF] transition-all duration-200 hover:bg-[#6C3EFF]/[0.16] hover:border-[#6C3EFF]/35"
                  >
                    Try AdNexis free
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M2 10L10 2M10 2H5M10 2V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <Reveal>
        <section className="border-t border-white/[0.05] bg-[#0A1628] py-32 px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-5 text-[11px] font-semibold tracking-[0.18em] text-cyan/70 uppercase">Get Started Free</p>
            <h2 className="text-[clamp(2rem,4vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-white">
              See what AI systems
              <br />
              <span className="text-gradient-cyan">actually extract from your site.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-md text-[16px] leading-relaxed text-[#94A3B8]">
              16 agents. 12 intelligence scores. A Global Fix Plan with P0/P1/P2 priorities. One audit — free, no account required.
            </p>
            <div className="mt-10 mx-auto max-w-lg">
              <AuditInput onSubmit={handleAudit} loading={loading} />
            </div>
            <p className="mt-4 text-[11px] text-[#334155]">Layer 4 Machine Trust analysis requires Pro plan or above.</p>
          </div>
        </section>
      </Reveal>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05] bg-[#07111F] px-6 py-16">
        <div className="mx-auto max-w-7xl md:px-4">
          <div className="flex flex-col justify-between gap-12 md:flex-row">
            <div className="max-w-xs">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.03]">
                  <PentagonMark size={16} />
                </div>
                <span className="text-[15px] font-bold tracking-tight text-white">SiteNexis</span>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-[#334155]">
                AI Retrieval + Machine Trust Intelligence Platform.
                <br />
                Built for the machine-first web.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <a
                  href="https://x.com/Sitenexis"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="SiteNexis on X"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[13px] text-[#475569] transition-colors hover:border-white/[0.15] hover:text-white"
                >
                  𝕏
                </a>
                <a
                  href="https://www.linkedin.com/in/sitenexis"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="SiteNexis on LinkedIn"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[11px] font-bold text-[#475569] transition-colors hover:border-blue-500/30 hover:text-blue-400"
                >
                  in
                </a>
                <a
                  href="mailto:sitenexisintel@gmail.com"
                  title="Email SiteNexis"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[11px] text-[#475569] transition-colors hover:border-teal-500/30 hover:text-teal-400"
                >
                  @
                </a>
              </div>
            </div>

            <div className="flex flex-wrap gap-12 text-[13px]">
              {/* Products column */}
              <div>
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-[#334155]">Products</p>
                <ul className="space-y-3">
                  <li>
                    <Link href="/" className="text-[#475569] transition-colors duration-150 hover:text-[#94A3B8]">SiteNexis</Link>
                  </li>
                  <li>
                    <a href="https://adnexis-ai.vercel.app" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[#475569] transition-colors duration-150 hover:text-[#9B77FF]">
                      AdNexis
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true" className="opacity-50">
                        <path d="M1.5 7.5L7.5 1.5M7.5 1.5H3.5M7.5 1.5V5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </a>
                  </li>
                </ul>
              </div>

              {[
                { heading: 'Product',    links: [['Features', '#features'], ['Pricing', '#pricing'], ['Changelog', '/changelog'], ['Status', '/status']] },
                { heading: 'Developers',links: [['Docs', '/docs'], ['API', '/api'], ['Blog', '/blog']] },
                { heading: 'Company',   links: [['About', '/about'], ['Privacy', '/privacy'], ['Terms', '/terms'], ['Contact', 'mailto:sitenexisintel@gmail.com']] },
              ].map(({ heading, links }) => (
                <div key={heading}>
                  <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-[#334155]">{heading}</p>
                  <ul className="space-y-3">
                    {links.map(([label, href]) => (
                      <li key={label}>
                        <a href={href} className="text-[#475569] transition-colors duration-150 hover:text-[#94A3B8]">{label}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/[0.04] pt-8 md:flex-row">
            <p className="text-[12px] text-[#1E293B]">© {new Date().getFullYear()} SiteNexis. All rights reserved.</p>
            <div className="flex items-center gap-4 text-[12px] text-[#1E293B]">
              <a href="https://x.com/Sitenexis" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[#475569]">@Sitenexis</a>
              <a href="mailto:sitenexisintel@gmail.com" className="transition-colors hover:text-[#475569]">sitenexisintel@gmail.com</a>
            </div>
          </div>
        </div>
      </footer>

    </main>
  );
}
