'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, ArrowRight, Shield, Loader2, BarChart3, Lock, Zap } from 'lucide-react';
import { Footer } from '@/components/marketing/Footer';

export default function MTSInputPage() {
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim()) return;
    setLoading(true);
    const clean = domain.trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .toLowerCase();
    router.push(`/mts/${encodeURIComponent(clean)}`);
  }

  return (
    <main className="min-h-screen bg-[#0A1628] text-slate-200">

      {/* Hero */}
      <section className="px-6 pt-28 pb-16 text-center">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 inline-flex items-center justify-center">
            <div className="relative">
              <div className="absolute -inset-4 rounded-full bg-cyan-500/10 blur-xl" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/5">
                <Shield size={28} className="text-cyan-400" />
              </div>
            </div>
          </div>
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/[0.08] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-cyan-400">
            <BarChart3 size={11} /> Free · No account · Instant
          </span>
          <h1 className="mt-4 mb-4 font-serif text-5xl font-bold tracking-tight text-white sm:text-6xl">
            Machine Trust Score
          </h1>
          <p className="mb-2 text-xl leading-relaxed text-slate-400">
            The single number that tells you how deeply AI ecosystems trust, retrieve, and recommend your domain.
          </p>
          <p className="text-[13px] text-slate-600">
            4 dimensions · 16 signals · shareable badge · no account required
          </p>
        </div>
      </section>

      {/* Input */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-xl">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <Globe size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="yourdomain.com"
                spellCheck={false}
                autoCapitalize="off"
                autoFocus
                className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] py-4 pl-11 pr-4 text-[16px] text-slate-200 placeholder-slate-600 outline-none transition focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !domain.trim()}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-cyan-500 px-6 py-4 text-[14px] font-semibold text-[#0A1628] transition hover:opacity-90 disabled:opacity-40"
            >
              {loading
                ? <><Loader2 size={15} className="animate-spin" /> Scoring…</>
                : <><ArrowRight size={15} /> Score it</>
              }
            </button>
          </form>

          {/* What it measures */}
          <div className="mt-12 grid gap-3 sm:grid-cols-2">
            {[
              { icon: <Shield size={14} />, label: 'Crawlability', detail: 'HTTPS · robots.txt · AI crawler access · sitemap', color: 'text-cyan-400' },
              { icon: <Lock size={14} />,   label: 'Content Trust', detail: 'Title · H1 · depth · external authority references', color: 'text-teal-400' },
              { icon: <Globe size={14} />,  label: 'Entity Clarity', detail: 'Schema.org · sameAs · organization · author', color: 'text-blue-400' },
              { icon: <Zap size={14} />,    label: 'Citation Readiness', detail: 'FAQPage · Article schema · canonical · structured data', color: 'text-amber-400' },
            ].map(({ icon, label, detail, color }) => (
              <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5">
                <div className={`mb-1 flex items-center gap-2 text-[13px] font-semibold ${color}`}>
                  {icon} {label}
                </div>
                <p className="text-[11px] text-slate-600">{detail}</p>
              </div>
            ))}
          </div>

          {/* Example domains */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-600">Try:</span>
            {['sitenexis.vercel.app', 'wikipedia.org', 'stripe.com', 'nytimes.com'].map((d) => (
              <button
                key={d}
                onClick={() => { setDomain(d); }}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1 font-mono text-[11px] text-slate-500 transition hover:border-white/[0.12] hover:text-slate-300"
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
