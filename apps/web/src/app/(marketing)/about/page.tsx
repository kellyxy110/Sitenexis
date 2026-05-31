import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About SiteNexis — AI Retrieval & Machine Trust Intelligence',
  description:
    'SiteNexis is the first AI Visibility Operating System. We model how AI systems retrieve, interpret, trust, and recommend web content — across every layer of the intelligence stack.',
};

function PentagonMark({ size = 20 }: { size?: number }) {
  const cx = size / 2, cy = size / 2, r = size * 0.42;
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden>
      <polygon points={pts} stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" fill="rgba(255,255,255,0.04)" />
      <polygon points={pts} stroke="rgba(11,206,188,0.35)" strokeWidth="0.6" fill="none"
        style={{ transform: `scale(0.55) translate(${size * 0.45}px, ${size * 0.45}px)` }} />
    </svg>
  );
}

const TEAM_ROLES = [
  { role: 'Founders', description: 'Building the infrastructure layer for the machine-first web.' },
  { role: 'AI Research', description: 'Modeling retrieval behavior across all major AI systems.' },
  { role: 'Engineering', description: 'Building the 16-agent analysis pipeline and real-time monitoring.' },
  { role: 'Product', description: 'Translating machine intelligence into actionable human insight.' },
];

const VALUES = [
  {
    title: 'Semantic integrity over manipulation',
    body: 'We build tools that improve genuine content quality. SiteNexis will never help manufacture authority that isn\'t earned.',
  },
  {
    title: 'Explainability is non-negotiable',
    body: 'Every score deduction maps to a named, actionable issue. No black boxes. No composite scores without sub-score breakdowns.',
  },
  {
    title: 'Deterministic by design',
    body: 'The same content always produces the same score. Reproducibility enables trust. Trust enables improvement.',
  },
  {
    title: 'The machine-first web is already here',
    body: 'AI systems are already the primary discovery layer for millions of queries. We build for where the web is going, not where it was.',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-midnight font-ui text-white antialiased">
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-20 px-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(0,200,255,0.06),transparent)]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">About</p>
          <h1 className="mt-4 text-[42px] font-bold leading-[1.1] tracking-[-0.03em] text-white md:text-[52px]">
            Built for the<br />
            <span className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">machine-first web</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-[1.75] text-slate-300">
            SiteNexis is the first AI Visibility Operating System. We model how AI systems retrieve,
            interpret, trust, and recommend web content — and give every publisher the intelligence
            to be visible in the machine-first web.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="border-t border-white/[0.05] bg-[#0A1628] py-20 px-6">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-12 md:grid-cols-2">
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/70">Mission</p>
              <h2 className="mb-4 text-[26px] font-bold leading-tight text-white">
                Making web content visible to machines — and trustworthy to AI systems.
              </h2>
              <p className="text-[15px] leading-[1.75] text-slate-400">
                The transition from keyword-based search to AI-mediated discovery is the largest structural
                shift in how web content is found since the invention of PageRank. SiteNexis gives
                every publisher — from solo founders to enterprise teams — the same intelligence layer
                that only the most sophisticated AI-native companies currently have.
              </p>
            </div>
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/70">What we built</p>
              <h2 className="mb-4 text-[26px] font-bold leading-tight text-white">
                A four-layer intelligence stack for machine trust.
              </h2>
              <p className="text-[15px] leading-[1.75] text-slate-400">
                SiteNexis runs 16 intelligence agents across four layers: crawl and structure,
                semantic intelligence, AI visibility, and machine trust. Every scan produces a
                complete picture of how AI systems perceive, retrieve, trust, and recommend
                your content — with actionable recommendations at each layer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/70">Principles</p>
          <h2 className="mb-10 text-[28px] font-bold text-white">What we believe</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {VALUES.map((v) => (
              <div key={v.title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h3 className="mb-2 text-[15px] font-semibold text-white">{v.title}</h3>
                <p className="text-[13px] leading-[1.7] text-slate-400">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="border-t border-white/[0.05] bg-[#0A1628] py-20 px-6">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/70">Team</p>
          <h2 className="mb-10 text-[28px] font-bold text-white">Built by AI researchers and engineers</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {TEAM_ROLES.map((t) => (
              <div key={t.role} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                  <PentagonMark size={16} />
                </div>
                <p className="mb-1.5 text-[13px] font-semibold text-white">{t.role}</p>
                <p className="text-[12px] leading-[1.65] text-slate-500">{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-[28px] font-bold text-white">See how SiteNexis works</h2>
          <p className="mb-8 text-[15px] text-slate-400">Run a free audit on any domain. No account required.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/signup"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-6 py-3 text-[14px] font-semibold text-[#050816] hover:-translate-y-0.5 transition-transform">
              Start free audit <ArrowRight size={14} />
            </Link>
            <Link href="/platform/health"
              className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-6 py-3 text-[14px] font-medium text-white hover:border-white/[0.2] transition-colors">
              See SiteNexis health score →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
