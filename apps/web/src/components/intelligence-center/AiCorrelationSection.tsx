'use client';

import { useQuery } from '@tanstack/react-query';
import { TrendChart } from '@/components/health/TrendChart';

interface CorrelationPoint {
  auditId: string;
  date: string;
  aiVisibilityScore: number;
  sessions: number;
  clicks: number;
}

interface CorrelationResponse {
  connector: { status: string };
  state?: 'empty' | 'partial' | 'complete';
  reason?: string;
  matchedDomain?: string;
  matchConfidence?: 'exact' | 'fallback';
  points?: CorrelationPoint[];
}

export function AiCorrelationSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['intelligence-center-ai-correlation'],
    queryFn: async () => {
      const res = await fetch('/api/intelligence-center/ai-correlation');
      if (!res.ok) throw new Error('Failed to load AI correlation');
      return res.json() as Promise<CorrelationResponse>;
    },
    staleTime: 120_000,
  });

  const points = data?.points ?? [];

  return (
    <div className="mb-6 rounded-xl border border-teal-500/20 bg-teal-500/[0.04] p-4">
      <h2 className="mb-1 text-sm font-semibold text-white">AI Insights — Score vs. Traffic</h2>
      <p className="mb-3 text-xs text-[#7A9AB4]">
        How your AI Visibility Score has moved alongside real traffic and search clicks, at each point you ran an audit.
      </p>

      {data?.matchConfidence === 'fallback' && data.matchedDomain && (
        <p className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Showing data for <strong>{data.matchedDomain}</strong> — your most recently audited domain. We could not
          confirm this exactly matches your connected GA4/Search Console property.
        </p>
      )}

      {!isLoading && data?.state === 'empty' && (
        <p className="text-xs text-[#4A6280]">
          {data.reason ?? 'Not enough audit history yet to correlate scores with traffic.'}
        </p>
      )}

      {!isLoading && points.length === 1 && (
        <p className="mb-3 text-xs text-[#4A6280]">
          Only one audit with traffic data so far — a trend needs at least two. Score: {points[0]!.aiVisibilityScore},
          sessions: {points[0]!.sessions}, clicks: {points[0]!.clicks} around {points[0]!.date}.
        </p>
      )}

      {(isLoading || points.length >= 2) && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#4A6280]">Score vs. Sessions</h3>
            <TrendChart
              loading={isLoading}
              data={points.map((p) => ({ date: p.date, aiVisibilityScore: p.aiVisibilityScore, sessions: p.sessions }))}
              series={[
                { key: 'aiVisibilityScore', label: 'AI Visibility Score', color: '#0BCEBC' },
                { key: 'sessions', label: 'Sessions', color: '#00C8FF' },
              ]}
              yDomain={['auto', 'auto']}
              height={200}
            />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#4A6280]">Score vs. Clicks</h3>
            <TrendChart
              loading={isLoading}
              data={points.map((p) => ({ date: p.date, aiVisibilityScore: p.aiVisibilityScore, clicks: p.clicks }))}
              series={[
                { key: 'aiVisibilityScore', label: 'AI Visibility Score', color: '#0BCEBC' },
                { key: 'clicks', label: 'Clicks', color: '#F59E0B' },
              ]}
              yDomain={['auto', 'auto']}
              height={200}
            />
          </div>
        </div>
      )}
    </div>
  );
}
