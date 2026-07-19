import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/mts' },
};

export default function MtsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
