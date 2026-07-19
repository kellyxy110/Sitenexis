import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/platform' },
};

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return children;
}
