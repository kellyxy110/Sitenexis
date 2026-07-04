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
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: i * 0.13 },
  }),
}

// ── Mobile simplified background ──────────────────────────────────────────────

function MobileBackground() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(11,206,188,0.06) 0%, transparent 70%)' }}
      />
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(rgba(11,206,188,0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(11,206,188,0.02) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
        transform: 'perspective(800px) rotateX(20deg)',
        transformOrigin: '50% 0%',
      }} />
    </>
  )
}

// ── Domain input ──────────────────────────────────────────────────────────────

function DomainInput({ onSubmit, loading }: { onSubmit: (d: string) => void; loading: boolean }) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim().replace(/^https?:\/\//, '')
    if (trimmed) onSubmit(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <motion.div
        className="pointer-events-none absolute -inset-1 rounded-3xl opacity-0 blur-xl"
        animate={focused ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4 }}
        style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(11,206,188,0.12), transparent 70%)' }}
      />

      <motion.div
        className="relative flex items-center gap-3 rounded-2xl p-2 pl-5"
        animate={focused
          ? { borderColor: 'rgba(11,206,188,0.35)', boxShadow: '0 0 0 1px rgba(11,206,188,0.15), 0 16px 48px rgba(0,0,0,0.6)' }
          : { borderColor: 'rgba(255,255,255,0.06)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }
        }
        transition={{ duration: 0.3 }}
        style={{
          background: 'rgba(255,255,255,0.025)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <motion.div
          className="pointer-events-none absolute inset-y-0 left-0 w-px rounded-full"
          animate={focused ? { opacity: [0, 1, 0], scaleY: [0, 1, 0] } : { opacity: 0 }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{ background: 'linear-gradient(to bottom, transparent, #0BCEBC, transparent)' }}
        />

        <Globe size={16} className="shrink-0 text-slate-600" strokeWidth={1.5} />

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

        <motion.button
          type="submit"
          disabled={loading || !value.trim()}
          className="relative shrink-0 overflow-hidden rounded-xl px-6 py-3 text-sm font-bold text-[#030812] disabled:cursor-not-allowed disabled:opacity-40"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            background: 'linear-gradient(135deg, #0BCEBC 0%, #00C8FF 100%)',
            boxShadow: '0 4px 24px rgba(11,206,188,0.3)',
          }}
        >
          <motion.span
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }}
          />
          {loading ? (
            <span className="relative flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#030812]/30 border-t-[#030812]" />
              Scanning
            </span>
          ) : (
            <span className="relative flex items-center gap-2">
              Run Intelligence Audit
              <ArrowRight size={14} strokeWidth={2.5} />
            </span>
          )}
        </motion.button>
      </motion.div>
    </form>
  )
}

// ── Stage indicator — shows narrative progress ───────────────────────────────

const STAGES = ['Chaos', 'Discovery', 'Mapping', 'Understanding', 'Visibility']

function StageIndicator({ progress }: { progress: number }) {
  const activeIdx = Math.min(Math.floor(progress * STAGES.length), STAGES.length - 1)

  return (
    <div className="flex items-center gap-1">
      {STAGES.map((stage, i) => (
        <div key={stage} className="flex items-center gap-1">
          <div
            className="h-1 rounded-full transition-all duration-700"
            style={{
              width: i === activeIdx ? 24 : 8,
              background: i <= activeIdx
                ? 'linear-gradient(90deg, #0BCEBC, #00C8FF)'
                : 'rgba(255,255,255,0.08)',
            }}
          />
        </div>
      ))}
      <span className="ml-3 text-[10px] font-medium tracking-[0.15em] uppercase text-slate-500">
        {STAGES[activeIdx]}
      </span>
    </div>
  )
}

// ── Score preview ─────────────────────────────────────────────────────────────

const PREVIEW_SCORES = [
  { label: 'Machine Trust', score: 84, color: '#22C55E' },
  { label: 'AI Visibility', score: 71, color: '#0BCEBC' },
  { label: 'Citation Prob.', score: 62, color: '#0BCEBC' },
  { label: 'Entity Intel.', score: 55, color: '#F59E0B' },
  { label: 'Retrieval Score', score: 88, color: '#22C55E' },
]

// ── Proof badges ──────────────────────────────────────────────────────────────

const PROOF_ITEMS = ['12 intelligence scores', '6-stage retrieval simulation', 'Investigation-grade diagnostics']

// ── Main hero component ───────────────────────────────────────────────────────

