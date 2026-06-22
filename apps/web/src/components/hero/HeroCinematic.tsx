'use client'

import {
  useRef,
  useState,
  useEffect,
} from 'react'
import dynamic from 'next/dynamic'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, Globe, Zap } from 'lucide-react'

const HeroScene = dynamic(() => import('./HeroScene'), {
  ssr: false,
  loading: () => null,
})

// ── Types ─────────────────────────────────────────────────────────────────────

interface HeroCinematicProps {
  onSubmit: (domain: string) => void
  loading: boolean
}

// ── Animation variants ────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: i * 0.12 },
  }),
}

// ── Mobile simplified background ──────────────────────────────────────────────

function MobileBackground() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(11,206,188,0.08) 0%, transparent 70%)' }}
      />
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(rgba(11,206,188,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(11,206,188,0.025) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
        transform: 'perspective(800px) rotateX(20deg)',
        transformOrigin: '50% 0%',
      }} />
    </>
  )
}

// ── Glassmorphism domain input ─────────────────────────────────────────────────

function DomainInput({ onSubmit, loading }: { onSubmit: (d: string) => void; loading: boolean }) {
  const [value,   setValue]   = useState('')
  const [focused, setFocused] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim().replace(/^https?:\/\//, '')
    if (trimmed) onSubmit(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      {/* Ambient glow behind input */}
      <motion.div
        className="pointer-events-none absolute -inset-1 rounded-3xl opacity-0 blur-xl"
        animate={focused ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4 }}
        style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(11,206,188,0.15), transparent 70%)' }}
      />

      <motion.div
        className="relative flex items-center gap-3 rounded-2xl p-2 pl-5"
        animate={focused
          ? { borderColor: 'rgba(11,206,188,0.35)', boxShadow: '0 0 0 1px rgba(11,206,188,0.15), 0 16px 48px rgba(0,0,0,0.6)' }
          : { borderColor: 'rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }
        }
        transition={{ duration: 0.3 }}
        style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Animated scan line */}
        <motion.div
          className="pointer-events-none absolute inset-y-0 left-0 w-px rounded-full"
          animate={focused ? { opacity: [0, 1, 0], scaleY: [0, 1, 0] } : { opacity: 0 }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{ background: 'linear-gradient(to bottom, transparent, #0BCEBC, transparent)' }}
        />

        <Globe size={16} className="shrink-0 text-slate-500" strokeWidth={1.5} />

        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Enter any domain — e.g. apple.com"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent py-3 text-[15px] text-white outline-none placeholder:text-slate-600"
          aria-label="Domain to audit"
        />

        {/* CTA button with glow sweep */}
        <motion.button
          type="submit"
          disabled={loading || !value.trim()}
          className="relative shrink-0 overflow-hidden rounded-xl px-6 py-3 text-sm font-bold text-[#050816] disabled:cursor-not-allowed disabled:opacity-40"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            background: 'linear-gradient(135deg, #0BCEBC 0%, #00C8FF 100%)',
            boxShadow: '0 4px 20px rgba(11,206,188,0.35)',
          }}
        >
          {/* Shimmer sweep */}
          <motion.span
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
          />

          {loading ? (
            <span className="relative flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#050816]/30 border-t-[#050816]" />
              Scanning
            </span>
          ) : (
            <span className="relative flex items-center gap-2">
              Run Audit
              <ArrowRight size={14} strokeWidth={2.5} />
            </span>
          )}
        </motion.button>
      </motion.div>
    </form>
  )
}

// ── Score preview (right-side content on desktop) ─────────────────────────────

const PREVIEW_SCORES = [
  { label: 'Machine Trust',   score: 84, color: '#22C55E' },
  { label: 'AI Visibility',   score: 71, color: '#0BCEBC' },
  { label: 'Citation Prob.',  score: 62, color: '#0BCEBC' },
  { label: 'Entity Intel.',   score: 55, color: '#F59E0B' },
  { label: 'Retrieval Score', score: 88, color: '#22C55E' },
]

