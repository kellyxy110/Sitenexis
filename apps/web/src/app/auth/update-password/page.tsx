'use client'

import { useState, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

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

function UpdateForm() {
  const router = useRouter()
  const [password,  setPassword]  = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }

    setLoading(true)
    setError('')

    const supabase = createSupabaseBrowserClient()
    const { error: err } = await supabase.auth.updateUser({ password })

    setLoading(false)
    if (err) { setError(err.message); return }

    router.push('/dashboard')
    router.refresh()
  }, [password, router])

  return (
    <div className="relative min-h-screen bg-[#07111F] font-sans antialiased">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(0,200,255,0.07),transparent)]" />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-16">
        <div className="w-full max-w-[400px]">
          <div className="mb-9 flex items-center justify-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04]">
              <PentagonMark size={18} />
            </div>
            <span className="text-[17px] font-bold tracking-[-0.01em] text-white">SiteNexis</span>
          </div>

          <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-8 shadow-[0_8px_48px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <h1 className="text-[22px] font-bold tracking-[-0.02em] text-white">Set new password</h1>
            <p className="mt-1.5 text-[14px] text-slate-500">Enter your new password below.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-[12px] font-medium text-slate-500">New password</label>
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
                    autoFocus
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-3 pl-10 pr-12 text-[14px] text-white placeholder-slate-700 outline-none transition focus:border-teal-500/[0.4] focus:bg-white/[0.06] focus:ring-2 focus:ring-teal-500/[0.12]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition"
                    aria-label={showPass ? 'Hide' : 'Show'}
                  >
                    {showPass ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/[0.2] bg-red-500/[0.08] px-4 py-3 text-[12px] text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || password.length < 8}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 py-3 text-[13px] font-bold text-[#050816] transition-all hover:shadow-[0_0_20px_rgba(0,200,255,0.25)] hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0"
              >
                {loading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#050816]/30 border-t-[#050816]" />
                    Updating…
                  </>
                ) : 'Update password'}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-[13px] text-slate-600">
            <Link href="/login" className="font-medium text-slate-400 hover:text-white transition">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#07111F]" />}>
      <UpdateForm />
    </Suspense>
  )
}
