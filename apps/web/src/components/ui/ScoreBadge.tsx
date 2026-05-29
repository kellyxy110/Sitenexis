import { getScoreLabel, getScoreTailwindClass } from '@sitenexis/shared';
import { clsx } from 'clsx';

interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreBadge({ score, size = 'md' }: ScoreBadgeProps) {
  const label = getScoreLabel(score);
  const colorClass = getScoreTailwindClass(score);

  return (
    <div
      className={clsx(
        'inline-flex flex-col items-center rounded-xl border border-white/10 bg-white/5 p-3',
        size === 'sm' && 'p-2',
        size === 'lg' && 'p-5'
      )}
    >
      <span className={clsx('font-display font-bold tabular-nums', colorClass,
        size === 'sm' && 'text-2xl',
        size === 'md' && 'text-4xl',
        size === 'lg' && 'text-6xl',
      )}>
        {score}
      </span>
      <span className={clsx('mt-1 text-text-mid',
        size === 'sm' && 'text-xs',
        size === 'md' && 'text-sm',
        size === 'lg' && 'text-base',
      )}>
        {label}
      </span>
    </div>
  );
}
