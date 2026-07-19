import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free Citation Check — SiteNexis Tools',
  description: 'Check whether AI systems like ChatGPT and Perplexity are actually citing your domain today, using live AI inference and web search.',
  alternates: { canonical: '/tools/citation-check' },
};

export default function CitationCheckLayout({ children }: { children: React.ReactNode }) {
  return children;
}
