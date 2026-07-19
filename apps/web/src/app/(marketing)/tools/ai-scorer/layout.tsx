import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free AI Visibility Scorer — SiteNexis Tools',
  description: 'Paste any page\'s HTML or text and get an instant 9-signal AI extractability score — free, browser-only, no account required.',
  alternates: { canonical: '/tools/ai-scorer' },
};

export default function AiScorerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
