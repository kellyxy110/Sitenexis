import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/docs' },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
