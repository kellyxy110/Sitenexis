'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import {
  Brain, Layers, Shield, Zap, Globe, Network,
  Eye, BookOpen, TrendingUp, Search, Award, Cpu,
  ArrowRight, ChevronRight,
} from 'lucide-react'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { Footer } from '@/components/marketing/Footer'

// ── Shared primitives ─────────────────────────────────────────────────────────

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  )
}


// ── Layer data ────────────────────────────────────────────────────────────────

const LAYERS = [
  {
    num: 4, label: 'Machine Trust Layer', color: 'from-cyan-500 to-teal-500', glow: 'rgba(0,200,255,0.15)',
    border: 'border-cyan-500/20', bg: 'bg-cyan-500/5',
    desc: 'Models how AI systems form, maintain, and lose trust in your content over time.',
    modules: ['Retrieval Simulation', 'Machine Trust Scoring', 'Temporal Authority', 'Recommendation Surface Mapping', 'Synthetic Entity Detection'],
  },
  {
    num: 3, label: 'AI Visibility Layer', color: 'from-teal-500 to-emerald-500', glow: 'rgba(11,206,188,0.15)',
    border: 'border-teal-500/20', bg: 'bg-teal-500/5',
    desc: 'Scores citation probability, AI extractability, retrieval readiness, and recommendation confidence.',
    modules: ['AI Visibility Score', 'Retrieval Readiness', 'Citation Probability', 'Semantic Trust', 'Recommendation Confidence'],
  },
  {
    num: 2, label: 'Semantic Intelligence Layer', color: 'from-blue-500 to-indigo-500', glow: 'rgba(99,102,241,0.15)',
    border: 'border-blue-500/20', bg: 'bg-blue-500/5',
    desc: 'Extracts and scores every named entity, relationship, and semantic structure across your domain.',
    modules: ['Entity Intelligence Engine', 'AI Perception Graph', 'Schema Analysis', 'Content Quality', 'Machine Readability'],
  },
  {
    num: 1, label: 'Crawl & Structure Layer', color: 'from-slate-400 to-slate-500', glow: 'rgba(148,163,184,0.1)',
    border: 'border-slate-500/20', bg: 'bg-slate-500/5',
    desc: 'Full-site Puppeteer crawl: HTML parsing, chunk extraction, link graph, SEO signals, performance.',
    modules: ['Puppeteer Crawl Engine', 'Semantic Chunker', 'Internal Link Graph', 'SEO Signal Analysis', 'Core Web Vitals'],
  },
]

// ── AI pipeline steps ─────────────────────────────────────────────────────────

const PIPELINE = [
  { step: '01', label: 'Text extraction', detail: 'Strip nav, boilerplate, scripts' },
  { step: '02', label: 'Chunking', detail: 'Split into ~512-token semantic units' },
  { step: '03', label: 'Embedding', detail: 'Convert chunks to vector representations' },
  { step: '04', label: 'Entity extraction', detail: 'Identify named real-world objects' },
  { step: '05', label: 'Retrieval scoring', detail: 'Rank chunks for query relevance' },
  { step: '06', label: 'Summarisation', detail: 'Compress retrieved chunks into answer' },
  { step: '07', label: 'Citation decision', detail: 'Select chunks to surface or quote' },
  { step: '08', label: 'Trust filtering', detail: 'Suppress low-confidence sources' },
]

// ── Provider matrix ───────────────────────────────────────────────────────────

const PROVIDERS = [
  { name: 'Google AI Overviews', signal: 'E-E-A-T + structured data', trust: 'Domain authority + schema', citation: 'Direct answer extraction' },
  { name: 'ChatGPT / GPT-4o', signal: 'Semantic query embedding', trust: 'Recency + factual density', citation: 'Chunk-level quotation' },
  { name: 'Perplexity', signal: 'Real-time crawl + ranking', trust: 'Source diversity + directness', citation: 'Inline citation with URL' },
  { name: 'Gemini', signal: 'Knowledge Graph integration', trust: 'Entity consistency + schema', citation: 'Knowledge panel association' },
  { name: 'Claude', signal: 'Semantic clarity + structure', trust: 'Authoritativeness + entity clarity', citation: 'Summarisation + attribution' },
  { name: 'Voice Assistants', signal: 'Answer directness + schema', trust: 'Structured data + authority', citation: 'Single-answer extraction' },
]

// ── Scores grid ───────────────────────────────────────────────────────────────

