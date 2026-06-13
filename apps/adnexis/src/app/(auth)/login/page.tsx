'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  async function handleGoogleLogin() {
    setOauthLoading(true);
    setError('');
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/api/auth/callback` },
      });
      if (oauthError) throw oauthError;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
      setOauthLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      if (msg.toLowerCase().includes('invalid login') || msg.toLowerCase().includes('invalid credentials')) {
        setError('Incorrect email or password.');
      } else if (msg.toLowerCase().includes('email not confirmed')) {
        setError('Please confirm your email before signing in.');
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  }

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-8 shadow-card w-full max-w-sm">
      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold text-text-primary">Sign in to AdNexis</h2>
        <p className="text-text-secondary text-sm mt-1">AI Creative Intelligence</p>
      </div>

      {/* Google OAuth */}
      <button
        onClick={() => void handleGoogleLogin()}
        disabled={oauthLoading || loading}
        className="w-full flex items-center justify-center gap-2.5 border border-border bg-bg-elevated hover:bg-bg-card text-text-primary px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 mb-4"
      >
        {oauthLoading ? <Loader2 size={16} className="animate-spin" /> : <GoogleIcon />}
        Continue with Google
      </button>

      <div className="relative my-5 flex items-center gap-3">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs text-text-muted">or</span>
        <div className="flex-1 border-t border-border" />
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-text-primary placeholder-text-muted text-sm focus:border-purple focus:outline-none transition-colors"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-1.5" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2.5 text-text-primary placeholder-text-muted text-sm focus:border-purple focus:outline-none transition-colors"
            placeholder="••••••••"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading || oauthLoading}
          className="w-full bg-purple hover:bg-purple-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-text-secondary text-sm mt-6 text-center">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-purple hover:text-purple-light transition-colors">
          Sign up
        </Link>
      </p>
    </div>
  );
}
