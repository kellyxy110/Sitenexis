import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — SiteNexis',
  description: 'SiteNexis plans: Free, Starter, Pro, and Agency. Unlimited audits, Layer 4 Machine Trust analysis, and API access on paid tiers.',
  alternates: { canonical: '/pricing' },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
