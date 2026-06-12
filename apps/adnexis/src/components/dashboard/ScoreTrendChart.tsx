'use client';

import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

type TrendPoint = { date: string; avgScore: number; count: number };

export function ScoreTrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-[#16162A] border border-[#2A2A4A] rounded-xl p-8 text-center">
        <p className="text-[#9090B8] text-sm">Analyze ads to see your performance trend here.</p>
      </div>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
  }));

  return (
    <div className="bg-[#16162A] border border-[#2A2A4A] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-[#F0F0FF]">Performance Trend</h3>
          <p className="text-[#9090B8] text-xs mt-0.5">Avg score per day — last 30 days</p>
        </div>
        <span className="text-xs text-[#5A5A8A] bg-[#1C1C30] rounded-full px-3 py-1">
          {data.reduce((s, d) => s + d.count, 0)} ads analyzed
        </span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6C3EFF" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#6C3EFF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2A4A" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#5A5A8A', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#5A5A8A', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: '#16162A', border: '1px solid #2A2A4A', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#F0F0FF', marginBottom: 4 }}
            itemStyle={{ color: '#6C3EFF' }}
            formatter={(v: number, _: string, props: { payload?: TrendPoint }) => [
              `${v} / 100`,
              `Avg Score (${props.payload?.count ?? 0} ad${(props.payload?.count ?? 0) !== 1 ? 's' : ''})`,
            ]}
          />
          <Area
            type="monotone"
            dataKey="avgScore"
            stroke="#6C3EFF"
            strokeWidth={2}
            fill="url(#scoreGrad)"
            dot={{ fill: '#6C3EFF', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#00D4AA', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
