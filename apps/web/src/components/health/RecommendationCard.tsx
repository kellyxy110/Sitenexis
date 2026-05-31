'use client';

import { ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { useState } from 'react';

export interface RecommendationItem {
  dimension: string;
  severity: 'critical' | 'warning' | 'info';
  issue: string;
  impact: string;
  fix: string;
  estimatedImprovement: number;
}

const DIMENSION_LABELS: Record<string, string> = {
  technical_seo: 'Technical SEO',
  ai_visibility: 'AI Visibility',
  entity_coverage: 'Entity Coverage',
  citation_readiness: 'Citation Readiness',
  knowledge_graph: 'Knowledge Graph',
  trust_signals: 'Trust Signals',
  performance: 'Performance',
  geo: 'GEO',
};

const SEVERITY_STYLES = {
  critical: { badge: 'bg-red-500/15 text-red-400 border border-red-500/20', dot: 'bg-red-500' },
  warning:  { badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/20', dot: 'bg-amber-500' },
  info:     { badge: 'bg-blue-500/15 text-blue-400 border border-blue-500/20', dot: 'bg-blue-400' },
};

export function RecommendationCard({ rec, index }: { rec: RecommendationItem; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);
  const styles = SEVERITY_STYLES[rec.severity];
  const dimLabel = DIMENSION_LABELS[rec.dimension] ?? rec.dimension;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <button
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles.badge}`}>
              {rec.severity}
            </span>
            <span className="text-[10px] text-[#4A6280] uppercase tracking-wide">{dimLabel}</span>
          </div>
          <p className="text-sm font-medium text-[#C8DFE8] leading-snug">{rec.issue}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 rounded-full bg-teal-500/10 px-2 py-0.5">
            <Zap className="h-3 w-3 text-teal-400" />
            <span className="text-[11px] font-semibold text-teal-400">+{rec.estimatedImprovement}</span>
          </div>
          {expanded
            ? <ChevronUp className="h-4 w-4 text-[#4A6280]" />
            : <ChevronDown className="h-4 w-4 text-[#4A6280]" />
          }
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.04] px-4 pb-4 pt-3 space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4A6280] mb-1">Impact</p>
            <p className="text-sm text-[#7A9AB4] leading-relaxed">{rec.impact}</p>
          </div>
          <div className="rounded-lg border border-teal-500/20 bg-teal-500/[0.05] px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-500 mb-1">Fix</p>
            <p className="text-sm text-[#C8DFE8] leading-relaxed">{rec.fix}</p>
          </div>
        </div>
      )}
    </div>
  );
}
