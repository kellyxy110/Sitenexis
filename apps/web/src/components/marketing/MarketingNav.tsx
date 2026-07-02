'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, ArrowRight, ChevronRight, ChevronDown, ExternalLink, Globe, ClipboardPaste, Shield, MessageSquare } from 'lucide-react'

// ── Pentagon logo mark ────────────────────────────────────────────────────────

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

// ── Nav links config ──────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Methodology', href: '/methodology' },
  { label: 'Pricing',     href: '/pricing'     },
  { label: 'Blog',        href: '/blog'        },
]

const TOOLS = [
  {
    name: 'Machine Trust Score',
    tagline: 'Free domain MTS · shareable badge',
    desc: 'The AI-era Domain Authority. Scores any domain across 4 trust dimensions with a shareable badge.',
    href: '/mts',
    icon: <Shield size={14} className="text-cyan-400" />,
    accent: '#00C8FF',
  },
  {
    name: 'Is AI Citing You?',
    tagline: 'Live citation check',
    desc: 'Runs real AI queries with web search and checks if your domain appears in the responses.',
    href: '/tools/citation-check',
    icon: <MessageSquare size={14} className="text-purple-400" />,
    accent: '#A855F7',
  },
  {
    name: 'AI Citation Score',
    tagline: 'Live URL scanner',
    desc: 'Crawls a live URL and scores how likely AI systems are to cite it.',
    href: '/tools/quick-check',
    icon: <Globe size={14} className="text-teal-400" />,
    accent: '#0BCEBC',
  },
  {
    name: 'AI Readiness Scorer',
    tagline: 'Paste HTML or text',
    desc: 'Score pasted content on 9 citation signals — runs entirely in your browser.',
    href: '/tools/ai-scorer',
    icon: <ClipboardPaste size={14} className="text-blue-400" />,
    accent: '#6366F1',
  },
]

const PRODUCTS = [
  {
    name: 'SiteNexis',
    tagline: 'AI Retrieval & Machine Trust Intelligence',
    desc: 'Model how AI systems find, trust, and recommend your website.',
    href: '/',
    external: false,
    accent: '#00C8FF',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => {
          const a = (Math.PI * 2 * i) / 5 - Math.PI / 2
          const r = 6
          return `${8 + r * Math.cos(a)},${8 + r * Math.sin(a)}`
        }).join(' ') && (
          <polygon
            points={Array.from({ length: 5 }, (_, i) => {
              const a = (Math.PI * 2 * i) / 5 - Math.PI / 2
              return `${8 + 6 * Math.cos(a)},${8 + 6 * Math.sin(a)}`
            }).join(' ')}
            stroke="#00C8FF"
            strokeWidth="1.2"
            fill="rgba(0,200,255,0.08)"
          />
        )}
      </svg>
    ),
  },
  {
    name: 'AdNexis',
    tagline: 'AI Creative Intelligence',
    desc: 'Deconstruct top-performing ads and generate high-converting creative.',
    href: 'https://adnexis-ai.vercel.app',
    external: true,
    accent: '#6C3EFF',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="2" y="2" width="5" height="5" rx="1.2" stroke="#6C3EFF" strokeWidth="1.2" fill="rgba(108,62,255,0.1)" />
        <rect x="9" y="2" width="5" height="5" rx="1.2" stroke="#6C3EFF" strokeWidth="1.2" fill="rgba(108,62,255,0.06)" />
        <rect x="2" y="9" width="5" height="5" rx="1.2" stroke="#6C3EFF" strokeWidth="1.2" fill="rgba(108,62,255,0.06)" />
        <rect x="9" y="9" width="5" height="5" rx="1.2" stroke="#00D4AA" strokeWidth="1.2" fill="rgba(0,212,170,0.06)" />
      </svg>
    ),
  },
]

// ── Tools dropdown ────────────────────────────────────────────────────────────

