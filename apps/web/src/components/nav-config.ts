import {
  LayoutDashboard,
  Eye,
  Brain,
  Network,
  ScanSearch,
  Quote,
  ShieldCheck,
  Zap,
  Globe,
  History,
  Layers,
  GitFork,
  BarChart3,
  AlertTriangle,
  FileText,
  FileJson,
  Key,
  CreditCard,
  Users,
  Puzzle,
  Activity,
  Search,
  FolderKanban,
  ListChecks,
  type LucideIcon,
} from 'lucide-react';

// Layers is already imported above — used for SII

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  matchExact?: boolean;
  permission?: 'layer4Analysis' | 'competitiveAnalysis' | 'apiAccess' | 'bulkDomains';
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        matchExact: true,
      },
      {
        id: 'health',
        label: 'SiteNexis Health',
        href: '/dashboard/health',
        icon: Activity,
        badge: 'LIVE',
      },
      {
        id: 'ai-overview',
        label: 'AI Visibility Overview',
        href: '/dashboard/overview',
        icon: Eye,
      },
      {
        id: 'sii',
        label: 'Intelligence Index',
        href: '/dashboard/sii',
        icon: Layers,
        badge: 'SII',
      },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    items: [
      { id: 'ai-visibility',  label: 'AI Visibility',        href: '/dashboard/ai-visibility',  icon: Brain },
      { id: 'entity',         label: 'Entity Intelligence',   href: '/dashboard/entity',          icon: Network },
      { id: 'retrieval',      label: 'Retrieval Optimization',href: '/dashboard/retrieval',       icon: ScanSearch },
      { id: 'citation',       label: 'Citation Probability',  href: '/dashboard/citation',        icon: Quote },
      { id: 'semantic-trust', label: 'Semantic Trust',        href: '/dashboard/semantic-trust',  icon: ShieldCheck },
    ],
  },
  {
    id: 'analysis',
    label: 'Analysis',
    items: [
      { id: 'audits',       label: 'Audits',         href: '/dashboard/audits',          icon: Zap },
      { id: 'live-audit',   label: 'Live Audit',     href: '/dashboard/audits/live',     icon: Globe },
      { id: 'audit-history',label: 'Audit History',  href: '/dashboard/audits/history',  icon: History },
      { id: 'portfolio',    label: 'Portfolio',       href: '/dashboard/portfolio',       icon: FolderKanban },
      { id: 'query-test',   label: 'Query Simulation', href: '/dashboard/query-test',    icon: Search },
      {
        id: 'bulk-audits',
        label: 'Bulk Audits',
        href: '/dashboard/audits/bulk',
        icon: Layers,
        permission: 'bulkDomains',
      },
    ],
  },
  {
    id: 'systems',
    label: 'Systems',
    items: [
      { id: 'perception-graph', label: 'Perception Graph',     href: '/dashboard/perception-graph', icon: GitFork },
      {
        id: 'competitive',
        label: 'Competitive Analysis',
        href: '/dashboard/competitive',
        icon: BarChart3,
        permission: 'competitiveAnalysis',
      },
      { id: 'schema',  label: 'Schema Generator', href: '/dashboard/schema',  icon: FileJson },
      { id: 'fix-plan', label: 'Fix Plan',         href: '/dashboard/fix-plan', icon: ListChecks, badge: 'NEW' },
      { id: 'issues',  label: 'Issues Center',   href: '/dashboard/issues',  icon: AlertTriangle },
      { id: 'reports', label: 'Reports',          href: '/dashboard/reports', icon: FileText },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [
      {
        id: 'api-keys',
        label: 'API Keys',
        href: '/dashboard/settings/api-keys',
        icon: Key,
        permission: 'apiAccess',
      },
      { id: 'billing',      label: 'Billing',      href: '/dashboard/settings/billing',      icon: CreditCard },
      { id: 'team',         label: 'Team',          href: '/dashboard/settings/team',         icon: Users },
      { id: 'integrations', label: 'Integrations',  href: '/dashboard/settings/integrations', icon: Puzzle },
    ],
  },
];

export function getActiveNavItem(pathname: string): NavItem | null {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      const active = item.matchExact
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(item.href + '/');
      if (active) return item;
    }
  }
  return null;
}
