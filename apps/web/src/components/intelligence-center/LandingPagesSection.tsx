'use client';

import { useQuery } from '@tanstack/react-query';

interface LandingPageRow {
  pagePath: string;
  sessions: number;
  activeUsers: number;
  keyEvents: number;
  avgEngagementTimeSec: number;
  engagementRate: number;
  sessionsComparison: { direction: 'up' | 'down' | 'stable' | 'unavailable'; percentageDelta: number | null };
}

interface LandingPagesResponse {
  connector: { status: string };
  landingPages: LandingPageRow[];
}

function fmtSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export function LandingPagesSection() {
  const { data } = useQuery({
    queryKey: ['intelligence-center-landing-pages'],
    queryFn: async () => {
      const res = await fetch('/api/intelligence-center/landing-pages');
      if (!res.ok) throw new Error('Failed to load landing pages');
      return res.json() as Promise<LandingPagesResponse>;
    },
    staleTime: 60_000,
  });

  const rows = data?.landingPages ?? [];

  return (
    <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <h2 className="mb-3 text-sm font-semibold text-white">Landing Pages</h2>
      {rows.length === 0 ? (
        <p className="text-xs text-[#4A6280]">No Analytics landing-page data is available for this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#4A6280]">
                <th className="text-left font-normal">Landing page</th>
                <th className="text-right font-normal">Sessions</th>
                <th className="text-right font-normal">Users</th>
                <th className="text-right font-normal">Engagement</th>
                <th className="text-right font-normal">Avg. time</th>
                <th className="text-right font-normal">Key events</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.pagePath} className="border-t border-white/[0.04]">
                  <td className="max-w-[220px] truncate py-1.5 text-[#C8DFE8]">{r.pagePath}</td>
                  <td className="py-1.5 text-right tabular-nums text-white">{r.sessions}</td>
                  <td className="py-1.5 text-right tabular-nums text-white">{r.activeUsers}</td>
                  <td className="py-1.5 text-right tabular-nums text-white">{(r.engagementRate * 100).toFixed(0)}%</td>
                  <td className="py-1.5 text-right tabular-nums text-white">{fmtSeconds(r.avgEngagementTimeSec)}</td>
                  <td className="py-1.5 text-right tabular-nums text-white">{r.keyEvents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
