import type { Metadata } from 'next';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sitenexis.vercel.app';

export const metadata: Metadata = {
  title: 'SiteNexis — AI Retrieval & Machine Trust Intelligence',
  description:
    'SiteNexis models how AI systems retrieve, interpret, trust, and recommend your website. Run 16 autonomous agents, get an Intelligence Report, Decision Roadmap, Competitive Reality Simulation, and 12 intelligence scores — all in one scan.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'SiteNexis — AI Retrieval & Machine Trust Intelligence',
    description:
      'Model how AI systems retrieve, interpret, trust, and recommend your website. 12 scores · 16 agents · Intelligence Report · Decision Roadmap · Competitive Reality Simulation.',
    url: appUrl,
    siteName: 'SiteNexis',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'SiteNexis — AI Retrieval & Machine Trust Intelligence',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@Sitenexis',
    creator: '@Sitenexis',
    title: 'SiteNexis — AI Retrieval & Machine Trust Intelligence',
    description:
      'Model how AI systems retrieve, interpret, trust, and recommend your website. 12 scores · 16 agents · Intelligence Report · Decision Roadmap · Competitive Reality Simulation.',
    images: ['/opengraph-image'],
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
