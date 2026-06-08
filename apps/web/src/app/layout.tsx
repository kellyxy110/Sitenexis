import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SiteNexis — AI Retrieval & Machine Trust Intelligence',
  description:
    'SiteNexis models how AI systems retrieve, interpret, trust, and recommend your website — across every layer from semantic structure to machine trust formation.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon',
  },
};

// ─── Global structured data (Organization + WebSite + SoftwareApplication) ────
const SITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://sitenexis.com/#organization',
      name: 'SiteNexis',
      url: 'https://sitenexis.com',
      email: 'sitenexisintel@gmail.com',
      logo: {
        '@type': 'ImageObject',
        url: 'https://sitenexis.com/favicon.svg',
        width: 512,
        height: 512,
      },
      description:
        'AI Retrieval and Machine Trust Intelligence platform that models how AI systems retrieve, interpret, trust, and recommend web content — across every layer of the intelligence stack.',
      foundingDate: '2025',
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'sitenexisintel@gmail.com',
        contactType: 'customer support',
        availableLanguage: 'English',
      },
      founder: {
        '@type': 'Person',
        '@id': 'https://sitenexis.com/#founder',
        name: 'Ekeleme David Kelechi',
        alternateName: 'Kellyxyhub',
        url: 'https://sitenexis.com/about',
        sameAs: [
          'https://github.com/kellyxy110',
        ],
      },
      sameAs: [
        'https://github.com/kellyxy110',
        'https://x.com/Sitenexis',
        'https://www.linkedin.com/in/sitenexis',
        'https://www.reddit.com/user/Sitenexis',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://sitenexis.com/#website',
      url: 'https://sitenexis.com',
      name: 'SiteNexis',
      description: 'AI Retrieval and Machine Trust Intelligence Platform',
      publisher: { '@id': 'https://sitenexis.com/#organization' },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'https://sitenexis.com/audit/{domain}',
        },
        'query-input': 'required name=domain',
      },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://sitenexis.com/#app',
      name: 'SiteNexis',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: 'https://sitenexis.com',
      description:
        'Multi-layer AI retrieval and machine trust intelligence system. Audits any domain across twelve dimensions including SEO health, AI extractability, entity intelligence, citation readiness, retrieval simulation, and machine trust.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: 'Free tier available — 1 audit per month',
      },
      provider: { '@id': 'https://sitenexis.com/#organization' },
      featureList: [
        'AI Retrieval Simulation',
        'Machine Trust Scoring',
        'Entity Intelligence Analysis',
        'Citation Probability Engine',
        'Recommendation Surface Mapping',
        'Temporal Authority Modeling',
        'Synthetic Entity Detection',
      ],
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased font-sans" suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_SCHEMA) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
