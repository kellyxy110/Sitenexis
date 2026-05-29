'use client';

import { useRouter } from 'next/navigation';
import { ArrowUpRight, RotateCcw, Trash2, Clock } from 'lucide-react';

export interface AuditFeedItem {
  id: string;
  domain: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  createdAt: string;
  scores?: {
    overall?: number | null;
    aiScore?: number | null;
    seoScore?: number | null;
  } | null;
}

interface AuditActivityFeedProps {
  audits: AuditFeedItem[];
  loading?: boolean;
  onRerun?: (domain: string) => void;
  onDelete?: (id: string) => void;
}

const STATUS_CONFIG = {
  queued:   { label: 'Queued',   dot: 'bg-[#3A5568]',       badge: 'text-[#4A6280] bg-white/5' },
  running:  { label: 'Running',  dot: 'bg-blue-400 animate-pulse', badge: 'text-blue-400 bg-blue-500/10' },
  complete: { label: 'Complete', dot: 'bg-teal-400',         badge: 'text-teal-400 bg-teal-500/10' },
  failed:   { label: 'Failed',   dot: 'bg-red-400',          badge: 'text-red-400 bg-red-500/10' },
} as const;

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ScorePill({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-xs text-[#3A5568]">—</span>;
  const color =
    value >= 90 ? 'text-green-400 bg-green-500/10' :
    value >= 70 ? 'text-teal-400 bg-teal-500/10' :
    value >= 50 ? 'text-amber-400 bg-amber-500/10' :
    'text-red-400 bg-red-500/10';
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${color}`}>
      {Math.round(value)}
    </span>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-white/[0.04]">
      <div className="h-4 w-32 animate-pulse rounded bg-white/5" />
      <div className="ml-auto h-4 w-16 animate-pulse rounded bg-white/5" />
    </div>
  );
}

export function AuditActivityFeed({ audits, loading, onRerun, onDelete }: AuditActivityFeedProps) {
  const router = useRouter();

  return (
    <div className="card-glass overflow-hidden rounded-xl">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <h3 className="text-sm font-semibold text-white">Recent Audits</h3>
        <span className="text-xs text-[#4A6280]">
          {!loading && `${audits.length} audit${audits.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {loading ? (
        <div>
          {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}
        </div>
      ) : audits.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.03]">
            <Clock className="h-5 w-5 text-[#4A6280]" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-medium text-[#C8DFE8]">No audits yet</p>
            <p className="mt-1 text-xs text-[#4A6280]">Run your first audit from the command bar above</p>
          </div>
        </div>
      ) : (
        <ul>
          {audits.map((audit) => {
            const cfg = STATUS_CONFIG[audit.status];
            return (
              <li
                key={audit.id}
                className="group flex items-center gap-4 border-b border-white/[0.04] px-5 py-3.5 transition-colors last:border-0 hover:bg-white/[0.02]"
              >
                {/* Domain + status */}
                <div className="flex flex-1 items-center gap-3 min-w-0">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
                  <span className="truncate text-sm font-medium text-white">{audit.domain}</span>
                </div>

                {/* Scores */}
                <div className="hidden items-center gap-3 sm:flex">
                  <div className="flex items-center gap-1 text-[#4A6280]">
                    <span className="text-[10px] font-medium uppercase tracking-wide">AI</span>
                    <ScorePill value={audit.scores?.aiScore} />
                  </div>
                  <div className="flex items-center gap-1 text-[#4A6280]">
                    <span className="text-[10px] font-medium uppercase tracking-wide">SEO</span>
                    <ScorePill value={audit.scores?.seoScore} />
                  </div>
                </div>

                {/* Status badge */}
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.badge}`}>
                  {cfg.label}
                </span>

                {/* Time */}
                <span className="hidden shrink-0 text-[11px] text-[#3A5568] sm:block">
                  {fmtRelative(audit.createdAt)}
                </span>

                {/* Actions (visible on hover) */}
                <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  {audit.status === 'complete' && (
                    <button
                      onClick={() => router.push(`/audit/${encodeURIComponent(audit.domain)}`)}
                      className="rounded p-1 text-[#4A6280] transition-colors hover:text-cyan"
                      title="View report"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {onRerun && (
                    <button
                      onClick={() => onRerun(audit.domain)}
                      className="rounded p-1 text-[#4A6280] transition-colors hover:text-white"
                      title="Re-run audit"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(audit.id)}
                      className="rounded p-1 text-[#4A6280] transition-colors hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
