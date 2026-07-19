import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Platform — SiteNexis',
  description: 'The SiteNexis platform: 16 intelligence agents across 4 layers, producing 12 explainable scores that model how AI systems retrieve, trust, and recommend your site.',
  alternates: { canonical: '/platform' },
};

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return children;
}
