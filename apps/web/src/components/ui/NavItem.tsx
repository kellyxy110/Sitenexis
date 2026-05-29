'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem as NavItemType } from '@/components/nav-config';

interface NavItemProps {
  item: NavItemType;
  collapsed: boolean;
  onNavigate?: (() => void) | undefined;
}

export function NavItem({ item, collapsed, onNavigate }: NavItemProps) {
  const pathname = usePathname();
  const isActive = item.matchExact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + '/');

  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      {...(onNavigate ? { onClick: onNavigate } : {})}
      className={[
        'group relative flex items-center gap-3 rounded-lg transition-all duration-200',
        collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5',
        isActive
          ? 'bg-white/[0.07] text-white'
          : 'text-[#6B8FA3] hover:bg-white/[0.04] hover:text-[#C8DFE8]',
      ].join(' ')}
    >
      {/* Active left accent */}
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-cyan" />
      )}

      <Icon
        className={[
          'h-[18px] w-[18px] shrink-0 transition-colors duration-200',
          isActive ? 'text-cyan' : 'text-current opacity-80',
        ].join(' ')}
        strokeWidth={1.6}
      />

      {!collapsed && (
        <span className="flex-1 truncate text-sm font-medium leading-none">
          {item.label}
        </span>
      )}

      {!collapsed && item.badge && (
        <span className="rounded-full bg-cyan/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan">
          {item.badge}
        </span>
      )}

      {/* Collapsed tooltip */}
      {collapsed && (
        <span
          className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-md border border-white/10 bg-[#081410] px-2.5 py-1.5 text-xs font-medium text-white shadow-glass-md opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          role="tooltip"
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}
