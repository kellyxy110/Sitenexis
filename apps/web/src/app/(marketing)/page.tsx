'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useInView, type Variants } from 'framer-motion';
import { ArrowRight, Globe } from 'lucide-react';
import { HeroCinematic } from '@/components/hero/HeroCinematic';

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
  { label: 'AI Visibility',       sub: 'Layer 3' },
  { label: 'Retrieval Readiness', sub: 'Layer 3' },
  { label: 'Entity Intelligence', sub: 'Layer 2' },
  { label: 'Semantic Trust',      sub: 'Layer 2' },
  { label: 'Citation Readiness',  sub: 'Layer 2' },
  { label: 'Machine Readability', sub: 'Layer 2' },
  { label: 'AI Extractability',   sub: 'Layer 2' },
  { label: 'Schema Intelligence', sub: 'Layer 1' },
  { label: 'Machine Trust',       sub: 'Layer 4' },
  { label: 'Temporal Authority',  sub: 'Layer 4' },
  { label: 'Surface Mapping',     sub: 'Layer 4' },
];

const SCORES_PREVIEW = [
  { label: 'AI Visibility',    score: 74, delta: '+12' },
  { label: 'Entity Trust',     score: 61, delta: '+8'  },
  { label: 'Retrieval Ready',  score: 88, delta: '+3'  },
  { label: 'Machine Trust',    score: 52, delta: '+21' },
  { label: 'Citation Score',   score: 79, delta: '+6'  },
];

