'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  computeAuditProgress, buildProgressInput, derivePhaseTimeline,
  deriveLifecycleEvents, appendLifecycleEvents,
  type AuditProgressState, type RawProgressSignal, type LifecycleEvent,
} from '@/lib/audit-progress';
import { AuditExperience } from './audit-experience/AuditExperience';
import type { AuditAgentManifest } from '@sitenexis/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

type StageStatus = 'pending' | 'active' | 'complete' | 'error';
type StreamMode = 'stable' | 'healthy' | 'degraded' | 'fallback';

interface Stage {
  id: string;
  icon: string;
  label: string;
  shortLabel: string;
  subStatus: string | null;
}

interface SSEPayload {
  type?: string;
  status?: string;
  stage?: string;
  pagesCount?: number;
  issuesCount?: number;
  message?: string;
  error?: string;
  timestamp?: string;
  agentManifest?: AuditAgentManifest;
}

interface StreamMetrics {
  chunks: number;
  parseErrors: number;
  connErrors: number;
  failures: number;
  recoveries: number;
}

// ─── Stage definitions ────────────────────────────────────────────────────────

const STAGE_DEFS: Stage[] = [
  { id: 'crawl',  icon: '🔍', label: 'Crawling pages',         shortLabel: 'Crawl',  subStatus: null },
  { id: 'seo',    icon: '📊', label: 'Analysing SEO signals',  shortLabel: 'SEO',    subStatus: null },
  { id: 'ai',     icon: '🧠', label: 'Scoring AI readability', shortLabel: 'AI',     subStatus: null },
  { id: 'schema', icon: '🧱', label: 'Validating schema',      shortLabel: 'Schema', subStatus: null },
  { id: 'links',  icon: '🔗', label: 'Mapping link graph',     shortLabel: 'Links',  subStatus: null },
  { id: 'report', icon: '📄', label: 'Generating report',      shortLabel: 'Report', subStatus: null },
];

const STAGE_MAP: Record<string, string> = {
  crawl: 'crawl', crawling: 'crawl',
  seo: 'seo',
  ai: 'ai', readability: 'ai',
  schema: 'schema',
  links: 'links', link_graph: 'links',
  report: 'report', reporting: 'report',
};

const TERMINAL_AGENT_STATUSES = new Set(['completed', 'partial', 'failed', 'not_configured', 'not_applicable', 'no_data']);

function stageFromManifest(manifest: SSEPayload['agentManifest']): { active: string | null; completed: string[]; messages: Record<string, string> } {
  const agents = manifest?.agents ?? {};
  const terminal = (agent: string) => TERMINAL_AGENT_STATUSES.has(agents[agent]?.status ?? 'pending');
  const completed: string[] = [];
  const messages: Record<string, string> = {};
  if (terminal('crawl')) completed.push('crawl');
  if (terminal('seo')) completed.push('seo');
  if (terminal('schema')) completed.push('schema');
  if (['retrieval', 'entity', 'citation', 'semantic-trust'].every(terminal)) completed.push('ai');
  if (terminal('reporting')) completed.push('report');
  const active = ['crawl', 'seo', 'schema', 'ai', 'report'].find((stage) => !completed.includes(stage)) ?? null;
  for (const [agent, state] of Object.entries(agents)) {
    if (state.keyOutput) messages[STAGE_MAP[agent] ?? agent] = state.keyOutput;
  }
  return { active, completed, messages };
}

const MODE_MAX_RECONNECTS: Record<StreamMode, number> = {
  stable: 5, healthy: 4, degraded: 3, fallback: 1,
};

// ─── SRS Formula ─────────────────────────────────────────────────────────────

const MAX_ERRORS = 5;

