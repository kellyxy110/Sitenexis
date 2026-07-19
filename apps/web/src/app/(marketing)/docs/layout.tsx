import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Docs — SiteNexis',
  description: 'SiteNexis documentation: API reference, scoring methodology, and integration guides.',
  alternates: { canonical: '/docs' },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
