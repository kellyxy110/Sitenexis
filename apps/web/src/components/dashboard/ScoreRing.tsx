'use client';

import { useEffect, useRef, useState } from 'react';

interface ScoreRingProps {
  score: number | null;
  size?: number | undefined;
  strokeWidth?: number | undefined;
  label?: string | undefined;
  animated?: boolean | undefined;
}

function scoreColor(score: number): string {
  if (score >= 90) return '#22C55E';
  if (score >= 70) return '#0BCEBC';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs Work';
  return 'Critical';
}

export function ScoreRing({
  score,
  size = 200,
  strokeWidth = 10,
  label,
  animated = true,
}: ScoreRingProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const animRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const duration = 1200;

  useEffect(() => {
    if (score === null) return;
    const target = score;
    if (!animated) { setDisplayScore(target); return; }

    startRef.current = null;

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * target));
      if (progress < 1) animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [score, animated]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const fillRatio = score !== null ? displayScore / 100 : 0;
  const strokeDashoffset = circumference * (1 - fillRatio);
  const color = score !== null ? scoreColor(score) : '#1E3A5F';

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      {/* Background radial glow */}
      {score !== null && (
        <div
          className="pointer-events-none absolute inset-0 rounded-full opacity-20 blur-3xl"
          style={{ background: color }}
        />
      )}

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
        />
        {/* Fill */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.05s linear, stroke 0.4s ease' }}
        />
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        {score !== null ? (
          <>
            <span
              className="tabular-nums font-display font-bold leading-none text-white"
              style={{ fontSize: size * 0.26 }}
            >
              {displayScore}
            </span>
            <span
              className="font-medium leading-none"
              style={{ color, fontSize: size * 0.075 }}
            >
              {scoreLabel(score)}
            </span>
            {label && (
              <span className="mt-1 text-center text-[#4A6280]" style={{ fontSize: size * 0.065 }}>
                {label}
              </span>
            )}
          </>
        ) : (
          <span className="text-sm text-[#4A6280]">—</span>
        )}
      </div>
    </div>
  );
}