function computeSRS(
  m: StreamMetrics,
  statuses: Record<string, StageStatus>,
): { srs: number; C: number; I: number; D: number; E: number; R: number } {
  const completedLayers = Object.values(statuses).filter((s) => s === 'complete').length;
  const totalAttempts = m.chunks + m.connErrors;
  const C = totalAttempts > 0 ? m.chunks / totalAttempts : 1;
  const totalMessages = m.chunks + m.parseErrors;
  const I = totalMessages > 0 ? m.chunks / totalMessages : 1;
  const D = STAGE_DEFS.length > 0 ? completedLayers / STAGE_DEFS.length : 0;
  const E = Math.max(0, 1 - m.connErrors / MAX_ERRORS);
  const R = m.failures > 0 ? Math.min(1, m.recoveries / m.failures) : 1;
  const raw = C * 0.25 + I * 0.20 + D * 0.20 + E * 0.15 + R * 0.20;
  return {
    srs: Math.round(raw * 1000) / 10,
    C: Math.round(C * 100), I: Math.round(I * 100),
    D: Math.round(D * 100), E: Math.round(E * 100), R: Math.round(R * 100),
  };
}

function streamMode(srs: number): StreamMode {
  if (srs >= 85) return 'stable';
  if (srs >= 70) return 'healthy';
  if (srs >= 50) return 'degraded';
  return 'fallback';
}

function srsColor(srs: number): string {
  if (srs >= 90) return '#22C55E';
  if (srs >= 75) return '#0BCEBC';
  if (srs >= 60) return '#F59E0B';
  return '#EF4444';
}

// ─── Visual sub-components ────────────────────────────────────────────────────

