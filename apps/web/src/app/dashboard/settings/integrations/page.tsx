'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useRouter } from 'next/navigation';
import { Puzzle, Bell, Search, Zap, Globe, ArrowRight } from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  connected: boolean;
  badge?: string;
  action?: string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Receive audit completion alerts and critical issue notifications in your Slack workspace.',
    icon: Bell,
    connected: false,
    action: 'Connect Slack',
  },
  {
    id: 'google-search-console',
    name: 'Google Search Console',
    description: 'Correlate AI visibility scores with GSC performance data — impressions, clicks, and ranking trends.',
    icon: Search,
    connected: false,
    action: 'Connect GSC',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Trigger Zaps when audits complete or new critical issues are detected. Connect to 5,000+ apps.',
    icon: Zap,
    connected: false,
    badge: 'Coming Soon',
  },
  {
    id: 'webhook',
    name: 'Webhooks',
    description: 'Send audit events to any endpoint — audit.completed, issue.critical, score.changed.',
    icon: Globe,
    connected: false,
    badge: 'Agency+',
    action: 'Configure',
  },
];

export default function IntegrationsPage() {
  const router = useRouter();

  return (
    <DashboardLayout>
      <TopCommandBar onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)} />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">

        <div className="mb-6">
          <div className="mb-1 flex items-center gap-2">
            <Puzzle className="h-5 w-5 text-cyan" />
            <h1 className="text-xl font-bold text-white">Integrations</h1>
          </div>
          <p className="text-sm text-[#4A6280]">Connect SiteNexis to your existing tools and workflows</p>
        </div>

        <div className="space-y-3">
          {INTEGRATIONS.map((integration) => {
            const Icon = integration.icon;
            const isComingSoon = integration.badge === 'Coming Soon';
            return (
              <div key={integration.id} className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
                  <Icon className="h-5 w-5 text-[#4A6280]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{integration.name}</span>
                    {integration.badge && (
                      <span className={`rounded-pill border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        isComingSoon
                          ? 'border-amber/20 bg-amber/10 text-amber'
                          : 'border-purple/25 bg-purple/10 text-purple'
                      }`}>
                        {integration.badge}
                      </span>
                    )}
                    {integration.connected && (
                      <span className="rounded-pill border border-teal/20 bg-teal/10 px-2 py-0.5 text-[10px] font-semibold text-teal">Connected</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[#4A6280]">{integration.description}</p>
                </div>
                {!isComingSoon && integration.action && (
                  <button
                    className="shrink-0 flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-[#7A9AB4] hover:text-white hover:border-white/[0.15] transition-colors"
                    onClick={() => {
                      /* Integration setup flows will be wired here */
                    }}
                  >
                    {integration.action} <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="mb-2 text-sm font-semibold text-[#C8DFE8]">Webhook Events</h2>
          <p className="mb-3 text-xs text-[#4A6280]">Available on Agency and Enterprise plans — send audit events to any endpoint.</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {[
              'audit.queued', 'audit.started', 'audit.completed', 'audit.failed',
              'score.changed', 'issue.critical', 'issue.warning', 'report.generated',
            ].map((event) => (
              <div key={event} className="flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-1.5">
                <code className="text-xs font-mono text-cyan">{event}</code>
              </div>
            ))}
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}
