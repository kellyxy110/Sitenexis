'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useLatestAudit, useAuditSubReport, useMe } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ListChecks,
  ExternalLink,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Clock,
  Zap,
  Shield,
  Eye,
  Search,
  Link2,
  Filter,
} from 'lucide-react';
import type {
  FixPlan,
  FixPlanItem,
  FixPriority,
  FixPlanDependencyChain,
  FixPlanModuleBreakdown,
} from '@sitenexis/shared';

// ── Colors ──────────────────────────────────────────────────────────────────

function priorityColor(p: FixPriority): string {
  if (p === 'P0') return '#EF4444';
  if (p === 'P1') return '#F59E0B';
  return '#4A6280';
}

function severityColor(s: string): string {
  if (s === 'critical') return '#EF4444';
  if (s === 'warning') return '#F59E0B';
  return '#60A5FA';
}

function impactColor(i: string): string {
  if (i === 'high') return '#EF4444';
  if (i === 'medium') return '#F59E0B';
  return '#0BCEBC';
}

function effortColor(e: string): string {
  if (e === 'high') return '#EF4444';
  if (e === 'medium') return '#F59E0B';
  return '#0BCEBC';
}

function scoreColor(score: number): string {
  if (score >= 70) return '#0BCEBC';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

function moduleIcon(module: string) {
  if (module === 'seo') return <Search className="h-3 w-3" />;
  if (module === 'schema') return <Link2 className="h-3 w-3" />;
  if (module.includes('trust')) return <Shield className="h-3 w-3" />;
  if (module.includes('ai') || module.includes('visibility') || module.includes('retrieval') || module.includes('recommendation')) return <Eye className="h-3 w-3" />;
  return <Zap className="h-3 w-3" />;
}

function moduleLabel(module: string): string {
  const labels: Record<string, string> = {
    seo: 'SEO',
    schema: 'Schema',
    'machine-readability': 'Machine Readability',
    entity: 'Entity',
    citation: 'Citation',
    'semantic-trust': 'Semantic Trust',
    'ai-visibility': 'AI Visibility',
    content: 'Content',
    performance: 'Performance',
    'link-graph': 'Link Graph',
    'machine-trust': 'Machine Trust',
    'retrieval-simulation': 'Retrieval',
    'temporal-authority': 'Temporal',
    'recommendation-surface': 'Surfaces',
    'synthetic-entity': 'Authenticity',
  };
  return labels[module] ?? module;
}

// ── GTL Badge ───────────────────────────────────────────────────────────────

function GTLStateBadge({ state }: { state: string }) {
  const colors: Record<string, string> = { complete: '#0BCEBC', partial: '#F59E0B', empty: '#EF4444' };
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ color: colors[state] ?? '#4A6280', backgroundColor: `${colors[state] ?? '#4A6280'}20`, border: `1px solid ${colors[state] ?? '#4A6280'}40` }}
    >
      {state}
    </span>
  );
}

// ── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, label }: { score: number; label: string }) {
  const color = scoreColor(score);
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const dash = (score / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={circumference / 4} strokeLinecap="round" />
        <text x="44" y="44" textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="18" fontWeight="700">{score}</text>
      </svg>
      <span className="text-xs text-[#4A6280]">{label}</span>
    </div>
  );
}

// ── Fix Item Row ────────────────────────────────────────────────────────────

