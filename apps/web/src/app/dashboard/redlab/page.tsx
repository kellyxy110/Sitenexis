'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useAuditSubReport, useLatestAudit, useMe } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { Crosshair } from 'lucide-react';
import type { RedLabReport } from '@sitenexis/shared';

function color(score: number) { return score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400'; }

export default function RedLabPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { audit, isLoading: auditLoading } = useLatestAudit();
  const { data, isLoading } = useAuditSubReport<RedLabReport>(audit?.id ?? null, 'redlab');
  const loading = auditLoading || isLoading;

  return (
    <DashboardLayout>
      <TopCommandBar onRunAudit={(domain) => router.push(`/audit/${encodeURIComponent(domain)}`)} userName={me?.email?.split('@')[0] ?? null} plan={me?.plan} />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Crosshair className="h-5 w-5 text-cyan" />
              <h1 className="text-xl font-bold text-white">RedLab</h1>
            </div>
            <p className="text-sm text-[#4A6280]">Passive, read-only attack-surface recon: exposed sensitive paths and outdated JS libraries with known CVEs.</p>
          </div>
          {data && <div className={`text-4xl font-bold ${color(data.overallScore)}`}>{data.overallScore}<span className="text-sm text-[#4A6280]"> / 100</span></div>}
        </div>

        {loading && <div className="h-32 animate-pulse rounded-xl bg-white/[0.03]" />}
        {!loading && !data && <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-[#4A6280]">Run a Layer 4 audit to generate a RedLab report.</div>}

        {data && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-xs text-[#4A6280]">Exposed path freedom</p>
                <p className={`mt-2 text-2xl font-bold ${color(data.scoreBreakdown.exposedPathFreedom)}`}>{data.scoreBreakdown.exposedPathFreedom}</p>
                <p className="mt-1 text-xs text-[#4A6280]">{data.pathsChecked} paths checked</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-xs text-[#4A6280]">Library freshness</p>
                <p className={`mt-2 text-2xl font-bold ${data.scoreBreakdown.libraryFreshness === null ? 'text-[#4A6280]' : color(data.scoreBreakdown.libraryFreshness)}`}>{data.scoreBreakdown.libraryFreshness === null ? 'Not detected' : data.scoreBreakdown.libraryFreshness}</p>
              </div>
            </div>

            {data.exposedPaths.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">Exposed paths ({data.exposedPaths.length})</h2>
                <div className="space-y-2">
                  {data.exposedPaths.map((p) => (
                    <div key={p.path} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <code className="text-sm text-white">{p.path}</code>
                        <span className="text-xs uppercase text-amber-400">{p.severity}</span>
                      </div>
                      <p className="mt-2 text-sm text-[#7A9AB4]">{p.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {data.vulnerableLibraries.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">Outdated libraries ({data.vulnerableLibraries.length})</h2>
                <div className="space-y-2">
                  {data.vulnerableLibraries.map((lib) => (
                    <div key={`${lib.library}-${lib.scriptSource}`} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-white">{lib.library} {lib.detectedVersion}</span>
                        <span className="text-xs uppercase text-amber-400">{lib.severity}</span>
                      </div>
                      <p className="mt-2 text-xs text-[#4A6280]">{lib.cveReferences.join(', ')} — upgrade to {lib.knownVulnerableBelow}+</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

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