function SrsBar({ label, value }: { label: string; value: number }) {
  const color = value >= 85 ? '#22C55E' : value >= 70 ? '#0BCEBC' : value >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between">
        <span className="text-[10px] text-[#4A6280]">{label}</span>
        <span className="text-[10px] font-medium text-white">{value}</span>
      </div>
      <div className="h-1 rounded-full bg-white/5">
        <div className="h-1 rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

interface SrsWidgetProps {
  srs: number; mode: StreamMode;
  C: number; I: number; D: number; E: number; R: number;
}

function SrsWidget({ srs, mode, C, I, D, E, R }: SrsWidgetProps) {
  const color = srsColor(srs);
  const modeLabel = { stable: 'Stable', healthy: 'Healthy', degraded: 'Degraded', fallback: 'Fallback' }[mode];
  const modeBadge = {
    stable:   'bg-green-500/10 text-green-400 border-green-500/20',
    healthy:  'bg-teal-500/10 text-teal-400 border-teal-500/20',
    degraded: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    fallback: 'bg-red-500/10 text-red-400 border-red-500/20',
  }[mode];

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#4A6280]">Stream Reliability</span>
        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${modeBadge}`}>{modeLabel}</span>
      </div>
      <div className="flex items-end gap-3 mb-3">
        <span className="text-2xl font-black tabular-nums leading-none" style={{ color }}>{srs.toFixed(1)}</span>
        <div className="flex-1 mb-1">
          <div className="h-1 rounded-full bg-white/5">
            <div className="h-1 rounded-full transition-all duration-700" style={{ width: `${Math.min(srs, 100)}%`, background: color }} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2">
        <SrsBar label="C" value={C} />
        <SrsBar label="I" value={I} />
        <SrsBar label="D" value={D} />
        <SrsBar label="E" value={E} />
        <SrsBar label="R" value={R} />
      </div>
      {mode === 'degraded' && (
        <p className="mt-2 text-[10px] text-amber-400 leading-tight">Degraded mode — non-critical updates suppressed</p>
      )}
      {mode === 'fallback' && (
        <p className="mt-2 text-[10px] text-red-400 leading-tight">Fallback mode — serving last known state</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
// Note: the ring/particle-field visuals now live in ./audit-experience — this
// component's job is SSE handling, stream-reliability scoring, and computing
// the canonical progress contract; AuditExperience owns rendering it.

export interface AuditProgressProps {
  domain: string;
  auditId: string;
}

export function AuditProgress({ domain, auditId }: AuditProgressProps) {
  const router = useRouter();
  const esRef = useRef<EventSource | null>(null);

  // Retained only to feed the Stream Reliability Score (D component) below —
  // superseded for actual progress display by the canonical engine.
  const [stageStatuses, setStageStatuses] = useState<Record<string, StageStatus>>(() =>
    Object.fromEntries(STAGE_DEFS.map((s, i) => [s.id, i === 0 ? 'active' : 'pending']))
  );
  const [failed, setFailed]           = useState(false);
  const [showSrs, setShowSrs]         = useState(false);

  const metricsRef = useRef<StreamMetrics>({ chunks: 0, parseErrors: 0, connErrors: 0, failures: 0, recoveries: 0 });
  const [metrics, setMetrics] = useState<StreamMetrics>(metricsRef.current);

  // ─── Canonical progress engine state (see @/lib/audit-progress) ─────────
  const startedAtMsRef = useRef<number>(Date.now());
  const lastManifestRef = useRef<SSEPayload['agentManifest'] | null>(null);
  const lastPagesCountRef = useRef<number | null>(null);
  const prevProgressStateRef = useRef<AuditProgressState | null>(null);
  const [progressState, setProgressState] = useState<AuditProgressState>(() =>
    computeAuditProgress(buildProgressInput({
      auditId, domain, executionMode: 'unknown',
      signal: {}, startedAtMs: startedAtMsRef.current, nowMs: startedAtMsRef.current,
    })),
  );
  const [liveFeed, setLiveFeed] = useState<LifecycleEvent[]>([]);
  const [lastAnnouncement, setLastAnnouncement] = useState<string | null>(null);

  const pushProgress = useCallback((signal: RawProgressSignal) => {
    const next = computeAuditProgress(buildProgressInput({
      auditId, domain, executionMode: 'unknown',
      signal, startedAtMs: startedAtMsRef.current, nowMs: Date.now(),
    }));
    const newEvents = deriveLifecycleEvents(prevProgressStateRef.current, next, Date.now());
    prevProgressStateRef.current = next;
    setProgressState(next);
    if (newEvents.length > 0) {
      setLiveFeed((feed) => appendLifecycleEvents(feed, newEvents));
      const stageEvent = newEvents.find((e) => e.id.startsWith('stage:') || e.id.startsWith('terminal:'));
      if (stageEvent) setLastAnnouncement(stageEvent.message);
    }
  }, [auditId, domain]);

  const { srs, C, I, D, E, R } = useMemo(() => computeSRS(metrics, stageStatuses), [metrics, stageStatuses]);
  const mode = useMemo(() => streamMode(srs), [srs]);
  const phases = useMemo(() => derivePhaseTimeline(progressState), [progressState]);

  const syncMetrics = useCallback(() => { setMetrics({ ...metricsRef.current }); }, []);

  const advanceToStage = useCallback((stageId: string) => {
    setStageStatuses((prev) => {
      const next = { ...prev };
      let found = false;
      for (const s of STAGE_DEFS) {
        if (found) { next[s.id] = 'pending'; }
        else if (s.id === stageId) { next[s.id] = 'active'; found = true; }
        else { next[s.id] = 'complete'; }
      }
      return next;
    });
  }, []);

  const markAllComplete = useCallback(() => {
    setStageStatuses(Object.fromEntries(STAGE_DEFS.map((s) => [s.id, 'complete'])));
  }, []);

  // ─── SSE connection ───────────────────────────────────────────────────────
  useEffect(() => {
    let unmounted = false;
    let reconnects = 0;

    function connect() {
      if (unmounted) return;
      const es = new EventSource(`/api/audit/${auditId}/stream`);
      esRef.current = es;

      es.onmessage = (event: MessageEvent<string>) => {
        let payload: SSEPayload;
        try { payload = JSON.parse(event.data) as SSEPayload; }
        catch { metricsRef.current.parseErrors += 1; syncMetrics(); return; }

        if (payload.type === 'ping' || (payload.status === 'partial' && payload.stage === 'connecting')) return;

        metricsRef.current.chunks += 1;
        syncMetrics();

        // ─── Canonical progress engine — updates on every real tick ─────────
        if (payload.agentManifest) lastManifestRef.current = payload.agentManifest;
        if (payload.pagesCount != null) lastPagesCountRef.current = payload.pagesCount;
        pushProgress({
          status: payload.status,
          agentManifest: lastManifestRef.current ?? undefined,
          pagesCount: lastPagesCountRef.current ?? undefined,
          error: payload.error,
        });

        if (payload.status === 'degraded') {
          if (payload.error?.includes('timed out')) { setFailed(true); es.close(); }
          return;
        }
        if (payload.error) { setFailed(true); es.close(); return; }

        if (payload.agentManifest) {
          const manifestStages = stageFromManifest(payload.agentManifest);
          setStageStatuses((previous) => {
            const next = { ...previous };
            for (const stage of manifestStages.completed) next[stage] = 'complete';
            if (manifestStages.active && next[manifestStages.active] !== 'complete') next[manifestStages.active] = 'active';
            return next;
          });
        }

        if (payload.stage) {
          const mapped = STAGE_MAP[payload.stage.toLowerCase()] ?? null;
          if (mapped) advanceToStage(mapped);
        }

        if (payload.status === 'partial') {
          setTimeout(() => router.push('/audit/' + encodeURIComponent(domain)), 800);
          es.close();
          return;
        }

        if (payload.status === 'complete') {
          markAllComplete();
          setTimeout(() => router.push(`/audit/${encodeURIComponent(domain)}`), 800);
          es.close();
        }
        if (payload.status === 'failed') { setFailed(true); es.close(); }
      };

      es.onerror = () => {
        es.close();
        if (unmounted) return;
        metricsRef.current.connErrors += 1;
        reconnects += 1;
        const srsNow = computeSRS(metricsRef.current, {}).srs;
        const modeNow = streamMode(srsNow);
        const budget = MODE_MAX_RECONNECTS[modeNow];
        metricsRef.current.failures += 1;
        syncMetrics();
        if (reconnects < budget) {
          const delay = modeNow === 'fallback' ? 8_000 : modeNow === 'degraded' ? 5_000 : 3_000;
          setTimeout(() => { metricsRef.current.recoveries += 1; syncMetrics(); connect(); }, delay);
        } else {
          setFailed(true);
          pushProgress({ status: 'failed', error: 'Lost connection to the audit stream. Please refresh.' });
        }
      };
    }

    connect();
    return () => { unmounted = true; esRef.current?.close(); };
  }, [auditId, domain, advanceToStage, markAllComplete, router, syncMetrics, pushProgress]);

  return (
    <AuditExperience
      domain={domain}
      progressState={progressState}
      startedAtMs={startedAtMsRef.current}
      phases={phases}
      feedEvents={liveFeed}
      lastAnnouncement={lastAnnouncement}
      belowRing={
        !failed && (
          <div className="relative z-10 mt-5 w-full max-w-md">
            <button
              onClick={() => setShowSrs(!showSrs)}
              className="mb-2 flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#4A6280]">
                Stream Health
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tabular-nums" style={{ color: srsColor(srs) }}>{srs.toFixed(1)}</span>
                <svg className={`h-3 w-3 text-slate-600 transition-transform ${showSrs ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none">
                  <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </button>
            {showSrs && <SrsWidget srs={srs} mode={mode} C={C} I={I} D={D} E={E} R={R} />}
          </div>
        )
      }
      footer={
        failed ? (
          <button onClick={() => router.push('/dashboard')} className="text-sm text-[#4A6280] underline hover:text-white transition-colors">
            Back to dashboard
          </button>
        ) : (
          <p className="text-[11px] text-slate-700">
            Keep this tab open — you&apos;ll be redirected when the audit completes.
          </p>
        )
      }
    />
  );
}
