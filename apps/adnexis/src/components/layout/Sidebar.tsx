'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BookOpen, Zap, Wand2, LogOut, BookMarked, Sparkles, Menu, X } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Overview',    icon: LayoutDashboard },
  { href: '/vault',     label: 'Swipe Vault', icon: BookOpen },
  { href: '/analyze',   label: 'Analyze Ad',  icon: Zap },
  { href: '/generate',  label: 'Generate',    icon: Wand2 },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  async function handleSignOut() {
    await signOut({ callbackUrl: '/login' });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border flex items-center justify-between">
        <span className="text-xl font-display font-bold text-text-primary">
          Ad<span className="text-purple">Nexis</span>
        </span>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-text-secondary hover:text-text-primary p-1">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                active
                  ? 'bg-purple/20 text-purple border border-purple/30'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
              )}
            >
              <Icon size={16} className={active ? 'text-purple' : ''} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-4 border-t border-border space-y-1">
        <Link
          href="/pricing"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-[#6C3EFF]/10 border border-[#6C3EFF]/20 text-[#9B6FFF] hover:bg-[#6C3EFF]/20 transition-all mb-2"
        >
          <Sparkles size={15} />
          Upgrade Plan
        </Link>
        <Link
          href="/guide"
          target="_blank"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all"
        >
          <BookMarked size={16} />
          How to use AdNexis
        </Link>
        <button
          onClick={() => { void handleSignOut(); }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all w-full"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 bg-bg-secondary border-r border-border flex-col h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* ── Mobile: top bar with hamburger ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 h-14 bg-bg-secondary border-b border-border">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-text-secondary hover:text-text-primary p-1.5 rounded-lg hover:bg-bg-elevated transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <span className="text-[17px] font-display font-bold text-text-primary">
          Ad<span className="text-purple">Nexis</span>
        </span>
      </div>

      {/* ── Mobile: overlay backdrop ── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile: drawer ── */}
      <aside
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-bg-secondary border-r border-border flex flex-col transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent onClose={() => setMobileOpen(false)} />
      </aside>
    </>
  );
}
