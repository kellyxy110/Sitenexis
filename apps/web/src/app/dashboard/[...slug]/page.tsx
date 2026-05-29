'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useRouter } from 'next/navigation';
import {
  Construction, ArrowLeft, Brain, Network, ScanSearch, Quote,
  ShieldCheck, GitFork, BarChart3, AlertTriangle, FileText,
  Key, CreditCard, Users, Puzzle, Globe, Layers, History,
  Settings, Zap,
} from 'lucide-react';

// ── Route metadata map ────────────────────────────────────────────────────────

const ROUTE_META: Record<string, {
  title: string;
  description: string;
  icon: React.ElementType;
  badge?: string;
  group: string;
}> = {
  'overview': {
    title: 'AI Visibility Overview',
    description: 'A consolidated view of your AI visibility score across all intelligence layers — retrieval readiness, entity confidence, citation probability, and semantic trust in one panel.',
    icon: Brain,
    group: 'Intelligence',
  },
  'ai-visibility': {
    title: 'AI Visibility',
    description: 'Per-page and site-wide AI visibility scoring. See exactly how AI systems extract, interpret, and rank your content — with sub-score breakdowns for every metric.',
    icon: Brain,
    group: 'Intelligence',
  },
  'entity': {
    title: 'Entity Intelligence',
    description: 'Every named entity detected across your domain — scored for consistency, disambiguation, external validation depth, and AI Perception Graph position.',
    icon: Network,
    group: 'Intelligence',
  },
  'retrieval': {
    title: 'Retrieval Optimization',
    description: 'Simulation of how AI retrieval systems extract and rank your content. Identifies chunk boundary issues, summarisation loss, and context truncation zones.',
    icon: ScanSearch,
    badge: 'Layer 4',
    group: 'Intelligence',
  },
  'citation': {
    title: 'Citation Probability',
    description: 'Models the likelihood that AI systems select your content as a citation source. Factual density, claim specificity, and authority signal analysis per page.',
    icon: Quote,
    group: 'Intelligence',
  },
  'semantic-trust': {
    title: 'Semantic Trust',
    description: 'Authorship trust, organisational trust, content trust, and structural trust — with Claude-powered contradiction detection across your top pages.',
    icon: ShieldCheck,
    group: 'Intelligence',
  },
  'audits': {
    title: 'Audits',
    description: 'Browse and manage all your audit jobs. Filter by domain, status, score range, or date. Bulk re-run, export, or delete.',
    icon: Zap,
    group: 'Analysis',
  },
  'audits/live': {
    title: 'Live Audit',
    description: 'Watch a real-time audit in progress. See each of the 16 intelligence agents complete their work as it happens — with live issue detection and score updates.',
    icon: Globe,
    group: 'Analysis',
  },
  'audits/history': {
    title: 'Audit History',
    description: 'Full audit history with score trend charts. Compare any two audits side-by-side, track improvements over time, and export historical data.',
    icon: History,
    group: 'Analysis',
  },
  'audits/bulk': {
    title: 'Bulk Audits',
    description: 'Upload a CSV of domains and run audits across your entire portfolio in one job. View aggregated scores, rank domains, and export comparative reports.',
    icon: Layers,
    badge: 'Agency+',
    group: 'Analysis',
  },
  'perception-graph': {
    title: 'Perception Graph',
    description: 'The AI Perception Graph — a force-directed map of how AI systems model your content. Nodes are entities, topics, and claims. Edges are semantic relationships.',
    icon: GitFork,
    group: 'Systems',
  },
  'competitive': {
    title: 'Competitive Analysis',
    description: 'Compare your AI visibility scores against up to 5 competitor domains. Entity coverage gaps, citation pathway comparison, and recommendation likelihood ranking.',
    icon: BarChart3,
    badge: 'Pro+',
    group: 'Systems',
  },
  'issues': {
    title: 'Issues Center',
    description: 'Every issue detected across all your audits — filterable by severity, module, domain, and date. Prioritised by estimated score impact. Bulk dismiss or export.',
    icon: AlertTriangle,
    group: 'Systems',
  },
  'reports': {
    title: 'Reports',
    description: 'Download enterprise PDF reports for any completed audit. Dark cover page, full score breakdown, issue inventory, and executive summary. White-label available on Agency+.',
    icon: FileText,
    group: 'Systems',
  },
  'settings': {
    title: 'Settings',
    description: 'Manage your account, team, integrations, and billing from one place.',
    icon: Settings,
    group: 'Settings',
  },
  'settings/api-keys': {
    title: 'API Keys',
    description: 'Generate and manage API keys for programmatic access to SiteNexis. Set key permissions, rate limits, and expiry dates. Available on Agency and Enterprise plans.',
    icon: Key,
    badge: 'Agency+',
    group: 'Settings',
  },
  'settings/billing': {
    title: 'Billing',
    description: 'Manage your subscription plan, view invoices, update payment methods, and access the Stripe customer portal.',
    icon: CreditCard,
    group: 'Settings',
  },
  'settings/team': {
    title: 'Team',
    description: 'Invite teammates, assign roles (Admin, Editor, Viewer), and manage access to specific domains and audit results.',
    icon: Users,
    group: 'Settings',
  },
  'settings/integrations': {
    title: 'Integrations',
    description: 'Connect SiteNexis to Slack, Zapier, Google Search Console, and more. Set up automated audit triggers and issue alert webhooks.',
    icon: Puzzle,
    group: 'Settings',
  },
};

