'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

type StageStatus = 'pending' | 'active' | 'complete' | 'error';
type StreamMode = 'stable' | 'healthy' | 'degraded' | 'fallback';

interface Stage {
  id: string;
  icon: string;
  label: string;
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
  { id: 'crawl',  icon: '🔍', label: 'Crawling pages',         subStatus: null },
  { id: 'seo',    icon: '📊', label: 'Analysing SEO signals',  subStatus: null },
  { id: 'ai',     icon: '🧠', label: 'Scoring AI readability', subStatus: null },
  { id: 'schema', icon: '🧱', label: 'Validating schema',      subStatus: null },
  { id: 'links',  icon: '🔗', label: 'Mapping link graph',     subStatus: null },
  { id: 'report', icon: '📄', label: 'Generating report',      subStatus: null },
];

const STAGE_MAP: Record<string, string> = {
  crawl: 'crawl', crawling: 'crawl',
  seo: 'seo',
  ai: 'ai', readability: 'ai',
  schema: 'schema',
  links: 'links', link_graph: 'links',
  report: 'report', reporting: 'report',
};

// Max reconnects per stream mode — auto-healing reconnect budget
const MODE_MAX_RECONNECTS: Record<StreamMode, number> = {
  stable: 5, healthy: 4, degraded: 3, fallback: 1,
};

// ─── SRS Formula ─────────────────────────────────────────────────────────────
//
// SRS = (C×0.25 + I×0.20 + D×0.20 + E×0.15 + R×0.20) × 100
//
// C = Continuity  — successful chunks / total stream attempts
// I = Integrity   — successful parses / total messages received
// D = Completion  — completed audit layers / total layers
// E = Error stab  — 1 − (connErrors / MAX_ERRORS), floored at 0
// R = Recovery    — successful reconnects / total failures (1 if no failures)

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
    C: Math.round(C * 100),
    I: Math.round(I * 100),
    D: Math.round(D * 100),
    E: Math.round(E * 100),
    R: Math.round(R * 100),
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-cyan" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function RadarIcon() {
  return (
    <div className="relative flex h-16 w-16 items-center justify-center">
      <div className="absolute h-16 w-16 rounded-full border border-cyan/20 animate-ping" style={{ animationDuration: '2s' }} />
      <div className="absolute h-12 w-12 rounded-full border border-cyan/30 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.3s' }} />
      <div className="absolute h-8  w-8  rounded-full border border-cyan/40 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.6s' }} />
      <div className="h-3 w-3 rounded-full bg-cyan" />
    </div>
  );
}

