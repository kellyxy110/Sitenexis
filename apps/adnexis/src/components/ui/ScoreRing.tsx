'use client';

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  color?: string;
}

export function ScoreRing({
  score,
  size = 80,
  strokeWidth = 6,
  label,
  color,
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = () => {
    if (color) return color;
    if (score >= 80) return '#00D4AA';
    if (score >= 60) return '#6C3EFF';
    if (score >= 40) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#2A2A4A"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="rotate-90"
          style={{
            transform: 'rotate(90deg)',
            transformOrigin: 'center',
            fill: getColor(),
            fontSize: size < 60 ? '14px' : '18px',
            fontWeight: 700,
          }}
        >
          {score}
        </text>
      </svg>
      {label && (
        <span className="text-xs text-text-secondary text-center leading-tight">{label}</span>
      )}
    </div>
  );
}
