'use client'

import { useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft, Check } from 'lucide-react'
import { createSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client'

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

function ResetForm() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  const configured = isSupabaseConfigured()

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError('')

    const supabase = createSupabaseBrowserClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    })

    setLoading(false)
    if (err) { setError(err.message); return }
    setSent(true)
  }, [email])

  return (
    <div className="w-full max-w-[400px]">
      {/* Logo */}
      <div className="mb-9 flex items-center justify-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04]">
          <PentagonMark size={18} />
        </div>
        <span className="text-[17px] font-bold tracking-[-0.01em] text-white">SiteNexis</span>
      </div>

      <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-8 shadow-[0_8px_48px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        {sent ? (
          <>
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-teal-500/[0.2] bg-teal-500/[0.1]">
              <Check size={22} className="text-teal-400" strokeWidth={2} />
            </div>
            <h1 className="text-[22px] font-bold tracking-[-0.02em] text-white">Check your email</h1>
            <p className="mt-2 text-[14px] leading-[1.7] text-slate-500">
              If an account exists for{' '}
              <span className="font-medium text-white">{email}</span>,
              you&apos;ll receive a password reset link shortly.
            </p>
            <p className="mt-4 text-[12px] text-slate-600">
              The link expires in 1 hour. Check your spam folder if you don&apos;t see it.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-[22px] font-bold tracking-[-0.02em] text-white">Reset password</h1>
            <p className="mt-1.5 text-[14px] text-slate-500">
              Enter your email and we&apos;ll send you a reset link.
            </p>

            {!configured && (
              <div className="mt-5 rounded-xl border border-amber-500/[0.2] bg-amber-500/[0.08] px-4 py-3 text-[12px] text-amber-400">
                Supabase is not configured. Password reset is unavailable in demo mode.
              </div>
            )}

            {configured && (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
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

                {error && (
                  <div className="rounded-xl border border-red-500/[0.2] bg-red-500/[0.08] px-4 py-3 text-[12px] text-red-400">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 py-3 text-[13px] font-bold text-[#050816] transition-all hover:shadow-[0_0_20px_rgba(0,200,255,0.25)] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:translate-y-0"
                >
                  {loading ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#050816]/30 border-t-[#050816]" />
                      Sending…
                    </>
                  ) : 'Send reset link'}
                </button>
              </form>
            )}
          </>
        )}
      </div>

      <p className="mt-6 text-center text-[13px] text-slate-600">
        <Link href="/login" className="inline-flex items-center gap-1.5 font-medium text-slate-400 hover:text-white transition">
          <ArrowLeft size={13} strokeWidth={2} /> Back to sign in
        </Link>
      </p>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="h-64 w-full max-w-[400px] animate-pulse rounded-[24px] bg-white/[0.03]" />}>
      <ResetForm />
    </Suspense>
  )
}
