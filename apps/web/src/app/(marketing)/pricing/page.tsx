'use client'

import React, { useState, useRef } from 'react'
import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import { Check, Minus, ArrowRight, Zap, ChevronDown, Activity } from 'lucide-react'
import { MarketingNav } from '@/components/marketing/MarketingNav'

// ── Primitives ────────────────────────────────────────────────────────────────

function PentagonMark({ size = 16 }: { size?: number }) {
  const cx = size / 2, cy = size / 2, r = size * 0.42
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
  }).join(' ')
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden>
      <polygon points={pts} stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" fill="rgba(255,255,255,0.04)" />
      <polygon points={pts} stroke="rgba(11,206,188,0.35)" strokeWidth="0.6" fill="none"
        style={{ transform: `scale(0.55) translate(${size * 0.45}px, ${size * 0.45}px)` }} />
    </svg>
  )
}

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  )
}


// ── Plan data ─────────────────────────────────────────────────────────────────

type Plan = {
  name: string
  monthlyPrice: number | null
  annualPrice: number | null
  desc: string
  cta: string
  href: string
  highlight: boolean
  badge?: string
  features: string[]
}

const PLANS: Plan[] = [
  {
    name: 'Free',
    monthlyPrice: 0, annualPrice: 0,
    desc: 'Explore AI visibility for one domain.',
    cta: 'Start for free', href: '/signup',
    highlight: false,
    features: [
      '1 audit / month',
      'All Layer 1 modules',
      'SEO Health Score',
      'Schema Analysis',
      'PDF export',
      'No credit card required',
    ],
  },
  {
    name: 'Starter',
    monthlyPrice: 29, annualPrice: 23,
    desc: 'For developers and indie founders.',
    cta: 'Get Starter', href: '/signup?plan=starter',
    highlight: false,
    features: [
      '50 audits / month',
      'All Layer 1–2 modules',
      'AI Visibility Score',
      'Entity Intelligence',
      'Citation Probability',
      'Semantic Trust',
      'PDF reports',
      'Email support',
    ],
  },
  {
    name: 'Pro',
    monthlyPrice: 79, annualPrice: 63,
    desc: 'Full intelligence stack. No limits.',
    cta: 'Start Pro trial', href: '/signup?plan=pro',
    highlight: true,
    badge: 'Most Popular',
    features: [
      'Unlimited audits',
      'All 4 intelligence layers',
      'Machine Trust (Layer 4)',
      'Retrieval Simulation',
      'Temporal Authority',
      'Recommendation Surface Mapping',
      'Competitive AI Visibility Analysis',
      'Priority support',
    ],
  },
  {
    name: 'Agency',
    monthlyPrice: 249, annualPrice: 199,
    desc: 'For teams managing client portfolios.',
    cta: 'Get Agency', href: '/signup?plan=agency',
    highlight: false,
    features: [
      'Everything in Pro',
      'Unlimited audits',
      'Bulk domain scanning',
      'White-label PDF reports',
      'REST API access',
      'Team seats (5 users)',
      'Dedicated account manager',
    ],
  },
  {
    name: 'Enterprise',
    monthlyPrice: null, annualPrice: null,
    desc: 'Custom contracts for large organisations.',
    cta: 'Contact sales', href: 'mailto:sales@sitenexis.com',
    highlight: false,
    features: [
      'Everything in Agency',
      'Unlimited team seats',
      'SSO / SAML',
      'Custom data retention',
      'On-prem deployment option',
      'SLA guarantee',
      'Dedicated ML engineer',
    ],
  },
]

// ── Feature comparison ────────────────────────────────────────────────────────

const COMPARISON_ROWS: { category: string; features: { label: string; plans: (boolean | string)[] }[] }[] = [
  {
    category: 'Core',
    features: [
      { label: 'Audits per month',            plans: ['1', '50', 'Unlimited', 'Unlimited', 'Unlimited'] },
      { label: 'Pages per audit (max)',        plans: ['50', '200', '500', '500', 'Custom'] },
      { label: 'PDF export',                   plans: [true, true, true, true, true] },
      { label: 'API access',                   plans: [false, false, false, true, true] },
    ],
  },
  {
    category: 'Intelligence Layers',
    features: [
      { label: 'Layer 1 — Crawl & Structure',  plans: [true, true, true, true, true] },
      { label: 'Layer 2 — AI Visibility',       plans: [false, true, true, true, true] },
      { label: 'Layer 3 — Semantic Intelligence',plans: [false, true, true, true, true] },
      { label: 'Layer 4 — Machine Trust',        plans: [false, false, true, true, true] },
    ],
  },
  {
    category: 'Layer 4 Modules',
    features: [
      { label: 'Retrieval Simulation',          plans: [false, false, true, true, true] },
      { label: 'Machine Trust Scoring',         plans: [false, false, true, true, true] },
      { label: 'Temporal Authority Model',      plans: [false, false, true, true, true] },
      { label: 'Recommendation Surface Map',    plans: [false, false, true, true, true] },
      { label: 'Synthetic Entity Detection',    plans: [false, false, true, true, true] },
    ],
  },
  {
    category: 'Advanced',
    features: [
      { label: 'Competitive AI Visibility',     plans: [false, false, true, true, true] },
      { label: 'Bulk domain scanning',          plans: [false, false, false, true, true] },
      { label: 'White-label reports',           plans: [false, false, false, true, true] },
      { label: 'Team seats',                    plans: ['1', '1', '3', '5', 'Unlimited'] },
    ],
  },
]

