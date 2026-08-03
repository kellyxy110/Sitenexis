'use client';

import { useQuery } from '@tanstack/react-query';

interface PageComparison {
  current: number;
  previous: number;
  absoluteDelta: number;
  percentageDelta: number | null;
  direction: 'up' | 'down' | 'stable' | 'unavailable';
}

interface PageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
  clicksComparison: PageComparison;
  impressionsComparison: PageComparison;
  positionDelta: number | null;
}

interface PagesResponse {
  connector: { status: string };
  pages: PageRow[];
}

function directionColor(direction: PageComparison['direction']): string {
  return direction === 'up' ? 'text-teal-400' : direction === 'down' ? 'text-red-400' : 'text-[#7A9AB4]';
}

function fmtDelta(c: PageComparison): string {
  if (c.direction === 'unavailable') return 'new';
  if (c.percentageDelta === null) return c.direction === 'up' ? 'new traffic' : '—';
  const pct = (c.percentageDelta * 100).toFixed(0);
  return c.percentageDelta > 0 ? `+${pct}%` : `${pct}%`;
}

export function PagesSection() {
  const { data } = useQuery({
    queryKey: ['intelligence-center-pages'],
    queryFn: async () => {
      const res = await fetch('/api/intelligence-center/pages');
      if (!res.ok) throw new Error('Failed to load pages');
      return res.json() as Promise<PagesResponse>;
    },
    staleTime: 60_000,
  });

  const pages = data?.pages ?? [];

  return (
    <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <h2 className="mb-3 text-sm font-semibold text-white">Pages</h2>
      {pages.length === 0 ? (
        <p className="text-xs text-[#4A6280]">No Search Console performance data is available for this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#4A6280]">
                <th className="text-left font-normal">Page</th>
                <th className="text-right font-normal">Clicks</th>
                <th className="text-right font-normal">Impr.</th>
                <th className="text-right font-normal">CTR</th>
                <th className="text-right font-normal">Position</th>
                <th className="text-right font-normal">Δ Clicks</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.page} className="border-t border-white/[0.04]">
                  <td className="max-w-[240px] truncate py-1.5 text-[#C8DFE8]">{p.page}</td>
                  <td className="py-1.5 text-right tabular-nums text-white">{p.clicks}</td>
                  <td className="py-1.5 text-right tabular-nums text-white">{p.impressions}</td>
                  <td className="py-1.5 text-right tabular-nums text-white">{(p.ctr * 100).toFixed(1)}%</td>
                  <td className="py-1.5 text-right tabular-nums text-white">{p.avgPosition.toFixed(1)}</td>
                  <td className={`py-1.5 text-right tabular-nums ${directionColor(p.clicksComparison.direction)}`}>{fmtDelta(p.clicksComparison)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
