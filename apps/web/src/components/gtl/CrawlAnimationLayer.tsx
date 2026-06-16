'use client'

import { useEffect, useRef, useState } from 'react'
import { type GTLState } from '@sitenexis/shared'

// ─── Pulse ring — expands outward from a point ───────────────────────────────

interface PulseRingProps { cx: number; cy: number; color: string; delay?: number }

function PulseRing({ cx, cy, color, delay = 0 }: PulseRingProps) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill="none"
      stroke={color}
      strokeWidth={1.2}
      style={{
        transformOrigin: `${cx}px ${cy}px`,
        animation: `gtl-ring 2.4s ${delay}s ease-out infinite`,
        opacity: 0,
      }}
    />
  )
}

// ─── Travelling data packet along an edge ────────────────────────────────────

interface PacketProps { x1: number; y1: number; x2: number; y2: number; color: string; delay?: number }

function DataPacket({ x1, y1, x2, y2, color, delay = 0 }: PacketProps) {
  const id = useRef(`pkt-${Math.random().toString(36).slice(2)}`)
  return (
    <g>
      <path
        id={id.current}
        d={`M ${x1} ${y1} L ${x2} ${y2}`}
        fill="none"
        stroke="transparent"
      />
      <circle r={2.5} fill={color} opacity={0.85}>
        <animateMotion
          dur="1.8s"
          begin={`${delay}s`}
          repeatCount="indefinite"
          rotate="none"
        >
          <mpath xlinkHref={`#${id.current}`} />
        </animateMotion>
      </circle>
    </g>
  )
}

// ─── Ghost node — appears during partial crawl ───────────────────────────────

interface GhostNodeProps { cx: number; cy: number; delay?: number }

function GhostNode({ cx, cy, delay = 0 }: GhostNodeProps) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill="rgba(255,255,255,0.04)"
      stroke="rgba(255,255,255,0.08)"
      strokeWidth={1}
      strokeDasharray="3 3"
      style={{ animation: `gtl-ghost 3s ${delay}s ease-in-out infinite alternate` }}
    />
  )
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

export interface CrawlNode  { id: string; x: number; y: number; discovered: boolean }
export interface CrawlEdge  { from: string; to: string }

interface CrawlAnimationLayerProps {
  state: GTLState
  nodes: CrawlNode[]
  edges: CrawlEdge[]
  width: number
  height: number
  pendingCount?: number
}

const TEAL  = '#0BCEBC'
const CYAN  = '#00C8FF'
const AMBER = '#F59E0B'

export function CrawlAnimationLayer({
  state,
  nodes,
  edges,
  width,
  height,
  pendingCount = 0,
}: CrawlAnimationLayerProps) {
  const [frame, setFrame] = useState(0)

  // Drive gentle re-render every 2 s so packets stagger on new edges
  useEffect(() => {
    if (state !== 'partial') return
    const id = setInterval(() => setFrame(f => f + 1), 2000)
    return () => clearInterval(id)
  }, [state])

  if (state === 'empty') return null

  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))

  return (
    <>
      {/* Keyframe injection — only once per document */}
      <style>{`
        @keyframes gtl-ring {
          0%   { r: 6;  opacity: 0.6; }
          100% { r: 28; opacity: 0; }
        }
        @keyframes gtl-ghost {
          from { opacity: 0.25; }
          to   { opacity: 0.06; }
        }
        @keyframes gtl-node-enter {
          from { opacity: 0; transform: scale(0.4); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        {/* Packet animation on each edge */}
        {state === 'partial' && edges.map((e, i) => {
          const a = nodeMap[e.from]
          const b = nodeMap[e.to]
          if (!a || !b) return null
          return (
            <DataPacket
              key={`${e.from}-${e.to}-${frame}`}
              x1={a.x} y1={a.y}
              x2={b.x} y2={b.y}
              color={i % 2 === 0 ? TEAL : CYAN}
              delay={(i * 0.3) % 1.8}
            />
          )
        })}

        {/* Pulse rings on discovered nodes */}
        {state === 'partial' && nodes.filter(n => n.discovered).map((n, i) => (
          <PulseRing
            key={n.id}
            cx={n.x} cy={n.y}
            color={AMBER}
            delay={(i * 0.4) % 2.4}
          />
        ))}

        {/* Ghost nodes — undiscovered pages still crawling */}
        {state === 'partial' && pendingCount > 0 && Array.from({ length: Math.min(pendingCount, 8) }).map((_, i) => {
          const angle = (i / Math.min(pendingCount, 8)) * Math.PI * 2
          const r     = Math.min(width, height) * 0.35
          return (
            <GhostNode
              key={`ghost-${i}`}
              cx={width / 2 + r * Math.cos(angle)}
              cy={height / 2 + r * Math.sin(angle)}
              delay={i * 0.4}
            />
          )
        })}

        {/* Complete: one final teal ring on each node then stops */}
        {state === 'complete' && nodes.slice(0, 5).map((n, i) => (
          <PulseRing key={n.id} cx={n.x} cy={n.y} color={TEAL} delay={i * 0.15} />
        ))}
      </svg>
    </>
  )
}
