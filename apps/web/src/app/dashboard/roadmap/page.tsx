'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useLatestAudit, useAuditSubReport, useMe } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Route,
  ExternalLink,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';
import type { FixPlan, FixPlanItem, FixPriority } from '@sitenexis/shared';

function priorityColor(p: FixPriority): string {
  if (p === 'P0') return '#EF4444';
  if (p === 'P1') return '#F59E0B';
  return '#4A6280';
}

function effortLabel(e: string) {
  if (e === 'low') return '< 1h';
  if (e === 'medium') return '1–4h';
  return '4h+';
}

function effortHours(e: string) {
  if (e === 'low') return 0.5;
  if (e === 'medium') return 2;
  return 6;
}

function RoadmapCard({ item, position, label, accent }: { item: FixPlanItem; position: number; label: string; accent: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border bg-white/[0.02] p-4" style={{ borderColor: `${accent}30` }}>
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: `${accent}20`, color: accent }}>
          {position}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: accent }}>{label}</span>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: priorityColor(item.priority), backgroundColor: `${priorityColor(item.priority)}15` }}>
              {item.priority}
            </span>
            <span className="text-[10px] text-[#4A6280]">{item.module}</span>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="mt-1 text-left w-full group">
            <p className="text-sm text-white font-medium group-hover:text-cyan transition-colors">{item.message}</p>
          </button>
          <div className="mt-2 flex items-center gap-3 text-[10px] text-[#4A6280]">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{effortLabel(item.effort)}</span>
            {item.impactScores && (
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                SEO +{item.impactScores.seoImpact} · AI +{item.impactScores.aiVisibilityImpact} · Trust +{item.impactScores.trustImpact}
              </span>
            )}
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-[#4A6280] hover:text-white transition-colors">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {expanded && (
        <div className="mt-3 ml-10 space-y-2 text-xs text-[#4A6280]">
          {item.problem && <p><strong className="text-[#7A9AB4]">Problem:</strong> {item.problem}</p>}
          {item.solution && <p><strong className="text-[#7A9AB4]">Solution:</strong> {item.solution}</p>}
          {item.recommendation && <p><strong className="text-[#7A9AB4]">Recommendation:</strong> {item.recommendation}</p>}
          {item.dependsOn && item.dependsOn.length > 0 && (
            <p><strong className="text-[#7A9AB4]">Depends on:</strong> {item.dependsOn.join(', ')}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function RoadmapPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { audit, isLoading: auditLoading } = useLatestAudit();
  const { data: fixPlan, isLoading } = useAuditSubReport<FixPlan>(audit?.id ?? null, 'fix-plan');

  const loading = auditLoading || isLoading;

  const items = fixPlan?.items ?? [];

  const startHere = items.filter((i) => i.priority === 'P0' && i.effort === 'low').slice(0, 1);
  const doNext = items.filter((i) => i.priority === 'P0' && !startHere.includes(i)).slice(0, 1);

  let cumHours = 0;
  const thisWeek: FixPlanItem[] = [];
  const thisSprint: FixPlanItem[] = [];
  const backlog: FixPlanItem[] = [];

  for (const item of items) {
    if (startHere.includes(item) || doNext.includes(item)) continue;
    cumHours += effortHours(item.effort);
    if (cumHours <= 8) thisWeek.push(item);
    else if (cumHours <= 56) thisSprint.push(item);
    else backlog.push(item);
  }

  const totalItems = items.length;
  const criticalCount = items.filter((i) => i.severity === 'critical').length;
  const totalEffort = items.reduce((s, i) => s + effortHours(i.effort), 0);

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
              <Route className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">Decision Roadmap</h1>
              <span className="rounded-full bg-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-cyan">v4</span>
            </div>
            <p className="text-sm text-[#4A6280]">
              {audit
                ? <>Optimally sequenced action plan for <span className="text-[#7A9AB4]">{audit.domain}</span> — <a href={`/audit/${encodeURIComponent(audit.domain)}?auditId=${audit.id}`} className="text-cyan hover:underline inline-flex items-center gap-1">full report <ExternalLink className="h-3 w-3" /></a></>
                : 'Dependency-aware action sequencing — highest impact, lowest effort first'}
            </p>
          </div>
        </div>

        {loading && (
          <div className="space-y-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-white/[0.03]" />)}</div>
        )}

        {!loading && (!fixPlan || items.length === 0) && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <Route className="h-8 w-8 text-[#4A6280] mx-auto mb-3" />
            <p className="text-white font-semibold">No roadmap available</p>
            <p className="mt-1 text-sm text-[#4A6280]">Run an audit to generate your decision roadmap.</p>
          </div>
        )}

        {fixPlan && items.length > 0 && (
          <div className="space-y-8">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                <span className="text-2xl font-bold text-white tabular-nums">{totalItems}</span>
                <div className="text-[10px] text-[#4A6280]">Total Actions</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                <span className="text-2xl font-bold text-red-400 tabular-nums">{criticalCount}</span>
                <div className="text-[10px] text-[#4A6280]">Critical</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                <span className="text-2xl font-bold text-cyan tabular-nums">{Math.round(totalEffort)}h</span>
                <div className="text-[10px] text-[#4A6280]">Est. Total Effort</div>
              </div>
            </div>

            {startHere.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-green-400" />
                  <h2 className="text-sm font-semibold text-green-400">Start Here</h2>
                </div>
                {startHere.map((item, i) => (
                  <RoadmapCard key={item.id ?? i} item={item} position={1} label="Start Here" accent="#22C55E" />
                ))}
              </div>
            )}

            {doNext.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-cyan" />
                  <h2 className="text-sm font-semibold text-cyan">Do Next</h2>
                </div>
                {doNext.map((item, i) => (
                  <RoadmapCard key={item.id ?? i} item={item} position={2} label="Do Next" accent="#00C8FF" />
                ))}
              </div>
            )}

            {thisWeek.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#0BCEBC]" />
                  <h2 className="text-sm font-semibold text-[#0BCEBC]">This Week</h2>
                  <span className="text-[10px] text-[#4A6280]">≤ 8h cumulative</span>
                </div>
                <div className="space-y-2">
                  {thisWeek.map((item, i) => (
                    <RoadmapCard key={item.id ?? i} item={item} position={i + 3} label="This Week" accent="#0BCEBC" />
                  ))}
                </div>
              </div>
            )}

            {thisSprint.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#F59E0B]" />
                  <h2 className="text-sm font-semibold text-[#F59E0B]">This Sprint</h2>
                  <span className="text-[10px] text-[#4A6280]">8–56h cumulative</span>
                </div>
                <div className="space-y-2">
                  {thisSprint.map((item, i) => (
                    <RoadmapCard key={item.id ?? i} item={item} position={thisWeek.length + (doNext.length > 0 ? 3 : 2) + i} label="Sprint" accent="#F59E0B" />
                  ))}
                </div>
              </div>
            )}

            {backlog.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-[#4A6280]">Backlog</h2>
                  <span className="text-[10px] text-[#4A6280]">{backlog.length} items</span>
                </div>
                <div className="space-y-2">
                  {backlog.slice(0, 10).map((item, i) => (
                    <RoadmapCard key={item.id ?? i} item={item} position={thisWeek.length + thisSprint.length + (doNext.length > 0 ? 3 : 2) + i} label="Backlog" accent="#4A6280" />
                  ))}
                  {backlog.length > 10 && (
                    <p className="text-[10px] text-[#4A6280] pl-10">+ {backlog.length - 10} more items in backlog</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
