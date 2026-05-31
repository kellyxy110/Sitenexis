'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { IntelligenceHero, type IntelligenceScores } from '@/components/dashboard/IntelligenceHero';
import { InsightGrid, type InsightGridData } from '@/components/dashboard/InsightGrid';
import { AuditActivityFeed, type AuditFeedItem } from '@/components/dashboard/AuditActivityFeed';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditRow {
  id: string;
  domain: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  createdAt: string;
  completedAt: string | null;
  scores?: {
    overall: number;
    seoScore: number;
    aiScore: number;
    schemaScore: number;
    linkGraphScore: number;
    performanceScore: number;
  } | null;
  _count?: { issues: number };
}

interface AuditsResponse {
  data: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

interface MeResponse {
  id: string;
  email: string;
  plan: string;
  isDemo: boolean;
}

const PAGE_SIZE = 10;

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // ── Fetch current user ──────────────────────────────────────────────────────
  const { data: me, isLoading: meLoading } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: async () => {
      const r = await fetch('/api/me');
      if (!r.ok) return { id: '', email: '', plan: 'free', isDemo: true };
      return r.json() as Promise<MeResponse>;
    },
    staleTime: 60_000,
  });

  const userName = me?.email ? me.email.split('@')[0] : null;
  const userPlan = me?.plan ?? 'free';
  // Only show demo banner once /api/me has responded — avoids flash on authenticated pages.
  const isDemo   = meLoading ? false : (me?.isDemo ?? true);

  // ── Fetch audits ────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery<AuditsResponse>({
    queryKey: ['audits', 1],
    queryFn: async () => {
      const r = await fetch(`/api/audits?page=1&pageSize=${PAGE_SIZE}`);
      const json = await r.json() as AuditsResponse | { error: string };
      if (!r.ok || 'error' in json) {
        return { data: [], total: 0, page: 1, pageSize: PAGE_SIZE, hasMore: false };
      }
      return json;
    },
    staleTime: 30_000,
    refetchInterval: (query) => {
      const rows = query.state.data?.data ?? [];
      return rows.some((r) => r.status === 'running' || r.status === 'queued') ? 5000 : false;
    },
  });

  // ── Delete mutation ─────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/audit/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audits'] }),
  });

  // ── Start new audit ─────────────────────────────────────────────────────────
  const handleNewAudit = async (domain: string) => {
    setIsStarting(true);
    setStartError(null);
    try {
      const res = await fetch('/api/audit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      if (res.ok) {
        const { auditId } = await res.json() as { auditId: string };
        router.push(`/audit/${encodeURIComponent(domain)}?auditId=${auditId}`);
      } else {
        const body = await res.json() as { error?: string };
        setStartError(body.error ?? `Request failed (${res.status}). Please try again.`);
      }
    } catch {
      setStartError('Could not reach the server. Check your connection and try again.');
    } finally {
      setIsStarting(false);
    }
  };

  // ── Derived data ────────────────────────────────────────────────────────────
  const completeAudits = data?.data?.filter((r) => r.status === 'complete') ?? [];

  const intelligenceScores: IntelligenceScores = useMemo(() => {
    if (!completeAudits.length) {
      return { aiVisibility: null, retrievalReadiness: null, citationProbability: null, semanticTrust: null, entityConfidence: null };
    }
    const avgAi = Math.round(completeAudits.reduce((s, r) => s + (r.scores?.aiScore ?? 0), 0) / completeAudits.length);
    return {
      aiVisibility:       avgAi,
      retrievalReadiness: null,
      citationProbability:null,
      semanticTrust:      null,
      entityConfidence:   null,
    };
  }, [completeAudits]);

  const insightData: InsightGridData = useMemo(() => ({
    entityCount:          null,
    entityConsistency:    null,
    crawlHealth:          completeAudits.length > 0 ? 'healthy' : null,
    crawledPages:         null,
    topIssueCount:        completeAudits.reduce((s, r) => s + (r._count?.issues ?? 0), 0) || null,
    criticalIssueCount:   null,
    perceptionNodeCount:  null,
    topIssues:            [],
  }), [completeAudits]);

  const feedItems: AuditFeedItem[] = useMemo(() => (data?.data ?? []).map((a) => ({
    id:        a.id,
    domain:    a.domain,
    status:    a.status,
    createdAt: a.createdAt,
    scores:    a.scores ? { aiScore: a.scores.aiScore, seoScore: a.scores.seoScore } : null,
  })), [data]);

  return (
    <DashboardLayout userName={userName} plan={userPlan}>
      <TopCommandBar
        onRunAudit={handleNewAudit}
        isAuditing={isStarting}
        userName={userName}
        plan={userPlan}
      />

      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">
        {/* Demo mode banner */}
        {isDemo && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3">
            <span className="mt-0.5 text-amber-400 text-sm">⚠</span>
            <div>
              <p className="text-sm font-medium text-amber-300">Demo mode — no real credentials configured</p>
              <p className="mt-0.5 text-xs text-amber-500/80">
                Audit results are procedurally generated. Replace placeholder values in{' '}
                <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-[11px]">.env</code>{' '}
                with your Supabase and database credentials to enable real crawls.
              </p>
            </div>
          </div>
        )}

        {startError && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {startError}
          </div>
        )}

        {/* Intelligence Hero */}
        <div className="mb-6 animate-fade-in">
          <IntelligenceHero
            scores={intelligenceScores}
            domain={completeAudits[0]?.domain ?? undefined}
            loading={isLoading}
          />
        </div>

        {/* Insight Grid */}
        <div className="mb-6 animate-fade-in">
          <InsightGrid data={insightData} loading={isLoading} />
        </div>

        {/* Audit Activity Feed */}
        <div className="animate-fade-in">
          <AuditActivityFeed
            audits={feedItems}
            loading={isLoading}
            onRerun={handleNewAudit}
            onDelete={(id) => {
              if (confirm('Delete this audit?')) deleteMutation.mutate(id);
            }}
          />
        </div>
      </main>
    </DashboardLayout>
  );
}
