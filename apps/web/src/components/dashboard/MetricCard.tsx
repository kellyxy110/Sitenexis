'use client';

import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  label: string;
  score: number | null;
  icon: LucideIcon;
  trend?: number | null | undefined;
  description?: string | undefined;
  loading?: boolean | undefined;
}

function scoreColor(score: number): { text: string; bg: string; ring: string } {
  if (score >= 90) return { text: 'text-green-400',  bg: 'bg-green-500/10',  ring: 'bg-green-500' };
  if (score >= 70) return { text: 'text-teal-400',   bg: 'bg-teal-500/10',   ring: 'bg-teal-500' };
  if (score >= 50) return { text: 'text-amber-400',  bg: 'bg-amber-500/10',  ring: 'bg-amber-500' };
  return             { text: 'text-red-400',    bg: 'bg-red-500/10',    ring: 'bg-red-500' };
}

function CountUp({ target, duration = 900 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  const animRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = null;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const p = Math.min((now - startRef.current) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [target, duration]);

  return <>{val}</>;
}

export function MetricCard({ label, score, icon: Icon, trend, description, loading }: MetricCardProps) {
  const colors = score !== null ? scoreColor(score) : null;

  return (
    <div className="card-intelligence group relative flex flex-col gap-3 rounded-xl p-5 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.03]">
      {/* Top row: icon + trend */}
      <div className="flex items-start justify-between">
        <div className={[
          'flex h-8 w-8 items-center justify-center rounded-lg',
          colors ? colors.bg : 'bg-white/5',
        ].join(' ')}>
          <Icon
            className={['h-4 w-4', colors ? colors.text : 'text-[#4A6280]'].join(' ')}
            strokeWidth={1.75}
          />
        </div>

        {trend !== null && trend !== undefined && (
          <div className={[
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
            trend > 0 ? 'text-teal-400 bg-teal-500/10' :
            trend < 0 ? 'text-red-400 bg-red-500/10' :
            'text-[#4A6280] bg-white/5',
          ].join(' ')}>
            {trend > 0
              ? <TrendingUp className="h-3 w-3" />
              : trend < 0
                ? <TrendingDown className="h-3 w-3" />
                : <Minus className="h-3 w-3" />
            }
            {trend !== 0 && `${Math.abs(trend)}%`}
          </div>
        )}
      </div>

      {/* Score */}
      <div className="flex items-end gap-1.5">
        {loading ? (
          <div className="h-9 w-16 animate-pulse rounded bg-white/5" />
        ) : score !== null ? (
          <>
            <span className={['text-[32px] font-bold leading-none tabular-nums', colors!.text].join(' ')}>
              <CountUp target={score} />
            </span>
            <span className="mb-0.5 text-sm text-[#4A6280]">/100</span>
          </>
        ) : (
          <span className="text-2xl font-bold text-[#3A5568]">—</span>
        )}
      </div>

      {/* Label + bar */}
      <div>
        <p className="text-sm font-medium text-[#C8DFE8] leading-tight">{label}</p>
        {description && (
          <p className="mt-0.5 hidden text-xs leading-relaxed text-[#4A6280] sm:block">{description}</p>
        )}
      </div>

      {/* Mini progress bar */}
      <div className="h-[2px] w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={['h-full rounded-full transition-all duration-1000 ease-out', colors ? colors.ring : 'bg-white/10'].join(' ')}
          style={{ width: score !== null ? `${score}%` : '0%' }}
        />
      </div>
    </div>
  );
}
