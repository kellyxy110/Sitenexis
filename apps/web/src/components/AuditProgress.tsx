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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Hex ring position calculator ─────────────────────────────────────────────

function getNodePositions(count: number, radius: number, centerX: number, centerY: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    return { x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) };
  });
}

// ─── Circular progress ring ───────────────────────────────────────────────────

function ProgressRing({ progress, size = 180 }: { progress: number; size?: number }) {
  const strokeWidth = 4;
  const r = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="drop-shadow-[0_0_30px_rgba(0,200,255,0.15)]">
      {/* Track */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />
      {/* Progress arc */}
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="url(#progressGrad)" strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        className="transition-all duration-700 ease-out"
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
      />
      {/* Glow pulse on the leading edge */}
      {progress > 0 && progress < 100 && (
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="url(#progressGrad)" strokeWidth={8}
          strokeLinecap="round" opacity={0.15}
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700 ease-out animate-pulse"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', filter: 'blur(6px)' }}
        />
      )}
      <defs>
        <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00C8FF" />
          <stop offset="100%" stopColor="#0BCEBC" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Animated background particles ────────────────────────────────────────────

function ParticleField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 30 }, (_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-cyan/20"
          style={{
            width: `${1 + Math.random() * 2}px`,
            height: `${1 + Math.random() * 2}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `particleFloat ${8 + Math.random() * 12}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 8}s`,
            opacity: 0.3 + Math.random() * 0.4,
          }}
        />
      ))}
      <style>{`
        @keyframes particleFloat {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          25%      { transform: translateY(-20px) translateX(10px); opacity: 0.6; }
          50%      { transform: translateY(-10px) translateX(-5px); opacity: 0.4; }
          75%      { transform: translateY(-30px) translateX(8px); opacity: 0.5; }
        }
      `}</style>
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
  const [showSrs, setShowSrs]         = useState(false);

  const metricsRef = useRef<StreamMetrics>({ chunks: 0, parseErrors: 0, connErrors: 0, failures: 0, recoveries: 0 });
  const [metrics, setMetrics] = useState<StreamMetrics>(metricsRef.current);

  const elapsed = useElapsed(!failed);

  const { srs, C, I, D, E, R } = useMemo(() => computeSRS(metrics, stageStatuses), [metrics, stageStatuses]);
  const mode = useMemo(() => streamMode(srs), [srs]);

  const completedCount = useMemo(
    () => Object.values(stageStatuses).filter((s) => s === 'complete').length,
    [stageStatuses],
  );
  const progressPct = Math.round((completedCount / STAGE_DEFS.length) * 100);

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

        if (payload.type === 'ping' || payload.status === 'partial') return;

        metricsRef.current.chunks += 1;
        syncMetrics();

        if (payload.status === 'degraded') {
          if (payload.error?.includes('timed out')) { setFailed(true); setFailReason(payload.error); es.close(); }
          return;
        }
        if (payload.error) { setFailed(true); setFailReason(payload.error); es.close(); return; }
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
        if (payload.status === 'failed') { setFailed(true); setFailReason('The audit failed. Please try again.'); es.close(); }
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
          setFailReason('Lost connection to the audit stream. Please refresh.');
        }
      };
    }

    connect();
    return () => { unmounted = true; esRef.current?.close(); };
  }, [auditId, domain, advanceToStage, markAllComplete, router, syncMetrics]);

  // ─── Hex node positions (ring around center) ───────────────────────────────
  const ringSize = 340;
  const center = ringSize / 2;
  const nodeRadius = 120;
  const nodePositions = useMemo(() => getNodePositions(STAGE_DEFS.length, nodeRadius, center, center), [center]);

  const activeStage = STAGE_DEFS.find((s) => stageStatuses[s.id] === 'active');

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#040A12] px-4 py-12">
      {/* Particle background */}
      <ParticleField />

      {/* Subtle radial gradient behind the ring */}
      <div className="pointer-events-none absolute" style={{ width: 600, height: 600, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
        <div className="h-full w-full rounded-full bg-[radial-gradient(circle,rgba(0,200,255,0.04)_0%,transparent_70%)]" />
      </div>

      {/* ─── Top bar: domain + status ──────────────────────────────────────── */}
      <div className="relative z-10 mb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 backdrop-blur-sm">
          {!failed && <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-cyan" /></span>}
          {failed && <span className="h-2 w-2 rounded-full bg-red-500" />}
          <span className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
            {failed ? 'Audit Failed' : 'Auditing'}
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">{domain}</h1>
        {failed && failReason && (
          <p className="mx-auto mt-3 max-w-md rounded-lg border border-red-500/20 bg-red-500/[0.08] px-4 py-2 text-sm text-red-400">
            {failReason}
          </p>
        )}
      </div>

      {/* ─── Mission control ring ──────────────────────────────────────────── */}
      <div className="relative z-10" style={{ width: ringSize, height: ringSize }}>
        {/* Center: progress ring + percentage */}
        <div className="absolute" style={{ left: center - 90, top: center - 90 }}>
          <ProgressRing progress={progressPct} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-black tabular-nums text-white">{progressPct}<span className="text-lg text-slate-500">%</span></span>
            <span className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-slate-500">
              {progressPct >= 100 ? 'Complete' : activeStage ? activeStage.shortLabel : 'Starting'}
            </span>
          </div>
        </div>

        {/* Connector lines from center to each node */}
        <svg className="absolute inset-0" width={ringSize} height={ringSize}>
          {nodePositions.map((pos, i) => {
            const status = stageStatuses[STAGE_DEFS[i].id] ?? 'pending';
            const strokeColor = status === 'complete' ? 'rgba(16,185,129,0.3)' : status === 'active' ? 'rgba(0,200,255,0.3)' : 'rgba(255,255,255,0.04)';
            return (
              <line key={STAGE_DEFS[i].id} x1={center} y1={center} x2={pos.x} y2={pos.y}
                stroke={strokeColor} strokeWidth={1.5}
                className="transition-all duration-500" />
            );
          })}
        </svg>

        {/* Agent nodes */}
        {STAGE_DEFS.map((stage, i) => {
          const pos = nodePositions[i];
          const status = stageStatuses[stage.id] ?? 'pending';
          const isActive = status === 'active';
          const isComplete = status === 'complete';

          const borderColor = isComplete ? 'border-green-500/40' : isActive ? 'border-cyan/50' : 'border-white/[0.06]';
          const bgColor = isComplete ? 'bg-green-500/[0.08]' : isActive ? 'bg-cyan/[0.08]' : 'bg-white/[0.02]';
          const textColor = isComplete ? 'text-green-400' : isActive ? 'text-cyan' : 'text-slate-600';

          return (
            <div
              key={stage.id}
              className={`absolute flex flex-col items-center justify-center rounded-full border-2 transition-all duration-500 ${borderColor} ${bgColor}`}
              style={{
                width: 64, height: 64,
                left: pos.x - 32, top: pos.y - 32,
                boxShadow: isActive ? '0 0 20px rgba(0,200,255,0.15), 0 0 40px rgba(0,200,255,0.05)' :
                           isComplete ? '0 0 20px rgba(16,185,129,0.1)' : 'none',
              }}
            >
              {/* Ping ring for active node */}
              {isActive && (
                <span className="absolute inset-0 rounded-full border border-cyan/30 animate-ping" style={{ animationDuration: '2s' }} />
              )}
              <span className="text-lg leading-none">{stage.icon}</span>
              <span className={`mt-0.5 text-[8px] font-bold uppercase tracking-wider ${textColor}`}>{stage.shortLabel}</span>
            </div>
          );
        })}
      </div>

      {/* ─── Active stage detail ───────────────────────────────────────────── */}
      {activeStage && !failed && (
        <div className="relative z-10 mt-6 flex items-center gap-3 rounded-xl border border-cyan/10 bg-cyan/[0.03] px-5 py-3 backdrop-blur-sm">
          <svg className="h-4 w-4 animate-spin text-cyan" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <div>
            <span className="text-sm font-medium text-white">{activeStage.label}</span>
            {stageSubStatus[activeStage.id] && (
              <span className="ml-2 text-xs text-slate-500">{stageSubStatus[activeStage.id]}</span>
            )}
          </div>
        </div>
      )}

      {/* ─── Live counters ─────────────────────────────────────────────────── */}
      <div className="relative z-10 mt-8 grid w-full max-w-md grid-cols-3 gap-3">
        {[
          { label: 'Pages', value: pagesCount, color: '#00C8FF' },
          { label: 'Issues', value: issuesCount, color: issuesCount > 0 ? '#F59E0B' : '#0BCEBC' },
          { label: 'Elapsed', value: elapsed, color: '#8B5CF6' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex flex-col items-center rounded-xl border border-white/[0.06] bg-white/[0.02] py-4 backdrop-blur-sm">
            <span className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</span>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-widest text-slate-600">{label}</span>
          </div>
        ))}
      </div>

      {/* ─── Completed stages bar ──────────────────────────────────────────── */}
      <div className="relative z-10 mt-5 flex w-full max-w-md gap-1.5">
        {STAGE_DEFS.map((stage) => {
          const status = stageStatuses[stage.id] ?? 'pending';
          return (
            <div
              key={stage.id}
              className="h-1 flex-1 rounded-full transition-all duration-500"
              style={{
                background: status === 'complete' ? '#10B981' : status === 'active' ? '#00C8FF' : 'rgba(255,255,255,0.05)',
                boxShadow: status === 'active' ? '0 0 8px rgba(0,200,255,0.3)' : 'none',
              }}
            />
          );
        })}
      </div>

      {/* ─── SRS toggle + widget ───────────────────────────────────────────── */}
      {!failed && (
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
      )}

      {/* ─── Footer ────────────────────────────────────────────────────────── */}
      <div className="relative z-10 mt-6 text-center">
        {failed ? (
          <button onClick={() => router.push('/dashboard')} className="text-sm text-[#4A6280] underline hover:text-white transition-colors">
            Back to dashboard
          </button>
        ) : (
          <p className="text-[11px] text-slate-700">
            Keep this tab open — you&apos;ll be redirected when the audit completes.
          </p>
        )}
      </div>
    </div>
  );
}
