'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { DashboardData } from './shared';

const CONNECTED_STATUSES = new Set(['connected']);

/**
 * Compact dashboard widget — shares the same query key/cache as the full
 * intelligence-center report page, so visiting either one warms the other.
 */
export function GA4GSCSummaryCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['intelligence-center-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/intelligence-center/dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard');
      return res.json() as Promise<DashboardData>;
    },
    staleTime: 60_000,
  });

  if (isLoading) return null;

  const connected = data ? CONNECTED_STATUSES.has(data.connector.status) : false;

  if (!connected) {
    return (
      <div className="mb-4 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal/[0.08] border border-teal/[0.15]">
            <span className="text-sm font-bold text-teal">📈</span>
          </div>
          <div>
            <p className="text-xs text-[#4A6280]">Traffic & Search</p>
            <p className="text-sm font-bold text-white">Not connected</p>
          </div>
        </div>
        <Link href="/dashboard/settings/integrations" className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs font-semibold text-[#7A9AB4] hover:text-white hover:border-white/[0.15] transition-colors">
          Connect
        </Link>
      </div>
    );
  }

  // GA4-derived sessions must never render as 0 unless GA4's last sync actually
  // succeeded — otherwise "GA4 has never synced" reads identically to "Google
  // confirmed zero sessions" (unavailable ≠ zero).
  const sessions = data?.ga4Available ? String(data?.traffic?.totalSessions ?? 0) : '—';
  const clicks = data?.search?.totalClicks ?? 0;

  return (
    <div className="mb-4 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal/[0.08] border border-teal/[0.15]">
          <span className="text-sm font-bold text-teal">📈</span>
        </div>
        <div>
          <p className="text-xs text-[#4A6280]">Traffic & Search (30d)</p>
          <p className="text-sm font-bold text-white">{sessions} sessions · {clicks} clicks</p>
        </div>
      </div>
      <Link href="/dashboard/intelligence-center" className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs font-semibold text-[#7A9AB4] hover:text-white hover:border-white/[0.15] transition-colors">
        View report
      </Link>
    </div>
  );
}
