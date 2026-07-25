'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useAuditSubReport, useLatestAudit, useMe } from '@/lib/use-audit-data';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import type { MachineTrustSecurityReport } from '@sitenexis/shared';

function color(score: number) { return score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400'; }

export default function MachineTrustSecurityPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { audit, isLoading: auditLoading } = useLatestAudit();
  const { data, isLoading } = useAuditSubReport<MachineTrustSecurityReport>(audit?.id ?? null, 'machine-trust-security');
  const loading = auditLoading || isLoading;
  return <DashboardLayout><TopCommandBar onRunAudit={(domain) => router.push(`/audit/${encodeURIComponent(domain)}`)} userName={me?.email?.split('@')[0] ?? null} plan={me?.plan} /><main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8"><div className="mb-6 flex items-start justify-between gap-4"><div><div className="mb-1 flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-cyan" /><h1 className="text-xl font-bold text-white">Machine Trust and AI Security</h1></div><p className="text-sm text-[#4A6280]">Deterministic checks for prompt injection, hidden instructions, data leakage signals, and machine resource coverage.</p></div>{data?.overallScore !== null && data?.overallScore !== undefined && <div className={`text-4xl font-bold ${color(data.overallScore)}`}>{data.overallScore}<span className="text-sm text-[#4A6280]"> / 100</span></div>}</div>{loading && <div className="h-32 animate-pulse rounded-xl bg-white/[0.03]" />}{!loading && !data && <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-[#4A6280]">Run an audit to generate Machine Trust security evidence.</div>}{data && <div className="space-y-6"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(data.scoreBreakdown).map(([key, value]) => <div key={key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"><p className="text-xs text-[#4A6280]">{key.replace(/[A-Z]/g, (letter) => ` ${letter}`).trim()}</p><p className={`mt-2 text-2xl font-bold ${value === null ? 'text-[#4A6280]' : color(value)}`}>{value === null ? 'Not assessed' : value}</p></div>)}</div><section><h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">Evidence-linked findings ({data.findings.length})</h2><div className="space-y-2">{data.findings.map((finding) => <article key={finding.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-white">{finding.title}</h3><span className="text-xs uppercase text-amber-400">{finding.severity}</span></div><p className="mt-2 text-sm text-[#7A9AB4]">{finding.explanation}</p><p className="mt-2 text-xs text-[#4A6280]">Fix: {finding.recommendation} Confidence: {Math.round(finding.confidence * 100)}%</p></article>)}</div></section><section className="rounded-xl border border-cyan/20 bg-cyan/[0.04] p-4 text-xs text-[#7A9AB4]"><p className="font-semibold text-cyan">Scanner limits</p>{data.limitations.map((limitation) => <p key={limitation} className="mt-1">{limitation}</p>)}</section></div>}</main></DashboardLayout>;
}
