'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useLatestAudit, useAuditSubReport, useMe } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { GitFork, ExternalLink } from 'lucide-react';

interface GraphNode {
  id: string;
  type: 'entity' | 'topic' | 'claim' | 'page';
  label: string;
  confidence: number;
  citationReadiness: number;
  disambiguationStrength: number;
  supportingPages: string[];
}

interface GraphEdge {
  source: string;
  target: string;
  relationshipType: string;
  strength: number;
  evidencedBy: string[];
}

interface GraphData {
  auditId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function scoreColor(s: number) {
  if (s >= 0.9) return '#22C55E';
  if (s >= 0.7) return '#0BCEBC';
  if (s >= 0.5) return '#F59E0B';
  return '#EF4444';
}

const NODE_TYPE_COLORS: Record<string, string> = {
  entity: '#00C8FF',
  topic:  '#0BCEBC',
  claim:  '#F59E0B',
  page:   '#8B5CF6',
};

const REL_LABELS: Record<string, string> = {
  isA:       'is a',
  partOf:    'part of',
  relatedTo: 'related to',
  contradicts: 'contradicts',
  supports:  'supports',
  authorOf:  'author of',
  locatedIn: 'located in',
  offers:    'offers',
};

export default function PerceptionGraphPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { audit, isLoading: auditLoading } = useLatestAudit();
  const { data, isLoading } = useAuditSubReport<GraphData>(audit?.id ?? null, 'perception-graph');

  const loading = auditLoading || isLoading;

  const nodes = data?.nodes ?? [];
  const edges = data?.edges ?? [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  return (
    <DashboardLayout>
      <TopCommandBar
        onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)}
        userName={me?.email?.split('@')[0] ?? null}
        plan={me?.plan}
      />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">

        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <GitFork className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">AI Perception Graph</h1>
            </div>
            <p className="text-sm text-[#4A6280]">
              {audit
                ? <>For <span className="text-[#7A9AB4]">{audit.domain}</span> — <a href={`/audit/${encodeURIComponent(audit.domain)}?auditId=${audit.id}`} className="text-cyan hover:underline inline-flex items-center gap-1">interactive graph <ExternalLink className="h-3 w-3" /></a></>
                : 'How AI systems model your content — entities, topics, claims, and semantic relationships'}
            </p>
          </div>
          {data && (
            <div className="text-right">
              <div className="text-4xl font-bold tabular-nums text-white">{nodes.length}</div>
              <div className="text-xs text-[#4A6280]">Nodes</div>
            </div>
          )}
        </div>

        {!audit && !auditLoading && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <p className="text-white font-semibold">No completed audits yet</p>
            <p className="mt-1 text-sm text-[#4A6280]">Run an audit to generate the AI Perception Graph.</p>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[1,2,3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-white/[0.03]" />)}
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Summary stats */}
            <div className="grid gap-3 sm:grid-cols-4">
              {(['entity','topic','claim','page'] as const).map((type) => {
                const count = nodes.filter((n) => n.type === type).length;
                return (
                  <div key={type} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                    <div className="text-2xl font-bold tabular-nums" style={{ color: NODE_TYPE_COLORS[type] }}>{count}</div>
                    <div className="mt-0.5 text-xs capitalize text-[#4A6280]">{type}{count !== 1 ? 's' : ''}</div>
                  </div>
                );
              })}
            </div>

            {/* Full-report note */}
            {audit && (
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <GitFork className="h-5 w-5 shrink-0 text-cyan" />
                <div>
                  <p className="text-sm font-semibold text-white">Interactive Force Graph</p>
                  <p className="text-xs text-[#4A6280]">The full interactive force-directed perception graph is available on the audit results page.</p>
                </div>
                <a
                  href={`/audit/${encodeURIComponent(audit.domain)}?auditId=${audit.id}`}
                  className="ml-auto shrink-0 rounded-lg border border-cyan/20 bg-cyan/10 px-3 py-1.5 text-xs font-semibold text-cyan hover:bg-cyan/20 transition-colors flex items-center gap-1"
                >
                  Open Graph <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {/* Nodes table */}
            {nodes.length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Graph Nodes ({nodes.length})</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="pb-2 text-left text-[#4A6280] font-medium">Node</th>
                        <th className="pb-2 text-left text-[#4A6280] font-medium">Type</th>
                        <th className="pb-2 text-right text-[#4A6280] font-medium">Confidence</th>
                        <th className="pb-2 text-right text-[#4A6280] font-medium hidden sm:table-cell">Citation Ready</th>
                        <th className="pb-2 text-right text-[#4A6280] font-medium hidden md:table-cell">Pages</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {[...nodes].sort((a, b) => b.confidence - a.confidence).map((node) => (
                        <tr key={node.id} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 pr-4 font-medium text-white">{node.label}</td>
                          <td className="py-2.5 pr-4">
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize"
                              style={{ color: NODE_TYPE_COLORS[node.type], backgroundColor: `${NODE_TYPE_COLORS[node.type]}18` }}>
                              {node.type}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-right" style={{ color: scoreColor(node.confidence) }}>
                            {Math.round(node.confidence * 100)}%
                          </td>
                          <td className="py-2.5 pr-4 text-right hidden sm:table-cell" style={{ color: scoreColor(node.citationReadiness) }}>
                            {Math.round(node.citationReadiness * 100)}%
                          </td>
                          <td className="py-2.5 text-right hidden md:table-cell text-[#4A6280]">
                            {(node.supportingPages ?? []).length}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Edges */}
            {edges.length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Semantic Relationships ({edges.length})</h2>
                <div className="space-y-2">
                  {[...edges].sort((a, b) => b.strength - a.strength).map((edge, i) => {
                    const src = nodeById.get(edge.source);
                    const tgt = nodeById.get(edge.target);
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-white truncate max-w-[140px]">{src?.label ?? edge.source}</span>
                        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] bg-white/[0.04] text-[#4A6280]">{REL_LABELS[edge.relationshipType] ?? edge.relationshipType}</span>
                        <span className="font-medium text-white truncate max-w-[140px]">{tgt?.label ?? edge.target}</span>
                        <span className="ml-auto shrink-0 tabular-nums" style={{ color: scoreColor(edge.strength) }}>
                          {Math.round(edge.strength * 100)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
