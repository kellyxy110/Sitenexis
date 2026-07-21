import type { Metadata } from 'next';
import './globals.css';

const DEFAULT_APP_URL = 'https://adnexis-eight.vercel.app';

// A malformed NEXT_PUBLIC_APP_URL (empty, whitespace-only, missing a scheme,
// or otherwise unparseable) must never throw here — this runs during static
// generation for every page via the root layout, so an unguarded `new URL()`
// takes the entire build down. Trim, validate, and fall back safely.
function safeAppUrl(): URL {
  const raw = process.env['NEXT_PUBLIC_APP_URL']?.trim();
  if (raw) {
    try { return new URL(raw); } catch { /* fall through to default */ }
  }
  return new URL(DEFAULT_APP_URL);
}

export const metadata: Metadata = {
  title: {
    default: 'AdNexis — AI Ad Creative Intelligence Platform',
    template: '%s | AdNexis',
  },
  description: 'Deconstruct winning ad creatives with AI. Analyze hook types, emotional stacks, funnel stages, and CTA patterns. Generate high-converting variations, edit images with Qwen AI, and create videos with LTX-2.3 in seconds.',
  metadataBase: safeAppUrl(),
  keywords: ['ad creative analysis', 'AI advertising', 'ad hook analysis', 'performance marketing', 'creative intelligence', 'ad generation', 'AI image editing', 'AI video generation', 'LTX video', 'image inpainting'],
  authors: [{ name: 'AdNexis', url: 'https://adnexis-eight.vercel.app' }],
  openGraph: {
    type: 'website',
    siteName: 'AdNexis',
    title: 'AdNexis — AI Ad Creative Intelligence Platform',
    description: 'Deconstruct winning ads. Edit images, generate videos, and produce high-converting creatives powered by AI.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'AdNexis — AI Ad Creative Intelligence' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AdNexis — AI Ad Creative Intelligence',
    description: 'Analyze winning ads, edit images, generate videos, and produce high-converting creatives with AI.',
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
