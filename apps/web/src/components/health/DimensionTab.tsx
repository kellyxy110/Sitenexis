'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface DimensionTabProps {
  label: string;
  score: number | null;
  trend?: number | null;
  active?: boolean;
  onClick: () => void;
  loading?: boolean;
}

function scoreColor(score: number): string {
  if (score >= 90) return '#22C55E';
  if (score >= 70) return '#0BCEBC';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

export function DimensionTab({ label, score, trend, active, onClick, loading }: DimensionTabProps) {
  const color = score !== null ? scoreColor(score) : '#3A5568';

  return (
    <button
      onClick={onClick}
      className={[
        'flex flex-col gap-1.5 rounded-xl border px-4 py-3 text-left transition-all duration-200 cursor-pointer',
        active
          ? 'border-white/15 bg-white/[0.06]'
          : 'border-white/[0.04] bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.03]',
      ].join(' ')}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-[#4A6280]">{label}</span>
      {loading ? (
        <div className="h-6 w-10 animate-pulse rounded bg-white/5" />
      ) : (
        <div className="flex items-end gap-1.5">
          <span className="text-2xl font-bold tabular-nums leading-none" style={{ color }}>
            {score !== null ? score : '—'}
          </span>
          {score !== null && <span className="mb-0.5 text-xs text-[#3A5568]">/100</span>}
        </div>
      )}
      {trend !== null && trend !== undefined && !loading && (
        <div className={[
          'flex items-center gap-0.5 text-[10px] font-medium',
          trend > 0 ? 'text-teal-400' : trend < 0 ? 'text-red-400' : 'text-[#4A6280]',
        ].join(' ')}>
          {trend > 0 ? <TrendingUp className="h-3 w-3" /> : trend < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          {trend !== 0 && <span>{Math.abs(trend)}%</span>}
        </div>
      )}
      {/* Mini progress bar */}
      <div className="h-[2px] w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: score !== null ? `${score}%` : '0%', backgroundColor: color }}
        />
      </div>
    </button>
  );
}
