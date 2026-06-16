'use client'

import Link from 'next/link'
import { ArrowRight, ScanSearch } from 'lucide-react'

export interface EmptyStateProps {
  title?: string
  message?: string
  action?: string
  href?: string
  icon?: React.ReactNode
  compact?: boolean
}

export function EmptyState({
  title = 'No audit data available',
  message = 'Run a crawl to generate verified site intelligence',
  action = 'Start Audit',
  href = '/dashboard',
  icon,
  compact = false,
}: EmptyStateProps) {
  return (
    <div className={[
      'flex flex-col items-center justify-center text-center',
      compact ? 'py-10 px-6' : 'py-20 px-6',
    ].join(' ')}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        {icon ?? <ScanSearch size={20} strokeWidth={1.5} className="text-slate-600" />}
      </div>
      <h3 className={[
        'font-semibold text-slate-400',
        compact ? 'text-[13px]' : 'text-[15px]',
      ].join(' ')}>
        {title}
      </h3>
      <p className={[
        'mt-1.5 max-w-xs text-slate-600',
        compact ? 'text-[11px]' : 'text-[13px]',
      ].join(' ')}>
        {message}
      </p>
      {action && (
        <Link
          href={href}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-2.5 text-[12px] font-bold text-[#050816] transition-all hover:-translate-y-px hover:shadow-[0_0_20px_rgba(0,200,255,0.2)]"
        >
          {action} <ArrowRight size={12} strokeWidth={2.5} />
        </Link>
      )}
    </div>
  )
}
