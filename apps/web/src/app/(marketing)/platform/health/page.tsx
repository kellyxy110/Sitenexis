import { Metadata } from 'next';
import { PublicHealthShowcase } from './PublicHealthShowcase';
import { isFullyConfigured } from '@/lib/mode';

export const metadata: Metadata = {
  title: 'SiteNexis Health Score — Live AI Visibility Monitor',
  description:
    'See how SiteNexis scores on its own platform: AI visibility, entity coverage, citation readiness, schema health, and machine trust — updated on every deployment.',
};

export const revalidate = 300; // ISR: revalidate every 5 minutes

async function getLatestHealthData() {
  if (!isFullyConfigured()) {
    return { run: null };
  }

  try {
    const { getLatestSelfAuditRun } = await import('@sitenexis/db');
    const run = await getLatestSelfAuditRun('sitenexis.com');
    if (!run) return { run: null };
    return { run };
  } catch {
    return { run: null };
  }
}

export default async function PlatformHealthPage() {
  const data = await getLatestHealthData();
  return <PublicHealthShowcase data={data as Parameters<typeof PublicHealthShowcase>[0]['data']} />;
}
