'use client'

import { type GTLState } from '@sitenexis/shared'
import { StateIndicator } from './StateIndicator'

interface GTLMetricCardProps {
  value: number | null | undefined
  label: string
  state: GTLState
  suffix?: string
  description?: string
  color?: string
}

function scoreColor(v: number): string {
  if (v >= 90) return '#22C55E'
  if (v >= 70) return '#0BCEBC'
  if (v >= 50) return '#F59E0B'
  return '#EF4444'
}

export function GTLMetricCard({
  value,
  label,
  state,
  suffix = '',
  description,
  color,
}: GTLMetricCardProps) {
  const resolved = color ?? (value != null ? scoreColor(value) : '#4A6280')
  const isPartial = state === 'partial'
  const isEmpty   = state === 'empty'

  return (
    <div
      className={[
        'relative overflow-hidden rounded-[18px] border p-5 transition-all duration-500',
        isEmpty
          ? 'border-white/[0.04] bg-white/[0.01]'
          : isPartial
          ? 'border-amber-500/[0.12] bg-[#0A1628]'
          : 'border-white/[0.07] bg-[#0A1628]',
      ].join(' ')}
    >
      {/* Partial shimmer line */}
      {isPartial && (
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(to right, transparent, ${resolved}55, transparent)` }}
        />
      )}

      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
          {label}
        </span>
        <StateIndicator state={state} showLabel={isPartial} />
      </div>

      <div className="mt-3">
        {isEmpty ? (
          <span className="text-[28px] font-bold text-slate-700">—</span>
        ) : (
          <span
            className={['text-[28px] font-bold tracking-[-0.03em] transition-opacity duration-500', isPartial ? 'opacity-70' : 'opacity-100'].join(' ')}
            style={{ color: resolved }}
          >
            {value ?? '—'}{value != null ? suffix : ''}
          </span>
        )}
      </div>

      {description && !isEmpty && (
        <p className="mt-1.5 text-[11px] leading-[1.6] text-slate-600">{description}</p>
      )}

      {isPartial && (
        <p className="mt-2 text-[10px] text-amber-500/60">Partial confidence — crawl in progress</p>
      )}
    </div>
  )
}
