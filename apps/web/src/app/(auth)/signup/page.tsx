'use client'

import { useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, Check } from 'lucide-react'
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

function TwitterXIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function DiscordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026c.462-.62.874-1.275 1.226-1.963a.074.074 0 0 0-.041-.104 13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z" />
    </svg>
  )
}

function PentagonMark({ size = 18 }: { size?: number }) {
  const cx = size / 2, cy = size / 2, r = size * 0.42
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
  }).join(' ')
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden>
      <polygon points={pts} stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" fill="rgba(255,255,255,0.04)" />
    </svg>
  )
}

const PLAN_LABELS: Record<string, { name: string; color: string; bg: string; border: string }> = {
  starter: { name: 'Starter — 50 audits/month',              color: 'text-cyan-400',   bg: 'bg-cyan-500/[0.08]',   border: 'border-cyan-500/[0.15]'   },
  pro:     { name: 'Pro — Unlimited + Layer 4 Intelligence', color: 'text-teal-400',   bg: 'bg-teal-500/[0.08]',   border: 'border-teal-500/[0.15]'   },
  agency:  { name: 'Agency — Everything + API access',       color: 'text-purple-400', bg: 'bg-purple-500/[0.08]', border: 'border-purple-500/[0.15]' },
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

// ── Signup form ───────────────────────────────────────────────────────────────

function SignupForm() {
  const router      = useRouter()
  const searchParams = useSearchParams()
  const plan        = searchParams.get('plan') ?? 'free'

  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [oauthLoad, setOauthLoad] = useState<'google' | 'github' | 'twitter' | 'discord' | null>(null)
  const [error,     setError]     = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const configured = isSupabaseConfigured()
  const planInfo   = PLAN_LABELS[plan]

  // ── OAuth ──────────────────────────────────────────────────────────────────

  const handleOAuth = useCallback(async (provider: 'google' | 'github' | 'twitter' | 'discord') => {
    if (!configured) return
    setOauthLoad(provider)
    setError('')
    const supabase = createSupabaseBrowserClient()
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?plan=${plan}`,
      },
    })
    if (err) { setError(err.message); setOauthLoad(null) }
  }, [configured, plan])

  // ── Email / password signup ────────────────────────────────────────────────

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

    // If session is immediately available (email confirmation disabled), go to dashboard
    if (data.session) {
      router.push('/dashboard')
      router.refresh()
      return
    }

    // Otherwise show email confirmation prompt
    setConfirmed(true)
  }, [email, password, plan, router])

  if (confirmed) {
    return (
      <div className="w-full max-w-[400px]">
        <div className="mb-9 flex items-center justify-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04]">
            <PentagonMark size={18} />
          </div>
          <span className="text-[17px] font-bold tracking-[-0.01em] text-white">SiteNexis</span>
        </div>
        <div className="rounded-[24px] border border-teal-500/[0.15] bg-white/[0.03] p-8 shadow-[0_8px_48px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-teal-500/[0.2] bg-teal-500/[0.1]">
            <Check size={22} className="text-teal-400" strokeWidth={2} />
          </div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-white">Check your email</h1>
          <p className="mt-2 text-[14px] leading-[1.7] text-slate-500">
            We sent a confirmation link to{' '}
            <span className="font-medium text-white">{email}</span>.
            Click it to activate your account — the link expires in 1 hour.
          </p>
          <p className="mt-4 text-[12px] text-slate-600">
            Didn&apos;t receive it? Check your spam folder or{' '}
            <button onClick={() => setConfirmed(false)} className="text-teal-400 hover:underline">
              try again
            </button>.
          </p>
        </div>
        <p className="mt-6 text-center text-[13px] text-slate-600">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-slate-400 hover:text-white transition">Sign in</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[400px]">

      {/* Logo */}
      <div className="mb-9 flex items-center justify-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04]">
          <PentagonMark size={18} />
        </div>
        <span className="text-[17px] font-bold tracking-[-0.01em] text-white">SiteNexis</span>
      </div>

      {/* Card */}
      <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-8 shadow-[0_8px_48px_rgba(0,0,0,0.5)] backdrop-blur-2xl">

        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-white">Create your account</h1>
        <p className="mt-1.5 text-[14px] text-slate-500">
          {planInfo ? `Signing up for ${planInfo.name}.` : 'Free plan — no credit card required.'}
        </p>

        {/* Plan badge */}
        {planInfo && (
          <div className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${planInfo.color} ${planInfo.bg} ${planInfo.border}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {planInfo.name}
          </div>
        )}

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
              className="mt-3 w-full rounded-lg border border-amber-500/[0.25] bg-amber-500/[0.12] py-2 text-[12px] font-semibold text-amber-300 hover:bg-amber-500/[0.2] transition"
            >
              Enter demo dashboard →
            </button>
          </div>
        )}

        {configured && (
          <>
            {/* OAuth */}
            <div className="mt-6 grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleOAuth('google')}
                disabled={!!oauthLoad}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-3 text-[13px] font-medium text-white transition-all hover:border-white/[0.18] hover:bg-white/[0.07] disabled:opacity-50"
              >
                {oauthLoad === 'google' ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" /> : <GoogleIcon />}
                Google
              </button>
              <button
                onClick={() => handleOAuth('github')}
                disabled={!!oauthLoad}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-3 text-[13px] font-medium text-white transition-all hover:border-white/[0.18] hover:bg-white/[0.07] disabled:opacity-50"
              >
                {oauthLoad === 'github' ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" /> : <GitHubIcon />}
                GitHub
              </button>
              <button
                onClick={() => handleOAuth('twitter')}
                disabled={!!oauthLoad}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-3 text-[13px] font-medium text-white transition-all hover:border-white/[0.18] hover:bg-white/[0.07] disabled:opacity-50"
              >
                {oauthLoad === 'twitter' ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" /> : <TwitterXIcon />}
                Twitter / X
              </button>
              <button
                onClick={() => handleOAuth('discord')}
                disabled={!!oauthLoad}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-3 text-[13px] font-medium text-white transition-all hover:border-white/[0.18] hover:bg-white/[0.07] disabled:opacity-50"
              >
                {oauthLoad === 'discord' ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" /> : <DiscordIcon />}
                Discord
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-6 flex items-center gap-3">
              <div className="flex-1 border-t border-white/[0.07]" />
              <span className="shrink-0 text-[11px] font-medium text-slate-600">or sign up with email</span>
              <div className="flex-1 border-t border-white/[0.07]" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>

              {/* Email */}
              <div>
                <label htmlFor="email" className="mb-1.5 block text-[12px] font-medium text-slate-500">Email address</label>
                <div className="relative">
                  <Mail size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" strokeWidth={1.5} />
                  <input
                    id="email"
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
                <label htmlFor="password" className="mb-1.5 block text-[12px] font-medium text-slate-500">Password</label>
                <div className="relative">
                  <Lock size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" strokeWidth={1.5} />
                  <input
                    id="password"
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
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition"
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                  >
                    {showPass ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
                  </button>
                </div>
                <StrengthBar password={password} />
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-xl border border-red-500/[0.2] bg-red-500/[0.08] px-4 py-3 text-[12px] text-red-400">
                  {error}
                </div>
              )}

              {/* Terms */}
              <p className="text-[11px] text-slate-700">
                By creating an account you agree to our{' '}
                <Link href="/terms" className="text-slate-500 hover:text-slate-300 underline underline-offset-2">Terms</Link>
                {' '}and{' '}
                <Link href="/privacy" className="text-slate-500 hover:text-slate-300 underline underline-offset-2">Privacy Policy</Link>.
              </p>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !email || password.length < 8}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 py-3 text-[13px] font-bold text-[#050816] transition-all hover:shadow-[0_0_20px_rgba(0,200,255,0.25)] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:translate-y-0 disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#050816]/30 border-t-[#050816]" />
                    Creating account…
                  </>
                ) : (
                  'Create account'
                )}
              </button>
            </form>
          </>
        )}
      </div>

      {/* Footer */}
      <p className="mt-6 text-center text-[13px] text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-slate-400 hover:text-white transition">Sign in</Link>
      </p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-[400px] rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-8">
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-white/[0.04]" />
          ))}
        </div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  )
}
