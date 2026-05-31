'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Globe, ArrowLeft, CheckCircle2, Loader2, Circle, ExternalLink } from 'lucide-react';

type AgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

interface AgentState {
  id: string;
  label: string;
  phase: number;
  status: AgentStatus;
  message?: string;
}

const AGENT_PIPELINE: Omit<AgentState, 'status' | 'message'>[] = [
  { id: 'crawl',               label: 'Crawl Agent',                phase: 1 },
  { id: 'seo',                 label: 'SEO Analysis',               phase: 2 },
  { id: 'schema',              label: 'Schema Intelligence',         phase: 2 },
  { id: 'retrieval',           label: 'AI Retrieval Agent',          phase: 3 },
  { id: 'entity',              label: 'Entity Intelligence',         phase: 3 },
  { id: 'performance',         label: 'Performance Agent',           phase: 3 },
  { id: 'citation',            label: 'Citation Intelligence',       phase: 4 },
  { id: 'semantic-trust',      label: 'Semantic Trust Agent',        phase: 4 },
  { id: 'retrieval-simulation',label: 'Retrieval Simulation',        phase: 5 },
  { id: 'machine-trust',       label: 'Machine Trust Agent',         phase: 5 },
  { id: 'temporal-authority',  label: 'Temporal Authority',          phase: 5 },
  { id: 'recommendation-mapping', label: 'Recommendation Mapping',  phase: 5 },
  { id: 'synthetic-entity',    label: 'Synthetic Entity Detection',  phase: 5 },
  { id: 'visualization',       label: 'Visualization Agent',         phase: 6 },
  { id: 'reporting',           label: 'Reporting Agent',             phase: 7 },
];

function agentStatusIcon(status: AgentStatus) {
  if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-teal" />;
  if (status === 'running')   return <Loader2 className="h-4 w-4 text-cyan animate-spin" />;
  if (status === 'failed')    return <Circle className="h-4 w-4 text-red-400 fill-red-400/30" />;
  if (status === 'skipped')   return <Circle className="h-4 w-4 text-[#334155]" />;
  return <Circle className="h-4 w-4 text-[#334155]" />;
}

export default function LiveAuditPage() {
  const router = useRouter();
  const [domain, setDomain] = useState('');
  const [auditId, setAuditId] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentState[]>(
    AGENT_PIPELINE.map((a) => ({ ...a, status: 'pending' as AgentStatus }))
  );
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const evtRef = useRef<EventSource | null>(null);

  const handleStart = async () => {
    const trimmed = domain.trim();
    if (!trimmed) return;
    setError(null);
    setDone(false);
    setRunning(true);
    setAgents(AGENT_PIPELINE.map((a) => ({ ...a, status: 'pending' })));

    try {
      const res = await fetch('/api/audit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: trimmed }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const { auditId: id } = await res.json() as { auditId: string };
      setAuditId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start audit');
      setRunning(false);
    }
  };

  useEffect(() => {
    if (!auditId) return;

    const es = new EventSource(`/api/audit/${auditId}/stream`);
    evtRef.current = es;

    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data as string) as { agentId?: string; event?: string; payload?: Record<string, unknown>; status?: string };

        if (msg.agentId) {
          setAgents((prev) => prev.map((a) =>
            a.id === msg.agentId
              ? { ...a, status: msg.event === 'completed' ? 'completed' : msg.event === 'failed' ? 'failed' : 'running' }
              : a
          ));
        }

        if (msg.status === 'complete' || msg.status === 'failed') {
          setDone(true);
          setRunning(false);
          es.close();
          if (msg.status === 'failed') setError('Audit failed — partial results may be available.');
        }
      } catch { /* ignore malformed events */ }
    };

    es.onerror = () => {
      setDone(true);
      setRunning(false);
      es.close();
    };

    return () => { es.close(); };
  }, [auditId]);

  useEffect(() => {
    return () => { evtRef.current?.close(); };
  }, []);

  const completedCount = agents.filter((a) => a.status === 'completed').length;
  const progressPct = Math.round((completedCount / agents.length) * 100);

  return (
    <DashboardLayout>
      <TopCommandBar onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)} />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">

        <div className="mb-6 flex items-center gap-4">
          <Link href="/dashboard/audits" className="flex items-center gap-1.5 text-sm text-[#4A6280] hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> Audits
          </Link>
          <span className="text-[#334155]">/</span>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-cyan" />
            <h1 className="text-xl font-bold text-white">Live Audit</h1>
          </div>
        </div>

        {/* Domain input */}
        {!running && !done && (
          <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Start a Live Audit</h2>
            <div className="flex gap-3">
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                placeholder="example.com"
                className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-[#334155] outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20"
              />
              <button
                onClick={handleStart}
                disabled={!domain.trim()}
                className="rounded-lg bg-cyan/10 border border-cyan/20 px-5 py-2.5 text-sm font-semibold text-cyan hover:bg-cyan/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Start Audit
              </button>
            </div>
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          </div>
        )}

        {/* Progress */}
        {(running || done) && (
          <div className="space-y-5">
            {/* Progress bar */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold text-white">{domain}</span>
                <span className="text-[#4A6280]">{completedCount}/{agents.length} agents complete</span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%`, backgroundColor: done ? '#22C55E' : '#00C8FF' }}
                />
              </div>
              {done && !error && auditId && (
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-green-400">Audit complete</span>
                  <a
                    href={`/audit/${encodeURIComponent(domain)}?auditId=${auditId}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-teal/20 bg-teal/10 px-3 py-1.5 text-xs font-semibold text-teal hover:bg-teal/20 transition-colors"
                  >
                    View Full Report <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
            </div>

            {/* Agent pipeline */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">16-Agent Pipeline</h2>
              <div className="space-y-1">
                {([1,2,3,4,5,6,7] as const).map((phase) => {
                  const phaseAgents = agents.filter((a) => a.phase === phase);
                  return (
                    <div key={phase} className="mb-3">
                      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#334155]">Phase {phase}</div>
                      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                        {phaseAgents.map((agent) => (
                          <div key={agent.id} className="flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                            {agentStatusIcon(agent.status)}
                            <span className="text-xs" style={{
                              color: agent.status === 'completed' ? '#0BCEBC'
                                   : agent.status === 'running'   ? '#00C8FF'
                                   : agent.status === 'failed'    ? '#EF4444'
                                   : '#4A6280'
                            }}>
                              {agent.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
