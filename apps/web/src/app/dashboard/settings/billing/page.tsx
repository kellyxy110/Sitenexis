'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Check, ArrowRight, Loader2, ExternalLink, Zap, Clock } from 'lucide-react';
import { CREDIT_PACKS, CREDIT_ACTION_LABELS, type CreditAction } from '@/lib/credits-config';

interface MeData {
  id: string;
  email: string;
  plan: 'free' | 'starter' | 'pro' | 'agency' | 'enterprise';
  isDemo: boolean;
  creditBalance: number;
  isUnlimited: boolean;
}

interface TxRecord {
  id: string;
  type: string;
  amount: number;
  actionType: string;
  description: string | null;
  createdAt: string;
}

const PLAN_DETAILS: Record<string, { label: string; price: string; features: string[] }> = {
  free:       { label: 'Free',       price: '$0/mo',   features: ['10 starter credits', 'Layers 1–3 only', 'No API access'] },
  starter:    { label: 'Starter',    price: '$29/mo',  features: ['50 credits/month', 'Layers 1–3', 'Email support'] },
  pro:        { label: 'Pro',        price: '$99/mo',  features: ['150 credits/month', 'Layer 4 (Machine Trust)', 'Competitive analysis'] },
  agency:     { label: 'Agency',     price: '$249/mo', features: ['500 credits/month', 'Layer 4 + API access', 'Bulk domains', 'Priority support'] },
  enterprise: { label: 'Enterprise', price: 'Custom',  features: ['Unlimited credits', 'White-label reports', 'Dedicated support', 'SLA'] },
};

const CREDIT_COST_TABLE: { action: string; label: string; cost: number }[] = [
  { action: 'ai_visibility_audit',  label: 'AI Visibility Audit',  cost: 2  },
  { action: 'ai_swarm_audit',       label: 'AI Swarm Audit',       cost: 5  },
  { action: 'competitor_analysis',  label: 'Competitor Analysis',  cost: 2  },
  { action: 'fix_generation',       label: 'Fix Generation',       cost: 1  },
  { action: 'ai_search_simulation', label: 'AI Search Simulation', cost: 3  },
  { action: 'video_report',         label: 'Video Report',         cost: 10 },
];

function scoreBar(pct: number, color: string) {
  return (
    <div className="h-1.5 w-full rounded-full bg-white/[0.06]">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
    </div>
  );
}

