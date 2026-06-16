'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

interface PartialTruthBannerProps {
  message?: string
  hint?: string
  timestamp: string
}

export function PartialTruthBanner({
  message = 'Audit in progress',
  hint = 'Results update as crawl expands',
  timestamp,
}: PartialTruthBannerProps) {
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    const update = () => {
      const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
      if (diff < 60)  setElapsed(`${diff}s ago`)
      else if (diff < 3600) setElapsed(`${Math.floor(diff / 60)}m ago`)
      else setElapsed(`${Math.floor(diff / 3600)}h ago`)
    }
    update()
    const id = setInterval(update, 5000)
    return () => clearInterval(id)
  }, [timestamp])

  return (
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-500/[0.18] bg-amber-500/[0.05] px-4 py-3">
      <RefreshCw
        size={13}
        strokeWidth={2}
        className="mt-0.5 shrink-0 animate-spin text-amber-400"
        style={{ animationDuration: '2s' }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-amber-300">{message}</p>
        <p className="mt-0.5 text-[11px] text-amber-400/70">{hint}</p>
      </div>
      <span className="shrink-0 text-[10px] text-amber-500/50">{elapsed}</span>
    </div>
  )
}
