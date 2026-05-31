'use client';

import { useEffect, useRef, useState } from 'react';

interface HealthScoreRingProps {
  score: number | null;
  label: string;
  color: string;
  size?: number;
  loading?: boolean;
}

function CountUp({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef<number | null>(null);
  const start = useRef<number | null>(null);

  useEffect(() => {
    start.current = null;
    const tick = (now: number) => {
      if (start.current === null) start.current = now;
      const p = Math.min((now - start.current) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target, duration]);

  return <>{val}</>;
}

export function HealthScoreRing({ score, label, color, size = 200, loading }: HealthScoreRingProps) {
  const r = (size / 2) * 0.78;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const progress = score !== null ? Math.max(0, Math.min(100, score)) / 100 : 0;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={10} />
        {/* Progress arc */}
        {!loading && score !== null && (
          <circle
            cx={cx} cy={cx} r={r}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)', filter: `drop-shadow(0 0 8px ${color}60)` }}
          />
        )}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {loading ? (
          <div className="h-10 w-16 animate-pulse rounded bg-white/5" />
        ) : score !== null ? (
          <>
            <span className="tabular-nums font-bold" style={{ fontSize: size * 0.22, color, lineHeight: 1 }}>
              <CountUp target={score} />
            </span>
            <span className="mt-1 text-xs text-[#4A6280]">/100</span>
          </>
        ) : (
          <span className="text-3xl font-bold text-[#3A5568]">—</span>
        )}
        <span className="mt-2 text-center text-[11px] font-medium text-[#7A9AB4] leading-tight px-2">{label}</span>
      </div>
    </div>
  );
}
