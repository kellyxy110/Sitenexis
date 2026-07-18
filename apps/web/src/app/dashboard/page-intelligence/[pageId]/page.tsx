'use client';

import { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useRouter } from 'next/navigation';
import { Sparkles, ChevronDown, ChevronUp, Check, Send, Loader2 } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/events';

interface Recommendation {
  action: string;
  rationale: string;
  sourceFindingIds: string[];
  expectedImpact: string;
}
interface CitabilityEntry {
  engine: string;
  likelihood: 'low' | 'medium' | 'high';
  reasoning: string;
}
interface OptimizationSession {
  id: string;
  diagnosis: string;
  originalTitle: string | null;
  originalMetaDescription: string | null;
  originalH1: string | null;
  originalBodyText: string;
  optimizedTitle: string | null;
  optimizedMetaDescription: string | null;
  optimizedH1: string | null;
  optimizedBodyText: string;
  recommendations: Recommendation[];
  citabilityByEngine: CitabilityEntry[];
  status: 'draft' | 'accepted' | 'published';
  createdAt: string;
}

const LIKELIHOOD_COLOR: Record<string, string> = { high: '#22C55E', medium: '#F59E0B', low: '#EF4444' };

function DiffColumn({ label, title, meta, h1, body }: { label: string; title: string | null; meta: string | null; h1: string | null; body: string }) {
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#4A6280]">{label}</div>
      <div className="space-y-2 text-xs">
        <div><span className="text-[#4A6280]">Title:</span> <span className="text-white">{title ?? '(none)'}</span></div>
        <div><span className="text-[#4A6280]">Meta:</span> <span className="text-white">{meta ?? '(none)'}</span></div>
        <div><span className="text-[#4A6280]">H1:</span> <span className="text-white">{h1 ?? '(none)'}</span></div>
      </div>
      <div className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-black/20 p-3 text-xs leading-relaxed text-[#C8DFE8]">
        {body}
      </div>
    </div>
  );
}

function SessionCard({ session, onStatusChange }: { session: OptimizationSession; onStatusChange: (id: string, status: 'accepted' | 'published') => void }) {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    if (!expanded) trackEvent('recommendation_viewed', { auditId: '', recommendationId: session.id });
    setExpanded(!expanded);
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0A1628]">
      <button onClick={toggle} className="flex w-full items-center justify-between gap-4 p-4 text-left">
        <div>
          <div className="text-sm font-semibold text-white">{new Date(session.createdAt).toLocaleString()}</div>
          <div className="text-xs text-[#7A9AB4]">{session.recommendations.length} recommendation{session.recommendations.length === 1 ? '' : 's'} · status: {session.status}</div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-[#4A6280]" /> : <ChevronDown size={16} className="text-[#4A6280]" />}
      </button>

      {expanded && (
        <div className="border-t border-white/[0.05] p-4 space-y-5">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#4A6280]">Diagnosis</div>
            <p className="text-sm leading-relaxed text-[#C8DFE8]">{session.diagnosis}</p>
          </div>

          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#4A6280]">Recommendations (each traced to a real finding)</div>
            <div className="space-y-2">
              {session.recommendations.map((r, i) => (
                <div key={i} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3 text-xs">
                  <div className="font-semibold text-white">{r.action}</div>
                  <div className="mt-1 text-[#7A9AB4]">{r.rationale}</div>
                  <div className="mt-1 text-teal-400">Expected impact: {r.expectedImpact}</div>
                </div>
              ))}
              {session.recommendations.length === 0 && (
                <p className="text-xs text-[#4A6280]">No recommendations survived traceability validation for this generation.</p>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#4A6280]">Estimated citability by AI engine</div>
            <div className="flex flex-wrap gap-2">
              {session.citabilityByEngine.map((c, i) => (
                <span key={i} title={c.reasoning} className="rounded-pill border px-2 py-1 text-[11px] font-medium"
                  style={{ borderColor: `${LIKELIHOOD_COLOR[c.likelihood]}40`, color: LIKELIHOOD_COLOR[c.likelihood] }}>
                  {c.engine}: {c.likelihood}
                </span>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#4A6280]">Rewrite diff — suggestion only, nothing is auto-applied</div>
            <div className="flex flex-col gap-3 md:flex-row">
              <DiffColumn label="Original" title={session.originalTitle} meta={session.originalMetaDescription} h1={session.originalH1} body={session.originalBodyText} />
              <DiffColumn label="Optimized" title={session.optimizedTitle} meta={session.optimizedMetaDescription} h1={session.optimizedH1} body={session.optimizedBodyText} />
            </div>
          </div>

          {session.status === 'draft' && (
            <div className="flex gap-2">
              <button onClick={() => onStatusChange(session.id, 'accepted')} className="flex items-center gap-1.5 rounded-lg border border-teal-500/25 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-400 hover:bg-teal-500/20">
                <Check size={13} /> Accept
              </button>
            </div>
          )}
          {session.status === 'accepted' && (
            <button onClick={() => onStatusChange(session.id, 'published')} className="flex items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/20">
              <Send size={13} /> Mark published (I published this externally)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function PageIntelligencePage() {
  const router = useRouter();
  const params = useParams<{ pageId: string }>();
  const searchParams = useSearchParams();
  const auditId = searchParams.get('auditId') ?? '';
  const queryClient = useQueryClient();

  const sessionsQuery = useQuery({
    queryKey: ['page-intelligence-sessions', auditId, params.pageId],
    queryFn: async () => {
      const res = await fetch(`/api/audit/${auditId}/pages/${params.pageId}/intelligence/sessions`);
      if (!res.ok) throw new Error('Failed to load sessions');
      return (await res.json()).sessions as OptimizationSession[];
    },
    enabled: Boolean(auditId && params.pageId),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/audit/${auditId}/pages/${params.pageId}/intelligence`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Generation failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['page-intelligence-sessions', auditId, params.pageId] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ sessionId, status }: { sessionId: string; status: 'accepted' | 'published' }) => {
      const res = await fetch(`/api/audit/${auditId}/pages/${params.pageId}/intelligence/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      return { sessionId, status };
    },
    onSuccess: ({ status }) => {
      if (status === 'accepted' || status === 'published') {
        trackEvent('recommendation_applied', { auditId, recommendationId: params.pageId });
      }
      queryClient.invalidateQueries({ queryKey: ['page-intelligence-sessions', auditId, params.pageId] });
    },
  });

  const sessions = sessionsQuery.data ?? [];

  return (
    <DashboardLayout>
      <TopCommandBar onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)} />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">Page Intelligence</h1>
            </div>
            <p className="text-sm text-[#4A6280]">Diagnosis and rewrite proposals for this page — every recommendation traces to a real SiteNexis finding.</p>
          </div>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2 text-sm font-semibold text-[#050816] disabled:opacity-60"
          >
            {generateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {generateMutation.isPending ? 'Generating…' : 'Generate Page Intelligence'}
          </button>
        </div>

        {generateMutation.isError && (
          <div className="mb-4 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-400">
            {(generateMutation.error as Error).message}
          </div>
        )}

        <div className="space-y-3">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} onStatusChange={(sessionId, status) => statusMutation.mutate({ sessionId, status })} />
          ))}
          {sessions.length === 0 && !sessionsQuery.isLoading && (
            <p className="text-sm text-[#4A6280]">No optimization sessions yet — generate the first one above.</p>
          )}
        </div>
      </main>
    </DashboardLayout>
  );
}