const SCORES = [
  { icon: Eye,       name: 'AI Visibility Score',      tier: 'Tier 2', desc: 'Composite of all AI-layer signals. The primary measure of how an AI system perceives your site.' },
  { icon: Cpu,       name: 'Machine Readability',       tier: 'Tier 2', desc: 'Extraction fidelity — how much meaning survives the AI retrieval pipeline from raw HTML to usable chunk.' },
  { icon: Network,   name: 'Entity Confidence',         tier: 'Tier 2', desc: 'Scores entity detection, consistency across pages, coverage depth, and disambiguation strength.' },
  { icon: Search,    name: 'Retrieval Readiness',       tier: 'Tier 2', desc: 'Query-answer alignment, chunk extractability, and conversational query structure across 6 query types.' },
  { icon: BookOpen,  name: 'Citation Probability',      tier: 'Tier 2', desc: 'Likelihood an AI selects this content as a citation — factual density, claim specificity, authority depth.' },
  { icon: Shield,    name: 'Semantic Trust',            tier: 'Tier 2', desc: 'Authorship, organisational, content, and structural trust signals — with cross-page contradiction detection.' },
  { icon: Layers,    name: 'Retrieval Quality Score',   tier: 'Tier 3', desc: 'Simulates chunk extraction, ranking pressure, summarisation loss, and citation eligibility filtering.' },
  { icon: Brain,     name: 'Machine Trust Score',       tier: 'Tier 3', desc: 'Entity credibility, schema alignment, external validation depth, and trust degradation resistance.' },
  { icon: TrendingUp,name: 'Authority Velocity',        tier: 'Tier 3', desc: 'Rate of authority growth or decay across consecutive audit snapshots — velocity, not snapshot.' },
  { icon: Globe,     name: 'Recommendation Surfaces',   tier: 'Tier 3', desc: 'Inclusion probability across AI Overviews, chat, voice assistants, and autonomous agent discovery.' },
  { icon: Award,     name: 'Entity Authenticity',       tier: 'Tier 3', desc: 'Detects synthetic entity patterns, manufactured authority networks, and schema manipulation signals.' },
  { icon: Zap,       name: 'Machine Trust Intelligence',tier: 'Tier 4', desc: 'Top-level composite. How deeply does an AI ecosystem trust, retrieve, and recommend this website?' },
]