function FixItemRow({ item }: { item: FixPlanItem }) {
  const [expanded, setExpanded] = useState(false);
  const pColor = priorityColor(item.priority);
  return (
    <div className="border-b border-white/[0.04] last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 py-3 text-left hover:bg-white/[0.02] transition-colors px-3 -mx-3 rounded"
      >
        <span
          className="mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide shrink-0"
          style={{ color: pColor, backgroundColor: `${pColor}20`, border: `1px solid ${pColor}40` }}
        >
          {item.priority}
        </span>
        <span className="mt-0.5 text-[#4A6280] shrink-0">{moduleIcon(item.module)}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white leading-relaxed">{item.message}</p>
          {item.pageUrl && <p className="text-[10px] text-[#4A6280] truncate mt-0.5">{item.pageUrl}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded px-1 py-0.5 text-[9px] font-semibold uppercase" style={{ color: severityColor(item.severity), backgroundColor: `${severityColor(item.severity)}15` }}>
            {item.severity}
          </span>
          <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: impactColor(item.expectedImpact), backgroundColor: `${impactColor(item.expectedImpact)}15` }}>
            {item.expectedImpact} impact
          </span>
          <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ color: effortColor(item.effort), backgroundColor: `${effortColor(item.effort)}15` }}>
            {item.effort} effort
          </span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-[#4A6280]" /> : <ChevronDown className="h-3.5 w-3.5 text-[#4A6280]" />}
        </div>
      </button>
      {expanded && (
        <div className="mb-3 ml-8 rounded-lg border border-white/[0.04] bg-white/[0.02] p-4 text-xs space-y-3">
          <div>
            <span className="font-semibold text-[#7A9AB4]">Module: </span>
            <span className="text-[#C8DFE8]">{moduleLabel(item.module)}</span>
            <span className="ml-3 font-semibold text-[#7A9AB4]">Type: </span>
            <span className="text-[#C8DFE8]">{item.type.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="font-semibold text-[#7A9AB4]">Recommendation: </span>
            <span className="text-[#C8DFE8]">{item.recommendation}</span>
          </div>
          {item.problem && (
            <div>
              <span className="font-semibold text-[#7A9AB4]">Problem: </span>
              <span className="text-[#C8DFE8]">{item.problem}</span>
            </div>
          )}
          {item.solution && (
            <div>
              <span className="font-semibold text-[#7A9AB4]">Solution: </span>
              <span className="text-[#C8DFE8]">{item.solution}</span>
            </div>
          )}
          {item.fixCode && (
            <div>
              <span className="font-semibold text-[#7A9AB4]">Fix Code:</span>
              <pre className="mt-1 rounded-lg bg-[#0A1628] border border-white/[0.06] p-3 text-[10px] text-teal-300 overflow-x-auto whitespace-pre-wrap">
                {item.fixCode}
              </pre>
            </div>
          )}
          <div className="flex gap-4 pt-1">
            <div className="text-center">
              <div className="text-sm font-bold" style={{ color: '#60A5FA' }}>{item.impactScores.seoImpact}</div>
              <div className="text-[9px] text-[#4A6280]">SEO</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold" style={{ color: '#0BCEBC' }}>{item.impactScores.aiVisibilityImpact}</div>
              <div className="text-[9px] text-[#4A6280]">AI Visibility</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold" style={{ color: '#A78BFA' }}>{item.impactScores.trustImpact}</div>
              <div className="text-[9px] text-[#4A6280]">Trust</div>
            </div>
          </div>
          {item.dependsOn.length > 0 && (
            <div className="flex items-center gap-1 text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              <span className="text-[10px]">Depends on {item.dependsOn.length} other fix{item.dependsOn.length > 1 ? 'es' : ''} — resolve those first</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Module Breakdown Row ────────────────────────────────────────────────────

function ModuleRow({ m, total }: { m: FixPlanModuleBreakdown; total: number }) {
  const pct = total > 0 ? Math.round((m.count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
      <span className="text-[#4A6280]">{moduleIcon(m.module)}</span>
      <span className="w-32 text-xs text-white">{moduleLabel(m.module)}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full bg-cyan" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-[10px] text-[#4A6280] tabular-nums">{m.count}</span>
      <div className="flex gap-1">
        {m.p0 > 0 && <span className="rounded px-1 text-[9px] font-bold" style={{ color: '#EF4444', backgroundColor: '#EF444415' }}>P0:{m.p0}</span>}
        {m.p1 > 0 && <span className="rounded px-1 text-[9px] font-bold" style={{ color: '#F59E0B', backgroundColor: '#F59E0B15' }}>P1:{m.p1}</span>}
        {m.p2 > 0 && <span className="rounded px-1 text-[9px] font-bold" style={{ color: '#4A6280', backgroundColor: '#4A628015' }}>P2:{m.p2}</span>}
      </div>
    </div>
  );
}

// ── Dependency Chain Card ───────────────────────────────────────────────────

function ChainCard({ chain }: { chain: FixPlanDependencyChain }) {
  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.03] p-4">
      <h3 className="mb-1 text-xs font-semibold text-amber-400">{chain.name}</h3>
      <p className="mb-3 text-[10px] text-[#4A6280]">{chain.description}</p>
      <ol className="space-y-1.5">
        {chain.steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2 text-[10px] text-[#C8DFE8]">
            <span className="shrink-0 rounded-full h-4 w-4 flex items-center justify-center text-[8px] font-bold bg-amber-500/20 text-amber-400 mt-0.5">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

type FilterPriority = 'all' | 'P0' | 'P1' | 'P2';
type ActiveTab = 'fixes' | 'modules' | 'dependencies';

export default function FixPlanPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { audit, isLoading: auditLoading } = useLatestAudit();
  const { data, gtlState, isLoading } = useAuditSubReport<FixPlan>(
    audit?.id ?? null,
    'fix-plan'
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>('fixes');
  const [filterPriority, setFilterPriority] = useState<FilterPriority>('all');

  const loading = auditLoading || isLoading;

  const filteredItems = data
    ? filterPriority === 'all'
      ? data.items
      : data.items.filter((i) => i.priority === filterPriority)
    : [];

  return (
    <DashboardLayout>
      <TopCommandBar
        onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)}
        userName={me?.email?.split('@')[0] ?? null}
        plan={me?.plan}
      />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 flex-wrap">
              <ListChecks className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">Global Fix Plan</h1>
              {gtlState && <GTLStateBadge state={gtlState} />}
            </div>
            <p className="text-sm text-[#4A6280]">
              {audit
                ? <>Unified optimization roadmap for <span className="text-[#7A9AB4]">{audit.domain}</span> — <a href={`/audit/${encodeURIComponent(audit.domain)}?auditId=${audit.id}`} className="text-cyan hover:underline inline-flex items-center gap-1">full report <ExternalLink className="h-3 w-3" /></a></>
                : 'Prioritized action queue across all intelligence modules'}
            </p>
          </div>
          {data && <ScoreRing score={data.overallFixScore} label="Health" />}
        </div>

        {/* No audit */}
        {!audit && !auditLoading && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <ListChecks className="h-8 w-8 text-[#4A6280] mx-auto mb-3" />
            <p className="text-white font-semibold">No completed audits yet</p>
            <p className="mt-1 text-sm text-[#4A6280]">Run an audit to generate your fix plan.</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-white/[0.03]" />)}
          </div>
        )}

        {/* Empty */}
        {!loading && audit && !data && gtlState === 'empty' && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <Info className="h-8 w-8 text-[#4A6280] mx-auto mb-3" />
            <p className="text-white font-semibold">No fix plan data</p>
            <p className="mt-1 text-sm text-[#4A6280]">The audit may still be processing. Check back soon.</p>
          </div>
        )}

        {/* Main content */}
        {data && (
          <div className="space-y-5">

            {/* Hero stats */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard label="Total Issues" value={String(data.totalItems)} color="#7A9AB4" />
              <StatCard label="P0 Critical" value={String(data.p0Count)} color="#EF4444" />
              <StatCard label="P1 Important" value={String(data.p1Count)} color="#F59E0B" />
              <StatCard label="P2 Improve" value={String(data.p2Count)} color="#4A6280" />
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-[#7A9AB4]" />
                  <span className="text-2xl font-bold tabular-nums text-[#7A9AB4]">{data.estimatedTotalEffortHours}h</span>
                </div>
                <div className="mt-0.5 text-[10px] font-semibold text-[#4A6280] uppercase tracking-wide">Est. Total Effort</div>
              </div>
            </div>

            {/* Tab navigation */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-1">
                {(['fixes', 'modules', 'dependencies'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
                    style={{
                      backgroundColor: activeTab === tab ? 'rgba(255,255,255,0.07)' : 'transparent',
                      color: activeTab === tab ? '#fff' : '#4A6280',
                    }}
                  >
                    {tab === 'fixes' ? `Fix Queue (${data.totalItems})`
                      : tab === 'modules' ? 'Module Breakdown'
                      : `Dependency Chains (${data.dependencyChains.length})`}
                  </button>
                ))}
              </div>

              {activeTab === 'fixes' && (
                <div className="flex items-center gap-1">
                  <Filter className="h-3 w-3 text-[#4A6280]" />
                  {(['all', 'P0', 'P1', 'P2'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setFilterPriority(p)}
                      className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase transition-colors"
                      style={{
                        backgroundColor: filterPriority === p ? 'rgba(255,255,255,0.1)' : 'transparent',
                        color: filterPriority === p ? '#fff' : '#4A6280',
                      }}
                    >
                      {p === 'all' ? 'All' : p}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fixes tab */}
            {activeTab === 'fixes' && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                {filteredItems.length > 0 ? (
                  <div>
                    {filteredItems.slice(0, 100).map((item) => (
                      <FixItemRow key={item.id} item={item} />
                    ))}
                    {filteredItems.length > 100 && (
                      <p className="mt-3 text-[10px] text-[#4A6280]">Showing 100 of {filteredItems.length} items</p>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <AlertCircle className="h-6 w-6 text-[#4A6280] mx-auto mb-2" />
                    <p className="text-xs text-[#4A6280]">
                      {filterPriority === 'all' ? 'No issues detected — site is in good health.' : `No ${filterPriority} issues found.`}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Modules tab */}
            {activeTab === 'modules' && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Issues by Module</h2>
                {data.moduleBreakdown.length > 0 ? (
                  <div>
                    {data.moduleBreakdown.map((m) => (
                      <ModuleRow key={m.module} m={m} total={data.totalItems} />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#4A6280]">No module data.</p>
                )}
              </div>
            )}

            {/* Dependencies tab */}
            {activeTab === 'dependencies' && (
              <div className="space-y-4">
                {data.dependencyChains.length > 0 ? (
                  data.dependencyChains.map((chain, i) => (
                    <ChainCard key={i} chain={chain} />
                  ))
                ) : (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
                    <p className="text-xs text-[#4A6280]">No dependency chains detected — all fixes can be applied independently.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
      <div className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</div>
      <div className="mt-0.5 text-[10px] font-semibold text-[#4A6280] uppercase tracking-wide">{label}</div>
    </div>
  );
}
