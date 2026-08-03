'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

type Classification = 'rising' | 'declining' | 'high_impression_low_ctr' | 'near_page_one' | 'losing_position' | 'gaining_position';

interface ClassifiedQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
  previousClicks: number | null;
  previousImpressions: number | null;
  clicksPercentageDelta: number | null;
  impressionsPercentageDelta: number | null;
  positionDelta: number | null;
  classifications: Classification[];
}

interface QueriesResponse {
  connector: { status: string };
  totalQueries: number;
  groups: Record<Classification, ClassifiedQueryRow[]> | null;
}

const TABS: { key: Classification; label: string }[] = [
  { key: 'rising', label: 'Rising' },
  { key: 'declining', label: 'Declining' },
  { key: 'high_impression_low_ctr', label: 'High Impr. / Low CTR' },
  { key: 'near_page_one', label: 'Near Page One' },
  { key: 'gaining_position', label: 'Gaining Position' },
  { key: 'losing_position', label: 'Losing Position' },
];

function fmtPct(v: number | null): string {
  if (v === null) return '—';
  const pct = (v * 100).toFixed(0);
  return v > 0 ? `+${pct}%` : `${pct}%`;
}

export function QueriesSection() {
  const [active, setActive] = useState<Classification>('rising');

  const { data } = useQuery({
    queryKey: ['intelligence-center-queries'],
    queryFn: async () => {
      const res = await fetch('/api/intelligence-center/queries');
      if (!res.ok) throw new Error('Failed to load queries');
      return res.json() as Promise<QueriesResponse>;
    },
    staleTime: 60_000,
  });

  const rows = data?.groups?.[active] ?? [];

  return (
    <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <h2 className="mb-3 text-sm font-semibold text-white">Query Opportunities</h2>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
              active === tab.key
                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                : 'border-white/[0.06] bg-white/[0.02] text-[#7A9AB4] hover:border-white/[0.12] hover:text-[#C8DFE8]'
            }`}
          >
            {tab.label}
            {data?.groups?.[tab.key] && data.groups[tab.key].length > 0 && (
              <span className="ml-1.5 text-[10px] text-[#4A6280]">{data.groups[tab.key].length}</span>
            )}
          </button>
        ))}
      </div>

      {!data?.groups ? (
        <p className="text-xs text-[#4A6280]">No Search Console query data is available for this period.</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-[#4A6280]">No queries currently fall into this category.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#4A6280]">
                <th className="text-left font-normal">Query</th>
                <th className="text-right font-normal">Clicks</th>
                <th className="text-right font-normal">Impr.</th>
                <th className="text-right font-normal">CTR</th>
                <th className="text-right font-normal">Position</th>
                <th className="text-right font-normal">Δ Impr.</th>
                <th className="text-right font-normal">Δ Position</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.query} className="border-t border-white/[0.04]">
                  <td className="max-w-[220px] truncate py-1.5 text-[#C8DFE8]">{r.query}</td>
                  <td className="py-1.5 text-right tabular-nums text-white">{r.clicks}</td>
                  <td className="py-1.5 text-right tabular-nums text-white">{r.impressions}</td>
                  <td className="py-1.5 text-right tabular-nums text-white">{(r.ctr * 100).toFixed(1)}%</td>
                  <td className="py-1.5 text-right tabular-nums text-white">{r.avgPosition.toFixed(1)}</td>
                  <td className={`py-1.5 text-right tabular-nums ${(r.impressionsPercentageDelta ?? 0) > 0 ? 'text-teal-400' : (r.impressionsPercentageDelta ?? 0) < 0 ? 'text-red-400' : 'text-[#7A9AB4]'}`}>
                    {fmtPct(r.impressionsPercentageDelta)}
                  </td>
                  <td className={`py-1.5 text-right tabular-nums ${(r.positionDelta ?? 0) > 0 ? 'text-teal-400' : (r.positionDelta ?? 0) < 0 ? 'text-red-400' : 'text-[#7A9AB4]'}`}>
                    {r.positionDelta === null ? '—' : r.positionDelta.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
