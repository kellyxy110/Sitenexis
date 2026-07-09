'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { PanelLeftClose, PanelLeftOpen, X, Menu, Sun, Moon } from 'lucide-react';
import { NAV_GROUPS } from '@/components/nav-config';
import { NavItem } from '@/components/ui/NavItem';

interface SidebarProps {
  userName?: string | null | undefined;
  plan?: string | undefined;
}

const PLAN_STYLES: Record<string, string> = {
  enterprise: 'text-cyan bg-cyan/10 border border-cyan/20',
  agency:     'text-cyan bg-cyan/10 border border-cyan/20',
  pro:        'text-teal bg-teal/10 border border-teal/20',
  starter:    'text-amber bg-amber/10 border border-amber/20',
  free:       'text-[#4A6280] bg-white/5 border border-white/5',
};

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-1 py-1">
      {/* Pentagon mark */}
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <polygon
          points="12,2 22,8.5 18.5,20 5.5,20 2,8.5"
          stroke="#00C8FF"
          strokeWidth="1.5"
          fill="rgba(0,200,255,0.08)"
          strokeLinejoin="round"
        />
        <polygon
          points="12,6 18,10 15.5,17 8.5,17 6,10"
          fill="rgba(0,200,255,0.15)"
          stroke="rgba(0,200,255,0.4)"
          strokeWidth="0.75"
          strokeLinejoin="round"
        />
      </svg>
      {!collapsed && (
        <span className="font-display text-[17px] font-bold tracking-tight text-white">
          Site<span className="text-cyan">Nexis</span>
        </span>
      )}
    </Link>
  );
}

function UserFooter({
  userName,
  plan,
  collapsed,
}: {
  userName?: string | null | undefined;
  plan: string;
  collapsed: boolean;
}) {
  const initials = userName
    ? userName.split(/[\s@]/).filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  const planStyle = PLAN_STYLES[plan] ?? PLAN_STYLES.free;

  return (
    <div className={[
      'flex items-center border-t border-white/[0.06] pt-3',
      collapsed ? 'justify-center' : 'gap-3 px-1',
    ].join(' ')}>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0C2030] text-[11px] font-semibold text-cyan ring-1 ring-white/10">
        {initials}
      </div>
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white leading-none mb-1">
            {userName ?? 'Anonymous'}
          </p>
          <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${planStyle}`}>
            {planLabel}
          </span>
        </div>
      )}
    </div>
  );
}

function SidebarInner({
  collapsed,
  setCollapsed,
  userName,
  plan,
  onNavigate,
  showCollapseToggle,
}: {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  userName?: string | null | undefined;
  plan: string;
  onNavigate?: (() => void) | undefined;
  showCollapseToggle: boolean;
}) {
  return (
    <aside
      className={[
        'flex h-full flex-col border-r border-white/[0.06] bg-deepspace transition-all duration-[250ms] ease-in-out',
        collapsed ? 'w-[72px] px-3 py-5' : 'w-[260px] px-4 py-5',
      ].join(' ')}
    >
      {/* Top: logo + collapse toggle */}
      <div className={[
        'mb-6 flex items-center',
        collapsed ? 'justify-center' : 'justify-between',
      ].join(' ')}>
        <Logo collapsed={collapsed} />
        {showCollapseToggle && !collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="rounded-md p-1.5 text-[#4A6280] transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
        {showCollapseToggle && collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="mt-4 rounded-md p-1.5 text-[#4A6280] transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden scrollbar-none">
        {NAV_GROUPS.map((group) => (
          <div key={group.id}>
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-[#3A5568]">
                {group.label}
              </p>
            )}
            {collapsed && (
              <div className="mb-2 h-px bg-white/[0.04]" />
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Theme toggle + user footer */}
      <div className="mt-4 space-y-2">
        <ThemeToggle collapsed={collapsed} />
        <UserFooter userName={userName} plan={plan} collapsed={collapsed} />
      </div>
    </aside>
  );
}

function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = (localStorage.getItem('sn-theme') ?? 'dark') as 'dark' | 'light';
    setTheme(saved);
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('sn-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }

  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={[
        'flex items-center gap-2.5 rounded-lg border border-white/[0.06] py-2 text-[#7A9AB4] transition-colors hover:border-white/10 hover:bg-white/5 hover:text-white',
        collapsed ? 'justify-center w-full px-2' : 'w-full px-3',
      ].join(' ')}
    >
      {theme === 'dark'
        ? <Sun className="h-4 w-4 shrink-0" />
        : <Moon className="h-4 w-4 shrink-0" />}
      {!collapsed && (
        <span className="text-xs font-medium">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
      )}
    </button>
  );
}

export function Sidebar({ userName, plan = 'free' }: SidebarProps) {
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="fixed left-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-deepspace text-white shadow-glass-sm md:hidden"
        onClick={() => setMobileOpen((o) => !o)}
        aria-label="Toggle navigation"
      >
        {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={[
          'fixed inset-y-0 left-0 z-40 transform transition-transform duration-[250ms] ease-in-out md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <SidebarInner
          collapsed={false}
          setCollapsed={() => {}}
          userName={userName}
          plan={plan}
          onNavigate={() => setMobileOpen(false)}
          showCollapseToggle={false}
        />
      </div>

      {/* Desktop fixed sidebar */}
      <div className="hidden shrink-0 md:block" style={{ width: desktopCollapsed ? 72 : 260 }}>
        <div className="fixed top-0 h-screen" style={{ width: desktopCollapsed ? 72 : 260 }}>
          <SidebarInner
            collapsed={desktopCollapsed}
            setCollapsed={setDesktopCollapsed}
            userName={userName}
            plan={plan}
            showCollapseToggle
          />
        </div>
      </div>
    </>
  );
}
