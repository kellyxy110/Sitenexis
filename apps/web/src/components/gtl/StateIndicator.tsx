'use client'

import { type GTLState } from '@sitenexis/shared'

interface StateIndicatorProps {
  state: GTLState
  size?: 'sm' | 'md'
  showLabel?: boolean
}

const CONFIG: Record<GTLState, { dot: string; ring: string; label: string; pulse: boolean }> = {
  complete: { dot: 'bg-teal-400',  ring: 'ring-teal-400/20', label: 'Complete', pulse: false },
  partial:  { dot: 'bg-amber-400', ring: 'ring-amber-400/20', label: 'In Progress', pulse: true  },
  empty:    { dot: 'bg-slate-600', ring: 'ring-slate-600/20', label: 'No Data',    pulse: false },
}

export function StateIndicator({ state, size = 'sm', showLabel = false }: StateIndicatorProps) {
  const cfg = CONFIG[state]
  const dotSize = size === 'md' ? 'h-2.5 w-2.5' : 'h-1.5 w-1.5'

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`relative flex shrink-0 ${dotSize}`}>
        {cfg.pulse && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${cfg.dot} opacity-60`} />
        )}
        <span className={`relative inline-flex rounded-full ${dotSize} ${cfg.dot} ring-2 ${cfg.ring}`} />
      </span>
      {showLabel && (
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
          {cfg.label}
        </span>
      )}
    </span>
  )
}