// ── FAQ data ──────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: 'What counts as one audit?',
    a: 'One audit = one full domain scan, up to the page limit for your plan. A re-audit of the same domain counts as a separate audit.',
  },
  {
    q: 'Can I upgrade or downgrade at any time?',
    a: 'Yes. Upgrades take effect immediately with prorated billing. Downgrades take effect at the next billing cycle.',
  },
  {
    q: 'What is Layer 4 analysis?',
    a: 'Layer 4 is the Machine Trust layer — retrieval simulation, machine trust scoring, temporal authority modeling, recommendation surface mapping, and synthetic entity detection. It requires Layer 2 and 3 data and is computationally intensive, so it is gated to Pro and above.',
  },
  {
    q: 'Is there a free trial for Pro?',
    a: 'Yes — Pro includes a 7-day free trial with no credit card required. You get access to all four intelligence layers immediately.',
  },
  {
    q: 'How does the API work?',
    a: 'The REST API is available on Agency and Enterprise plans. It exposes all audit endpoints, scoring data, and webhook events. Full documentation at sitenexis.com/docs.',
  },
  {
    q: 'What AI models power the analysis?',
    a: 'SiteNexis uses Claude (Anthropic) as the primary model for entity extraction, contradiction detection, and AI extractability scoring. OpenAI is available as a fallback. All prompts and scoring logic are deterministic — the same content always produces the same score.',
  },
]

