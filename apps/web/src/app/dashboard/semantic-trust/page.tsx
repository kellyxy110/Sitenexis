'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useLatestAudit, useAuditSubReport } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react';

interface AIVisData {
  auditId: string;
  semanticTrustScore: number;
  breakdown?: {
    semanticTrust?: Record<string, number>;
  };
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

const TRUST_DIMENSION_LABELS: Record<string, { label: string; desc: string }> = {
  authorshipTrust: {
    label: 'Authorship Trust',
    desc: 'Named authors with external attribution, credentials, and contributor pages',
  },
  organisationalTrust: {
    label: 'Organisational Trust',
    desc: 'Organisation schema, contact info, About page, business registration signals',
  },
  contentTrust: {
    label: 'Content Trust',
    desc: 'Factual accuracy, absence of contradictions, claim verifiability, update signals',
  },
  structuralTrust: {
    label: 'Structural Trust',
    desc: 'Schema markup completeness, consistent entity data, canonical URLs, HTTPS',
  },
};

const TRUST_SIGNALS_DESC = [
  { signal: 'Author schema on key pages', icon: 'authorship' },
  { signal: 'Organisation schema with verified sameAs links', icon: 'organisation' },
  { signal: 'No cross-page factual contradictions detected', icon: 'content' },
  { signal: 'dateModified schema on updated content', icon: 'structural' },
  { signal: 'HTTPS with valid certificate on all pages', icon: 'structural' },
  { signal: 'Consistent entity attributes across pages', icon: 'content' },
];

export default function SemanticTrustPage() {
  const router = useRouter();
  const { audit, isLoading: auditLoading } = useLatestAudit();
  const { data, isLoading } = useAuditSubReport<AIVisData>(audit?.id ?? null, 'ai-visibility');

  const loading = auditLoading || isLoading;
  const trustBreakdown = data?.breakdown?.semanticTrust ?? {};
  const hasBreakdown = Object.keys(trustBreakdown).length > 0;

  return (
    <DashboardLayout>
      <TopCommandBar onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)} />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">

        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">Semantic Trust</h1>
            </div>
            <p className="text-sm text-[#4A6280]">
              {audit
                ? <>For <span className="text-[#7A9AB4]">{audit.domain}</span> — <a href={`/audit/${encodeURIComponent(audit.domain)}?auditId=${audit.id}`} className="text-cyan hover:underline inline-flex items-center gap-1">full report <ExternalLink className="h-3 w-3" /></a></>
                : 'Authorship, organisational, content, and structural trust signals — with Claude-powered contradiction detection'}
            </p>
          </div>
          {data && (
            <div className="text-right">
              <div className="text-4xl font-bold tabular-nums" style={{ color: scoreColor(data.semanticTrustScore) }}>{data.semanticTrustScore}</div>
              <div className="text-xs text-[#4A6280]">Semantic Trust Score</div>
              <div className="mt-0.5 text-xs font-semibold" style={{ color: scoreColor(data.semanticTrustScore) }}>{scoreLabel(data.semanticTrustScore)}</div>
            </div>
          )}
        </div>

        {!audit && !auditLoading && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <p className="text-white font-semibold">No completed audits yet</p>
            <p className="mt-1 text-sm text-[#4A6280]">Run an audit to see semantic trust analysis.</p>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[1,2,3].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-white/[0.03]" />)}
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Four trust dimensions */}
            {hasBreakdown ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {Object.entries(TRUST_DIMENSION_LABELS).map(([key, meta]) => {
                  const score = trustBreakdown[key];
                  if (score == null) return null;
                  return (
                    <div key={key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">{meta.label}</span>
                        <span className="text-xl font-bold tabular-nums" style={{ color: scoreColor(score) }}>{Math.round(score)}</span>
                      </div>
                      <p className="mb-3 text-xs text-[#4A6280]">{meta.desc}</p>
                      <div className="h-1.5 rounded-full bg-white/10">
                        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: scoreColor(score) }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* No sub-breakdown available — show composite score with context */
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Composite Trust Score</h2>
                <div className="mb-3 flex items-end gap-3">
                  <span className="text-5xl font-bold tabular-nums" style={{ color: scoreColor(data.semanticTrustScore) }}>{data.semanticTrustScore}</span>
                  <span className="mb-1 text-sm font-semibold" style={{ color: scoreColor(data.semanticTrustScore) }}>{scoreLabel(data.semanticTrustScore)}</span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${data.semanticTrustScore}%`, backgroundColor: scoreColor(data.semanticTrustScore) }} />
                </div>
                <p className="mt-4 text-xs text-[#4A6280]">
                  Sub-score breakdown (Authorship, Organisational, Content, Structural) is available on the full audit report.
                </p>
              </div>
            )}

            {/* Trust signal reference */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h2 className="mb-1 text-sm font-semibold text-[#C8DFE8]">Key Trust Signals</h2>
              <p className="mb-4 text-xs text-[#4A6280]">Signals that AI systems evaluate when assigning credibility to your content</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {TRUST_SIGNALS_DESC.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" />
                    <span className="text-[#4A6280]">{s.signal}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Contradiction detection note */}
            <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
              <div>
                <p className="text-sm font-semibold text-white">Claude-Powered Contradiction Detection</p>
                <p className="mt-0.5 text-xs text-[#4A6280]">
                  The Semantic Trust Score includes contradiction detection across your top 20 pages by PageRank.
                  Cross-page contradictions in entity attributes, schema data, and factual claims reduce the contradiction absence sub-score.
                  Available on Pro and Agency plans.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
