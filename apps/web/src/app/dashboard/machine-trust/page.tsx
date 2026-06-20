'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useLatestAudit, useAuditSubReport, useMe } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { Shield, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface MachineTrustData {
  auditId: string;
  overall: number;
  entityCredibilityScore: number;
  schemaTrustAlignmentScore: number;
  externalValidationScore: number;
  contradictionAbsenceScore: number | null;
  trustDegradationResistance: number;
  crossSourceValidationIndex: number;
  trustIssues: Array<{ type: string; severity: string; entity: string; description: string; recommendation: string }>;
  degradationSignals: Array<{ signalType: string; entity: string; previousValue: string; currentValue: string; severityImpact: number }>;
}

function scoreColor(s: number) {
  if (s >= 90) return '#22C55E';
  if (s >= 70) return '#0BCEBC';
  if (s >= 50) return '#F59E0B';
  return '#EF4444';
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const color = scoreColor(score);
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={circ / 4} strokeLinecap="round" />
        <text x="44" y="44" textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="18" fontWeight="700">{score}</text>
      </svg>
      <span className="text-xs text-[#4A6280]">{label}</span>
    </div>
  );
}

function MetricBar({ label, value, desc }: { label: string; value: number; desc: string }) {
  const color = scoreColor(value);
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-white">{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.06] mb-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <p className="text-[10px] text-[#4A6280]">{desc}</p>
    </div>
  );
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'border-red-500/20 bg-red-500/[0.04] text-red-400',
  warning: 'border-amber-500/20 bg-amber-500/[0.04] text-amber-400',
  info: 'border-blue-500/20 bg-blue-500/[0.04] text-blue-400',
};

export default function MachineTrustPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { audit, isLoading: auditLoading } = useLatestAudit();
  const { data, isLoading } = useAuditSubReport<MachineTrustData>(audit?.id ?? null, 'machine-trust');

  const loading = auditLoading || isLoading;

  return (
    <DashboardLayout>
      <TopCommandBar
        onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)}
        userName={me?.email?.split('@')[0] ?? null}
        plan={me?.plan}
      />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">
        <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Shield className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">Machine Trust Score</h1>
            </div>
            <p className="text-sm text-[#4A6280]">
              {audit
                ? <>Trust analysis for <span className="text-[#7A9AB4]">{audit.domain}</span> — <a href={`/audit/${encodeURIComponent(audit.domain)}?auditId=${audit.id}`} className="text-cyan hover:underline inline-flex items-center gap-1">full report <ExternalLink className="h-3 w-3" /></a></>
                : 'How AI systems form, maintain, and lose trust in your content'}
            </p>
          </div>
          {data && <ScoreRing score={data.overall} label="Trust Score" />}
        </div>

        {loading && (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-white/[0.03]" />)}</div>
        )}

        {!loading && !data && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <Shield className="h-8 w-8 text-[#4A6280] mx-auto mb-3" />
            <p className="text-white font-semibold">No trust data available</p>
            <p className="mt-1 text-sm text-[#4A6280]">Run an audit to generate Machine Trust analysis.</p>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <MetricBar label="Entity Credibility" value={data.entityCredibilityScore} desc="Consistency of entity attributes across pages, schema, and metadata" />
              <MetricBar label="Schema Trust Alignment" value={data.schemaTrustAlignmentScore} desc="Schema claims verified against body text — no over-claiming" />
              <MetricBar label="External Validation" value={data.externalValidationScore} desc="sameAs links resolving, external sources confirming key claims" />
              <MetricBar label="Contradiction Absence" value={data.contradictionAbsenceScore ?? 0} desc="No conflicting entity attributes or factual claims across pages" />
              <MetricBar label="Degradation Resistance" value={data.trustDegradationResistance} desc="Trust signals maintained across audit history — no schema removals or broken links" />
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-white tabular-nums">{Math.round(data.crossSourceValidationIndex * 100)}%</span>
                <span className="mt-1 text-xs text-[#4A6280]">Cross-Source Validation Index</span>
                <p className="mt-2 text-[10px] text-[#4A6280] text-center">Ratio of entity claims externally validated</p>
              </div>
            </div>

            {data.trustIssues.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">Trust Issues ({data.trustIssues.length})</h2>
                <div className="space-y-2">
                  {data.trustIssues.map((issue, i) => (
                    <div key={i} className={`flex items-start gap-3 rounded-lg border p-3 text-xs ${SEVERITY_COLORS[issue.severity] ?? SEVERITY_COLORS.info}`}>
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{issue.description}</p>
                        {issue.entity && <p className="mt-0.5 text-[#4A6280]">Entity: {issue.entity}</p>}
                        <p className="mt-1 text-[#4A6280]">{issue.recommendation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.degradationSignals.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">Degradation Signals ({data.degradationSignals.length})</h2>
                <div className="space-y-2">
                  {data.degradationSignals.map((sig, i) => (
                    <div key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3 text-xs">
                      <div className="flex items-center gap-2 text-amber-400 font-semibold mb-1">
                        <AlertTriangle className="h-3 w-3" />
                        {sig.signalType.replace(/_/g, ' ')}
                        <span className="ml-auto text-[10px] tabular-nums">−{sig.severityImpact} pts</span>
                      </div>
                      <p className="text-[#4A6280]">Entity: {sig.entity}</p>
                      <p className="text-[#4A6280]">Changed from &ldquo;{sig.previousValue}&rdquo; to &ldquo;{sig.currentValue}&rdquo;</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.trustIssues.length === 0 && data.degradationSignals.length === 0 && (
              <div className="rounded-xl border border-green-500/20 bg-green-500/[0.04] p-5 flex items-center gap-3 text-sm text-green-400">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                No trust issues or degradation signals detected. Entity claims are consistent and externally validated.
              </div>
            )}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