function ToolsDropdown({ open }: { open: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="absolute left-1/2 top-full mt-2 w-[300px] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0A1628] shadow-[0_16px_48px_rgba(0,0,0,0.7)]"
        >
          <div className="p-1.5">
            {TOOLS.map((t) => (
              <Link
                key={t.name}
                href={t.href}
                className="group flex items-start gap-3.5 rounded-xl p-3.5 transition-colors duration-150 hover:bg-white/[0.04]"
              >
                <div
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                  style={{ borderColor: `${t.accent}30`, backgroundColor: `${t.accent}10` }}
                >
                  {t.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white">{t.name}</p>
                  <p className="text-[11px] font-medium mt-0.5" style={{ color: t.accent + 'CC' }}>{t.tagline}</p>
                  <p className="text-[11px] leading-relaxed text-slate-600 mt-1">{t.desc}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="border-t border-white/[0.06] bg-white/[0.01] px-4 py-2.5">
            <p className="text-[10px] text-slate-700">Free tools · No account required</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Products dropdown ─────────────────────────────────────────────────────────

function ProductsDropdown({ open }: { open: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="absolute left-1/2 top-full mt-2 w-[340px] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0A1628] shadow-[0_16px_48px_rgba(0,0,0,0.7)]"
        >
          <div className="p-1.5">
            {PRODUCTS.map((p) => (
              <a
                key={p.name}
                href={p.href}
                target={p.external ? '_blank' : undefined}
                rel={p.external ? 'noopener noreferrer' : undefined}
                className="group flex items-start gap-3.5 rounded-xl p-3.5 transition-colors duration-150 hover:bg-white/[0.04]"
              >
                <div
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                  style={{ borderColor: `${p.accent}30`, backgroundColor: `${p.accent}10` }}
                >
                  {p.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-white">{p.name}</span>
                    {p.external && (
                      <ExternalLink size={10} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                    )}
                  </div>
                  <p className="text-[11px] font-medium mt-0.5" style={{ color: p.accent + 'CC' }}>{p.tagline}</p>
                  <p className="text-[11px] leading-relaxed text-slate-600 mt-1">{p.desc}</p>
                </div>
              </a>
            ))}
          </div>
          <div className="border-t border-white/[0.06] bg-white/[0.01] px-4 py-2.5">
            <p className="text-[10px] text-slate-700">The AI Intelligence Suite · Built for the machine-first web</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MarketingNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [productsOpen, setProductsOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [mobileProductsOpen, setMobileProductsOpen] = useState(false)
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false)
  const productsRef = useRef<HTMLDivElement>(null)
  const toolsRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!productsOpen) return
    const handler = (e: MouseEvent) => {
      if (!productsRef.current?.contains(e.target as Node)) setProductsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [productsOpen])

  useEffect(() => {
    if (!toolsOpen) return
    const handler = (e: MouseEvent) => {
      if (!toolsRef.current?.contains(e.target as Node)) setToolsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [toolsOpen])

  const activeLink =
    NAV_LINKS.find(l => pathname === l.href || pathname.startsWith(l.href + '/')) ??
    (pathname.startsWith('/tools') || pathname.startsWith('/mts') ? { label: 'Tools', href: '/tools' } : undefined)

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="border-b border-white/[0.05] bg-midnight/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-10">

            {/* Left: logo + mobile breadcrumb */}
            <div className="flex items-center gap-2">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] transition-colors group-hover:border-white/[0.14]">
                  <PentagonMark size={16} />
                </div>
                <span className="text-[15px] font-semibold tracking-[-0.01em] text-white">SiteNexis</span>
              </Link>
              {activeLink && (
                <div className="flex items-center gap-1.5 md:hidden">
                  <ChevronRight size={12} className="text-slate-600" />
                  <span className="text-[13px] font-medium text-slate-400">{activeLink.label}</span>
                </div>
              )}
            </div>

            {/* Desktop nav */}
            <nav className="hidden items-center gap-7 md:flex" aria-label="Main navigation">

              {/* Products dropdown trigger */}
              <div ref={productsRef} className="relative">
                <button
                  onClick={() => setProductsOpen(v => !v)}
                  className={[
                    'flex items-center gap-1 text-sm transition-colors duration-150',
                    productsOpen ? 'text-white' : 'text-slate-400 hover:text-slate-200',
                  ].join(' ')}
                  aria-expanded={productsOpen}
                  aria-haspopup="true"
                >
                  Products
                  <ChevronDown
                    size={13}
                    className={`transition-transform duration-200 ${productsOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                <ProductsDropdown open={productsOpen} />
              </div>

              {/* Tools dropdown */}
              <div ref={toolsRef} className="relative">
                <button
                  onClick={() => setToolsOpen(v => !v)}
                  className={[
                    'flex items-center gap-1 text-sm transition-colors duration-150',
                    toolsOpen || pathname.startsWith('/tools') || pathname.startsWith('/mts') ? 'text-white' : 'text-slate-400 hover:text-slate-200',
                  ].join(' ')}
                  aria-expanded={toolsOpen}
                  aria-haspopup="true"
                >
                  Tools
                  <ChevronDown size={13} className={`transition-transform duration-200 ${toolsOpen ? 'rotate-180' : ''}`} />
                </button>
                <ToolsDropdown open={toolsOpen} />
              </div>

              {NAV_LINKS.map(({ label, href }) => {
                const isActive = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={label}
                    href={href}
                    className={[
                      'text-sm transition-colors duration-150',
                      isActive ? 'font-medium text-white' : 'text-slate-400 hover:text-slate-200',
                    ].join(' ')}
                  >
                    {label}
                  </Link>
                )
              })}
            </nav>

            {/* Right: CTA + hamburger */}
            <div className="flex items-center gap-2 md:gap-3">
              <Link href="/login" className="hidden text-sm text-slate-400 transition-colors hover:text-slate-200 sm:block">
                Log in
              </Link>
              <Link
                href="/signup"
                className="hidden rounded-lg border border-white/[0.12] bg-white/[0.05] px-4 py-2 text-sm font-medium text-white transition-all hover:border-white/[0.2] hover:bg-white/[0.08] md:block"
              >
                Get started
              </Link>
              <button
                onClick={() => setOpen(v => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slate-300 transition-all hover:border-white/[0.15] hover:bg-white/[0.06] md:hidden"
                aria-label={open ? 'Close menu' : 'Open menu'}
                aria-expanded={open}
              >
                {open ? <X size={17} strokeWidth={2} /> : <Menu size={17} strokeWidth={2} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              key="drawer"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-x-0 top-[65px] z-50 md:hidden"
            >
              <div className="mx-4 overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0A1628] shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
                {activeLink && (
                  <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-5 py-3">
                    <span className="text-[11px] text-slate-600">SiteNexis</span>
                    <ChevronRight size={10} className="text-slate-700" />
                    <span className="text-[11px] font-semibold text-slate-300">{activeLink.label}</span>
                  </div>
                )}

                <nav className="px-3 py-3" aria-label="Mobile navigation">
                  {/* Products expandable */}
                  <button
                    onClick={() => setMobileProductsOpen(v => !v)}
                    className="flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-[15px] font-medium text-slate-400 hover:bg-white/[0.04] hover:text-white transition-all"
                  >
                    Products
                    <ChevronDown size={14} className={`text-slate-600 transition-transform duration-200 ${mobileProductsOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {mobileProductsOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mx-2 mb-2 space-y-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
                          {PRODUCTS.map((p) => (
                            <a
                              key={p.name}
                              href={p.href}
                              target={p.external ? '_blank' : undefined}
                              rel={p.external ? 'noopener noreferrer' : undefined}
                              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
                            >
                              <div
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
                                style={{ borderColor: `${p.accent}30`, backgroundColor: `${p.accent}10` }}
                              >
                                {p.icon}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[13px] font-semibold text-white">{p.name}</span>
                                  {p.external && <ExternalLink size={9} className="text-slate-600" />}
                                </div>
                                <p className="text-[11px]" style={{ color: p.accent + 'AA' }}>{p.tagline}</p>
                              </div>
                            </a>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Tools expandable */}
                  <button
                    onClick={() => setMobileToolsOpen(v => !v)}
                    className="flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-[15px] font-medium text-slate-400 hover:bg-white/[0.04] hover:text-white transition-all"
                  >
                    Tools
                    <ChevronDown size={14} className={`text-slate-600 transition-transform duration-200 ${mobileToolsOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {mobileToolsOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mx-2 mb-2 space-y-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
                          {TOOLS.map((t) => (
                            <Link
                              key={t.name}
                              href={t.href}
                              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
                            >
                              <div
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
                                style={{ borderColor: `${t.accent}30`, backgroundColor: `${t.accent}10` }}
                              >
                                {t.icon}
                              </div>
                              <div>
                                <p className="text-[13px] font-semibold text-white">{t.name}</p>
                                <p className="text-[11px]" style={{ color: t.accent + 'AA' }}>{t.tagline}</p>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {NAV_LINKS.map(({ label, href }) => {
                    const isActive = pathname === href || pathname.startsWith(href + '/')
                    return (
                      <Link
                        key={label}
                        href={href}
                        className={[
                          'flex items-center justify-between rounded-xl px-4 py-3.5 text-[15px] font-medium transition-all',
                          isActive ? 'bg-white/[0.07] text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
                        ].join(' ')}
                      >
                        {label}
                        {isActive && <ChevronRight size={14} className="text-slate-500" />}
                      </Link>
                    )
                  })}
                </nav>

                <div className="flex flex-col gap-2.5 border-t border-white/[0.06] px-4 py-4">
                  <Link
                    href="/signup"
                    className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 py-3 text-[14px] font-bold text-[#050816] transition-all active:scale-[0.98]"
                  >
                    Get started free <ArrowRight size={14} />
                  </Link>
                  <Link
                    href="/login"
                    className="flex items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.03] py-3 text-[14px] font-medium text-slate-300 transition-all hover:bg-white/[0.06] active:scale-[0.98]"
                  >
                    Log in
                  </Link>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
