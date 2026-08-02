'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { deriveViewMode, type AuditProgressState, type PhaseTimelineEntry, type LifecycleEvent } from '@/lib/audit-progress';
import { useReducedMotion } from './use-reduced-motion';
import { ParticleField } from './ParticleField';
import { AuditHeader } from './AuditHeader';
import { AuditProgressRing } from './AuditProgressRing';
import { CurrentActivity } from './CurrentActivity';
import { AuditMetrics } from './AuditMetrics';
import { AuditStageTimeline } from './AuditStageTimeline';
import { LiveAuditFeed } from './LiveAuditFeed';
import { AuditEducationCarousel } from './AuditEducationCarousel';
import { AuditCompletion } from './AuditCompletion';
import { AuditLimitationNotice } from './AuditLimitationNotice';

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

/**
 * The SSE stream only ticks every ~2s, which would make a raw
 * progressState.elapsedMs display visibly stutter. This ticks a smooth local
 * clock from the same real startedAtMs instead — purely cosmetic, still
 * derived from the one real timestamp, never a fabricated rate.
 */
function useSmoothElapsedMs(startedAtMs: number, running: boolean): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  return Math.max(0, nowMs - startedAtMs);
}

interface AuditExperienceProps {
  domain: string;
  progressState: AuditProgressState;
  startedAtMs: number;
  phases?: PhaseTimelineEntry[];
  feedEvents?: LifecycleEvent[];
  lastAnnouncement?: string | null;
  /** Slots for pieces built in later, separately-validated tasks (education / completion). */
  belowRing?: ReactNode;
  footer?: ReactNode;
}

/**
 * Top-level composition for the live audit experience. Pure presentation —
 * all progress math comes from AuditProgressState (packages/... apps/web/src/lib/audit-progress),
 * never recomputed here.
 */
export function AuditExperience({
  domain, progressState, startedAtMs, phases, feedEvents, lastAnnouncement, belowRing, footer,
}: AuditExperienceProps) {
  const reducedMotion = useReducedMotion();
  const viewMode = deriveViewMode(progressState);
  const failed = viewMode === 'failed';
  const partial = viewMode === 'partial';
  const isFinished = viewMode === 'completed' || partial || failed;
  const running = viewMode === 'running';
  const elapsedMs = useSmoothElapsedMs(startedAtMs, running);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#040A12] px-4 py-12">
      <ParticleField reducedMotion={reducedMotion} />

      <div
        className="pointer-events-none absolute"
        style={{ width: 600, height: 600, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
        aria-hidden
      >
        <div className="h-full w-full rounded-full bg-[radial-gradient(circle,rgba(0,200,255,0.04)_0%,transparent_70%)]" />
      </div>

      {(running || failed) && (
        <AuditHeader domain={domain} failed={failed} errorMessage={progressState.errorMessage} reducedMotion={reducedMotion} />
      )}

      {running && (
        <>
          <div className="relative z-10">
            <AuditProgressRing progress={progressState.progress} stageLabel={progressState.currentActivity} reducedMotion={reducedMotion} />
          </div>

          <CurrentActivity
            stage={progressState.stage}
            currentActivity={progressState.currentActivity}
            currentUrl={progressState.currentUrl}
            reducedMotion={reducedMotion}
          />

          <AuditMetrics
            pagesDiscovered={progressState.pagesDiscovered}
            pagesAnalysed={progressState.pagesAnalysed}
            elapsedLabel={formatElapsed(elapsedMs)}
            estimatedRemainingLabel={progressState.estimatedRemainingLabel}
          />

          {phases && <AuditStageTimeline phases={phases} />}

          {feedEvents && <LiveAuditFeed events={feedEvents} lastAnnouncement={lastAnnouncement ?? null} />}

          <AuditEducationCarousel reducedMotion={reducedMotion} />
        </>
      )}

      {!failed && isFinished && phases && (
        <>
          <AuditCompletion
            partial={partial}
            pagesAnalysed={progressState.pagesAnalysed}
            phases={phases}
            reducedMotion={reducedMotion}
          />
          <AuditLimitationNotice
            failedModules={progressState.completedModules.filter((m) => m.state === 'FAILED')}
            unavailableModules={progressState.unavailableModules}
          />
        </>
      )}

      {belowRing}

      {(running || failed) && (
        <div className="relative z-10 mt-6 text-center">
          {footer ?? (
            <p className="text-[11px] text-slate-700">
              Keep this tab open — you&apos;ll be redirected when the audit completes.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
