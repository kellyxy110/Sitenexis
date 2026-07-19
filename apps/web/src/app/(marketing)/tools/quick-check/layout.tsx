import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Quick AI Visibility Check — SiteNexis Tools',
  description: 'A free, single-page 7-signal scan of any URL\'s AI readability — no account required.',
  alternates: { canonical: '/tools/quick-check' },
};

export default function QuickCheckLayout({ children }: { children: React.ReactNode }) {
  return children;
}
