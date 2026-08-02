'use client';

interface AuditMetricsProps {
  pagesDiscovered: number | null;
  pagesAnalysed: number | null;
  elapsedLabel: string;
  estimatedRemainingLabel: string;
}

function Tile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-white/[0.06] bg-white/[0.02] py-4 backdrop-blur-sm">
      <span className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</span>
      <span className="mt-1 text-center text-[10px] font-medium uppercase tracking-widest text-slate-600">{label}</span>
    </div>
  );
}

/**
 * Live metric tiles. Values genuinely unknown at this point in the pipeline
 * render as "—", never a fabricated placeholder number — see the limitations
 * documented in computeAuditProgress (pagesAnalysed is only known once the
 * audit's analysis phase is complete; the pipeline doesn't expose incremental
 * per-page analysis progress today).
 */
export function AuditMetrics({ pagesDiscovered, pagesAnalysed, elapsedLabel, estimatedRemainingLabel }: AuditMetricsProps) {
  return (
    <div className="relative z-10 mt-8 grid w-full max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile label="Pages Discovered" value={pagesDiscovered != null ? String(pagesDiscovered) : '—'} color="#00C8FF" />
      <Tile label="Pages Analysed" value={pagesAnalysed != null ? String(pagesAnalysed) : '—'} color="#0BCEBC" />
      <Tile label="Elapsed" value={elapsedLabel} color="#8B5CF6" />
      <Tile label="Estimated Remaining" value={estimatedRemainingLabel || '—'} color="#F59E0B" />
    </div>
  );
}
