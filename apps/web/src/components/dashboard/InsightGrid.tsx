'use client';

import { Network, AlertTriangle, Activity, GitFork } from 'lucide-react';

export interface InsightGridData {
  entityCount: number | null;
  entityConsistency: number | null;
  crawlHealth: 'healthy' | 'degraded' | 'failing' | null;
  crawledPages: number | null;
  topIssueCount: number | null;
  criticalIssueCount: number | null;
  perceptionNodeCount: number | null;
  topIssues: Array<{ label: string; severity: 'critical' | 'warning' | 'info' }>;
}

interface InsightGridProps {
  data: InsightGridData;
  loading?: boolean | undefined;
}

const CRAWL_HEALTH_STYLE = {
  healthy:  { label: 'Healthy',  color: 'text-teal-400',  bg: 'bg-teal-500/10',  dot: 'bg-teal-400' },
  degraded: { label: 'Degraded', color: 'text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-400' },
  failing:  { label: 'Failing',  color: 'text-red-400',   bg: 'bg-red-500/10',   dot: 'bg-red-400' },
};

const ISSUE_SEVERITY_STYLE = {
  critical: 'text-red-400 bg-red-500/10',
  warning:  'text-amber-400 bg-amber-500/10',
  info:     'text-blue-400 bg-blue-500/10',
};

function CardShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`card-glass overflow-hidden rounded-xl ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-3.5">
      <Icon className="h-4 w-4 text-[#4A6280]" strokeWidth={1.6} />
      <h4 className="text-sm font-semibold text-white">{title}</h4>
    </div>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/5 ${className}`} />;
}

function EntitySnapshot({ data, loading }: { data: InsightGridData; loading?: boolean | undefined }) {
  return (
    <CardShell>
      <CardHeader icon={Network} title="Entity Intelligence" />
      <div className="grid grid-cols-2 gap-px bg-white/[0.04] border-b border-white/[0.04]">
        {[
          { label: 'Entities Detected', value: data.entityCount },
          { label: 'Consistency Score', value: data.entityConsistency !== null ? `${data.entityConsistency}%` : null },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#050B09] px-5 py-4">
            {loading ? (
              <Skeleton className="mb-1 h-7 w-12" />
            ) : (
              <p className="text-2xl font-bold text-white tabular-nums">
                {value ?? '—'}
              </p>
            )}
            <p className="text-xs text-[#4A6280]">{label}</p>
          </div>
        ))}
      </div>
      <div className="px-5 py-3">
        <p className="text-xs text-[#4A6280] leading-relaxed">
          Named entities extracted from structured + unstructured content across all crawled pages.
        </p>
      </div>
    </CardShell>
  );
}

function CrawlHealth({ data, loading }: { data: InsightGridData; loading?: boolean | undefined }) {
  const cfg = data.crawlHealth ? CRAWL_HEALTH_STYLE[data.crawlHealth] : null;

  return (
    <CardShell>
      <CardHeader icon={Activity} title="Crawl Health" />
      <div className="px-5 py-4 flex items-center gap-3">
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : cfg ? (
          <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${cfg.bg}`}>
            <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
            <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
          </div>
        ) : (
          <span className="text-sm text-[#4A6280]">No data</span>
        )}
        {!loading && data.crawledPages !== null && (
          <span className="text-xs text-[#4A6280]">{data.crawledPages} pages indexed</span>
        )}
      </div>
    </CardShell>
  );
}

function TopIssues({ data, loading }: { data: InsightGridData; loading?: boolean | undefined }) {
  return (
    <CardShell>
      <CardHeader icon={AlertTriangle} title="Top Issues" />
      <div className="px-5 py-3">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        ) : data.topIssues.length === 0 ? (
          <p className="py-4 text-xs text-center text-[#4A6280]">No issues detected</p>
        ) : (
          <ul className="space-y-1.5">
            {data.topIssues.slice(0, 5).map((issue, i) => (
              <li key={i} className="flex items-center gap-2.5">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${ISSUE_SEVERITY_STYLE[issue.severity]}`}>
                  {issue.severity}
                </span>
                <span className="truncate text-xs text-[#C8DFE8]">{issue.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!loading && (data.criticalIssueCount ?? 0) > 0 && (
        <div className="border-t border-white/[0.06] px-5 py-2.5">
          <span className="text-xs text-red-400">
            {data.criticalIssueCount} critical issue{data.criticalIssueCount !== 1 ? 's' : ''} require attention
          </span>
        </div>
      )}
    </CardShell>
  );
}

function PerceptionGraph({ data, loading }: { data: InsightGridData; loading?: boolean | undefined }) {
  return (
    <CardShell>
      <CardHeader icon={GitFork} title="Perception Graph" />
      <div className="flex items-center gap-3 px-5 py-4">
        {loading ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <>
            <span className="text-2xl font-bold text-white tabular-nums">
              {data.perceptionNodeCount ?? '—'}
            </span>
            <span className="text-xs text-[#4A6280]">perception nodes mapped</span>
          </>
        )}
      </div>
      <div className="px-5 pb-4">
        <p className="text-xs text-[#4A6280] leading-relaxed">
          AI semantic representation of entity relationships and topic clusters.
        </p>
      </div>
    </CardShell>
  );
}

export function InsightGrid({ data, loading }: InsightGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <EntitySnapshot data={data} loading={loading} />
      <CrawlHealth data={data} loading={loading} />
      <TopIssues data={data} loading={loading} />
      <PerceptionGraph data={data} loading={loading} />
    </div>
  );
}
