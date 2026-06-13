import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'AdNexis — AI Ad Creative Intelligence Platform',
    template: '%s | AdNexis',
  },
  description: 'Deconstruct winning ad creatives with AI. Analyze hook types, emotional stacks, funnel stages, and CTA patterns. Generate high-converting variations in seconds.',
  metadataBase: new URL(process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://adnexis-eight.vercel.app'),
  keywords: ['ad creative analysis', 'AI advertising', 'ad hook analysis', 'performance marketing', 'creative intelligence', 'ad generation'],
  authors: [{ name: 'AdNexis', url: 'https://adnexis-eight.vercel.app' }],
  openGraph: {
    type: 'website',
    siteName: 'AdNexis',
    title: 'AdNexis — AI Ad Creative Intelligence Platform',
    description: 'Deconstruct winning ads. Understand what makes them convert. Generate better creatives powered by AI.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'AdNexis — AI Ad Creative Intelligence' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AdNexis — AI Ad Creative Intelligence',
    description: 'Analyze winning ads and generate high-converting variations with AI.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg-primary text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