// ── FAQ accordion item ────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-white/[0.06]">
      <button onClick={() => setOpen(v => !v)} className="flex w-full items-start justify-between gap-4 py-5 text-left">
        <span className="text-[15px] font-medium text-white">{q}</span>
        <ChevronDown size={16} className={`mt-0.5 shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <motion.div initial={false} animate={open ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
        <p className="pb-5 text-[14px] leading-[1.75] text-slate-400">{a}</p>
      </motion.div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [annual, setAnnual] = useState(false)

  const pricingSchema = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is included in the SiteNexis free plan?',
          acceptedAnswer: { '@type': 'Answer', text: 'The free plan includes 1 audit per month covering SEO health, AI readability, machine readability, entity intelligence, citation probability, semantic trust, schema analysis, link graph, content quality, and performance scoring.' },
        },
        {
          '@type': 'Question',
          name: 'What is Layer 4 Machine Trust analysis?',
          acceptedAnswer: { '@type': 'Answer', text: 'Layer 4 analysis includes Retrieval Simulation, Machine Trust Scoring, Temporal Authority Modeling, Recommendation Surface Mapping, and Synthetic Entity Detection. These advanced AI trust intelligence features are available on Pro and Agency plans.' },
        },
        {
          '@type': 'Question',
          name: 'Can I cancel my SiteNexis subscription?',
          acceptedAnswer: { '@type': 'Answer', text: 'Yes. You can cancel at any time from your billing settings. Your plan remains active until the end of the current billing period with no further charges.' },
        },
        {
          '@type': 'Question',
          name: 'What is the difference between Pro and Agency plans?',
          acceptedAnswer: { '@type': 'Answer', text: 'Both Pro and Agency plans include unlimited audits, Layer 4 Machine Trust analysis, and competitive AI visibility comparison. Agency adds bulk domain auditing and API access for integrating SiteNexis data into your own tools and client reports.' },
        },
        {
          '@type': 'Question',
          name: 'Do you offer annual billing discounts?',
          acceptedAnswer: { '@type': 'Answer', text: 'Yes. Annual billing is available at a discounted rate compared to monthly billing. You can toggle between monthly and annual pricing on this page to see your savings.' },
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      '@id': 'https://sitenexis.com/#app',
      name: 'SiteNexis',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: 'https://sitenexis.com',
      offers: [
        { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'USD', description: '1 audit per month — SEO, AI readability, entity intelligence, citation probability, and more.' },
        { '@type': 'Offer', name: 'Starter', price: '29', priceCurrency: 'USD', priceSpecification: { '@type': 'UnitPriceSpecification', price: '29', priceCurrency: 'USD', unitText: 'MONTH' }, description: '50 audits per month.' },
        { '@type': 'Offer', name: 'Pro', price: '79', priceCurrency: 'USD', priceSpecification: { '@type': 'UnitPriceSpecification', price: '79', priceCurrency: 'USD', unitText: 'MONTH' }, description: 'Unlimited audits, Layer 4 Machine Trust analysis, competitive AI visibility comparison.' },
        { '@type': 'Offer', name: 'Agency', price: '199', priceCurrency: 'USD', priceSpecification: { '@type': 'UnitPriceSpecification', price: '199', priceCurrency: 'USD', unitText: 'MONTH' }, description: 'Unlimited audits, Layer 4 analysis, bulk domains, and API access.' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-midnight font-ui text-white antialiased">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingSchema) }} />
      <MarketingNav />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-32 pb-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-5%,rgba(0,200,255,0.07),transparent)]" />
        <div className="relative mx-auto max-w-3xl px-6 text-center md:px-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Pricing</p>
            <h1 className="mt-4 text-[42px] font-bold leading-[1.1] tracking-[-0.03em] text-white md:text-[56px]">
              Intelligence that<br />
              <span className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">scales with you</span>
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-[16px] leading-[1.7] text-slate-400">
              Start free. Upgrade when you need the full machine trust intelligence stack.
            </p>

            {/* Billing toggle */}
            <div className="mt-8 inline-flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1.5">
              <button onClick={() => setAnnual(false)}
                className={`rounded-lg px-4 py-2 text-[13px] font-medium transition-all ${!annual ? 'bg-white/[0.08] text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>
                Monthly
              </button>
              <button onClick={() => setAnnual(true)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all ${annual ? 'bg-white/[0.08] text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>
                Annual
                <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-semibold text-teal-400">Save 20%</span>
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Social proof banner ── */}
      <section className="border-y border-white/[0.05] bg-[#0A1628] py-4">
        <div className="mx-auto max-w-4xl px-6">
          <div className="flex flex-col items-center justify-center gap-3 text-center sm:flex-row sm:gap-6 sm:text-left">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-teal-400 shrink-0" />
              <span className="text-[12px] font-medium text-slate-300">
                SiteNexis monitors itself on Pro — every deployment triggers a full audit of sitenexis.com
              </span>
            </div>
            <Link href="/platform/health"
              className="shrink-0 rounded-full border border-teal-500/30 bg-teal-500/[0.08] px-3 py-1 text-[11px] font-semibold text-teal-400 hover:bg-teal-500/[0.15] transition-colors">
              View live health score →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Plans ── */}
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 md:px-10">
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            {PLANS.map((plan, i) => {
              const price = annual ? plan.annualPrice : plan.monthlyPrice
              return (
                <Reveal key={plan.name} delay={i * 0.07}>
                  <div className={[
                    'card-glow relative flex h-full flex-col rounded-2xl p-6',
                    plan.highlight
                      ? 'border border-cyan-500/30 bg-gradient-to-b from-cyan-500/10 to-transparent'
                      : 'border border-white/[0.07] bg-[#0A1628]',
                  ].join(' ')}
                    style={{ '--glow-color': plan.highlight ? 'rgba(0,200,255,0.18)' : 'rgba(255,255,255,0.06)' } as React.CSSProperties}>

                    {plan.badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 px-3 py-1 text-[10px] font-bold text-[#050816]">
                          <Zap size={10} /> {plan.badge}
                        </span>
                      </div>
                    )}

                    <div className="mb-4">
                      <div className="text-[13px] font-semibold text-white">{plan.name}</div>
                      <div className="mt-3 flex items-baseline gap-1">
                        {price === null ? (
                          <span className="text-[28px] font-bold text-white">Custom</span>
                        ) : price === 0 ? (
                          <span className="text-[28px] font-bold text-white">$0</span>
                        ) : (
                          <>
                            <span className="text-[28px] font-bold text-white">${price}</span>
                            <span className="text-[13px] text-slate-500">/mo</span>
                          </>
                        )}
                      </div>
                      {annual && price !== null && price > 0 && (
                        <p className="mt-1 text-[11px] text-slate-500">Billed annually</p>
                      )}
                      <p className="mt-2 text-[12px] leading-[1.6] text-slate-500">{plan.desc}</p>
                    </div>

                    <Link href={plan.href}
                      className={[
                        'mb-5 flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold transition-all',
                        plan.highlight
                          ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-[#050816] hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(0,200,255,0.25)]'
                          : 'border border-white/[0.1] bg-white/[0.04] text-white hover:border-white/[0.18] hover:bg-white/[0.07]',
                      ].join(' ')}>
                      {plan.cta} {plan.highlight && <ArrowRight size={13} />}
                    </Link>

                    <div className="flex flex-col gap-2.5">
                      {plan.features.map(f => (
                        <div key={f} className="flex items-start gap-2.5">
                          <Check size={13} className={`mt-0.5 shrink-0 ${plan.highlight ? 'text-cyan-400' : 'text-teal-500'}`} strokeWidth={2.5} />
                          <span className="text-[12px] leading-[1.6] text-slate-400">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Comparison table ── */}
      <section className="border-y border-white/[0.05] bg-[#0A1628] py-24">
        <div className="mx-auto max-w-7xl px-6 md:px-10">
          <Reveal className="mb-12 text-center">
            <h2 className="text-[28px] font-bold tracking-[-0.02em] text-white md:text-[36px]">Full feature comparison</h2>
          </Reveal>
          <Reveal>
            <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                    <th className="px-6 py-4 text-[12px] font-semibold text-slate-400 md:w-64">Feature</th>
                    {PLANS.map(p => (
                      <th key={p.name} className={`px-4 py-4 text-center text-[12px] font-semibold ${p.highlight ? 'text-cyan-400' : 'text-slate-400'}`}>{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map(section => (
                    <React.Fragment key={section.category}>
                      <tr className="border-b border-white/[0.05] bg-white/[0.01]">
                        <td colSpan={6} className="px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{section.category}</td>
                      </tr>
                      {section.features.map(row => (
                        <tr key={row.label} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                          <td className="px-6 py-3.5 text-[13px] text-slate-300">{row.label}</td>
                          {row.plans.map((val, vi) => (
                            <td key={vi} className="px-4 py-3.5 text-center">
                              {typeof val === 'boolean' ? (
                                val
                                  ? <Check size={14} className="mx-auto text-teal-400" strokeWidth={2.5} />
                                  : <Minus size={14} className="mx-auto text-slate-700" strokeWidth={2} />
                              ) : (
                                <span className="text-[12px] font-medium text-slate-300">{val}</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24">
        <div className="mx-auto max-w-3xl px-6 md:px-10">
          <Reveal className="mb-12 text-center">
            <h2 className="text-[28px] font-bold tracking-[-0.02em] text-white md:text-[36px]">Frequently asked questions</h2>
          </Reveal>
          <Reveal>
            <div className="rounded-2xl border border-white/[0.07] bg-[#0A1628] px-6">
              {FAQS.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Enterprise CTA ── */}
      <section className="border-t border-white/[0.05] py-20">
        <div className="mx-auto max-w-3xl px-6 text-center md:px-10">
          <Reveal>
            <div className="card-glow rounded-2xl border border-white/[0.08] bg-[#0A1628] p-10 md:p-14"
              style={{ '--glow-color': 'rgba(0,200,255,0.06)' } as React.CSSProperties}>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-500/20 bg-slate-500/8 px-3 py-1 text-[11px] font-medium text-slate-400">
                Enterprise
              </div>
              <h2 className="text-[28px] font-bold tracking-[-0.02em] text-white">Need a custom contract?</h2>
              <p className="mx-auto mt-3 max-w-md text-[15px] text-slate-400">SSO, on-prem, unlimited seats, custom SLAs, and dedicated ML engineering support. Let&apos;s talk.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <a href="mailto:sales@sitenexis.com"
                  className="flex items-center gap-2 rounded-xl bg-white/[0.06] border border-white/[0.12] px-6 py-3 text-[14px] font-semibold text-white transition-all hover:border-white/[0.2] hover:bg-white/[0.1]">
                  Contact sales <ArrowRight size={14} />
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.05] py-10">
        <div className="mx-auto max-w-7xl px-6 md:px-10">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03]">
                <PentagonMark size={14} />
              </div>
              <span className="text-[13px] font-semibold text-white">SiteNexis</span>
            </div>
            <p className="text-[12px] text-slate-600">© {new Date().getFullYear()} SiteNexis. Machine Trust Intelligence.</p>
            <div className="flex items-center gap-6">
              {[['Privacy', '/privacy'], ['Terms', '/terms'], ['Blog', '/blog']].map(([l, h]) => (
                <Link key={l} href={h} className="text-[12px] text-slate-600 hover:text-slate-400">{l}</Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
