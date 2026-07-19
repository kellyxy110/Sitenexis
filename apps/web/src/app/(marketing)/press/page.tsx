import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { Footer } from '@/components/marketing/Footer';
import { Download, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Press & Media — SiteNexis',
  description: 'Company story, founder profile, brand assets, and media contact for SiteNexis.',
  alternates: { canonical: '/press' },
};

const BRAND_COLORS = [
  { name: 'Navy',      hex: '#0A1628', use: 'Primary background, headings' },
  { name: 'Cyan',      hex: '#00C8FF', use: 'Primary accent, CTAs' },
  { name: 'Teal',      hex: '#0BCEBC', use: 'Secondary accent, success states' },
  { name: 'Amber',     hex: '#F59E0B', use: 'Warnings' },
  { name: 'Red',       hex: '#EF4444', use: 'Critical issues, errors' },
];

export default function PressPage() {
  return (
    <div className="min-h-screen bg-midnight font-ui text-white antialiased">
      <MarketingNav />
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-32">
        <h1 className="mb-2 text-[36px] font-bold tracking-[-0.02em] text-white">Press &amp; Media</h1>
        <p className="mb-12 text-[15px] leading-relaxed text-slate-400">
          Company background, founder profile, and brand assets for journalists, partners, and anyone
          writing about SiteNexis.
        </p>

        {/* Company story */}
        <section className="mb-12">
          <h2 className="mb-4 text-[18px] font-semibold text-white">Company Story</h2>
          <p className="text-[14px] leading-[1.75] text-slate-400">
            SiteNexis was founded in 2025 to address a shift in how content is discovered: AI systems —
            ChatGPT, Gemini, Perplexity, Google AI Overviews, Claude — now retrieve, summarize, and cite
            web content directly, bypassing the traditional search-results click. SiteNexis models that
            entire pipeline, from how AI systems chunk and extract a page to whether they trust it enough
            to cite. It runs 16 intelligence agents across four layers — crawl and structure, semantic
            intelligence, AI visibility, and machine trust — and is built and operated by a single founder.
          </p>
          <p className="mt-4 text-[14px] leading-[1.75] text-slate-400">
            Read the full story on the <Link href="/about" className="text-cyan hover:underline">About page</Link>,
            or see the underlying scoring logic on the <Link href="/methodology" className="text-cyan hover:underline">Methodology page</Link>.
          </p>
        </section>

        {/* Mission & vision */}
        <section className="mb-12 rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/5 to-teal-500/5 p-8">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan/70">Mission</p>
          <p className="text-[18px] font-semibold leading-[1.5] text-white">
            Making web content visible to machines — and trustworthy to AI systems. Giving every
            publisher, from solo founders to enterprise teams, the same intelligence layer that only
            the most sophisticated AI-native companies currently have.
          </p>
        </section>

        {/* Founder profile */}
        <section className="mb-12">
          <h2 className="mb-4 text-[18px] font-semibold text-white">Founder</h2>
          <div className="flex items-start gap-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
              <Image src="/founder.jpg" alt="Ekeleme David Kelechi — Founder & CEO, SiteNexis" fill className="object-cover" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-white">Ekeleme David Kelechi</p>
              <p className="text-[13px] text-slate-500">Founder &amp; CEO, SiteNexis</p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
                Builder of AI retrieval and machine trust intelligence systems. Full founder bio,
                background, and social links on the{' '}
                <Link href="/founder" className="text-cyan hover:underline">Founder page</Link>.
              </p>
            </div>
          </div>
        </section>

        {/* Brand assets */}
        <section className="mb-12">
          <h2 className="mb-4 text-[18px] font-semibold text-white">Brand Assets</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <a
              href="/favicon.svg"
              download
              className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:border-teal-500/25"
            >
              <span className="text-[13px] text-slate-300">Logo mark (SVG)</span>
              <Download size={15} className="text-slate-500" />
            </a>
            <a
              href="/og-image"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:border-teal-500/25"
            >
              <span className="text-[13px] text-slate-300">Product screenshot card</span>
              <ArrowRight size={15} className="text-slate-500" />
            </a>
          </div>
          <p className="mb-3 mt-6 text-[12px] font-semibold uppercase tracking-widest text-slate-500">Brand Colors</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {BRAND_COLORS.map((c) => (
              <div key={c.hex} className="flex items-center gap-3 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2.5">
                <span className="h-6 w-6 shrink-0 rounded-md border border-white/10" style={{ backgroundColor: c.hex }} />
                <div className="text-[12px]">
                  <span className="font-mono text-slate-300">{c.hex}</span>{' '}
                  <span className="text-slate-500">— {c.name}, {c.use}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[13px] text-slate-500">
            Need a higher-resolution asset or a specific format? Email us — see Media Contact below.
          </p>
        </section>

        {/* Testimonials / case studies — honest placeholder, not fabricated */}
        <section className="mb-12">
          <h2 className="mb-4 text-[18px] font-semibold text-white">Customer Stories</h2>
          <p className="text-[14px] leading-relaxed text-slate-500">
            SiteNexis is early-stage. We don&apos;t publish testimonials, case studies, or awards we
            haven&apos;t actually earned yet — this section will be populated with real customer outcomes
            as they happen.
          </p>
        </section>

        {/* Media contact */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <p className="text-[14px] text-slate-400">
            Media inquiries, interview requests, or brand-asset needs:{' '}
            <a href="mailto:sitenexisintel@gmail.com" className="text-cyan hover:underline">
              sitenexisintel@gmail.com
            </a>{' '}
            — or use the <Link href="/contact" className="text-cyan hover:underline">Contact page</Link>.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
