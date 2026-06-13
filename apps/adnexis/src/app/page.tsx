import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AdNexis — AI Ad Creative Intelligence Platform',
  description: 'Deconstruct winning ad creatives with AI. Analyze hooks, emotions, funnel stage, and CTA patterns. Generate high-converting ad variations in seconds.',
  alternates: { canonical: 'https://adnexis-eight.vercel.app' },
  openGraph: {
    title: 'AdNexis — AI Ad Creative Intelligence',
    description: 'Analyze winning ads. Understand what makes them convert. Generate better creatives powered by AI.',
    url: 'https://adnexis-eight.vercel.app',
    siteName: 'AdNexis',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'AdNexis — AI Ad Creative Intelligence' },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AdNexis',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'AI-powered ad creative intelligence platform. Deconstruct winning ads, analyze hook types, emotional stacks, funnel stages, and generate high-converting variations.',
  url: 'https://adnexis-eight.vercel.app',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free tier available — up to 10 ads with full AI analysis',
  },
  featureList: [
    'AI hook type classification',
    'Emotional stack analysis',
    'Funnel stage detection',
    'CTA pattern extraction',
    'Performance scoring across 6 dimensions',
    'Ad variation generator',
    'Swipe vault with search and filter',
  ],
  creator: {
    '@type': 'Organization',
    name: 'SiteNexis',
    url: 'https://sitenexis.vercel.app',
  },
};

const FEATURES = [
  {
    icon: '🎯',
    title: 'Hook Type Classification',
    description: 'Every ad gets classified by its hook archetype — fear, curiosity, social proof, authority, transformation, and more. Know exactly what psychological mechanism is driving attention.',
  },
  {
    icon: '🧠',
    title: 'Emotional Stack Analysis',
    description: 'AI maps the full emotional sequence inside each ad: which emotions are triggered, in which order, and how they layer to build conversion pressure.',
  },
  {
    icon: '📊',
    title: 'Performance Scoring',
    description: 'Six-dimension performance score covering hook strength, emotional intensity, novelty, fatigue risk, conversion likelihood, and estimated runway days before creative fatigue sets in.',
  },
  {
    icon: '✍️',
    title: 'Ad Variation Generator',
    description: 'Generate multiple high-converting variations from any winning ad. Control tone, platform, and localization. Preserve what works, evolve what doesn\'t.',
  },
  {
    icon: '🗄️',
    title: 'Swipe Vault',
    description: 'Store, tag, and search your entire swipe file. Filter by platform, hook type, funnel stage, or performance score. Your creative intelligence library.',
  },
  {
    icon: '🔗',
    title: 'Hook Generator',
    description: 'Generate 10 hooks for any offer, audience, and platform combination. Built on patterns from thousands of high-performing ads across every major niche.',
  },
];

const FAQS = [
  {
    q: 'What does AdNexis analyze in an ad?',
    a: 'AdNexis analyzes hook type and strength, emotional stack, funnel stage (awareness, consideration, conversion), CTA type and effectiveness, target audience signals, performance score across 6 dimensions, creative fatigue risk, and estimated runway days before the ad loses effectiveness.',
  },
  {
    q: 'What ad formats does AdNexis support?',
    a: 'AdNexis works with any text-based ad transcript — Facebook Ads, Instagram Ads, TikTok ads, YouTube scripts, Google Ads copy, email subject lines, and direct response copy. Paste the transcript and the AI handles the rest.',
  },
  {
    q: 'How does the ad variation generator work?',
    a: 'Paste a winning ad, select your target platform and tone, and AdNexis generates multiple variations that preserve the core hook and emotional architecture while adapting the language, structure, and CTA for the target context.',
  },
  {
    q: 'What is the Swipe Vault?',
    a: 'The Swipe Vault is a searchable database of your best ad references. Upload ads by platform, niche, and source URL. Every ad gets AI-analyzed automatically. Filter and search by hook type, performance score, funnel stage, or any custom tag.',
  },
  {
    q: 'Who is AdNexis for?',
    a: 'AdNexis is built for media buyers, performance marketers, creative directors, copywriters, and growth teams who need to move faster than intuition allows — decoding what works in competitor ads and generating their own high-converting creatives at scale.',
  },
];

