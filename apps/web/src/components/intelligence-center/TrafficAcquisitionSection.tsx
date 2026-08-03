'use client';

import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';

interface ChannelRow {
  channelGroup: string;
  source: string;
  isAiReferral: boolean;
  sessions: number;
  activeUsers: number;
  shareOfSessions: number;
}

interface AcquisitionResponse {
  connector: { status: string };
  totalSessions: number;
  channels: ChannelRow[];
}

export function TrafficAcquisitionSection() {
  const { data } = useQuery({
    queryKey: ['intelligence-center-acquisition'],
    queryFn: async () => {
      const res = await fetch('/api/intelligence-center/acquisition');
      if (!res.ok) throw new Error('Failed to load acquisition data');
      return res.json() as Promise<AcquisitionResponse>;
    },
    staleTime: 60_000,
  });

  const channels = (data?.channels ?? []).slice(0, 15);

  return (
    <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <h2 className="mb-3 text-sm font-semibold text-white">Traffic Acquisition</h2>
      {channels.length === 0 ? (
        <p className="text-xs text-[#4A6280]">No Analytics acquisition data is available for this period.</p>
      ) : (
        <div className="space-y-1.5">
          {channels.map((c) => (
            <div key={`${c.channelGroup}::${c.source}`} className="flex items-center gap-2 text-xs">
              <span className="w-32 shrink-0 truncate text-[#4A6280]">{c.channelGroup}</span>
              <span className="flex min-w-0 flex-1 items-center gap-1 truncate text-[#C8DFE8]">
                {c.isAiReferral && <Sparkles size={11} className="shrink-0 text-cyan-400" />}
                {c.source}
              </span>
              <div className="h-1.5 w-20 shrink-0 rounded-full bg-white/[0.04]">
                <div className="h-1.5 rounded-full bg-cyan-500/60" style={{ width: `${c.shareOfSessions * 100}%` }} />
              </div>
              <span className="w-14 shrink-0 text-right font-semibold tabular-nums text-white">{c.sessions}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