export default function BillingPage() {
  const router = useRouter();

  const { data: me, isLoading } = useQuery<MeData>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/me').then((r) => r.json() as Promise<MeData>),
    staleTime: 60_000,
  });

  const { data: history } = useQuery<TxRecord[]>({
    queryKey: ['credit-history'],
    queryFn: async () => {
      const r = await fetch('/api/credits/history');
      if (!r.ok) return [];
      return r.json() as Promise<TxRecord[]>;
    },
    enabled: !!(me && !me.isDemo),
    staleTime: 30_000,
  });

  const currentPlan = me?.plan ?? 'free';
  const planDetail  = PLAN_DETAILS[currentPlan];
  const balance     = me?.creditBalance ?? 0;
  const unlimited   = me?.isUnlimited ?? false;

  // Credit bar fill — cap display at 200 for visual purposes
  const balancePct  = unlimited ? 100 : Math.min(100, (balance / 200) * 100);
  const balanceColor = unlimited ? '#0BCEBC' : balance > 20 ? '#0BCEBC' : balance > 5 ? '#F59E0B' : '#EF4444';

  const handlePortal = async () => {
    const res = await fetch('/api/billing/portal', { method: 'POST' });
    if (res.ok) {
      const { url } = await res.json() as { url: string };
      window.location.href = url;
    }
  };

  const handleBuyCredits = async (packId: string) => {
    if (me?.isDemo) { router.push('/#pricing'); return; }
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: packId }),
    });
    if (res.ok) {
      const { url } = await res.json() as { url: string };
      window.location.href = url;
    }
  };

  return (
    <DashboardLayout>
      <TopCommandBar onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)} />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">

        <div className="mb-6">
          <div className="mb-1 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-cyan" />
            <h1 className="text-xl font-bold text-white">Billing & Credits</h1>
          </div>
          <p className="text-sm text-[#4A6280]">Manage your credit wallet and subscription</p>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-[#4A6280]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {me && (
          <div className="space-y-6">

            {/* ── Credit Wallet ──────────────────────────────────────────── */}
            <div className="rounded-xl border border-cyan/[0.15] bg-cyan/[0.03] p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-cyan" />
                  <h2 className="text-sm font-semibold text-[#C8DFE8]">Credit Wallet</h2>
                </div>
                {me.isDemo && <span className="text-xs text-amber">Demo mode</span>}
              </div>

              <div className="mb-4 flex items-end gap-3">
                <div className="text-5xl font-bold tabular-nums text-white">
                  {unlimited ? '∞' : balance}
                </div>
                <div className="mb-1">
                  <p className="text-sm font-medium text-[#7A9AB4]">credits available</p>
                  {unlimited && <p className="text-xs text-teal">Unlimited access — owner account</p>}
                </div>
              </div>

              {!unlimited && scoreBar(balancePct, balanceColor)}

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CREDIT_COST_TABLE.slice(0, 4).map((item) => (
                  <div key={item.action} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <p className="text-[10px] text-[#4A6280]">{item.label}</p>
                    <p className="mt-0.5 text-sm font-bold text-white">{item.cost}cr</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Buy Credit Packs ───────────────────────────────────────── */}
            {!unlimited && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">Buy Credits</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {CREDIT_PACKS.map((pack) => (
                    <div
                      key={pack.id}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 flex flex-col justify-between hover:border-white/[0.12] transition-colors"
                    >
                      <div>
                        <p className="text-sm font-bold text-white">{pack.label}</p>
                        <p className="mt-1 text-2xl font-bold text-white">{pack.credits}<span className="text-sm font-normal text-[#4A6280]"> cr</span></p>
                        <p className="mt-0.5 text-[11px] text-[#4A6280]">${pack.perCredit.toFixed(2)} / credit</p>
                      </div>
                      <button
                        onClick={() => handleBuyCredits(pack.id)}
                        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-cyan/10 border border-cyan/20 px-3 py-2 text-xs font-bold text-cyan hover:bg-cyan/20 transition-colors"
                      >
                        ${pack.price} <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Credit History ─────────────────────────────────────────── */}
            {history && history.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-[#C8DFE8]">Recent Transactions</h2>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                  {history.slice(0, 10).map((tx) => {
                    const isCredit = tx.type === 'credit';
                    const label = CREDIT_ACTION_LABELS[tx.actionType as CreditAction] ?? tx.description ?? tx.actionType;
                    const date = new Date(tx.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                    return (
                      <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-full ${isCredit ? 'bg-teal/10' : 'bg-white/[0.04]'}`}>
                            {isCredit ? <Zap className="h-3.5 w-3.5 text-teal" /> : <Clock className="h-3.5 w-3.5 text-[#4A6280]" />}
                          </div>
                          <div>
                            <p className="text-sm text-white">{label}</p>
                            <p className="text-xs text-[#4A6280]">{date}</p>
                          </div>
                        </div>
                        <span className={`text-sm font-bold tabular-nums ${isCredit ? 'text-teal' : 'text-[#7A9AB4]'}`}>
                          {isCredit ? '+' : tx.amount === 0 ? '∞' : '−'}{tx.amount === 0 ? '' : tx.amount} cr
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Current Plan ───────────────────────────────────────────── */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Subscription Plan</h2>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-white">{planDetail?.label ?? currentPlan}</div>
                  <div className="mt-0.5 text-sm text-[#4A6280]">{planDetail?.price ?? '—'}</div>
                  {me.isDemo && <div className="mt-1 text-xs text-amber">Demo mode — billing disabled</div>}
                </div>
                {!me.isDemo && currentPlan !== 'free' && (
                  <button
                    onClick={handlePortal}
                    className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-sm text-[#7A9AB4] hover:text-white hover:border-white/[0.15] transition-colors"
                  >
                    Manage <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {planDetail?.features && (
                <ul className="mt-4 space-y-1.5">
                  {planDetail.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-[#4A6280]">
                      <Check className="h-3.5 w-3.5 text-teal shrink-0" />{f}
                    </li>
                  ))}
                </ul>
              )}
            </div>

          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