const TIER_COLORS: Record<string, string> = {
  'Tier 2': 'text-teal-400 bg-teal-500/10 border-teal-500/20',
  'Tier 3': 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  'Tier 4': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sitenexis.vercel.app'

const PLATFORM_SCHEMA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${appUrl}/platform#webpage`,
      url: `${appUrl}/platform`,
      name: 'Platform — SiteNexis',
      isPartOf: { '@id': `${appUrl}/#website` },
      about: { '@id': `${appUrl}/#app` },
      description: 'The SiteNexis platform: 16 intelligence agents across 4 layers, producing 12 explainable scores that model how AI systems retrieve, trust, and recommend a site.',
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: appUrl },
        { '@type': 'ListItem', position: 2, name: 'Platform', item: `${appUrl}/platform` },
      ],
    },
  ],
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlatformPage() {
  return (
    <div className="min-h-screen bg-midnight font-ui text-white antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(PLATFORM_SCHEMA) }}
      />
      <MarketingNav />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-32 pb-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(0,200,255,0.08),transparent)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_80%_80%,rgba(11,206,188,0.05),transparent)]" />
        <div className="relative mx-auto max-w-5xl px-6 text-center md:px-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/8 px-4 py-1.5 text-[12px] font-medium text-cyan-400">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              Machine Trust Intelligence Platform — v3.0
            </div>
            <h1 className="text-[42px] font-bold leading-[1.12] tracking-[-0.03em] text-white md:text-[62px]">
              The four-layer intelligence<br />
              <span className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">stack for machine trust</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-[1.7] text-slate-400">
              SiteNexis models how AI systems retrieve, interpret, trust, and recommend web content — across twelve dimensions, sixteen autonomous agents, and every major AI surface.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup" className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-6 py-3 text-sm font-bold text-[#050816] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(0,200,255,0.3)]">
                Start free audit <ArrowRight size={14} />
              </Link>
              <Link href="/docs" className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-6 py-3 text-sm font-medium text-white transition-all hover:border-white/[0.18] hover:bg-white/[0.07]">
                Read the docs <ChevronRight size={14} />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Four-layer stack ── */}
      <section className="border-y border-white/[0.05] bg-[#0A1628] py-24">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <Reveal className="mb-14 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Architecture</p>
            <h2 className="mt-3 text-[32px] font-bold tracking-[-0.02em] text-white md:text-[44px]">Four layers. Twelve scores. One platform.</h2>
            <p className="mx-auto mt-4 max-w-xl text-[16px] text-slate-400">Each layer depends on the one below. Layer 4 systems cannot produce meaningful output without the entity graph, retrieval scores, and semantic signals from Layers 2 and 3.</p>
          </Reveal>
          <div className="flex flex-col gap-4">
            {LAYERS.map((layer, i) => (
              <Reveal key={layer.num} delay={i * 0.08}>
                <div className={`card-glow relative overflow-hidden rounded-2xl border ${layer.border} ${layer.bg} p-6 md:p-8`}
                  style={{ '--glow-color': layer.glow } as React.CSSProperties}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8">
                    <div className="shrink-0">
                      <div className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${layer.color} px-3 py-1`}>
                        <span className="text-[11px] font-bold text-[#050816]">Layer {layer.num}</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-[18px] font-bold text-white">{layer.label}</h3>
                      <p className="mt-1.5 text-[14px] text-slate-400">{layer.desc}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {layer.modules.map(m => (
                          <span key={m} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] text-slate-300">{m}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI consumption pipeline ── */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <Reveal className="mb-14 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">How AI Systems Read</p>
            <h2 className="mt-3 text-[32px] font-bold tracking-[-0.02em] text-white md:text-[44px]">AI systems don&apos;t read websites. They read pipelines.</h2>
            <p className="mx-auto mt-4 max-w-xl text-[16px] text-slate-400">Every step from raw HTML to AI recommendation is a potential failure point. SiteNexis instruments all eight stages.</p>
          </Reveal>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {PIPELINE.map((p, i) => (
              <Reveal key={p.step} delay={i * 0.06}>
                <div className="card-glow group relative rounded-2xl border border-white/[0.07] bg-[#0A1628] p-5"
                  style={{ '--glow-color': 'rgba(0,200,255,0.1)' } as React.CSSProperties}>
                  <div className="mb-3 text-[28px] font-bold tracking-tight text-white/10">{p.step}</div>
                  <div className="text-[14px] font-semibold text-white">{p.label}</div>
                  <div className="mt-1 text-[12px] text-slate-500">{p.detail}</div>
                  {i < PIPELINE.length - 1 && (
                    <div className="absolute -right-1.5 top-1/2 z-10 hidden -translate-y-1/2 lg:block">
                      <ChevronRight size={12} className="text-slate-600" />
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Twelve scores ── */}
      <section className="border-y border-white/[0.05] bg-[#0A1628] py-24">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <Reveal className="mb-14 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Scoring System</p>
            <h2 className="mt-3 text-[32px] font-bold tracking-[-0.02em] text-white md:text-[44px]">Twelve scores. Every one explainable.</h2>
            <p className="mx-auto mt-4 max-w-xl text-[16px] text-slate-400">Every score is 0–100. Every deduction maps to a named, actionable issue. No black boxes.</p>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SCORES.map((s, i) => (
              <Reveal key={s.name} delay={i * 0.05}>
                <div className="card-glow group relative flex h-full flex-col rounded-2xl border border-white/[0.07] bg-midnight p-5"
                  style={{ '--glow-color': 'rgba(11,206,188,0.08)' } as React.CSSProperties}>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
                      <s.icon size={16} className="text-slate-300" strokeWidth={1.5} />
                    </div>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${TIER_COLORS[s.tier]}`}>{s.tier}</span>
                  </div>
                  <div className="text-[14px] font-semibold text-white">{s.name}</div>
                  <p className="mt-1.5 flex-1 text-[12px] leading-[1.7] text-slate-500">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Provider matrix ── */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <Reveal className="mb-14 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Multi-Provider Intelligence</p>
            <h2 className="mt-3 text-[32px] font-bold tracking-[-0.02em] text-white md:text-[44px]">Every major AI surface. One analysis.</h2>
            <p className="mx-auto mt-4 max-w-xl text-[16px] text-slate-400">Provider scores are probabilistic estimates based on measurable content signals — not live API queries. Weights are configurable per provider.</p>
          </Reveal>
          <Reveal>
            <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Provider</th>
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Primary Signal</th>
                    <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Trust Mechanism</th>
                    <th className="hidden px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 lg:table-cell">Citation Behaviour</th>
                  </tr>
                </thead>
                <tbody>
                  {PROVIDERS.map((p, i) => (
                    <tr key={p.name} className={`border-b border-white/[0.05] transition-colors hover:bg-white/[0.02] ${i === PROVIDERS.length - 1 ? 'border-b-0' : ''}`}>
                      <td className="px-6 py-4 text-[13px] font-medium text-white">{p.name}</td>
                      <td className="px-6 py-4 text-[13px] text-slate-400">{p.signal}</td>
                      <td className="px-6 py-4 text-[13px] text-slate-400">{p.trust}</td>
                      <td className="hidden px-6 py-4 text-[13px] text-slate-400 lg:table-cell">{p.citation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-white/[0.05] py-24">
        <div className="mx-auto max-w-3xl px-6 text-center md:px-10">
          <Reveal>
            <h2 className="text-[32px] font-bold tracking-[-0.02em] text-white md:text-[44px]">Ready to see how AI systems see your site?</h2>
            <p className="mx-auto mt-4 max-w-lg text-[16px] text-slate-400">Run a free audit in under 5 minutes. No credit card. No install.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup" className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-8 py-3.5 text-[14px] font-bold text-[#050816] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(0,200,255,0.3)]">
                Start for free <ArrowRight size={14} />
              </Link>
              <Link href="/pricing" className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-8 py-3.5 text-[14px] font-medium text-white transition-all hover:border-white/[0.18] hover:bg-white/[0.07]">
                View pricing
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <Footer />
    </div>
  )
}