export default async function HomePage() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect('/dashboard');
  } catch {
    // Supabase not configured — show landing page
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-[#0D0D1A] text-[#F0F0FF]" style={{ fontFamily: 'system-ui, sans-serif' }}>

        {/* Nav */}
        <nav className="border-b border-[#2A2A4A] px-6 py-4">
          <div className="mx-auto max-w-6xl flex items-center justify-between">
            <span className="text-xl font-bold">Ad<span className="text-[#6C3EFF]">Nexis</span></span>
            <div className="flex items-center gap-4">
              <Link href="/pricing" className="text-sm text-[#9090B8] hover:text-white transition-colors">Pricing</Link>
              <Link href="/guide" className="text-sm text-[#9090B8] hover:text-white transition-colors">Guide</Link>
              <Link href="/login" className="text-sm text-[#9090B8] hover:text-white transition-colors">Log in</Link>
              <Link href="/signup" className="rounded-lg bg-[#6C3EFF] hover:bg-[#7B4FFF] px-4 py-2 text-sm font-semibold text-white transition-colors">
                Get started free
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="px-6 py-24 text-center">
          <div className="mx-auto max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#6C3EFF]/30 bg-[#6C3EFF]/10 px-4 py-1.5 text-xs text-[#9090B8] mb-8">
              <span className="h-1.5 w-1.5 rounded-full bg-[#6C3EFF]" />
              AI Creative Intelligence Platform
            </div>
            <h1 className="text-5xl font-bold leading-tight mb-6">
              Deconstruct winning ads.<br />
              <span className="text-[#6C3EFF]">Understand what converts.</span>
            </h1>
            <p className="text-xl text-[#9090B8] max-w-2xl mx-auto mb-10 leading-relaxed">
              AdNexis uses AI to analyze any ad creative — classifying its hook, mapping its emotional stack,
              scoring its performance, and generating high-converting variations in seconds.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup" className="rounded-lg bg-[#6C3EFF] hover:bg-[#7B4FFF] px-8 py-3.5 text-base font-semibold text-white transition-colors">
                Start for free
              </Link>
              <Link href="/guide" className="rounded-lg border border-[#2A2A4A] hover:border-[#6C3EFF]/40 px-8 py-3.5 text-base font-semibold text-[#9090B8] hover:text-white transition-colors">
                See how it works →
              </Link>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-y border-[#2A2A4A] bg-[#16162A] px-6 py-10">
          <div className="mx-auto max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '6', label: 'AI models powering analysis' },
              { value: '6', label: 'Performance dimensions scored' },
              { value: '10+', label: 'Hook archetypes classified' },
              { value: '4', label: 'Platforms supported' },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-bold text-[#6C3EFF] mb-1">{s.value}</div>
                <div className="text-sm text-[#9090B8]">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">Everything you need to understand ad performance</h2>
              <p className="text-[#9090B8] text-lg max-w-2xl mx-auto">
                AdNexis does what a senior creative director does — except instantly, at scale, on every ad in your vault.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl border border-[#2A2A4A] bg-[#16162A] p-6">
                  <div className="text-3xl mb-4">{f.icon}</div>
                  <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-[#9090B8] leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-[#2A2A4A] bg-[#16162A] px-6 py-24">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-3xl font-bold text-center mb-16">How AdNexis works</h2>
            <div className="space-y-8">
              {[
                { step: '01', title: 'Add an ad to your Vault', description: 'Paste the ad transcript, select the platform, add the source URL. AdNexis accepts any text-based ad creative.' },
                { step: '02', title: 'AI analyzes the creative', description: 'Our AI pipeline extracts the hook type, emotional stack, funnel stage, CTA pattern, and target audience. You get a full performance score in seconds.' },
                { step: '03', title: 'Generate variations', description: 'Select any analyzed ad and generate multiple high-converting variations. Control tone, platform, and localization. Export directly.' },
                { step: '04', title: 'Build your creative intelligence', description: 'As your vault grows, patterns emerge. See which hook types perform best in your niche. Identify what emotional architectures your audience responds to.' },
              ].map((s) => (
                <div key={s.step} className="flex gap-6">
                  <div className="shrink-0 w-12 h-12 rounded-full bg-[#6C3EFF]/10 border border-[#6C3EFF]/30 flex items-center justify-center text-sm font-bold text-[#6C3EFF]">
                    {s.step}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{s.title}</h3>
                    <p className="text-[#9090B8] text-sm leading-relaxed">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-6 py-24">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold text-center mb-16">Frequently asked questions</h2>
            <div className="space-y-6">
              {FAQS.map((faq) => (
                <div key={faq.q} className="rounded-xl border border-[#2A2A4A] bg-[#16162A] p-6">
                  <h3 className="font-semibold text-white mb-2">{faq.q}</h3>
                  <p className="text-[#9090B8] text-sm leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-[#2A2A4A] px-6 py-24 text-center">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-3xl font-bold mb-4">Start analyzing ads for free</h2>
            <p className="text-[#9090B8] mb-8">No credit card required. Full AI analysis on your first 10 ads.</p>
            <Link href="/signup" className="inline-block rounded-lg bg-[#6C3EFF] hover:bg-[#7B4FFF] px-10 py-4 text-base font-semibold text-white transition-colors">
              Create free account
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[#2A2A4A] px-6 py-10">
          <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm font-bold">Ad<span className="text-[#6C3EFF]">Nexis</span></span>
            <div className="flex gap-6 text-sm text-[#5A5A8A]">
              <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
              <Link href="/guide" className="hover:text-white transition-colors">Guide</Link>
              <Link href="/login" className="hover:text-white transition-colors">Log in</Link>
              <a href="https://sitenexis.vercel.app" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">SiteNexis</a>
            </div>
            <p className="text-xs text-[#5A5A8A]">© {new Date().getFullYear()} AdNexis. Built on AI.</p>
          </div>
        </footer>

      </div>
    </>
  );
}
