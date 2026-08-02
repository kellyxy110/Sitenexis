'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendChart } from '@/components/health/TrendChart';

type Granularity = 'daily' | 'weekly' | 'monthly' | 'quarterly';
const GRANULARITIES: Granularity[] = ['daily', 'weekly', 'monthly', 'quarterly'];

interface TrendsResponse {
  connector: { status: string };
  granularity?: Granularity;
  traffic?: Array<{ date: string; sessions: number; activeUsers: number }>;
  search?: Array<{ date: string; clicks: number; impressions: number; ctr: number; avgPosition: number }>;
}

export function TrendSection() {
  const [granularity, setGranularity] = useState<Granularity>('daily');

  const { data, isLoading } = useQuery({
    queryKey: ['intelligence-center-trends', granularity],
    queryFn: async () => {
      const res = await fetch(`/api/intelligence-center/trends?granularity=${granularity}`);
      if (!res.ok) throw new Error('Failed to load trends');
      return res.json() as Promise<TrendsResponse>;
    },
    staleTime: 60_000,
  });

  const traffic = data?.traffic ?? [];
  const search = data?.search ?? [];

  return (
    <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">Trends</h2>
        <div className="flex flex-wrap gap-2">
          {GRANULARITIES.map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors border ${
                granularity === g
                  ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                  : 'border-white/10 text-[#4A6280] hover:text-white'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#4A6280]">Traffic</h3>
          <TrendChart
            loading={isLoading}
            data={traffic.map((t) => ({ date: t.date, sessions: t.sessions, activeUsers: t.activeUsers }))}
            series={[
              { key: 'sessions', label: 'Sessions', color: '#00C8FF' },
              { key: 'activeUsers', label: 'Active Users', color: '#0BCEBC' },
            ]}
            yDomain={['auto', 'auto']}
            height={180}
          />
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#4A6280]">Search Volume</h3>
          <TrendChart
            loading={isLoading}
            data={search.map((s) => ({ date: s.date, clicks: s.clicks, impressions: s.impressions }))}
            series={[
              { key: 'clicks', label: 'Clicks', color: '#F59E0B' },
              { key: 'impressions', label: 'Impressions', color: '#8B5CF6' },
            ]}
            yDomain={['auto', 'auto']}
            height={180}
          />
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#4A6280]">Search Quality</h3>
          <TrendChart
            loading={isLoading}
            data={search.map((s) => ({ date: s.date, ctr: Math.round(s.ctr * 1000) / 10, avgPosition: Math.round(s.avgPosition * 10) / 10 }))}
            series={[
              { key: 'ctr', label: 'CTR %', color: '#22C55E' },
              { key: 'avgPosition', label: 'Avg Position', color: '#EF4444' },
            ]}
            yDomain={['auto', 'auto']}
            height={180}
          />
        </div>
      </div>
    </div>
  );
}
