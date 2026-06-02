'use client'

import { useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, Check, Brain, Network, Shield, Zap } from 'lucide-react'
import { createSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client'

// ── SVG icons ─────────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

function PentagonMark({ size = 20 }: { size?: number }) {
  const cx = size / 2, cy = size / 2, r = size * 0.42
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
  }).join(' ')
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden>
      <polygon points={pts} stroke="rgba(0,200,255,0.7)" strokeWidth="1.4" fill="rgba(0,200,255,0.1)" />
    </svg>
  )
}

// ── Password strength ─────────────────────────────────────────────────────────

function getStrength(pw: string): number {
  if (pw.length === 0) return 0
  let s = 0
  if (pw.length >= 8)  s++
  if (pw.length >= 12) s++
  if (/[A-Z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s
}

function StrengthBar({ password }: { password: string }) {
  const s = getStrength(password)
  if (!password) return null
  const label = s <= 1 ? 'Weak' : s <= 3 ? 'Fair' : 'Strong'
  const color  = s <= 1 ? 'bg-red-500' : s <= 3 ? 'bg-amber-500' : 'bg-teal-500'
  const width  = `${Math.min((s / 5) * 100, 100)}%`
  return (
    <div className="mt-2">
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width }} />
      </div>
      <p className="mt-1 text-[10px] text-slate-600">{label} password</p>
    </div>
  )
}

// ── Left brand panel ──────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Brain,   title: 'AI Visibility Scoring',    desc: 'See exactly how ChatGPT, Perplexity, and Google AI Overviews perceive your content.' },
  { icon: Network, title: 'Entity Intelligence Engine', desc: 'Map every named entity on your domain and score consistency, coverage, and disambiguation.' },
  { icon: Shield,  title: 'Machine Trust Layer',       desc: 'Model how AI systems form, maintain, and lose trust in your website over time.' },
  { icon: Zap,     title: 'Retrieval Simulation',      desc: 'Simulate the 6-stage AI retrieval pipeline and identify every failure point.' },
]

const STATS = [
  { value: '10',   label: 'Free starter credits' },
  { value: '12',   label: 'Intelligence dimensions' },
  { value: '16',   label: 'Analysis agents' },
]

