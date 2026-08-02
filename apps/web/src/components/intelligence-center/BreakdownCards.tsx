'use client';

import { useQuery } from '@tanstack/react-query';

interface BreakdownsResponse {
  connector: { status: string };
  traffic?: { device: Record<string, number>; country: Record<string, number> };
  search?: { device: Record<string, number>; country: Record<string, number> };
}

function BreakdownList({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a).slice(0, 8);
  const max = entries.length > 0 ? entries[0]![1] : 1;

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#4A6280]">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-xs text-[#3A5568]">No breakdown data yet.</p>
      ) : (
        <div className="space-y-1.5">
          {entries.map(([label, value]) => (
            <div key={label} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0 truncate text-[#7A9AB4]">{label}</span>
              <div className="h-1.5 flex-1 rounded-full bg-white/[0.04]">
                <div className="h-1.5 rounded-full bg-cyan-500/60" style={{ width: `${(value / max) * 100}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right font-semibold tabular-nums text-white">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BreakdownCards() {
  const { data } = useQuery({
    queryKey: ['intelligence-center-breakdowns'],
    queryFn: async () => {
      const res = await fetch('/api/intelligence-center/breakdowns');
      if (!res.ok) throw new Error('Failed to load breakdowns');
      return res.json() as Promise<BreakdownsResponse>;
    },
    staleTime: 60_000,
  });

  return (
    <div className="mb-6 grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Traffic by Device</h2>
        <BreakdownList title="Sessions" data={data?.traffic?.device ?? {}} />
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Traffic by Country</h2>
        <BreakdownList title="Sessions" data={data?.traffic?.country ?? {}} />
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Search Clicks by Device</h2>
        <BreakdownList title="Clicks" data={data?.search?.device ?? {}} />
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Search Clicks by Country</h2>
        <BreakdownList title="Clicks" data={data?.search?.country ?? {}} />
      </div>
    </div>
  );
}
