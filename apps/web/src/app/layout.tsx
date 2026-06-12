import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Providers } from '@/components/Providers';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sitenexis.vercel.app';

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
  metadataBase: new URL(appUrl),
  title: 'SiteNexis — AI Retrieval & Machine Trust Intelligence',
  description:
    'SiteNexis models how AI systems retrieve, interpret, trust, and recommend your website — across every layer from semantic structure to machine trust formation.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon',
  },
  verification: {
    google: 'CaEcRc5T29RfSmPq7HJekJ47dIYu9AEXJ20IuQ49_9s',
    other: { 'msvalidate.01': 'EC4F898A0819A3BD78F2BDE48593E47A' },
  },
  openGraph: {
    title: 'SiteNexis — AI Retrieval & Machine Trust Intelligence',
    description: 'SiteNexis models how AI systems retrieve, interpret, trust, and recommend your website — across every layer from semantic structure to machine trust formation.',
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
    description: 'SiteNexis models how AI systems retrieve, interpret, trust, and recommend your website — across every layer from semantic structure to machine trust formation.',
    images: ['/opengraph-image'],
  },
};

// ─── Global structured data ───────────────────────────────────────────────────
const SITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@graph': [
    // ── Organization (brand-level identity, NOT founder personal profiles) ──
    {
      '@type': 'Organization',
      '@id': 'https://sitenexis.com/#organization',
      name: 'SiteNexis',
      legalName: 'SiteNexis',
      slogan: 'AI Retrieval & Machine Trust Intelligence',
      url: appUrl,
      email: 'sitenexisintel@gmail.com',
      logo: {
        '@type': 'ImageObject',
        url: `${appUrl}/favicon.svg`,
        width: 512,
        height: 512,
        caption: 'SiteNexis — AI Retrieval & Machine Trust Intelligence',
      },
      description:
        'SiteNexis is an AI Retrieval and Machine Trust Intelligence platform. It models how AI systems — including ChatGPT, Gemini, Perplexity, and Claude — retrieve, interpret, trust, and recommend web content across a four-layer intelligence stack.',
      foundingDate: '2025',
      numberOfEmployees: { '@type': 'QuantitativeValue', value: 1 },
      contactPoint: [
        {
          '@type': 'ContactPoint',
          email: 'sitenexisintel@gmail.com',
          contactType: 'customer support',
          availableLanguage: 'English',
        },
        {
          '@type': 'ContactPoint',
          email: 'sitenexisintel@gmail.com',
          contactType: 'sales',
          availableLanguage: 'English',
        },
      ],
      founder: { '@id': 'https://sitenexis.com/#founder' },
      // Brand-level external profiles only — not founder personal accounts
      sameAs: [
        'https://x.com/Sitenexis',
        'https://www.linkedin.com/in/sitenexis',
        'https://www.reddit.com/user/Sitenexis',
      ],
    },
    // ── Person (founder — separate top-level node, not just nested) ──────────
    {
      '@type': 'Person',
      '@id': 'https://sitenexis.com/#founder',
      name: 'Ekeleme David Kelechi',
      alternateName: ['Kellyxyhub', 'kellyxy110'],
      url: `${appUrl}/about`,
      jobTitle: 'Founder & CEO',
      worksFor: { '@id': 'https://sitenexis.com/#organization' },
      knowsAbout: [
        'AI Retrieval Systems',
        'Machine Trust Intelligence',
        'Retrieval-Augmented Generation',
        'Knowledge Graph Optimization',
        'Entity SEO',
        'AI Visibility Engineering',
        'Large Language Models',
        'Next.js',
        'TypeScript',
      ],
      sameAs: [
        'https://github.com/kellyxy110',
        'https://x.com/Sitenexis',
        'https://www.linkedin.com/in/sitenexis',
        'https://www.reddit.com/user/Sitenexis',
      ],
    },
    // ── WebSite ───────────────────────────────────────────────────────────────
    {
      '@type': 'WebSite',
      '@id': 'https://sitenexis.com/#website',
      url: appUrl,
      name: 'SiteNexis',
      description: 'AI Retrieval and Machine Trust Intelligence Platform',
      publisher: { '@id': 'https://sitenexis.com/#organization' },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${appUrl}/audit/{domain}`,
        },
        'query-input': 'required name=domain',
      },
    },
    // ── SoftwareApplication ───────────────────────────────────────────────────
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://sitenexis.com/#app',
      name: 'SiteNexis',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'AI Visibility & SEO Intelligence Tool',
      operatingSystem: 'Web',
      url: appUrl,
      description:
        'SiteNexis audits any domain across 12 dimensions using 16 intelligence agents. It produces AI Visibility scores, Machine Trust scores, Retrieval Simulation results, Temporal Authority analysis, Recommendation Surface maps, and Synthetic Entity detection — giving publishers a complete model of how AI systems perceive and recommend their content.',
      keywords: 'AI visibility, machine trust, entity SEO, AI retrieval simulation, ChatGPT visibility, Gemini optimization, AI Overviews, retrieval-augmented generation',
      screenshot: `${appUrl}/opengraph-image`,
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'USD',
        lowPrice: '0',
        offerCount: 4,
        offers: [
          { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'USD', description: '1 audit per month' },
          { '@type': 'Offer', name: 'Starter', price: '29', priceCurrency: 'USD' },
          { '@type': 'Offer', name: 'Pro', price: '79', priceCurrency: 'USD', description: 'Unlimited audits + Layer 4 Machine Trust analysis' },
          { '@type': 'Offer', name: 'Agency', price: '199', priceCurrency: 'USD', description: 'Unlimited audits + API access + bulk domains' },
        ],
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
        'AI Perception Graph',
        'Semantic Trust Scoring',
        'Schema Completeness Analysis',
      ],
    },
    // ── FAQ (drives AI Overviews + ChatGPT direct-answer retrieval) ───────────
    {
      '@type': 'FAQPage',
      '@id': `${appUrl}/#faq`,
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is SiteNexis?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'SiteNexis is an AI Retrieval and Machine Trust Intelligence platform that models how AI systems — including ChatGPT, Gemini, Perplexity, and Claude — retrieve, interpret, trust, and recommend web content. It runs 16 intelligence agents across four layers and produces a 12-dimensional audit report with actionable recommendations.',
          },
        },
        {
          '@type': 'Question',
          name: 'How does SiteNexis improve AI visibility?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'SiteNexis analyzes entity clarity, schema completeness, chunk extractability, semantic trust signals, and retrieval simulation across six stages. Each finding maps to a named issue with specific recommendations. Improvements to entity consistency, schema alignment, and content structure directly raise the probability of being retrieved and recommended by AI systems.',
          },
        },
        {
          '@type': 'Question',
          name: 'Which AI systems does SiteNexis analyze?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'SiteNexis models retrieval behavior across Google AI Overviews, ChatGPT browsing and RAG modes, Perplexity, Gemini, Claude web search, voice assistants, and autonomous agents. Provider scoring weights are configurable and all scores are labeled as probabilistic estimates.',
          },
        },
        {
          '@type': 'Question',
          name: 'What is the Machine Trust Score?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'The Machine Trust Score is a 0–100 composite that models AI system confidence in a website as a reliable source. It combines entity credibility consistency (30%), schema trust alignment (20%), external validation depth (25%), contradiction absence (15%), and trust degradation resistance (10%).',
          },
        },
        {
          '@type': 'Question',
          name: 'Is SiteNexis free?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'SiteNexis has a free tier with 1 full AI visibility audit per month covering Layers 1–3. Layer 4 Machine Trust Intelligence — including Retrieval Simulation, Machine Trust Score, Temporal Authority, Recommendation Surface Mapping, and Synthetic Entity Detection — is available on Pro and Agency plans.',
          },
        },
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
        {/* Google Analytics GA4 */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-YQJFVH9VJ7"
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-YQJFVH9VJ7');
          `}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