function BrandPanel() {
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden px-12 py-14 xl:px-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_30%_40%,rgba(0,200,255,0.09),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_70%_80%,rgba(11,206,188,0.06),transparent)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `linear-gradient(rgba(0,200,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,200,255,0.04) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />
      <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-cyan-500/[0.04] blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 right-10 h-48 w-48 rounded-full bg-teal-500/[0.05] blur-2xl" />

      <div className="relative space-y-10">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/[0.08]">
            <PentagonMark size={22} />
          </div>
          <div>
            <span className="block text-[20px] font-bold tracking-[-0.02em] text-white" style={{ fontFamily: 'Georgia, serif' }}>
              SiteNexis
            </span>
            <span className="block text-[11px] font-medium tracking-[0.1em] uppercase text-cyan-500/60">
              AI Visibility Intelligence
            </span>
          </div>
        </div>

        {/* Headline */}
        <div>
          <h1 className="text-[32px] font-bold leading-[1.2] tracking-[-0.03em] text-white xl:text-[36px]">
            Start free.<br />
            <span className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
              10 credits included.
            </span>
          </h1>
          <p className="mt-4 text-[15px] leading-[1.7] text-slate-400 max-w-[380px]">
            Model machine perception, trust formation, and retrieval behaviour across the AI ecosystem — no credit card required.
          </p>
        </div>

        {/* Features */}
        <div className="space-y-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-4">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04]">
                <Icon size={16} className="text-cyan-400" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white">{title}</p>
                <p className="mt-0.5 text-[12px] leading-[1.6] text-slate-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="relative mt-10 grid grid-cols-3 gap-4 border-t border-white/[0.06] pt-8">
        {STATS.map(({ value, label }) => (
          <div key={label}>
            <p className="text-[28px] font-bold tracking-[-0.03em] text-white">{value}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Signup form ───────────────────────────────────────────────────────────────

function SignupForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const plan         = searchParams.get('plan') ?? 'free'

  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [oauthLoad, setOauthLoad] = useState<'google' | 'github' | null>(null)
  const [error,     setError]     = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const configured = isSupabaseConfigured()

  const handleOAuth = useCallback(async (provider: 'google' | 'github') => {
    if (!configured) return
    setOauthLoad(provider)
    setError('')
    const supabase = createSupabaseBrowserClient()
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?plan=${plan}` },
    })
    if (err) { setError(err.message); setOauthLoad(null) }
  }, [configured, plan])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }

    setLoading(true)
    setError('')

    const supabase = createSupabaseBrowserClient()
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?plan=${plan}`,
        data: { plan },
      },
    })

    setLoading(false)

    if (err) {
      if (err.message.includes('already registered')) {
        setError('An account with this email already exists. Sign in instead.')
      } else {
        setError(err.message)
      }
      return
    }

    if (data.session) {
      router.push('/dashboard')
      router.refresh()
      return
    }

    setConfirmed(true)
  }, [email, password, plan, router])

  // ── Confirmed state ──────────────────────────────────────────────────────────

  if (confirmed) {
    return (
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/[0.08]">
            <PentagonMark size={18} />
          </div>
          <span className="text-[17px] font-bold tracking-[-0.01em] text-white" style={{ fontFamily: 'Georgia, serif' }}>SiteNexis</span>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-teal-500/[0.2] bg-teal-500/[0.1] mb-5">
          <Check size={22} className="text-teal-400" strokeWidth={2} />
        </div>
        <h1 className="text-[24px] font-bold tracking-[-0.02em] text-white">Check your email</h1>
        <p className="mt-2 text-[14px] leading-[1.7] text-slate-500">
          We sent a confirmation link to <span className="font-medium text-white">{email}</span>.{' '}
          Click it to activate your account — the link expires in 1 hour.
        </p>
        <p className="mt-4 text-[12px] text-slate-600">
          Didn&apos;t receive it? Check spam or{' '}
          <button onClick={() => setConfirmed(false)} className="text-teal-400 hover:underline">
            try again
          </button>.
        </p>
        <p className="mt-7 text-center text-[13px] text-slate-600">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-slate-400 transition hover:text-white">Sign in</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[400px]">

      {/* Mobile logo */}
      <div className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/[0.08]">
          <PentagonMark size={18} />
        </div>
        <span className="text-[17px] font-bold tracking-[-0.01em] text-white" style={{ fontFamily: 'Georgia, serif' }}>SiteNexis</span>
      </div>

      <h2 className="text-[24px] font-bold tracking-[-0.02em] text-white">Create your account</h2>
      <p className="mt-1.5 text-[14px] text-slate-500">Free — 10 credits included. No card required.</p>

      {/* Demo mode */}
      {!configured && (
        <div className="mt-6 rounded-xl border border-amber-500/[0.2] bg-amber-500/[0.08] px-4 py-3">
          <p className="text-[12px] font-semibold text-amber-400">Demo mode active</p>
          <p className="mt-0.5 text-[11px] text-amber-400/70">
            Add Supabase credentials to{' '}
            <code className="rounded bg-amber-500/[0.15] px-1 font-mono text-amber-300">apps/web/.env</code> to enable auth.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-3 w-full rounded-lg border border-amber-500/[0.25] bg-amber-500/[0.12] py-2 text-[12px] font-semibold text-amber-300 transition hover:bg-amber-500/[0.2]"
          >
            Enter demo dashboard →
          </button>
        </div>
      )}

      {configured && (
        <>
          {/* OAuth */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            {([
              { provider: 'google' as const, label: 'Google', Icon: GoogleIcon },
              { provider: 'github' as const, label: 'GitHub', Icon: GitHubIcon },
            ]).map(({ provider, label, Icon }) => (
              <button
                key={provider}
                onClick={() => handleOAuth(provider)}
                disabled={!!oauthLoad}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-3 text-[13px] font-medium text-white transition-all hover:border-white/[0.18] hover:bg-white/[0.07] disabled:opacity-50"
              >
                {oauthLoad === provider
                  ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  : <Icon />}
                {label}
              </button>
            ))}
          </div>

          <div className="relative my-6 flex items-center gap-3">
            <div className="flex-1 border-t border-white/[0.07]" />
            <span className="shrink-0 text-[11px] font-medium text-slate-600">or sign up with email</span>
            <div className="flex-1 border-t border-white/[0.07]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <label htmlFor="su-email" className="mb-1.5 block text-[12px] font-medium text-slate-500">Email address</label>
              <div className="relative">
                <Mail size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" strokeWidth={1.5} />
                <input
                  id="su-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  autoFocus
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-3 pl-10 pr-4 text-[14px] text-white placeholder-slate-700 outline-none transition focus:border-teal-500/[0.4] focus:bg-white/[0.06] focus:ring-2 focus:ring-teal-500/[0.12]"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="su-password" className="mb-1.5 block text-[12px] font-medium text-slate-500">Password</label>
              <div className="relative">
                <Lock size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" strokeWidth={1.5} />
                <input
                  id="su-password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-3 pl-10 pr-12 text-[14px] text-white placeholder-slate-700 outline-none transition focus:border-teal-500/[0.4] focus:bg-white/[0.06] focus:ring-2 focus:ring-teal-500/[0.12]"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 transition hover:text-slate-400"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
                </button>
              </div>
              <StrengthBar password={password} />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/[0.2] bg-red-500/[0.08] px-4 py-3 text-[12px] text-red-400">
                {error}
              </div>
            )}

            <p className="text-[11px] text-slate-700">
              By creating an account you agree to our{' '}
              <Link href="/terms" className="text-slate-500 hover:text-slate-300 underline underline-offset-2">Terms</Link>
              {' '}and{' '}
              <Link href="/privacy" className="text-slate-500 hover:text-slate-300 underline underline-offset-2">Privacy Policy</Link>.
            </p>

            <button
              type="submit"
              disabled={loading || !email || password.length < 8}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 py-3 text-[13px] font-bold text-[#050816] transition-all hover:shadow-[0_0_20px_rgba(0,200,255,0.25)] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:translate-y-0 disabled:shadow-none"
            >
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#050816]/30 border-t-[#050816]" />
                  Creating account…
                </>
              ) : 'Create account — free'}
            </button>
          </form>

          {/* Trust signals */}
          <div className="mt-5 flex items-center justify-center gap-4 text-[11px] text-slate-600">
            {['10 free credits', 'No card required', 'Cancel anytime'].map(t => (
              <span key={t} className="flex items-center gap-1">
                <Check size={10} className="text-teal-600" />
                {t}
              </span>
            ))}
          </div>
        </>
      )}

      <p className="mt-7 text-center text-[13px] text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-slate-400 transition hover:text-white">Sign in</Link>
      </p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center bg-[#07111F]">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-white/[0.06]" />
      </div>
    }>
      <div className="fixed inset-0 flex overflow-auto bg-[#07111F]">

        {/* Ambient background */}
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_50%_at_20%_30%,rgba(0,200,255,0.07),transparent)]" />
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_40%_35%_at_80%_80%,rgba(11,206,188,0.04),transparent)]" />

        {/* Left — brand panel (hidden on mobile) */}
        <div className="hidden lg:flex lg:w-[52%] border-r border-white/[0.05] bg-[#060f1c]">
          <BrandPanel />
        </div>

        {/* Right — signup form */}
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <SignupForm />
        </div>
      </div>
    </Suspense>
  )
}
