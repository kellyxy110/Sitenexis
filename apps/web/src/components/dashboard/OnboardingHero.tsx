'use client';

import { useState } from 'react';
import { ArrowRight, Brain, ScanSearch, ShieldCheck, Zap } from 'lucide-react';

interface OnboardingHeroProps {
  onRunAudit: (domain: string) => void;
  isAuditing?: boolean;
  error?: string | null;
  userName?: string | null;
}

const FEATURES = [
  {
    icon: Brain,
    label: 'AI Visibility Score',
    description: 'How AI systems like ChatGPT, Gemini, and Perplexity retrieve and rank your content',
  },
  {
    icon: ScanSearch,
    label: 'Retrieval Simulation',
    description: 'Six-stage simulation of the AI pipeline — from chunk extraction to citation eligibility',
  },
  {
    icon: ShieldCheck,
    label: 'Machine Trust Analysis',
    description: 'Entity credibility, schema alignment, contradiction detection, and trust decay signals',
  },
];

export function OnboardingHero({ onRunAudit, isAuditing, error, userName }: OnboardingHeroProps) {
  const [domain, setDomain] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!clean) return;
    onRunAudit(clean);
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-deepspace">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-cyan/[0.04] blur-3xl" />
      </div>

      <div className="relative px-6 py-14 sm:px-12 sm:py-20 text-center">
        {/* Greeting */}
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          {userName ? `Welcome, ${userName}` : 'Welcome to SiteNexis'}
        </p>

        <h2 className="text-[28px] font-bold leading-tight tracking-tight text-white sm:text-[36px]">
          Discover how AI systems<br className="hidden sm:block" />{' '}
          <span className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
            see your website
          </span>
        </h2>

        <p className="mx-auto mt-4 max-w-lg text-[15px] leading-[1.75] text-slate-400">
          Enter any domain to run a full 16-agent intelligence audit — SEO health, AI retrievability,
          entity trust, citation probability, and machine trust score in one report.
        </p>

        {/* Domain input */}
        <form onSubmit={handleSubmit} className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            disabled={isAuditing}
            className="flex-1 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder-slate-600 outline-none transition-colors focus:border-cyan/40 focus:bg-white/[0.06] disabled:opacity-50"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={isAuditing || !domain.trim()}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-6 py-3 text-[14px] font-semibold text-[#030907] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(0,200,255,0.3)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {isAuditing ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Auditing...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 fill-current" />
                Run Free Audit
              </>
            )}
          </button>
        </form>

        {error && (
          <p className="mx-auto mt-3 max-w-lg text-sm text-red-400">{error}</p>
        )}

        <p className="mt-3 text-[12px] text-slate-600">
          Free plan · 1 audit/month · No card required
        </p>

        {/* Feature highlights */}
        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-4 text-left sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, label, description }) => (
            <div
              key={label}
              className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5"
            >
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-cyan/[0.15] bg-cyan/[0.06]">
                <Icon className="h-4 w-4 text-cyan" strokeWidth={1.75} />
              </div>
              <p className="mb-1 text-[13px] font-semibold text-white">{label}</p>
              <p className="text-[12px] leading-[1.65] text-slate-500">{description}</p>
            </div>
          ))}
        </div>

        {/* Social proof */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-[12px] text-slate-600">
          <span className="flex items-center gap-1.5">
            <ArrowRight className="h-3 w-3 text-teal-500" />
            12 dimensions analyzed
          </span>
          <span className="flex items-center gap-1.5">
            <ArrowRight className="h-3 w-3 text-teal-500" />
            16 intelligence agents
          </span>
          <span className="flex items-center gap-1.5">
            <ArrowRight className="h-3 w-3 text-teal-500" />
            Every score fully explainable
          </span>
        </div>
      </div>
    </section>
  );
}