// ── Roadmap feature cards ─────────────────────────────────────────────────────

const UPCOMING = [
  { label: 'Per-page entity map', tag: 'Entity Intelligence' },
  { label: 'Score trend charts',  tag: 'Audit History' },
  { label: 'Competitive ranking', tag: 'Competitive Analysis' },
  { label: 'Bulk CSV upload',     tag: 'Bulk Audits' },
  { label: 'PDF white-label',     tag: 'Reports' },
  { label: 'Slack notifications', tag: 'Integrations' },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function StubPage() {
  const params  = useParams();
  const router  = useRouter();
  const slugArr = Array.isArray(params.slug) ? params.slug : [params.slug ?? ''];
  const slug    = slugArr.join('/');
  const meta    = ROUTE_META[slug];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = (meta?.icon ?? Construction) as React.ComponentType<any>;

  const handleAudit = (domain: string) => {
    router.push(`/audit/${encodeURIComponent(domain)}`);
  };

  return (
    <DashboardLayout>
      <TopCommandBar onRunAudit={handleAudit} />

      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-8 flex items-center gap-2 text-sm text-[#475569]">
          <Link href="/dashboard" className="flex items-center gap-1.5 hover:text-[#94A3B8] transition-colors">
            <ArrowLeft size={14} />
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-[#94A3B8]">{meta?.title ?? slug}</span>
        </div>

        {/* Feature hero */}
        <div className="mb-10 flex flex-col gap-6 rounded-card border border-white/[0.06] bg-deepspace p-8">
          <div className="flex items-start gap-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
              <Icon className="h-6 w-6 text-cyan" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] font-bold tracking-tight text-white">
                  {meta?.title ?? `/${slug}`}
                </h1>
                {meta?.badge && (
                  <span className="rounded-pill border border-purple/25 bg-purple/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple">
                    {meta.badge}
                  </span>
                )}
                <span className="rounded-pill border border-amber/20 bg-amber/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber">
                  Coming soon
                </span>
              </div>
              <p className="text-[15px] leading-[1.7] text-[#64748B]">
                {meta?.description ?? 'This section is under active development.'}
              </p>
            </div>
          </div>

          {/* CTA row */}
          <div className="flex items-center gap-4 border-t border-white/[0.05] pt-6">
            <Link
              href="/dashboard"
              className="btn-ghost inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
            >
              <ArrowLeft size={14} />
              Back to dashboard
            </Link>
            <Link
              href="/"
              className="text-sm text-[#475569] hover:text-[#94A3B8] transition-colors"
            >
              View all features →
            </Link>
          </div>
        </div>

        {/* What this module will do */}
        {meta && (
          <section className="mb-10">
            <h2 className="mb-5 text-[13px] font-semibold uppercase tracking-widest text-[#334155]">
              Roadmap highlights
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {UPCOMING.filter((f) => f.tag === meta.title || UPCOMING.indexOf(f) < 6).map((f) => (
                <div
                  key={f.label}
                  className="flex items-center gap-3 rounded-button border border-white/[0.05] bg-white/[0.02] px-4 py-3"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan/50" />
                  <span className="text-[13px] text-[#64748B]">{f.label}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Other available modules */}
        <section>
          <h2 className="mb-5 text-[13px] font-semibold uppercase tracking-widest text-[#334155]">
            Available now
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'Run a full audit',      href: '/dashboard',                     desc: 'Start with the main dashboard' },
              { label: 'View audit results',    href: '/audit/example.com',             desc: 'See the full 10-tab report' },
              { label: 'Check AI visibility',   href: '/dashboard',                     desc: 'Intelligence Hero scores' },
              { label: 'Explore entity graph',  href: '/audit/example.com#links',       desc: 'Force-directed link graph' },
              { label: 'Review critical issues',href: '/dashboard',                     desc: 'Issues in activity feed' },
              { label: 'Upgrade your plan',     href: '/#pricing',                      desc: 'Unlock Layer 4 features' },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group flex flex-col gap-1 rounded-button border border-white/[0.05] bg-white/[0.02] px-4 py-3 transition-all duration-200 hover:border-cyan/20 hover:bg-deepspace"
              >
                <span className="text-[13px] font-medium text-[#94A3B8] group-hover:text-white transition-colors">{item.label}</span>
                <span className="text-[11px] text-[#334155]">{item.desc}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </DashboardLayout>
  );
}
