'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client';

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter — 50 audits/month',
  pro:     'Pro — Unlimited + AI Intelligence',
  agency:  'Agency — Everything + API access',
};

function SignupForm() {
  const searchParams  = useSearchParams();
  const plan          = searchParams.get('plan') ?? 'free';

  const [email, setEmail]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]         = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError('');

    const supabase = createSupabaseBrowserClient();

    const { error: sbError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?plan=${plan}`,
        data: { plan },
      },
    });

    setLoading(false);
    if (sbError) {
      setError(sbError.message);
    } else {
      setSubmitted(true);
    }
  };

  const configured = isSupabaseConfigured();

  return (
    <>
      {!configured && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-400">
          <p className="font-semibold">Supabase not connected</p>
          <p className="mt-0.5 text-amber-400/70">
            Add your Supabase credentials to <code className="text-amber-300">apps/web/.env</code> to enable auth.
          </p>
        </div>
      )}

      <div className="card-glass rounded-xl p-8">
        <h1 className="font-display text-2xl font-bold text-white">Create your account</h1>
        <p className="mt-2 text-sm text-[#4A6280]">
          {plan && plan !== 'free'
            ? `You're signing up for ${PLAN_LABELS[plan] ?? plan}.`
            : 'Free plan — no credit card required.'}
        </p>

        {submitted ? (
          <div className="mt-6 rounded-lg border border-teal/30 bg-teal/10 px-4 py-4 text-sm text-teal-400">
            <p className="font-semibold">Check your inbox</p>
            <p className="mt-1 text-[#4A6280]">
              We sent a magic link to <span className="text-white">{email}</span>.
              Click it to activate your account — it expires in 1 hour.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#4A6280]">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-[#4A6280] outline-none focus:border-cyan focus:ring-2 focus:ring-cyan/20 disabled:opacity-50"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full rounded-lg bg-cyan px-4 py-2.5 text-sm font-semibold text-navy hover:bg-teal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending…' : 'Get magic link'}
            </button>

            <p className="text-center text-[11px] text-[#4A6280]">
              By signing up you agree to our{' '}
              <Link href="/terms" className="underline hover:text-white">Terms</Link>
              {' '}and{' '}
              <Link href="/privacy" className="underline hover:text-white">Privacy Policy</Link>.
            </p>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-[#4A6280]">
          Already have an account?{' '}
          <Link href="/login" className="text-cyan hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </>
  );
}

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="font-display text-2xl font-bold text-white">
            Site<span className="text-cyan">Nexis</span>
          </Link>
        </div>
        <Suspense fallback={<div className="h-64 rounded-xl border border-white/10 bg-white/5" />}>
          <SignupForm />
        </Suspense>
      </div>
    </main>
  );
}
