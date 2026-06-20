'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useLatestAudit, useAuditSubReport, useMe } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { Fingerprint, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface AuthenticityData {
  auditId: string;
  syntheticRiskScore: number;
  entityAuthenticityConfidence: number;
  networkIntegrityScore: number;
  detectedPatterns: Array<{ patternType: string; confidence: number; evidence: string[]; affectedEntities: string[]; severity: string }>;
  flaggedEntities: Array<{ entityName: string; flagReason: string; confidence: number }>;
  recommendations: string[];
}

function scoreColor(s: number) {
  if (s >= 80) return '#22C55E';
  if (s >= 60) return '#0BCEBC';
  if (s >= 40) return '#F59E0B';
  return '#EF4444';
}

function riskColor(s: number) {
  if (s <= 20) return '#22C55E';
  if (s <= 50) return '#F59E0B';
  return '#EF4444';
}

function riskLabel(s: number) {
  if (s <= 20) return 'Low Risk';
  if (s <= 50) return 'Medium Risk';
  if (s <= 80) return 'High Risk';
  return 'Critical Risk';
}

const PATTERN_LABELS: Record<string, string> = {
  fake_entity: 'Fake Entity Pattern',
  authority_network: 'AI Authority Network',
  schema_manipulation: 'Schema Manipulation',
  citation_farming: 'Citation Farming',
  unnatural_clustering: 'Unnatural Clustering',
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'border-red-500/20 bg-red-500/[0.04] text-red-400',
  warning: 'border-amber-500/20 bg-amber-500/[0.04] text-amber-400',
  info: 'border-blue-500/20 bg-blue-500/[0.04] text-blue-400',
};

export default function AuthenticityPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { audit, isLoading: auditLoading } = useLatestAudit();
  const { data, isLoading } = useAuditSubReport<AuthenticityData>(audit?.id ?? null, 'authenticity');

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
              <Fingerprint className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">Entity Authenticity</h1>
            </div>
            <p className="text-sm text-[#4A6280]">
              {audit
                ? <>Authenticity analysis for <span className="text-[#7A9AB4]">{audit.domain}</span> — <a href={`/audit/${encodeURIComponent(audit.domain)}?auditId=${audit.id}`} className="text-cyan hover:underline inline-flex items-center gap-1">full report <ExternalLink className="h-3 w-3" /></a></>
                : 'Detect synthetic entity signals and protect trust integrity'}
            </p>
          </div>
        </div>

        <p className="mb-6 text-[11px] text-[#4A6280] italic">Detection is pattern-based and probabilistic. Findings are shown with confidence scores, not definitive classifications.</p>

        {loading && (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-white/[0.03]" />)}</div>
        )}

        {!loading && !data && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <Fingerprint className="h-8 w-8 text-[#4A6280] mx-auto mb-3" />
            <p className="text-white font-semibold">No authenticity data available</p>
            <p className="mt-1 text-sm text-[#4A6280]">Run an audit to generate synthetic entity detection analysis.</p>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-center">
                <span className="text-3xl font-bold tabular-nums" style={{ color: scoreColor(data.entityAuthenticityConfidence) }}>
                  {data.entityAuthenticityConfidence}
                </span>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#4A6280]">Authenticity Confidence</div>
                <p className="mt-1 text-[10px] text-[#4A6280]">Higher = more organic</p>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-center">
                <span className="text-3xl font-bold tabular-nums" style={{ color: riskColor(data.syntheticRiskScore) }}>
                  {data.syntheticRiskScore}
                </span>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#4A6280]">Synthetic Risk</div>
                <p className="mt-1 text-[10px]" style={{ color: riskColor(data.syntheticRiskScore) }}>{riskLabel(data.syntheticRiskScore)}</p>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-center">
                <span className="text-3xl font-bold tabular-nums" style={{ color: scoreColor(data.networkIntegrityScore) }}>
                  {data.networkIntegrityScore}
                </span>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#4A6280]">Network Integrity</div>
                <p className="mt-1 text-[10px] text-[#4A6280]">Entity graph organicity</p>
              </div>
            </div>

            {data.detectedPatterns.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">Detected Patterns ({data.detectedPatterns.length})</h2>
                <div className="space-y-2">
                  {data.detectedPatterns.map((pattern, i) => (
                    <div key={i} className={`rounded-lg border p-4 text-xs ${SEVERITY_STYLES[pattern.severity] ?? SEVERITY_STYLES.info}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span className="font-semibold">{PATTERN_LABELS[pattern.patternType] ?? pattern.patternType}</span>
                        </div>
                        <span className="text-[10px] tabular-nums">{Math.round(pattern.confidence * 100)}% confidence</span>
                      </div>
                      {pattern.evidence.length > 0 && (
                        <ul className="mb-2 space-y-0.5 text-[#4A6280]">
                          {pattern.evidence.slice(0, 3).map((e, j) => <li key={j}>• {e}</li>)}
                        </ul>
                      )}
                      {pattern.affectedEntities.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {pattern.affectedEntities.map((ent, j) => (
                            <span key={j} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-[#4A6280]">{ent}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.flaggedEntities.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">Flagged Entities ({data.flaggedEntities.length})</h2>
                <div className="space-y-2">
                  {data.flaggedEntities.map((ent, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs">
                      <span className="font-semibold text-white">{ent.entityName}</span>
                      <span className="flex-1 text-[#4A6280] truncate">{ent.flagReason}</span>
                      <span className="shrink-0 tabular-nums" style={{ color: riskColor(ent.confidence * 100) }}>
                        {Math.round(ent.confidence * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.recommendations.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">Recommendations</h2>
                <ul className="space-y-2">
                  {data.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-lg border border-cyan/10 bg-cyan/[0.03] p-3 text-xs text-[#C8DFE8]">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.detectedPatterns.length === 0 && data.flaggedEntities.length === 0 && (
              <div className="rounded-xl border border-green-500/20 bg-green-500/[0.04] p-5 flex items-center gap-3 text-sm text-green-400">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                No synthetic patterns detected. Entity signals appear organic and consistent.
              </div>
            )}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
