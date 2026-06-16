'use client'

import { useMemo } from 'react'
import { type GTLState } from '@sitenexis/shared'
import { StateIndicator } from './StateIndicator'
import { CrawlAnimationLayer, type CrawlNode, type CrawlEdge } from './CrawlAnimationLayer'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CrawlPhase =
  | 'queued'
  | 'crawling'
  | 'extracting'
  | 'analyzing'
  | 'complete'
  | 'failed'

export interface CrawlStageStatus {
  phase: CrawlPhase
  pagesDiscovered: number
  pagesProcessed: number
  entitiesFound: number
  chunksExtracted: number
  agentPhase: number       // 1–7 matching infrastructure-agent phases
  errors: number
}

// ─── Phase → GTL state mapping ────────────────────────────────────────────────

function phaseToGTL(phase: CrawlPhase): GTLState {
  if (phase === 'complete') return 'complete'
  if (phase === 'failed')   return 'empty'
  if (phase === 'queued')   return 'empty'
  return 'partial'
}

// ─── Stage row ────────────────────────────────────────────────────────────────

const STAGES: { id: CrawlPhase; label: string; agentMin: number; agentMax: number }[] = [
  { id: 'queued',     label: 'Queued',           agentMin: 0, agentMax: 0 },
  { id: 'crawling',   label: 'Crawl + Extract',  agentMin: 1, agentMax: 1 },
  { id: 'extracting', label: 'SEO + Schema',     agentMin: 2, agentMax: 2 },
  { id: 'analyzing',  label: 'AI + Entity + Trust', agentMin: 3, agentMax: 5 },
  { id: 'complete',   label: 'Report Generated', agentMin: 6, agentMax: 7 },
]

function stageState(stage: typeof STAGES[number], current: CrawlPhase, _agentPhase: number): GTLState {
  const phases = STAGES.map(s => s.id)
  const currentIdx = phases.indexOf(current)
  const stageIdx   = phases.indexOf(stage.id)
  if (stageIdx < currentIdx) return 'complete'
  if (stageIdx === currentIdx) return 'partial'
  return 'empty'
}

// ─── Main component ───────────────────────────────────────────────────────────

interface NeuralCrawlMapProps {
  status: CrawlStageStatus
  /** Simplified node positions (normalised 0-1, component maps to container) */
  sampleNodes?: CrawlNode[]
  sampleEdges?: CrawlEdge[]
  width?: number
  height?: number
}

export function NeuralCrawlMap({
  status,
  sampleNodes = [],
  sampleEdges = [],
  width = 320,
  height = 200,
}: NeuralCrawlMapProps) {
  const gtlState = phaseToGTL(status.phase)

  const stats = useMemo(() => [
    { label: 'Pages found',  value: status.pagesDiscovered },
    { label: 'Processed',    value: status.pagesProcessed  },
    { label: 'Entities',     value: status.entitiesFound   },
    { label: 'Chunks',       value: status.chunksExtracted },
  ], [status])

  return (
    <div className="overflow-hidden rounded-[20px] border border-white/[0.07] bg-[#08111E]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="text-[12px] font-semibold text-slate-300">Neural Crawl Engine</span>
          <StateIndicator state={gtlState} showLabel />
        </div>
        {status.errors > 0 && (
          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
            {status.errors} error{status.errors > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Animation canvas */}
      <div className="relative" style={{ width, height }}>
        {/* Base node dots */}
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="absolute inset-0">
          {sampleNodes.map(n => (
            <circle
              key={n.id}
              cx={n.x}
              cy={n.y}
              r={n.discovered ? 4 : 2.5}
              fill={n.discovered ? '#0BCEBC' : 'rgba(255,255,255,0.08)'}
              style={{ transition: 'r 0.4s ease, fill 0.4s ease' }}
            />
          ))}
          {sampleEdges.map((e, i) => {
            const a = sampleNodes.find(n => n.id === e.from)
            const b = sampleNodes.find(n => n.id === e.to)
            if (!a || !b) return null
            return (
              <line
                key={i}
                x1={a.x} y1={a.y}
                x2={b.x} y2={b.y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
            )
          })}
        </svg>

        {/* Cognitive animation overlay */}
        <CrawlAnimationLayer
          state={gtlState}
          nodes={sampleNodes}
          edges={sampleEdges}
          width={width}
          height={height}
          pendingCount={status.pagesDiscovered - status.pagesProcessed}
        />

        {/* Pending count badge */}
        {gtlState === 'partial' && status.pagesDiscovered > status.pagesProcessed && (
          <div className="absolute bottom-3 right-3 rounded-full border border-amber-500/20 bg-amber-500/[0.08] px-2.5 py-1 text-[10px] font-medium text-amber-400">
            +{status.pagesDiscovered - status.pagesProcessed} crawling
          </div>
        )}
      </div>

      {/* Stage pipeline */}
      <div className="border-t border-white/[0.06] px-5 py-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">Pipeline</p>
        <div className="space-y-2">
          {STAGES.map(stage => {
            const s = stageState(stage, status.phase, 0)
            return (
              <div key={stage.id} className="flex items-center gap-2.5">
                <StateIndicator state={s} size="sm" />
                <span className={[
                  'text-[11px]',
                  s === 'complete' ? 'text-teal-400' :
                  s === 'partial'  ? 'text-amber-300' :
                  'text-slate-700',
                ].join(' ')}>
                  {stage.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 border-t border-white/[0.06]">
        {stats.map(s => (
          <div key={s.label} className="border-r border-white/[0.05] px-4 py-3 last:border-r-0">
            <p className="text-[10px] text-slate-700">{s.label}</p>
            <p className="mt-0.5 text-[14px] font-bold text-slate-300">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
