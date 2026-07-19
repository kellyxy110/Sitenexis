import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Citation Readiness Checklist — SiteNexis Tools',
  description: 'A free, interactive checklist mirroring the SiteNexis Citation Probability Engine — see exactly which factors determine whether AI systems cite your content.',
  alternates: { canonical: '/tools/citation-checklist' },
};

export default function CitationChecklistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
