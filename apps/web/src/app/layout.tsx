import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'SiteNexis — Website Intelligence Platform',
  description:
    'Audit any domain across SEO, AI readability, schema, link graph, and performance from a single platform.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased" style={{ background: 'linear-gradient(180deg, #030907 0%, #081410 100%)', minHeight: '100vh', color: '#E2EDE9' }} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
