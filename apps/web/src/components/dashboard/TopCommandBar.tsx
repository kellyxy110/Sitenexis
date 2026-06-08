'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Play, Bell, ChevronDown, User, CreditCard, LogOut, Settings, Zap } from 'lucide-react';
import Link from 'next/link';

interface TopCommandBarProps {
  onRunAudit: (domain: string) => void;
  isAuditing?: boolean | undefined;
  userName?: string | null | undefined;
  plan?: string | undefined;
  notificationCount?: number | undefined;
  creditBalance?: number | undefined;
  isUnlimited?: boolean | undefined;
}

function UserMenu({ userName, plan }: { userName?: string | null | undefined; plan?: string | undefined }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = userName
    ? userName.split(/[\s@]/).filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/[0.06]"
      >
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0C2030] text-[10px] font-semibold text-cyan">
          {initials}
        </div>
        <span className="hidden max-w-[120px] truncate text-sm font-medium sm:block">
          {userName ?? 'Account'}
        </span>
        <ChevronDown className={['h-3.5 w-3.5 text-[#4A6280] transition-transform duration-150', open ? 'rotate-180' : ''].join(' ')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-white/[0.08] bg-surface-dark shadow-glass-md">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <p className="text-sm font-medium text-white truncate">{userName ?? 'Anonymous'}</p>
            {plan && (
              <p className="text-xs text-[#4A6280] capitalize mt-0.5">{plan} plan</p>
            )}
          </div>
          <div className="py-1.5">
            {([
              { icon: User, label: 'Profile', href: '/dashboard/settings' },
              { icon: CreditCard, label: 'Billing', href: '/dashboard/settings/billing' },
              { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
            ] as Array<{ icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string; href: string }>).map(({ icon: Icon, label, href }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-[#6B8FA3] transition-colors hover:bg-white/[0.04] hover:text-white"
              >
                <Icon className="h-4 w-4" strokeWidth={1.6} />
                {label}
              </Link>
            ))}
          </div>
          <div className="border-t border-white/[0.06] py-1.5">
            <Link
              href="/auth/signout"
              className="flex items-center gap-3 px-4 py-2 text-sm text-red-400/70 transition-colors hover:bg-red-500/[0.06] hover:text-red-400"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.6} />
              Sign out
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function TopCommandBar({
  onRunAudit,
  isAuditing,
  userName,
  plan,
  notificationCount = 0,
  creditBalance,
  isUnlimited = false,
}: TopCommandBarProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const domain = inputValue.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!domain) return;
    onRunAudit(domain);
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-white/[0.06] bg-deepspace/90 pl-14 pr-4 md:px-6 backdrop-blur-xl">
      {/* Domain search */}
      <form
        onSubmit={handleSubmit}
        className="input-glass flex flex-1 max-w-lg items-center gap-2 rounded-lg px-3 py-1.5"
      >
        <Search className="h-4 w-4 shrink-0 text-[#4A6280]" strokeWidth={1.6} />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter domain to audit — e.g. example.com"
          className="flex-1 bg-transparent text-sm text-white placeholder-[#3A5568] outline-none"
          disabled={isAuditing}
          autoComplete="off"
          spellCheck={false}
        />
      </form>

      {/* Run audit CTA */}
      <button
        onClick={handleSubmit}
        disabled={isAuditing || !inputValue.trim()}
        className={[
          'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200',
          isAuditing || !inputValue.trim()
            ? 'cursor-not-allowed bg-white/5 text-[#3A5568]'
            : 'bg-cyan text-[#030907] hover:bg-cyan/90 hover:shadow-[0_0_20px_rgba(0,200,255,0.25)]',
        ].join(' ')}
      >
        {isAuditing ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span className="hidden sm:inline">Auditing...</span>
          </>
        ) : (
          <>
            <Play className="h-3.5 w-3.5 fill-current" />
            <span className="hidden sm:inline">Run Audit</span>
          </>
        )}
      </button>

      <div className="flex items-center gap-2">
        {/* Credits badge — hidden on mobile (accessible via dashboard credit widget) */}
        {(creditBalance !== undefined || isUnlimited) && (
          <Link
            href="/dashboard/settings/billing"
            className={[
              'hidden md:flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors',
              isUnlimited
                ? 'border-cyan/20 bg-cyan/5 text-cyan hover:bg-cyan/10'
                : (creditBalance ?? 0) <= 2
                ? 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/15'
                : (creditBalance ?? 0) <= 5
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15'
                : 'border-white/[0.06] bg-white/[0.03] text-[#4A6280] hover:text-white',
            ].join(' ')}
          >
            <Zap className="h-3 w-3" strokeWidth={2} />
            {isUnlimited ? '∞' : (creditBalance ?? 0)}
            <span className="hidden sm:inline text-[10px] opacity-70">credits</span>
          </Link>
        )}

        {/* Notifications */}
        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[#4A6280] transition-colors hover:bg-white/5 hover:text-white">
          <Bell className="h-4 w-4" strokeWidth={1.6} />
          {notificationCount > 0 && (
            <span className="absolute right-1 top-1 flex h-2 w-2 items-center justify-center rounded-full bg-cyan text-[8px] font-bold text-[#030907]" />
          )}
        </button>

        {/* User menu */}
        <UserMenu userName={userName} plan={plan} />
      </div>
    </header>
  );
}
