import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/tools/ai-scorer' },
};

export default function AiScorerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
