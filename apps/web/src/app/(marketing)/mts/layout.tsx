import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Machine Trust Score Lookup — SiteNexis',
  description: 'Look up the Machine Trust Score for any domain — a 0–100 composite modeling how much an AI system would trust the site as a source.',
  alternates: { canonical: '/mts' },
};

export default function MtsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
