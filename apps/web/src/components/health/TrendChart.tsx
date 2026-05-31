'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface DataPoint {
  date: string;
  [key: string]: number | string | null;
}

interface TrendChartProps {
  data: DataPoint[];
  series: Array<{ key: string; label: string; color: string }>;
  height?: number;
  loading?: boolean;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0A1628]/95 px-3 py-2.5 shadow-xl text-xs">
      <p className="mb-2 font-medium text-[#7A9AB4]">{label ? formatDate(label) : ''}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-[#C8DFE8]">{p.name}</span>
          <span className="ml-auto font-bold tabular-nums" style={{ color: p.color }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({ data, series, height = 200, loading }: TrendChartProps) {
  if (loading) {
    return <div className="animate-pulse rounded-lg bg-white/[0.03]" style={{ height }} />;
  }

  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-sm text-[#3A5568]" style={{ height }}>
        No historical data yet — runs will appear here after the first self-audit.
      </div>
    );
  }

  const chartData = data.map((d) => ({ ...d, date: formatDate(d.date) }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#4A6280', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: '#4A6280', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <ReferenceLine y={70} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
        <Tooltip content={<CustomTooltip />} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