const CAPABILITIES = [
  {
    heading: 'Retrieval Simulation',
    body: 'Models how AI systems extract, chunk, rank, and compress your content across six retrieval stages — identifying exactly where meaning degrades.',
    layer: 'Layer 4',
  },
  {
    heading: 'Entity Intelligence',
    body: 'Maps every named entity across your domain and scores consistency, disambiguation, and external validation signal depth.',
    layer: 'Layer 2',
  },
  {
    heading: 'Machine Trust Scoring',
    body: 'Computes the trust state of your domain from an AI perspective: credibility consistency, schema alignment, contradiction detection, and decay signals.',
    layer: 'Layer 4',
  },
  {
    heading: 'Citation Probability',
    body: 'Scores the likelihood an AI system selects your content as a citation source — factual density, claim specificity, and authority signal depth.',
    layer: 'Layer 2',
  },
  {
    heading: 'Semantic Trust Layer',
    body: 'Analyses authorship trust, organisational trust, structural trust, and content trust — detecting contradictions across pages via Claude API.',
    layer: 'Layer 2',
  },
  {
    heading: 'Recommendation Surfaces',
    body: 'Maps your visibility across AI Overviews, chat-based retrieval, voice assistants, and autonomous agent discovery — surface by surface.',
    layer: 'Layer 4',
  },
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

  return (
    <main className="min-h-screen bg-midnight font-ui text-white antialiased">

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50">
        <div
          className={[
            'border-b border-white/[0.05]',
            'bg-midnight/90 backdrop-blur-xl',
          ].join(' ')}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10 md:py-5">

            {/* Logo */}
            <a
              href="/"
              className="flex items-center gap-2.5 group"
              aria-label="SiteNexis home"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm transition-colors duration-200 group-hover:border-white/[0.14]">
                <PentagonMark size={16} />
              </div>
              <span className="text-[15px] font-semibold tracking-[-0.01em] text-white">
                SiteNexis
              </span>
            </a>

            {/* Links */}
            <nav className="hidden items-center gap-7 md:flex" aria-label="Main navigation">
              {['Platform', 'Pricing', 'Docs', 'Blog'].map((label) => (
                <a
                  key={label}
                  href={label === 'Pricing' ? '#pricing' : `/${label.toLowerCase()}`}
                  className="text-sm text-slate-400 transition-colors duration-150 hover:text-slate-200"
                >
                  {label}
                </a>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <a
                href="/login"
                className="hidden text-sm text-slate-400 transition-colors duration-150 hover:text-slate-200 sm:block"
              >
                Log in
              </a>
              <a
                href="/signup"
                className={[
                  'rounded-lg border border-white/[0.12] bg-white/[0.05] px-4 py-2 text-sm font-medium text-white',
                  'transition-all duration-200 hover:border-white/[0.2] hover:bg-white/[0.08]',
                  'backdrop-blur-sm',
                ].join(' ')}
              >
                Get started
              </a>
            </div>
          </div>
        </div>
      </header>

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
                <p className="mb-5 text-[11px] font-semibold tracking-[0.18em] text-cyan/70 uppercase">The Problem</p>
                <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em] text-white text-balance">
                  {"You're using 6 tools."}
                  <br />
                  <span className="text-gradient-cyan">We built one brain.</span>
                </h2>
                <p className="mt-6 text-[16px] leading-[1.8] text-[#94A3B8]">
                  SEO tools miss AI readiness. AI tools miss technical structure. Schema validators miss entity consistency.
                  None of them model how AI systems actually retrieve and trust your content.
                </p>
                <p className="mt-4 text-[16px] leading-[1.8] text-[#94A3B8]">
                  SiteNexis runs all 16 intelligence agents in a single scan, across all 4 layers simultaneously.
                </p>
                <div className="mt-10 flex items-center gap-4">
                  <a href="/signup" className="btn-primary px-6 py-3 text-sm font-semibold inline-flex items-center gap-2">
                    Start free audit <ArrowRight size={14} />
                  </a>
                  <a href="#features" className="text-sm text-[#64748B] hover:text-white transition-colors duration-150">
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
              Six intelligence layers.
              <br />
              <span className="text-[#64748B] font-normal">All in one scan.</span>
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
              const borderColor =
                card.color === 'cyan'    ? 'group-hover:border-cyan/30 group-hover:shadow-[0_0_32px_rgba(0,200,255,0.07)]' :
                card.color === 'teal'    ? 'group-hover:border-teal/30 group-hover:shadow-[0_0_32px_rgba(11,206,188,0.07)]' :
                card.color === 'sapphire'? 'group-hover:border-sapphire/30 group-hover:shadow-[0_0_32px_rgba(59,130,246,0.07)]' :
                card.color === 'purple'  ? 'group-hover:border-purple/30 group-hover:shadow-[0_0_32px_rgba(139,92,246,0.07)]' :
                                           'group-hover:border-amber/30 group-hover:shadow-[0_0_32px_rgba(245,158,11,0.07)]';
              const iconColor =
                card.color === 'cyan'     ? 'text-cyan'     :
                card.color === 'teal'     ? 'text-teal'     :
                card.color === 'sapphire' ? 'text-sapphire' :
                card.color === 'purple'   ? 'text-purple'   : 'text-amber';
              return (
                <motion.div
                  key={card.label}
                  variants={fadeUp}
                  className={`group relative flex flex-col gap-4 rounded-card border border-white/[0.06] bg-[#07111F] p-6 transition-all duration-300 ${borderColor}`}
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
                    <p className="text-[13px] leading-[1.75] text-[#64748B]">{card.body}</p>
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
            <div className="relative overflow-hidden rounded-card border border-purple/[0.2] bg-[#07111F] p-8">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-purple/[0.04] via-transparent to-transparent" />
              <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-pill border border-purple/25 bg-purple/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-purple">Layer 4 — Machine Trust</span>
                    <span className="rounded-pill border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[10px] text-[#475569] uppercase">Pro+</span>
                  </div>
                  <h3 className="text-[17px] font-bold text-white">Retrieval Simulation · Machine Trust · Temporal Authority</h3>
                  <p className="mt-1.5 text-[14px] text-[#64748B]">The only platform that models how AI retrieval systems actually trust and recommend your content over time.</p>
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
              <p className="mb-5 text-[11px] font-semibold tracking-[0.18em] text-cyan/70 uppercase">AI Readiness</p>
              <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em] text-white text-balance">
                How visible are you
                <br />
                <span className="text-gradient-cyan">to every AI system?</span>
              </h2>
              <p className="mt-6 text-[16px] leading-[1.8] text-[#94A3B8]">
                SiteNexis models your content against five major AI retrieval surfaces — showing exactly where you appear, where you're missing, and why.
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
              <span className="text-[#64748B] font-normal">Complete explainability.</span>
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

      {/* ── Score preview ─────────────────────────────────────────────────── */}
      <section className="py-32 px-6 bg-[#07111F]">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-16 lg:grid-cols-2">

            {/* Left — copy */}
            <Reveal>
              <div className="max-w-md">
                <p className="mb-4 text-[11px] font-medium tracking-[0.14em] text-slate-600 uppercase">
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
                  'rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6',
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

      {/* ── Capabilities (hidden — replaced by Intelligence Layers above) ── */}
      <section id="features-legacy" className="hidden border-t border-white/[0.04] bg-[#050B09] py-32 px-6">
        <div className="mx-auto max-w-6xl">

          <Reveal className="mb-16 max-w-xl">
            <p className="mb-4 text-[11px] font-medium tracking-[0.14em] text-slate-600 uppercase">
              Intelligence Modules
            </p>
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.03em] text-white">
              Built for the
              <br />
              <span className="text-slate-400 font-[350]">machine-first web.</span>
            </h2>
          </Reveal>

          <motion.div
            className="grid gap-px border border-white/[0.05] rounded-2xl overflow-hidden bg-white/[0.03]"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            {CAPABILITIES.map((cap) => (
              <motion.div
                key={cap.heading}
                variants={fadeUp}
                className={[
                  'group relative flex flex-col gap-3 bg-[#050B09] p-7',
                  'transition-colors duration-200 hover:bg-[#081410]',
                  'md:flex-row md:items-start md:gap-8',
                ].join(' ')}
              >
                <div className="shrink-0 pt-0.5">
                  <span
                    className={[
                      'inline-block rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-wide uppercase',
                      cap.layer === 'Layer 4'
                        ? 'border-teal-500/20 bg-teal-500/[0.08] text-teal-400/80'
                        : cap.layer === 'Layer 3'
                        ? 'border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400/70'
                        : 'border-white/[0.07] bg-white/[0.03] text-slate-600',
                    ].join(' ')}
                  >
                    {cap.layer}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="mb-2 text-[15px] font-semibold tracking-[-0.01em] text-white">
                    {cap.heading}
                  </h3>
                  <p className="text-[13px] leading-[1.75] text-slate-500">
                    {cap.body}
                  </p>
                </div>
                <ArrowRight
                  size={14}
                  strokeWidth={1.5}
                  className="absolute right-6 top-7 text-slate-700 opacity-0 transition-opacity duration-200 group-hover:opacity-100 md:static md:shrink-0 md:self-start md:mt-1"
                />
              </motion.div>
            ))}
          </motion.div>
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
              <span className="text-[#64748B] font-normal">Scale with intelligence.</span>
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
                  'relative flex flex-col rounded-card p-6 transition-all duration-300',
                  plan.pro
                    ? 'border border-cyan/[0.25] bg-[#0A1628] shadow-[0_0_48px_rgba(0,200,255,0.08),inset_0_1px_0_rgba(0,200,255,0.08)] animate-glow-pulse'
                    : 'border border-white/[0.06] bg-[#0A1628] hover:border-white/[0.12] hover:bg-[#111827]',
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
                  <p className="mt-1 text-[12px] text-[#475569]">{plan.desc}</p>
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04]">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: plan.pro ? '#00C8FF' : '#334155' }} />
                      </span>
                      <span className="text-[13px] text-[#64748B]">{f}</span>
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

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <Reveal>
        <section className="border-t border-white/[0.05] bg-[#0A1628] py-32 px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-5 text-[11px] font-semibold tracking-[0.18em] text-cyan/70 uppercase">Get Started</p>
            <h2 className="text-[clamp(2rem,4vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-white">
              See how AI reads
              <br />
              <span className="text-gradient-cyan">your website.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-sm text-[16px] leading-relaxed text-[#64748B]">
              Free scan. No account required. Results in 60 seconds.
            </p>
            <div className="mt-10 mx-auto max-w-lg">
              <AuditInput onSubmit={handleAudit} loading={loading} />
            </div>
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
            </div>

            <div className="flex flex-wrap gap-12 text-[13px]">
              {[
                { heading: 'Product',    links: [['Features', '#features'], ['Pricing', '#pricing'], ['Changelog', '/changelog'], ['Status', '/status']] },
                { heading: 'Developers',links: [['Docs', '/docs'], ['API', '/api'], ['Blog', '/blog']] },
                { heading: 'Company',   links: [['About', '/about'], ['Privacy', '/privacy'], ['Terms', '/terms']] },
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
            <p className="text-[12px] text-[#1E293B]">Built for the machine-first web.</p>
          </div>
        </div>
      </footer>

    </main>
  );
}