export function HeroCinematic({ onSubmit, loading }: HeroCinematicProps) {
  const heroRef = useRef<HTMLElement>(null)
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const scrollRef = useRef<number>(0)

  const [isMobile, setIsMobile] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [sceneLoaded, setSceneLoaded] = useState(false)
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lenisRef = useRef<any>(null)

  useEffect(() => {
    setMounted(true)
    setIsMobile(window.innerWidth < 768)
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize, { passive: true })
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1
      mouseRef.current.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

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
        scrollRef.current = maxScroll > 0 ? Math.min(1, scroll / maxScroll) : 0
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

  useEffect(() => {
    const t = setTimeout(() => setSceneLoaded(true), 500)
    return () => clearTimeout(t)
  }, [])

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -100])
  const contentOp = useTransform(scrollYProgress, [0, 0.6], [1, 0])
  const stageProgress = useTransform(scrollYProgress, [0, 1], [0, 1])

  const [currentProgress, setCurrentProgress] = useState(0)
  useEffect(() => {
    const unsub = stageProgress.on('change', (v) => setCurrentProgress(v))
    return unsub
  }, [stageProgress])

  return (
    <section
      ref={heroRef}
      className="relative flex min-h-[120vh] flex-col overflow-hidden"
      style={{ background: '#030812' }}
    >
      {/* 3D Canvas */}
      <div className="absolute inset-0">
        {reducedMotion || isMobile ? (
          <MobileBackground />
        ) : (
          <motion.div
            className="h-full w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: sceneLoaded ? 1 : 0 }}
            transition={{ duration: 1.5 }}
          >
            <HeroScene
              mouseRef={mouseRef}
              scrollRef={scrollRef}
              isMobile={isMobile}
            />
          </motion.div>
        )}
      </div>

      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 110% 110% at 50% 50%, transparent 40%, #030812 95%)',
          opacity: 0.8,
        }}
      />
      {/* Bottom fade */}
      <div
        className="pointer-events-none absolute bottom-0 inset-x-0 h-48"
        style={{ background: 'linear-gradient(to top, #030812, transparent)' }}
      />

      {/* Content */}
      <motion.div
        data-hero-content
        className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-6 pt-28 pb-24 lg:px-10"
        style={mounted && !reducedMotion ? { y: contentY, opacity: contentOp } : {}}
      >
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">

          {/* Left: copy + input */}
          <div className="flex flex-col">

            {/* Stage indicator */}
            <motion.div
              className="mb-6"
              custom={0}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
            >
              <StageIndicator progress={currentProgress} />
            </motion.div>

            {/* Badge */}
            <motion.div
              className="mb-7"
              custom={0.5}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
            >
              <span
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-medium tracking-[0.14em] text-slate-400 uppercase"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
                </span>
                Machine Trust Intelligence
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              custom={1}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="text-[clamp(2.75rem,6.5vw,5rem)] font-bold leading-[1.06] tracking-[-0.04em] text-balance"
            >
              <span className="text-white">From digital chaos</span>
              <br />
              <span className="text-white">to </span>
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #0BCEBC 0%, #00C8FF 50%, #7C5CFF 100%)',
                }}
              >
                machine intelligence.
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              custom={2}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="mt-7 max-w-[540px] text-[16px] leading-[1.75] text-slate-400"
            >
              SiteNexis transforms fragmented web signals into structured machine understanding.
              12 intelligence scores. 16 autonomous agents. Real-time retrieval simulation.
              See exactly where AI systems trust your content — and where they don&apos;t.
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
              <p className="mt-4 text-[12px] tracking-wide text-slate-500">
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
                <span key={item} className="flex items-center gap-2 text-[12px] text-slate-400">
                  <span className="h-px w-4 bg-gradient-to-r from-teal-500/60 to-transparent" />
                  {item}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Right: score preview */}
          <div className="hidden lg:flex lg:flex-col lg:items-end">
            <div className="relative w-full max-w-xs space-y-2.5">

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 0.6 }}
                className="mb-5 text-right text-[11px] font-medium tracking-[0.12em] text-slate-600 uppercase"
              >
                Live Intelligence Preview
              </motion.p>

              {PREVIEW_SCORES.map(({ label, score, color }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: 32 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="group flex items-center gap-4 rounded-xl px-4 py-3"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                  }}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold"
                    style={{
                      background: `${color}10`,
                      border: `1px solid ${color}22`,
                      color,
                    }}
                  >
                    {score}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-slate-400">{label}</span>
                    <div className="h-[2px] w-full overflow-hidden rounded-full bg-white/[0.03]">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${score}%` }}
                        transition={{ delay: 1.0 + i * 0.1, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5, duration: 0.5 }}
                className="mt-3 flex items-center justify-between rounded-xl px-4 py-3"
                style={{
                  background: 'rgba(11,206,188,0.03)',
                  border: '1px solid rgba(11,206,188,0.1)',
                }}
              >
                <span className="flex items-center gap-2 text-[12px] text-teal-500/70">
                  <Zap size={11} strokeWidth={2} />
                  Analysing example.com
                </span>
                <span className="text-[10px] text-slate-600">16 agents active</span>
              </motion.div>
            </div>
          </div>

        </div>
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
      >
        <span className="text-[10px] tracking-[0.2em] uppercase text-slate-600">Scroll to discover</span>
        <motion.div
          className="h-6 w-px bg-gradient-to-b from-teal-500/50 to-transparent"
          animate={{ scaleY: [1, 0.5, 1], opacity: [0.6, 0.3, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>
    </section>
  )
}
