import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { computeQuickMTS } from '@/lib/quick-mts';
import { MTSResultClient } from './MTSResultClient';

type Props = { params: Promise<{ domain: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain } = await params;
  const decoded = decodeURIComponent(domain);
  return {
    title: `${decoded} — Machine Trust Score | SiteNexis`,
    description: `See how deeply AI systems trust ${decoded}. Free Machine Trust Score powered by SiteNexis.`,
    openGraph: {
      title: `${decoded} Machine Trust Score`,
      description: `How deeply do AI systems trust ${decoded}? Scored across 4 dimensions by SiteNexis.`,
      type: 'website',
    },
  };
}

export default async function MTSResultPage({ params }: Props) {
  const { domain } = await params;
  const decoded = decodeURIComponent(domain);

  if (!decoded || decoded.length < 3 || decoded.length > 253) notFound();

  const result = await computeQuickMTS(decoded);

  return (
    <Suspense>
      <MTSResultClient result={result} domain={decoded} />
    </Suspense>
  );
}
