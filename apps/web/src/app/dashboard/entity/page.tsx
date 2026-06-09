'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useLatestAudit, useAuditSubReport, useMe } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { Network, ExternalLink, CheckCircle2, AlertCircle, Link2 } from 'lucide-react';

interface Entity {
  id: string;
  name: string;
  type: string;
  description: string | null;
  sameAsUrls: string[];
  mentionCount: number;
  consistencyScore: number;
  disambiguationScore: number;
}

interface EntityData {
  auditId: string;
  entityConfidenceScore: number | null;
  entityConsistencyScore: number | null;
  entityCoverageScore: number | null;
  disambiguationScore: number | null;
  entities: Entity[];
  primaryEntity: { id: string; name: string; type: string } | null;
  inconsistencies: string[];
  missingAttributes: string[];
  recommendations: string[];
}

function scoreColor(s: number) {
  if (s >= 90) return '#22C55E';
  if (s >= 70) return '#0BCEBC';
  if (s >= 50) return '#F59E0B';
  return '#EF4444';
}
function scoreLabel(s: number) {
  if (s >= 90) return 'Excellent';
  if (s >= 70) return 'Good';
  if (s >= 50) return 'Needs Work';
  return 'Critical';
}
function pct(n: number) { return Math.round(n * 100); }

const ENTITY_TYPE_COLORS: Record<string, string> = {
  Organization: '#0BCEBC',
  Person: '#00C8FF',
  Product: '#F59E0B',
  SoftwareApplication: '#8B5CF6',
  LocalBusiness: '#22C55E',
  Service: '#EC4899',
};

export default function EntityPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { audit, isLoading: auditLoading } = useLatestAudit();
  const { data, isLoading } = useAuditSubReport<EntityData>(audit?.id ?? null, 'entities');

  const loading = auditLoading || isLoading;

  const summaryScores = data ? [
    { label: 'Entity Confidence', score: data.entityConfidenceScore },
    { label: 'Consistency', score: data.entityConsistencyScore },
    { label: 'Coverage', score: data.entityCoverageScore },
    { label: 'Disambiguation', score: data.disambiguationScore },
  ] : [];

  return (
    <DashboardLayout>
      <TopCommandBar
        onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)}
        userName={me?.email?.split('@')[0] ?? null}
        plan={me?.plan}
      />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Network className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">Entity Intelligence</h1>
            </div>
            <p className="text-sm text-[#4A6280]">
              {audit
                ? <>For <span className="text-[#7A9AB4]">{audit.domain}</span> — <a href={`/audit/${encodeURIComponent(audit.domain)}?auditId=${audit.id}`} className="text-cyan hover:underline inline-flex items-center gap-1">full report <ExternalLink className="h-3 w-3" /></a></>
                : 'Named entities detected, scored for consistency, disambiguation, and AI Perception Graph position'}
            </p>
          </div>
          {data?.entityConfidenceScore != null && (
            <div className="text-right">
              <div className="text-4xl font-bold tabular-nums" style={{ color: scoreColor(data.entityConfidenceScore) }}>{data.entityConfidenceScore}</div>
              <div className="text-xs text-[#4A6280]">Entity Confidence</div>
              <div className="mt-0.5 text-xs font-semibold" style={{ color: scoreColor(data.entityConfidenceScore) }}>{scoreLabel(data.entityConfidenceScore)}</div>
            </div>
          )}
        </div>

        {!audit && !auditLoading && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <p className="text-white font-semibold">No completed audits yet</p>
            <p className="mt-1 text-sm text-[#4A6280]">Run an audit to see entity intelligence analysis.</p>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[1,2,3,4].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-white/[0.03]" />)}
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Summary scores */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {summaryScores.map(({ label, score }) => (
                score != null ? (
                  <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs text-[#4A6280]">{label}</span>
                      <span className="text-lg font-bold tabular-nums" style={{ color: scoreColor(score) }}>{Math.round(score)}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: scoreColor(score) }} />
                    </div>
                  </div>
                ) : null
              ))}
            </div>

            {/* Primary entity */}
            {data.primaryEntity && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">Primary Entity</h2>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg border border-white/[0.08] bg-white/[0.04] flex items-center justify-center">
                    <Network className="h-5 w-5" style={{ color: ENTITY_TYPE_COLORS[data.primaryEntity.type] ?? '#00C8FF' }} />
                  </div>
                  <div>
                    <div className="font-semibold text-white">{data.primaryEntity.name}</div>
                    <div className="text-xs text-[#4A6280]">{data.primaryEntity.type}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Entity table */}
            {data.entities.length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Detected Entities ({data.entities.length})</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="pb-2 text-left text-[#4A6280] font-medium">Entity</th>
                        <th className="pb-2 text-left text-[#4A6280] font-medium">Type</th>
                        <th className="pb-2 text-right text-[#4A6280] font-medium">Mentions</th>
                        <th className="pb-2 text-right text-[#4A6280] font-medium">Consistency</th>
                        <th className="pb-2 text-right text-[#4A6280] font-medium">Disambig.</th>
                        <th className="pb-2 text-right text-[#4A6280] font-medium">sameAs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {data.entities.map((e) => (
                        <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-2.5 pr-4">
                            <div className="font-medium text-white">{e.name}</div>
                            {e.description && <div className="mt-0.5 text-[#4A6280] truncate max-w-[200px]">{e.description}</div>}
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: ENTITY_TYPE_COLORS[e.type] ?? '#00C8FF', backgroundColor: `${ENTITY_TYPE_COLORS[e.type] ?? '#00C8FF'}15` }}>
                              {e.type}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-right text-[#7A9AB4]">{e.mentionCount}</td>
                          <td className="py-2.5 pr-4 text-right" style={{ color: scoreColor(pct(e.consistencyScore)) }}>{pct(e.consistencyScore)}%</td>
                          <td className="py-2.5 pr-4 text-right" style={{ color: scoreColor(pct(e.disambiguationScore)) }}>{pct(e.disambiguationScore)}%</td>
                          <td className="py-2.5 text-right">
                            {e.sameAsUrls.length > 0
                              ? <span className="flex items-center justify-end gap-1 text-teal"><Link2 className="h-3 w-3" />{e.sameAsUrls.length}</span>
                              : <span className="text-[#4A6280]">—</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Missing attributes */}
            {data.missingAttributes && data.missingAttributes.length > 0 && (
              <div className="rounded-xl border border-amber/20 bg-amber/[0.04] p-5">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber">
                  <AlertCircle className="h-4 w-4" /> Missing Attributes
                </h2>
                <div className="flex flex-wrap gap-2">
                  {data.missingAttributes.map((attr) => (
                    <span key={attr} className="rounded-md border border-amber/20 bg-amber/10 px-2 py-0.5 text-xs text-amber">{attr}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {data.recommendations && data.recommendations.length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">Recommendations</h2>
                <ul className="space-y-2">
                  {data.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#4A6280]">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