function useElapsed(running: boolean): string {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Mini bar for SRS sub-score breakdown
function SrsBar({ label, value }: { label: string; value: number }) {
  const color = value >= 85 ? '#22C55E' : value >= 70 ? '#0BCEBC' : value >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between">
        <span className="text-[10px] text-[#4A6280]">{label}</span>
        <span className="text-[10px] font-medium text-white">{value}</span>
      </div>
      <div className="h-1 rounded-full bg-white/5">
        <div
          className="h-1 rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─── Stream Reliability Score Widget ─────────────────────────────────────────

interface SrsWidgetProps {
  srs: number;
  mode: StreamMode;
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
    <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.025] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#4A6280]">
          Stream Reliability Score
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${modeBadge}`}>
          {modeLabel}
        </span>
      </div>

      {/* Score + bar */}
      <div className="flex items-end gap-3 mb-3">
        <span className="text-3xl font-black tabular-nums leading-none" style={{ color }}>
          {srs.toFixed(1)}
        </span>
        <div className="flex-1 mb-1.5">
          <div className="h-1.5 rounded-full bg-white/5">
            <div
              className="h-1.5 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(srs, 100)}%`, background: color }}
            />
          </div>
        </div>
      </div>

      {/* Sub-score breakdown — C I D E R */}
      <div className="grid grid-cols-5 gap-2">
        <SrsBar label="C" value={C} />
        <SrsBar label="I" value={I} />
        <SrsBar label="D" value={D} />
        <SrsBar label="E" value={E} />
        <SrsBar label="R" value={R} />
      </div>

      {/* Auto-healing alert */}
      {mode === 'degraded' && (
        <p className="mt-2.5 text-[10px] text-amber-400 leading-tight">
          Degraded mode active — non-critical updates suppressed, retry budget reduced
        </p>
      )}
      {mode === 'fallback' && (
        <p className="mt-2.5 text-[10px] text-red-400 leading-tight">
          Fallback mode — live computation paused, serving last known state
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface AuditProgressProps {
  domain: string;
  auditId: string;
}

export function AuditProgress({ domain, auditId }: AuditProgressProps) {
  const router = useRouter();
  const esRef = useRef<EventSource | null>(null);

  const [stageStatuses, setStageStatuses] = useState<Record<string, StageStatus>>(() =>
    Object.fromEntries(STAGE_DEFS.map((s, i) => [s.id, i === 0 ? 'active' : 'pending']))
  );
  const [stageSubStatus, setStageSubStatus] = useState<Record<string, string>>({});
  const [pagesCount, setPagesCount]   = useState(0);
  const [issuesCount, setIssuesCount] = useState(0);
  const [failed, setFailed]           = useState(false);
  const [failReason, setFailReason]   = useState<string | null>(null);

  // Stream metrics — separate ref (mutable in closures) + state (for renders)
  const metricsRef = useRef<StreamMetrics>({ chunks: 0, parseErrors: 0, connErrors: 0, failures: 0, recoveries: 0 });
  const [metrics, setMetrics]         = useState<StreamMetrics>(metricsRef.current);

  const elapsed = useElapsed(!failed);

  // SRS + derived stream mode — recomputed on every metrics or stage change
  const { srs, C, I, D, E, R } = useMemo(
    () => computeSRS(metrics, stageStatuses),
    [metrics, stageStatuses],
  );
  const mode = useMemo(() => streamMode(srs), [srs]);

  const syncMetrics = useCallback(() => {
    setMetrics({ ...metricsRef.current });
  }, []);

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

  useEffect(() => {
    let unmounted = false;
    let reconnects = 0;

    function connect() {
      if (unmounted) return;

      // Auto-healing: max reconnect budget is SRS-mode-aware
      const currentSrs = computeSRS(metricsRef.current, {}).srs;
      const currentMode = streamMode(currentSrs);
      const maxReconnects = MODE_MAX_RECONNECTS[currentMode];

      const es = new EventSource(`/api/audit/${auditId}/stream`);
      esRef.current = es;

      es.onmessage = (event: MessageEvent<string>) => {
        let payload: SSEPayload;
        try {
          payload = JSON.parse(event.data) as SSEPayload;
        } catch {
          metricsRef.current.parseErrors += 1;
          syncMetrics();
          return;
        }

        // Keepalives and initial partial events don't count as data
        if (payload.type === 'ping' || payload.status === 'partial') return;

        metricsRef.current.chunks += 1;
        syncMetrics();

        if (payload.status === 'degraded') {
          if (payload.error?.includes('timed out')) {
            setFailed(true);
            setFailReason(payload.error);
            es.close();
          }
          return;
        }

        if (payload.error) {
          setFailed(true);
          setFailReason(payload.error);
          es.close();
          return;
        }

        if (payload.pagesCount != null) setPagesCount(payload.pagesCount);
        if (payload.issuesCount != null) setIssuesCount(payload.issuesCount);

        if (payload.stage) {
          const mapped = STAGE_MAP[payload.stage.toLowerCase()] ?? null;
          if (mapped) advanceToStage(mapped);
          if (payload.message) {
            setStageSubStatus((prev) => ({ ...prev, [mapped ?? payload.stage!]: payload.message! }));
          }
        }

        if (payload.status === 'complete') {
          markAllComplete();
          setTimeout(() => router.push(`/audit/${encodeURIComponent(domain)}`), 800);
          es.close();
        }

        if (payload.status === 'failed') {
          setFailed(true);
          setFailReason('The audit failed. Please try again.');
          es.close();
        }
      };

      es.onerror = () => {
        es.close();
        if (unmounted) return;

        metricsRef.current.connErrors += 1;
        reconnects += 1;

        // Re-derive mode at failure time — budget shrinks as SRS falls
        const srsNow = computeSRS(metricsRef.current, {}).srs;
        const modeNow = streamMode(srsNow);
        const budget  = MODE_MAX_RECONNECTS[modeNow];

        metricsRef.current.failures += 1;
        syncMetrics();

        if (reconnects < budget) {
          // Delay scales with severity: degraded = 5s, fallback = 8s
          const delay = modeNow === 'fallback' ? 8_000 : modeNow === 'degraded' ? 5_000 : 3_000;
          setTimeout(() => {
            metricsRef.current.recoveries += 1;
            syncMetrics();
            connect();
          }, delay);
        } else {
          setFailed(true);
          setFailReason('Lost connection to the audit stream. Please refresh.');
        }
      };
    }

    connect();

    return () => {
      unmounted = true;
      esRef.current?.close();
    };
  }, [auditId, domain, advanceToStage, markAllComplete, router, syncMetrics]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050B09] px-6 py-16">
      <div className="w-full max-w-lg">

        {/* Domain + radar */}
        <div className="mb-10 flex flex-col items-center gap-4 text-center">
          <RadarIcon />
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-cyan">
              {failed ? 'Audit Failed' : 'Auditing'}
            </p>
            <p className="mt-1 text-2xl font-bold text-white">{domain}</p>
          </div>
          {failed && failReason && (
            <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
              {failReason}
            </p>
          )}
        </div>

        {/* Stage list */}
        <div className="mb-8 space-y-3">
          {STAGE_DEFS.map((stage) => {
            const status = stageStatuses[stage.id] ?? 'pending';
            const sub    = stageSubStatus[stage.id] ?? stage.subStatus;
            const isActive   = status === 'active';
            const isComplete = status === 'complete';
            const isPending  = status === 'pending';

            return (
              <div
                key={stage.id}
                className={[
                  'flex items-start gap-4 rounded-xl border px-4 py-3 transition-all duration-300',
                  isActive   ? 'border-cyan/40 bg-cyan/5'           :
                  isComplete ? 'border-green-500/20 bg-green-500/5' :
                               'border-white/5 bg-white/[0.02]',
                ].join(' ')}
              >
                <div className="mt-0.5 shrink-0">
                  {isComplete ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/20 text-xs text-green-400">✓</span>
                  ) : isActive ? (
                    <Spinner />
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/5 text-xs text-[#4A6280]">○</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span>{stage.icon}</span>
                    <span className={[
                      'text-sm font-medium',
                      isComplete ? 'text-green-400' :
                      isActive   ? 'text-white'     :
                      isPending  ? 'text-[#4A6280]' : 'text-[#4A6280]',
                    ].join(' ')}>
                      {stage.label}
                    </span>
                  </div>
                  {(isActive || isComplete) && sub && (
                    <p className="mt-0.5 text-xs text-[#4A6280] truncate">{sub}</p>
                  )}
                </div>

                {isActive && (
                  <span className="shrink-0 rounded-full bg-cyan/10 px-2 py-0.5 text-xs text-cyan">Active</span>
                )}
                {isComplete && (
                  <span className="shrink-0 rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400">Done</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Live counters */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Pages Crawled', value: pagesCount },
            { label: 'Issues Found',  value: issuesCount },
            { label: 'Time Elapsed',  value: elapsed },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center card-glass rounded-xl py-4">
              <span className="text-2xl font-bold tabular-nums text-white">{value}</span>
              <span className="mt-1 text-xs text-[#4A6280]">{label}</span>
            </div>
          ))}
        </div>

        {/* SRS Panel — Stream Reliability Score + auto-healing status */}
        {!failed && (
          <SrsWidget srs={srs} mode={mode} C={C} I={I} D={D} E={E} R={R} />
        )}

        {/* Footer */}
        <div className="mt-6 text-center">
          {failed ? (
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-[#4A6280] underline hover:text-white transition-colors"
            >
              Back to dashboard
            </button>
          ) : (
            <p className="text-xs text-[#4A6280]">
              Keep this tab open while the audit runs. You&apos;ll be redirected automatically.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
