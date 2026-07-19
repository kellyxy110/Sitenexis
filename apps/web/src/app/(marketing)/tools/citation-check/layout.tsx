import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/tools/citation-check' },
};

export default function CitationCheckLayout({ children }: { children: React.ReactNode }) {
  return children;
}
