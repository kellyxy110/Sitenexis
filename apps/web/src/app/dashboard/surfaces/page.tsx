'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useLatestAudit, useAuditSubReport, useMe } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { Radio, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface SurfaceEntry {
  inclusionProbability: number;
  status: string;
  blockers: Array<{ type: string; description: string; recommendation: string }>;
  recommendations: string[];
}

interface SurfacesData {
  auditId: string;
  overallSurfaceScore: number;
  surfaces: {
    aiOverviews: SurfaceEntry;
    chatRecommendation: SurfaceEntry;
    voiceRetrieval: SurfaceEntry;
    agentDiscovery: SurfaceEntry;
  };
  coverageGaps: Array<{ surface: string; missedOpportunity: string; requiredSignals: string[]; estimatedImpact: string }>;
  missingVisibilityChannels: string[];
}

function scoreColor(s: number) {
  if (s >= 70) return '#22C55E';
  if (s >= 40) return '#F59E0B';
  return '#EF4444';
}

const STATUS_BADGE: Record<string, string> = {
  visible: 'text-green-400 bg-green-500/10 border-green-500/20',
  partial: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  absent: 'text-red-400 bg-red-500/10 border-red-500/20',
};

const IMPACT_COLORS: Record<string, string> = {
  high: 'text-red-400',
  medium: 'text-amber-400',
  low: 'text-[#4A6280]',
};

const SURFACE_META: Record<string, { label: string; desc: string; icon: string }> = {
  aiOverviews: { label: 'AI Overviews', desc: 'Search-integrated AI answers (Google AI Overviews)', icon: '🔍' },
  chatRecommendation: { label: 'Chat Recommendation', desc: 'LLM assistants (ChatGPT, Claude, Gemini)', icon: '💬' },
  voiceRetrieval: { label: 'Voice Retrieval', desc: 'Voice assistants (Siri, Alexa, Google Assistant)', icon: '🎙️' },
  agentDiscovery: { label: 'Agent Discovery', desc: 'Autonomous agents and programmatic consumers', icon: '🤖' },
};

function SurfaceCard({ id, surface }: { id: string; surface: SurfaceEntry }) {
  const meta = SURFACE_META[id] ?? { label: id, desc: '', icon: '📡' };
  const color = scoreColor(surface.inclusionProbability);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span>{meta.icon}</span>
            <h3 className="text-sm font-semibold text-white">{meta.label}</h3>
          </div>
          <p className="mt-0.5 text-[10px] text-[#4A6280]">{meta.desc}</p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_BADGE[surface.status] ?? STATUS_BADGE.absent}`}>
          {surface.status}
        </span>
      </div>

      <div className="flex items-end gap-3 mb-4">
        <span className="text-3xl font-bold tabular-nums" style={{ color }}>{surface.inclusionProbability}</span>
        <span className="text-xs text-[#4A6280] mb-1">/ 100 estimated inclusion</span>
      </div>

      <div className="h-2 rounded-full bg-white/[0.06] mb-4">
        <div className="h-2 rounded-full transition-all" style={{ width: `${surface.inclusionProbability}%`, backgroundColor: color }} />
      </div>

      {surface.blockers.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#4A6280]">Blockers</span>
          {surface.blockers.slice(0, 3).map((b, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-400">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{b.description}</span>
            </div>
          ))}
        </div>
      )}

      {surface.recommendations.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#4A6280]">Recommendations</span>
          {surface.recommendations.slice(0, 2).map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-cyan">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{r}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SurfacesPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { audit, isLoading: auditLoading } = useLatestAudit();
  const { data, isLoading } = useAuditSubReport<SurfacesData>(audit?.id ?? null, 'surfaces');

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
              <Radio className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">Recommendation Surfaces</h1>
            </div>
            <p className="text-sm text-[#4A6280]">
              {audit
                ? <>Surface coverage for <span className="text-[#7A9AB4]">{audit.domain}</span> — <a href={`/audit/${encodeURIComponent(audit.domain)}?auditId=${audit.id}`} className="text-cyan hover:underline inline-flex items-center gap-1">full report <ExternalLink className="h-3 w-3" /></a></>
                : 'Where your content appears across the AI recommendation ecosystem'}
            </p>
          </div>
          {data && (
            <div className="text-right">
              <span className="text-3xl font-bold tabular-nums" style={{ color: scoreColor(data.overallSurfaceScore) }}>{data.overallSurfaceScore}</span>
              <div className="text-[10px] text-[#4A6280]">Overall Surface Score</div>
            </div>
          )}
        </div>

        <p className="mb-6 text-[11px] text-[#4A6280] italic">All surface scores are probabilistic estimates based on measurable content signals — not live API queries to AI systems.</p>

        {loading && (
          <div className="grid gap-4 sm:grid-cols-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-48 animate-pulse rounded-xl bg-white/[0.03]" />)}</div>
        )}

        {!loading && !data && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <Radio className="h-8 w-8 text-[#4A6280] mx-auto mb-3" />
            <p className="text-white font-semibold">No surface data available</p>
            <p className="mt-1 text-sm text-[#4A6280]">Run an audit to generate recommendation surface analysis.</p>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <SurfaceCard id="aiOverviews" surface={data.surfaces.aiOverviews} />
              <SurfaceCard id="chatRecommendation" surface={data.surfaces.chatRecommendation} />
              <SurfaceCard id="voiceRetrieval" surface={data.surfaces.voiceRetrieval} />
              <SurfaceCard id="agentDiscovery" surface={data.surfaces.agentDiscovery} />
            </div>

            {data.coverageGaps.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">Coverage Gaps ({data.coverageGaps.length})</h2>
                <div className="space-y-2">
                  {data.coverageGaps.map((gap, i) => (
                    <div key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white">{gap.surface}</span>
                        <span className={`ml-auto text-[10px] font-semibold uppercase ${IMPACT_COLORS[gap.estimatedImpact] ?? ''}`}>{gap.estimatedImpact} impact</span>
                      </div>
                      <p className="text-[#4A6280] mb-2">{gap.missedOpportunity}</p>
                      <div className="flex flex-wrap gap-1">
                        {gap.requiredSignals.map((sig, j) => (
                          <span key={j} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-[#4A6280]">{sig}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.missingVisibilityChannels.length > 0 && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-5">
                <h2 className="mb-2 text-sm font-semibold text-red-400">Missing Visibility Channels</h2>
                <ul className="space-y-1">
                  {data.missingVisibilityChannels.map((ch, i) => (
                    <li key={i} className="text-xs text-[#4A6280]">• {ch}</li>
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
