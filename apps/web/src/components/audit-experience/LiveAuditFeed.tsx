'use client';

import { useEffect, useRef } from 'react';
import type { LifecycleEvent } from '@/lib/audit-progress';

const KIND_ICON: Record<LifecycleEvent['kind'], string> = {
  success: '✓',
  active: '●',
  warning: '⚠',
  info: '·',
};

const KIND_COLOR: Record<LifecycleEvent['kind'], string> = {
  success: 'text-green-400',
  active: 'text-cyan',
  warning: 'text-amber-400',
  info: 'text-slate-500',
};

interface LiveAuditFeedProps {
  events: LifecycleEvent[];
  /** The single most recent stage-transition message — the only thing announced to screen readers. */
  lastAnnouncement: string | null;
}

/**
 * Compact scrolling feed of real lifecycle events. Deduplication and
 * page-count milestone bucketing happen upstream in deriveLifecycleEvents —
 * this component only renders what it's given.
 *
 * Accessibility: the visible list is a plain log (no per-item aria-live,
 * which would spam screen readers on a long audit) — only meaningful stage
 * changes are announced, via the separate aria-live region below.
 */
export function LiveAuditFeed({ events, lastAnnouncement }: LiveAuditFeedProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  if (events.length === 0) return null;

  return (
    <div className="relative z-10 mt-5 w-full max-w-lg">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#4A6280]">Live Feed</div>
      <div
        ref={scrollRef}
        role="log"
        aria-label="Audit activity log"
        className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-white/[0.05] bg-white/[0.015] p-3"
      >
        {events.map((event) => (
          <div key={event.id} className="flex items-start gap-2 text-xs">
            <span className={`mt-0.5 ${KIND_COLOR[event.kind]}`} aria-hidden>{KIND_ICON[event.kind]}</span>
            <span className="text-slate-400">{event.message}</span>
          </div>
        ))}
      </div>
      {/* The only thing screen readers hear from this component — meaningful stage changes, not every event. */}
      <div className="sr-only" role="status" aria-live="polite">{lastAnnouncement}</div>
    </div>
  );
}
