import Link from 'next/link';
import { Check } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — AdNexis',
  description: 'Start free with 10 ads and full AI analysis. Upgrade to Pro for unlimited ads, bulk analysis, and advanced generation. No credit card required.',
  alternates: { canonical: 'https://adnexis-eight.vercel.app/pricing' },
  openGraph: {
    title: 'AdNexis Pricing — Free, Pro, and Agency plans',
    description: 'Free tier includes 10 ads with full AI analysis. Pro at $29/month for unlimited. Agency at $79/month for teams.',
    url: 'https://adnexis-eight.vercel.app/pricing',
  },
};

const pricingJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is included in the AdNexis free plan?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The free plan includes up to 10 ads in your vault, full AI analysis per ad, performance scoring across 6 dimensions, ad variation generator with 3 variations, and the Swipe Vault with search and filter. No credit card required.',
      },
    },
    {
      '@type': 'Question',
      name: 'How much does AdNexis Pro cost?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'AdNexis Pro costs $29 per month. It includes unlimited ads in vault, bulk analyze, up to 10 variations per generate, all localization options, hook type analytics, performance trend chart, CSV export, and priority AI processing.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is there a team plan for AdNexis?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. AdNexis Agency costs $79 per month and includes everything in Pro plus team shared vault, up to 5 team members, client workspace separation, API access, and white-label PDF reports.',
      },
    },
  ],
};

const PLANS = [
  {
    name: 'Free',
    price: '0',
    period: 'forever',
    description: 'Try AdNexis with no commitment.',
    cta: 'Get started free',
    href: '/signup',
    highlight: false,
    features: [
      'Up to 10 ads in vault',
      'Full AI analysis per ad',
      'Performance scoring (6 dimensions)',
      'Ad variation generator (3 variations)',
      'Swipe Vault with search + filter',
    ],
  },
  {
    name: 'Pro',
    price: '29',
    period: 'per month',
    description: 'For serious creators and media buyers.',
    cta: 'Upgrade to Pro',
    href: '/api/billing/checkout?plan=pro',
    highlight: true,
    features: [
      'Unlimited ads in vault',
      'Bulk analyze entire vault',
      'Up to 10 variations per generate',
      'All localization options',
      'Hook type analytics',
      'Performance trend chart',
      'CSV export',
      'Priority AI processing',
    ],
  },
  {
    name: 'Agency',
    price: '79',
    period: 'per month',
    description: 'For teams managing multiple clients.',
    cta: 'Upgrade to Agency',
    href: '/api/billing/checkout?plan=agency',
    highlight: false,
    features: [
      'Everything in Pro',
      'Team shared vault',
      'Up to 5 team members',
      'Client workspace separation',
      'API access',
      'White-label PDF reports',
      'Dedicated support',
    ],
  },
];

export default function PricingPage() {
  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }} />
    <div className="min-h-screen bg-[#0D0D1A] px-6 py-16">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="text-center mb-14">
          <Link href="/dashboard" className="text-xl font-bold text-white mb-8 inline-block">
            Ad<span className="text-[#6C3EFF]">Nexis</span>
          </Link>
          <h1 className="mt-4 text-4xl font-bold text-white">Simple, transparent pricing</h1>
          <p className="mt-3 text-[#9090B8] text-lg">
            Upgrade when you need more power. Downgrade any time.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-7 flex flex-col ${
                plan.highlight
                  ? 'border-[#6C3EFF] bg-[#6C3EFF]/5 shadow-[0_0_40px_rgba(108,62,255,0.15)]'
                  : 'border-[#2A2A4A] bg-[#16162A]'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-[#6C3EFF] text-white text-xs font-bold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <p className="text-sm font-semibold text-[#9090B8] uppercase tracking-wide mb-1">{plan.name}</p>
                <div className="flex items-end gap-1 mb-2">
                  <span className="text-4xl font-bold text-white">${plan.price}</span>
                  <span className="text-[#5A5A8A] text-sm mb-1">/ {plan.period}</span>
                </div>
                <p className="text-[#9090B8] text-sm">{plan.description}</p>
              </div>

              <ul className="space-y-3 flex-1 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[#C0C0D8]">
                    <Check size={14} className="shrink-0 text-[#00D4AA] mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                prefetch={false}
                className={`w-full text-center rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                  plan.highlight
                    ? 'bg-[#6C3EFF] hover:bg-[#7B4FFF] text-white'
                    : 'border border-[#2A2A4A] hover:border-[#6C3EFF]/40 text-[#F0F0FF] hover:text-white'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-[#5A5A8A] text-xs mt-10">
          All plans include a 7-day free trial. No credit card required for Free tier.
        </p>
      </div>
    </div>
    </>
  );
}
