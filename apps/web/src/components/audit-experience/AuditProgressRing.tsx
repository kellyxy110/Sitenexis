'use client';

interface AuditProgressRingProps {
  progress: number;
  stageLabel: string;
  size?: number;
  reducedMotion: boolean;
}

/** Circular progress indicator — extracted so the progress value comes directly from the engine, not ad-hoc stage counting. */
export function AuditProgressRing({ progress, stageLabel, size = 180, reducedMotion }: AuditProgressRingProps) {
  const strokeWidth = 4;
  const r = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="drop-shadow-[0_0_30px_rgba(0,200,255,0.15)]">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="url(#progressGrad)" strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className={reducedMotion ? '' : 'transition-all duration-700 ease-out'}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
        />
        {!reducedMotion && progress > 0 && progress < 100 && (
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke="url(#progressGrad)" strokeWidth={8}
            strokeLinecap="round" opacity={0.15}
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="animate-pulse transition-all duration-700 ease-out"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', filter: 'blur(6px)' }}
          />
        )}
        <defs>
          <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00C8FF" />
            <stop offset="100%" stopColor="#0BCEBC" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black tabular-nums text-white">
          {progress}<span className="text-lg text-slate-500">%</span>
        </span>
        <span className="mt-0.5 max-w-[120px] truncate text-center text-[10px] font-medium uppercase tracking-widest text-slate-500">
          {stageLabel}
        </span>
      </div>
    </div>
  );
}
