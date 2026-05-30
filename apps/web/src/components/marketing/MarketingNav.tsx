'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, ArrowRight, ChevronRight } from 'lucide-react'

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
  { label: 'Platform', href: '/platform' },
  { label: 'Pricing',  href: '/pricing'  },
  { label: 'Docs',     href: '/docs'     },
  { label: 'Blog',     href: '/blog'     },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function MarketingNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Derive breadcrumb label for current page
  const activeLink = NAV_LINKS.find(l => pathname === l.href || pathname.startsWith(l.href + '/'))

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

              {/* Breadcrumb — mobile only, shown when on a sub-page */}
              {activeLink && (
                <div className="flex items-center gap-1.5 md:hidden">
                  <ChevronRight size={12} className="text-slate-600" />
                  <span className="text-[13px] font-medium text-slate-400">{activeLink.label}</span>
                </div>
              )}
            </div>

            {/* Desktop nav links */}
            <nav className="hidden items-center gap-7 md:flex" aria-label="Main navigation">
              {NAV_LINKS.map(({ label, href }) => {
                const isActive = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={label}
                    href={href}
                    className={[
                      'text-sm transition-colors duration-150',
                      isActive
                        ? 'font-medium text-white'
                        : 'text-slate-400 hover:text-slate-200',
                    ].join(' ')}
                  >
                    {label}
                  </Link>
                )
              })}
            </nav>

            {/* Right: CTA + hamburger */}
            <div className="flex items-center gap-2 md:gap-3">
              <Link
                href="/login"
                className="hidden text-sm text-slate-400 transition-colors hover:text-slate-200 sm:block"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="hidden rounded-lg border border-white/[0.12] bg-white/[0.05] px-4 py-2 text-sm font-medium text-white transition-all hover:border-white/[0.2] hover:bg-white/[0.08] md:block"
              >
                Get started
              </Link>

              {/* Hamburger — mobile only */}
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
            {/* Backdrop */}
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

            {/* Drawer panel */}
            <motion.div
              key="drawer"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-x-0 top-[65px] z-50 md:hidden"
            >
              <div className="mx-4 overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0A1628] shadow-[0_16px_48px_rgba(0,0,0,0.6)]">

                {/* Breadcrumb trail */}
                {activeLink && (
                  <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-5 py-3">
                    <span className="text-[11px] text-slate-600">SiteNexis</span>
                    <ChevronRight size={10} className="text-slate-700" />
                    <span className="text-[11px] font-semibold text-slate-300">{activeLink.label}</span>
                  </div>
                )}

                {/* Nav links */}
                <nav className="px-3 py-3" aria-label="Mobile navigation">
                  {NAV_LINKS.map(({ label, href }) => {
                    const isActive = pathname === href || pathname.startsWith(href + '/')
                    return (
                      <Link
                        key={label}
                        href={href}
                        className={[
                          'flex items-center justify-between rounded-xl px-4 py-3.5 text-[15px] font-medium transition-all',
                          isActive
                            ? 'bg-white/[0.07] text-white'
                            : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
                        ].join(' ')}
                      >
                        {label}
                        {isActive && <ChevronRight size={14} className="text-slate-500" />}
                      </Link>
                    )
                  })}
                </nav>

                {/* CTA row */}
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
