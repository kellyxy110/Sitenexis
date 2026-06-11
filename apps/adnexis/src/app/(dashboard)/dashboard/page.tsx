import { Suspense } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAdStats } from '@sitenexis/db';
import { LayoutDashboard, Zap, TrendingUp, BookOpen } from 'lucide-react';
import Link from 'next/link';

async function Stats({ userId }: { userId: string }) {
  let stats = { totalAds: 0, analyzedAds: 0, topHookType: null as string | null, avgScore: 0 };
  try {
    stats = await getAdStats(userId);
  } catch { /* DB not reachable */ }

  const cards = [
    { label: 'Total Ads', value: stats.totalAds, icon: BookOpen, color: 'text-purple-400' },
    { label: 'Analyzed', value: stats.analyzedAds, icon: Zap, color: 'text-teal-400' },
    { label: 'Avg Score', value: stats.avgScore ? String(stats.avgScore) : '—', icon: TrendingUp, color: 'text-orange-400' },
    { label: 'Top Hook', value: stats.topHookType ?? '—', icon: LayoutDashboard, color: 'text-purple-300' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="bg-[#16162A] border border-[#2A2A4A] rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[#9090B8] text-xs font-medium uppercase tracking-wide">{label}</span>
            <Icon size={16} className={color} />
          </div>
          <p className="text-2xl font-bold text-[#F0F0FF]">{value}</p>
        </div>
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-[#16162A] border border-[#2A2A4A] rounded-xl p-5 animate-pulse">
          <div className="h-3 bg-[#1C1C30] rounded w-2/3 mb-3" />
          <div className="h-7 bg-[#1C1C30] rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  let userId = 'demo';
  try {
    const supabase = await createSupabaseServerClient();
    // getSession reads from cookie — no network call, fast
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) userId = session.user.id;
  } catch { /* dev */ }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#F0F0FF]">Overview</h1>
        <p className="text-[#9090B8] mt-1 text-sm">Your creative intelligence at a glance.</p>
      </div>

      <Suspense fallback={<StatsSkeleton />}>
        <Stats userId={userId} />
      </Suspense>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/vault" className="bg-[#16162A] border border-[#2A2A4A] hover:border-purple-500/40 rounded-xl p-5 transition-all">
          <BookOpen size={20} className="text-purple-400 mb-3" />
          <h3 className="font-semibold text-[#F0F0FF] mb-1">Swipe Vault</h3>
          <p className="text-[#9090B8] text-xs">Browse and search your saved ads</p>
        </Link>
        <Link href="/analyze" className="bg-[#16162A] border border-[#2A2A4A] hover:border-teal-500/40 rounded-xl p-5 transition-all">
          <Zap size={20} className="text-teal-400 mb-3" />
          <h3 className="font-semibold text-[#F0F0FF] mb-1">Analyze Ad</h3>
          <p className="text-[#9090B8] text-xs">Get full AI intelligence on any ad</p>
        </Link>
        <Link href="/generate" className="bg-[#16162A] border border-[#2A2A4A] hover:border-orange-500/40 rounded-xl p-5 transition-all">
          <TrendingUp size={20} className="text-orange-400 mb-3" />
          <h3 className="font-semibold text-[#F0F0FF] mb-1">Generate</h3>
          <p className="text-[#9090B8] text-xs">Create platform-specific variations</p>
        </Link>
      </div>
    </div>
  );
}