// ── Proof badges ──────────────────────────────────────────────────────────────

const PROOF_ITEMS = ['12 intelligence scores', '6-stage retrieval simulation', 'Investigation-grade diagnostics']

// ── Main hero component ───────────────────────────────────────────────────────

export function HeroCinematic({ onSubmit, loading }: HeroCinematicProps) {
  const heroRef   = useRef<HTMLElement>(null)
  const mouseRef  = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const scrollRef = useRef<number>(0)

  const [isMobile, setIsMobile]               = useState(false)
  const [reducedMotion, setReducedMotion]     = useState(false)
  const [sceneLoaded, setSceneLoaded]         = useState(false)
  const [mounted, setMounted]                 = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lenisRef = useRef<any>(null)

  // ── Device detection ───────────────────────────────────────────────────────

  useEffect(() => {
    setMounted(true)
    setIsMobile(window.innerWidth < 768)
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)

    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize, { passive: true })
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── Mouse tracking (NDC coords) ────────────────────────────────────────────

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth)  * 2 - 1
      mouseRef.current.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // ── Lenis smooth scroll ────────────────────────────────────────────────────
  // Note: GSAP ScrollTrigger is intentionally NOT used here — it conflicts
  // with Framer Motion's MotionValues by snapshotting opacity:0 before the
  // fade-in animation completes. Framer Motion's useTransform handles the
  // scroll-driven opacity fade instead.

  useEffect(() => {
    if (reducedMotion) return

    let lenis: import('lenis').default
    let rafId: number

    async function init() {
      const { default: Lenis } = await import('lenis')

      lenis = new Lenis({
        duration: 1.25,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      })
      lenisRef.current = lenis

      lenis.on('scroll', ({ scroll }: { scroll: number }) => {
        const maxScroll = document.body.scrollHeight - window.innerHeight
        scrollRef.current = maxScroll > 0 ? scroll / maxScroll : 0
      })

      function raf(time: number) {
        lenis.raf(time)
        rafId = requestAnimationFrame(raf)
      }
      rafId = requestAnimationFrame(raf)
    }

    init()

    return () => {
      cancelAnimationFrame(rafId)
      if (lenis) lenis.destroy()
    }
  }, [reducedMotion])

  // ── Scene ready callback ───────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => setSceneLoaded(true), 400)
    return () => clearTimeout(t)
  }, [])

  // ── Scroll progress (for Framer Motion transforms) ─────────────────────────

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const contentY  = useTransform(scrollYProgress, [0, 1], [0, -80])
  const contentOp = useTransform(scrollYProgress, [0, 0.5], [1, 0])

  return (
    <section
      ref={heroRef}
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{ background: '#050816' }}
    >
      {/* ── 3D canvas background ───────────────────────────────────────────── */}
      <div className="absolute inset-0">
        {reducedMotion || isMobile ? (
          <MobileBackground />
        ) : (
          <motion.div
            className="h-full w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: sceneLoaded ? 1 : 0 }}
            transition={{ duration: 1.2 }}
          >
            <HeroScene
              mouseRef={mouseRef}
              scrollRef={scrollRef}
              isMobile={isMobile}
            />
          </motion.div>
        )}
      </div>

      {/* ── Gradient overlays on top of canvas ────────────────────────────── */}
      {/* Vignette edges */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 50%, #050816 100%)',
          opacity: 0.7,
        }}
      />
      {/* Bottom scroll fade */}
      <div
        className="pointer-events-none absolute bottom-0 inset-x-0 h-40"
        style={{ background: 'linear-gradient(to top, #050816, transparent)' }}
      />

      {/* ── Hero content ──────────────────────────────────────────────────── */}
      <motion.div
        data-hero-content
        className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-6 pt-28 pb-24 lg:px-10"
        style={mounted && !reducedMotion ? { y: contentY, opacity: contentOp } : {}}
      >
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">

          {/* ── Left: copy + input ────────────────────────────────────────── */}
          <div className="flex flex-col">

            {/* Badge */}
            <motion.div
              className="mb-8"
              custom={0}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
            >
              <span
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-medium tracking-[0.14em] text-slate-400 uppercase"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400" />
                Machine Trust Intelligence
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              custom={1}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="text-[clamp(3rem,7vw,5.25rem)] font-bold leading-[1.04] tracking-[-0.04em] text-balance"
            >
              <span className="text-white">The machine view</span>
              <br />
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #0BCEBC 0%, #00C8FF 60%, #7C5CFF 100%)',
                }}
              >
                of your website.
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              custom={2}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="mt-7 max-w-[520px] text-[17px] leading-[1.72] tracking-[-0.01em] text-white"
            >
              Machine Trust Intelligence across 12 scores, 4 layers, and 16
              autonomous agents. Retrieval simulation, investigation-grade
              diagnostics, and real-time SERP intelligence — exposing exactly
              where AI understanding forms and where it breaks down.
            </motion.p>

            {/* Input */}
            <motion.div
              custom={3}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="mt-10 w-full max-w-[540px]"
            >
              <DomainInput onSubmit={onSubmit} loading={loading} />
              <p className="mt-4 text-[12px] tracking-wide text-slate-300">
                Free&nbsp;&nbsp;·&nbsp;&nbsp;No account required&nbsp;&nbsp;·&nbsp;&nbsp;Results in ~60s
              </p>
            </motion.div>

            {/* Proof line */}
            <motion.div
              custom={4}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="mt-12 flex flex-wrap gap-x-7 gap-y-3"
            >
              {PROOF_ITEMS.map((item) => (
                <span key={item} className="flex items-center gap-2 text-[12px] text-slate-200">
                  <span className="h-px w-4 bg-slate-500" />
                  {item}
                </span>
              ))}
            </motion.div>
          </div>

          {/* ── Right: intelligence score preview (hidden on mobile) ───────── */}
          <div className="hidden lg:flex lg:flex-col lg:items-end">
            {/* The R3F sphere appears in canvas behind this column */}
            {/* Score cards float in front of the sphere */}
            <div className="relative w-full max-w-xs space-y-2.5">

              {/* Floating label */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.6 }}
                className="mb-5 text-right text-[11px] font-medium tracking-[0.12em] text-slate-700 uppercase"
              >
                Live Intelligence Preview
              </motion.p>

              {PREVIEW_SCORES.map(({ label, score, color }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: 32 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + i * 0.1, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                  className="group flex items-center gap-4 rounded-xl px-4 py-3"
                  style={{
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                  }}
                >
                  {/* Score ring */}
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold"
                    style={{
                      background: `${color}12`,
                      border:     `1px solid ${color}28`,
                      color,
                    }}
                  >
                    {score}
                  </div>

                  {/* Bar */}
                  <div className="flex flex-1 flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-slate-400">{label}</span>
                    <div className="h-[2px] w-full overflow-hidden rounded-full bg-white/[0.04]">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${score}%` }}
                        transition={{ delay: 0.9 + i * 0.1, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Footer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4, duration: 0.5 }}
                className="mt-3 flex items-center justify-between rounded-xl px-4 py-3"
                style={{
                  background: 'rgba(11,206,188,0.04)',
                  border: '1px solid rgba(11,206,188,0.12)',
                }}
              >
                <span className="flex items-center gap-2 text-[12px] text-teal-500/70">
                  <Zap size={11} strokeWidth={2} />
                  Analysing example.com
                </span>
                <span className="text-[10px] text-slate-600">Layer 4 active</span>
              </motion.div>
            </div>
          </div>

        </div>
      </motion.div>
    </section>
  )
}
