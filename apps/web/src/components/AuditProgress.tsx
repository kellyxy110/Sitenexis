'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

type StageStatus = 'pending' | 'active' | 'complete' | 'error';

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

// ─── Stage definitions ────────────────────────────────────────────────────────

const STAGE_DEFS: Stage[] = [
  { id: 'crawl',       icon: '🔍', label: 'Crawling pages',          subStatus: null },
  { id: 'seo',         icon: '📊', label: 'Analysing SEO signals',   subStatus: null },
  { id: 'ai',          icon: '🧠', label: 'Scoring AI readability',  subStatus: null },
  { id: 'schema',      icon: '🧱', label: 'Validating schema',       subStatus: null },
  { id: 'links',       icon: '🔗', label: 'Mapping link graph',      subStatus: null },
  { id: 'report',      icon: '📄', label: 'Generating report',       subStatus: null },
];

// Maps SSE stage names → stage IDs
const STAGE_MAP: Record<string, string> = {
  crawl:       'crawl',
  crawling:    'crawl',
  seo:         'seo',
  ai:          'ai',
  readability: 'ai',
  schema:      'schema',
  links:       'links',
  link_graph:  'links',
  report:      'report',
  reporting:   'report',
};

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-cyan" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

// ─── Radar sweep animation ────────────────────────────────────────────────────

function RadarIcon() {
  return (
    <div className="relative flex h-16 w-16 items-center justify-center">
      {/* Outer rings */}
      <div className="absolute h-16 w-16 rounded-full border border-cyan/20 animate-ping" style={{ animationDuration: '2s' }} />
      <div className="absolute h-12 w-12 rounded-full border border-cyan/30 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.3s' }} />
      <div className="absolute h-8  w-8  rounded-full border border-cyan/40 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.6s' }} />
      {/* Centre dot */}
      <div className="h-3 w-3 rounded-full bg-cyan" />
    </div>
  );
}

// ─── Elapsed timer ────────────────────────────────────────────────────────────

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
  const [pagesCount, setPagesCount] = useState(0);
  const [issuesCount, setIssuesCount] = useState(0);
  const [failed, setFailed] = useState(false);
  const [failReason, setFailReason] = useState<string | null>(null);

  const elapsed = useElapsed(!failed);

  const advanceToStage = useCallback((stageId: string) => {
    setStageStatuses((prev) => {
      const next = { ...prev };
      let found = false;
      for (const s of STAGE_DEFS) {
        if (found) {
          next[s.id] = 'pending';
        } else if (s.id === stageId) {
          next[s.id] = 'active';
          found = true;
        } else {
          next[s.id] = 'complete';
        }
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
    const MAX_RECONNECTS = 5;

    function connect() {
      if (unmounted) return;
      const es = new EventSource(`/api/audit/${auditId}/stream`);
      esRef.current = es;

      es.onmessage = (event: MessageEvent<string>) => {
        let payload: SSEPayload;
        try {
          payload = JSON.parse(event.data) as SSEPayload;
        } catch {
          return;
        }

        // Silently ignore keepalive pings and partial connecting events
        if (payload.type === 'ping' || payload.status === 'partial') return;

        // Degraded = temporary issue, keep stream alive — show a soft warning not a hard failure
        if (payload.status === 'degraded') {
          if (payload.error?.includes('timed out')) {
            // Only treat timeout as hard failure
            setFailed(true);
            setFailReason(payload.error);
            es.close();
          }
          // Other degraded events are transient — stay connected, keep UI running
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
          setTimeout(() => {
            router.push(`/audit/${encodeURIComponent(domain)}`);
          }, 800);
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
        reconnects += 1;
        if (reconnects < MAX_RECONNECTS) {
          setTimeout(connect, 3000);
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
  }, [auditId, domain, advanceToStage, markAllComplete, router]);

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
                  isActive   ? 'border-cyan/40 bg-cyan/5'        :
                  isComplete ? 'border-green-500/20 bg-green-500/5' :
                               'border-white/5 bg-white/[0.02]',
                ].join(' ')}
              >
                {/* Status icon */}
                <div className="mt-0.5 shrink-0">
                  {isComplete ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/20 text-xs text-green-400">✓</span>
                  ) : isActive ? (
                    <Spinner />
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/5 text-xs text-[#4A6280]">○</span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span>{stage.icon}</span>
                    <span className={[
                      'text-sm font-medium',
                      isComplete ? 'text-green-400' :
                      isActive   ? 'text-white' :
                      isPending  ? 'text-[#4A6280]' : 'text-[#4A6280]',
                    ].join(' ')}>
                      {stage.label}
                    </span>
                  </div>
                  {(isActive || isComplete) && sub && (
                    <p className="mt-0.5 text-xs text-[#4A6280] truncate">{sub}</p>
                  )}
                </div>

                {/* Stage-level timing badge */}
                {isActive && (
                  <span className="shrink-0 rounded-full bg-cyan/10 px-2 py-0.5 text-xs text-cyan">
                    Active
                  </span>
                )}
                {isComplete && (
                  <span className="shrink-0 rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
                    Done
                  </span>
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

        {/* Cancel / retry */}
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
