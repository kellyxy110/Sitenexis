import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/tools/citation-checklist' },
};

export default function CitationChecklistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
