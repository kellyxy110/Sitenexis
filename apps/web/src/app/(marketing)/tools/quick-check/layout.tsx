import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/tools/quick-check' },
};

export default function QuickCheckLayout({ children }: { children: React.ReactNode }) {
  return children;
}
