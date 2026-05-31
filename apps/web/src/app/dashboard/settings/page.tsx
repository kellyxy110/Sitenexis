'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Settings, CreditCard, Key, Users, Puzzle, ArrowRight } from 'lucide-react';

const SETTINGS_SECTIONS = [
  {
    href: '/dashboard/settings/billing',
    icon: CreditCard,
    title: 'Billing',
    desc: 'Manage your subscription plan, view invoices, update payment method',
  },
  {
    href: '/dashboard/settings/api-keys',
    icon: Key,
    title: 'API Keys',
    desc: 'Generate and manage API keys for programmatic access (Agency+)',
  },
  {
    href: '/dashboard/settings/team',
    icon: Users,
    title: 'Team',
    desc: 'Invite teammates, assign roles, manage access (Agency+)',
  },
  {
    href: '/dashboard/settings/integrations',
    icon: Puzzle,
    title: 'Integrations',
    desc: 'Connect Slack, Google Search Console, Zapier, and custom webhooks',
  },
];

export default function SettingsPage() {
  const router = useRouter();
  return (
    <DashboardLayout>
      <TopCommandBar onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)} />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">
        <div className="mb-6">
          <div className="mb-1 flex items-center gap-2">
            <Settings className="h-5 w-5 text-cyan" />
            <h1 className="text-xl font-bold text-white">Settings</h1>
          </div>
          <p className="text-sm text-[#4A6280]">Manage your account, team, integrations, and billing</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {SETTINGS_SECTIONS.map(({ href, icon: Icon, title, desc }) => (
            <Link key={href} href={href} className="group flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:border-white/[0.12] hover:bg-white/[0.04]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
                <Icon className="h-5 w-5 text-[#4A6280] group-hover:text-cyan transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white">{title}</div>
                <div className="mt-0.5 text-xs text-[#4A6280]">{desc}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-[#334155] group-hover:text-[#7A9AB4] transition-colors" />
            </Link>
          ))}
        </div>
      </main>
    </DashboardLayout>
  );
}
