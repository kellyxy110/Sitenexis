'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useAuditSubReport, useLatestAudit, useMe } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { ListChecks } from 'lucide-react';
import type { AiGovernanceReport } from '@sitenexis/shared';

function color(score: number) { return score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400'; }

const RESOURCE_LABELS: Record<string, string> = {
  hasLlmsTxt: 'llms.txt',
  hasAiTxt: 'ai.txt',
  hasSecurityTxt: 'security.txt',
  hasSitemapDeclaration: 'Sitemap declared',
};

export default function AiGovernancePage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { audit, isLoading: auditLoading } = useLatestAudit();
  const { data, isLoading } = useAuditSubReport<AiGovernanceReport>(audit?.id ?? null, 'ai-governance');
  const loading = auditLoading || isLoading;

  return (
    <DashboardLayout>
      <TopCommandBar onRunAudit={(domain) => router.push(`/audit/${encodeURIComponent(domain)}`)} userName={me?.email?.split('@')[0] ?? null} plan={me?.plan} />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">AI Governance</h1>
            </div>
            <p className="text-sm text-[#4A6280]">Declared AI-use policy: the Content-Signal directive, named AI crawler access, and AI discovery resources.</p>
          </div>
          {data && <div className={`text-4xl font-bold ${color(data.overallScore)}`}>{data.overallScore}<span className="text-sm text-[#4A6280]"> / 100</span></div>}
        </div>

        {loading && <div className="h-32 animate-pulse rounded-xl bg-white/[0.03]" />}
        {!loading && !data && <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-[#4A6280]">Run an audit to generate an AI Governance report.</div>}

        {data && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              {Object.entries(data.scoreBreakdown).map(([key, value]) => (
                <div key={key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="text-xs text-[#4A6280]">{key.replace(/[A-Z]/g, (letter) => ` ${letter}`).trim()}</p>
                  <p className={`mt-2 text-2xl font-bold ${value === null ? 'text-[#4A6280]' : color(value as number)}`}>{value === null ? 'Not declared' : String(value)}</p>
                </div>
              ))}
            </div>

            {data.contentSignal && (
              <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <h2 className="mb-2 text-sm font-semibold text-[#C8DFE8]">Declared Content-Signal</h2>
                <code className="block rounded-lg bg-black/30 p-3 text-xs text-[#7A9AB4]">{data.contentSignal.raw}</code>
              </section>
            )}

            <section>
              <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">AI discovery resources</h2>
              <div className="grid gap-3 sm:grid-cols-4">
                {Object.entries(RESOURCE_LABELS).map(([key, label]) => {
                  const present = Boolean((data as unknown as Record<string, boolean>)[key]);
                  return (
                    <div key={key} className={`rounded-xl border p-4 ${present ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                      <p className="text-xs text-[#4A6280]">{label}</p>
                      <p className={`mt-1 text-sm font-semibold ${present ? 'text-emerald-400' : 'text-[#4A6280]'}`}>{present ? 'Present' : 'Not found'}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            {data.namedBotAccess.some((b) => b.status !== 'unspecified') && (
              <section>
                <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">Named AI crawler access</h2>
                <div className="space-y-1">
                  {data.namedBotAccess.filter((b) => b.status !== 'unspecified').map((b) => (
                    <div key={b.bot} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm">
                      <span className="text-[#C8DFE8]">{b.bot}</span>
                      <span className={b.status === 'allowed' ? 'text-emerald-400' : 'text-red-400'}>{b.status}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">Findings ({data.issues.length})</h2>
              <div className="space-y-2">
                {data.issues.map((issue) => (
                  <article key={issue.code} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-white">{issue.title}</h3>
                      <span className="text-xs uppercase text-amber-400">{issue.severity}</span>
                    </div>
                    <p className="mt-2 text-sm text-[#7A9AB4]">{issue.explanation}</p>
                    <p className="mt-2 text-xs text-[#4A6280]">Fix: {issue.recommendation}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-cyan/20 bg-cyan/[0.04] p-4 text-xs text-[#7A9AB4]">
              <p className="font-semibold text-cyan">Assessment limits</p>
              {data.limitations.map((limitation) => <p key={limitation} className="mt-1">{limitation}</p>)}
            </section>
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
