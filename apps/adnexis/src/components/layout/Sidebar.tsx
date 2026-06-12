'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, BookOpen, Zap, Wand2, LogOut, BookMarked, Sparkles } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Overview',    icon: LayoutDashboard },
  { href: '/vault',     label: 'Swipe Vault', icon: BookOpen },
  { href: '/analyze',   label: 'Analyze Ad',  icon: Zap },
  { href: '/generate',  label: 'Generate',    icon: Wand2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="w-60 flex-shrink-0 bg-bg-secondary border-r border-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border">
        <span className="text-xl font-display font-bold text-text-primary">
          Ad<span className="text-purple">Nexis</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
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
        {/* Upgrade CTA */}
        <Link
          href="/pricing"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-[#6C3EFF]/10 border border-[#6C3EFF]/20 text-[#9B6FFF] hover:bg-[#6C3EFF]/20 transition-all mb-2"
        >
          <Sparkles size={15} />
          Upgrade Plan
        </Link>
        <Link
          href="/guide"
          target="_blank"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all"
        >
          <BookMarked size={16} />
          How to use AdNexis
        </Link>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all w-full"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
