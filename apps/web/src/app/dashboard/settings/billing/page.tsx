'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Check, ArrowRight, Loader2, ExternalLink } from 'lucide-react';

interface MeData {
  id: string;
  email: string;
  plan: 'free' | 'starter' | 'pro' | 'agency' | 'enterprise';
  isDemo: boolean;
}

const PLAN_DETAILS: Record<string, { label: string; price: string; features: string[]; highlight?: boolean }> = {
  free:       { label: 'Free',       price: '$0/mo',   features: ['1 audit/month', 'Layers 1–3 only', 'No API access'] },
  starter:    { label: 'Starter',    price: '$29/mo',  features: ['50 audits/month', 'Layers 1–3', 'Email support'] },
  pro:        { label: 'Pro',        price: '$99/mo',  features: ['Unlimited audits', 'Layer 4 (Machine Trust)', 'Competitive analysis'], highlight: true },
  agency:     { label: 'Agency',     price: '$249/mo', features: ['Unlimited audits', 'Layer 4 + API access', 'Bulk domains', 'Priority support'] },
  enterprise: { label: 'Enterprise', price: 'Custom',  features: ['Everything in Agency', 'White-label reports', 'Dedicated support', 'SLA'] },
};

export default function BillingPage() {
  const router = useRouter();
  const { data: me, isLoading } = useQuery<MeData>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/me').then((r) => r.json() as Promise<MeData>),
    staleTime: 60_000,
  });

  const currentPlan = me?.plan ?? 'free';
  const planDetail = PLAN_DETAILS[currentPlan];

  const handlePortal = async () => {
    const res = await fetch('/api/billing/portal', { method: 'POST' });
    if (res.ok) {
      const { url } = await res.json() as { url: string };
      window.location.href = url;
    }
  };

  const handleUpgrade = async (plan: string) => {
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
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
            <h1 className="text-xl font-bold text-white">Billing</h1>
          </div>
          <p className="text-sm text-[#4A6280]">Manage your subscription plan and payment details</p>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-[#4A6280]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading plan info…
          </div>
        )}

        {me && (
          <div className="space-y-6">
            {/* Current plan */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Current Plan</h2>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-white">{planDetail?.label ?? currentPlan}</div>
                  <div className="mt-0.5 text-sm text-[#4A6280]">{planDetail?.price ?? '—'}</div>
                  {me.isDemo && (
                    <div className="mt-1 text-xs text-amber">Demo mode — billing is disabled</div>
                  )}
                </div>
                {!me.isDemo && currentPlan !== 'free' && (
                  <button
                    onClick={handlePortal}
                    className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-sm text-[#7A9AB4] hover:text-white hover:border-white/[0.15] transition-colors"
                  >
                    Manage Subscription <ExternalLink className="h-3.5 w-3.5" />
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

            {/* Upgrade options */}
            {currentPlan === 'free' || currentPlan === 'starter' ? (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-[#C8DFE8]">Upgrade Your Plan</h2>
                {(['pro', 'agency'] as const).map((plan) => {
                  const pd = PLAN_DETAILS[plan];
                  return (
                    <div key={plan} className={`rounded-xl border p-5 ${pd.highlight ? 'border-cyan/30 bg-cyan/[0.04]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{pd.label}</span>
                            {pd.highlight && <span className="rounded-full border border-cyan/30 bg-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-cyan">Recommended</span>}
                          </div>
                          <div className="mt-0.5 text-sm font-bold text-[#7A9AB4]">{pd.price}</div>
                          <ul className="mt-2 space-y-1">
                            {pd.features.map((f) => (
                              <li key={f} className="flex items-center gap-1.5 text-xs text-[#4A6280]">
                                <Check className="h-3 w-3 text-teal shrink-0" />{f}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <button
                          onClick={() => me.isDemo ? router.push('/#pricing') : handleUpgrade(plan)}
                          className="shrink-0 flex items-center gap-1.5 rounded-lg bg-cyan/10 border border-cyan/20 px-4 py-2 text-sm font-semibold text-cyan hover:bg-cyan/20 transition-colors"
                        >
                          Upgrade <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                <p className="text-center text-xs text-[#4A6280]">
                  Need enterprise pricing?{' '}
                  <Link href="/#pricing" className="text-cyan hover:underline">View all plans</Link>
                </p>
              </div>
            ) : null}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
