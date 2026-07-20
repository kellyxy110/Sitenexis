'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, ArrowRight, Check, Loader2, X } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/events';

interface GoogleConnection {
  status: 'connected' | 'pending' | 'expired' | 'error';
  googleAccountEmail: string;
  scopes: string[];
  lastError: string | null;
  ga4PropertyId: string | null;
  ga4PropertyName: string | null;
  gscSiteUrl: string | null;
  gscSiteName: string | null;
}
interface Ga4Property { propertyId: string; propertyName: string; accountName: string }
interface GscSite { siteUrl: string; permissionLevel: string }

const ANALYTICS_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const SEARCH_CONSOLE_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  insufficient_scopes:
    'Google authenticated your account but did not grant Analytics/Search Console access — only basic profile info. ' +
    'Remove SiteNexis at myaccount.google.com/permissions, then reconnect and explicitly allow both permissions on the consent screen.',
  access_denied: 'You cancelled the Google consent screen. Click Connect Google to try again.',
  invalid_state: 'The connection request expired or was tampered with. Please try again.',
  exchange_failed: 'Google could not complete the connection. Please try again.',
};

export function GoogleIntegrationCard() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);

  const statusQuery = useQuery({
    queryKey: ['google-integration-status'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/google/status');
      if (!res.ok) throw new Error('Failed to load status');
      return res.json() as Promise<{ configured: boolean; connection: GoogleConnection | null }>;
    },
  });

  const propertiesQuery = useQuery({
    queryKey: ['google-properties'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/google/properties');
      if (!res.ok) throw new Error('Failed to load properties');
      return res.json() as Promise<{ ga4Properties: Ga4Property[]; gscSites: GscSite[] }>;
    },
    enabled: showPicker,
  });

  const selectMutation = useMutation({
    mutationFn: async (body: { ga4PropertyId?: string; ga4PropertyName?: string; gscSiteUrl?: string; gscSiteName?: string }) => {
      const res = await fetch('/api/integrations/google/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save selection');
      return res.json();
    },
    onSuccess: () => {
      trackEvent('integration_connected', { provider: 'ga4' });
      setShowPicker(false);
      queryClient.invalidateQueries({ queryKey: ['google-integration-status'] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/integrations/google/disconnect', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to disconnect');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['google-integration-status'] }),
  });

  // Just returned from Google's consent screen — open the property picker automatically.
  useEffect(() => {
    if (searchParams.get('connected') === 'google') setShowPicker(true);
  }, [searchParams]);

  const connection = statusQuery.data?.connection;
  const isConnected = connection?.status === 'connected';
  const googleError = searchParams.get('google_error');
  const hasAnalyticsScope = connection?.scopes.includes(ANALYTICS_SCOPE) ?? false;
  const hasSearchConsoleScope = connection?.scopes.includes(SEARCH_CONSOLE_SCOPE) ?? false;
  // A connection exists (Google authenticated) but lacks one or both data scopes —
  // distinct from "never connected" and from "fully connected". Never inferred from
  // Supabase login state, which this component never reads.
  const hasPartialAccess = connection != null && connection.status !== 'connected' && (hasAnalyticsScope || hasSearchConsoleScope || connection.status === 'error');

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
          <Search className="h-5 w-5 text-[#4A6280]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">Google Analytics + Search Console</span>
            {isConnected && (
              <span className="rounded-pill border border-teal/20 bg-teal/10 px-2 py-0.5 text-[10px] font-semibold text-teal">Connected</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-[#4A6280]">
            {isConnected
              ? `${connection.googleAccountEmail} · ${connection.ga4PropertyName ?? 'no GA4 property'} · ${connection.gscSiteName ?? connection.gscSiteUrl ?? 'no Search Console site'}`
              : 'Correlate AI visibility with real traffic and search data — GA4 and Search Console, one connection.'}
          </p>
        </div>
        {!statusQuery.data?.configured ? (
          <span className="text-xs text-[#4A6280]">Not configured</span>
        ) : isConnected ? (
          <button
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-[#7A9AB4] hover:text-white hover:border-white/[0.15] transition-colors disabled:opacity-50"
          >
            {disconnectMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} Disconnect
          </button>
        ) : (
          <a
            href="/api/integrations/google/connect"
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-[#7A9AB4] hover:text-white hover:border-white/[0.15] transition-colors"
          >
            Connect Google <ArrowRight className="h-3 w-3" />
          </a>
        )}
      </div>

      {googleError && (
        <p className="mt-3 text-xs text-red-400">
          {GOOGLE_ERROR_MESSAGES[googleError] ?? `Google connection failed (${googleError}). Please try again.`}
        </p>
      )}

      {hasPartialAccess && (
        <div className="mt-3 space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-400">Connected as {connection!.googleAccountEmail}, but missing access</p>
          <p className="flex items-center gap-1.5 text-xs text-[#C8DFE8]">
            {hasAnalyticsScope ? <Check size={12} className="text-teal-400" /> : <X size={12} className="text-red-400" />} Google Analytics
          </p>
          <p className="flex items-center gap-1.5 text-xs text-[#C8DFE8]">
            {hasSearchConsoleScope ? <Check size={12} className="text-teal-400" /> : <X size={12} className="text-red-400" />} Search Console
          </p>
        </div>
      )}

      {showPicker && (
        <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/20 p-4">
          <p className="mb-3 text-xs font-semibold text-white">Select your properties</p>
          {propertiesQuery.isLoading && <p className="text-xs text-[#4A6280]">Loading available properties…</p>}
          {propertiesQuery.data && (
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-wide text-[#4A6280]">GA4 property</p>
                <div className="space-y-1">
                  {propertiesQuery.data.ga4Properties.map((p) => (
                    <button
                      key={p.propertyId}
                      onClick={() => selectMutation.mutate({ ga4PropertyId: p.propertyId, ga4PropertyName: p.propertyName })}
                      className="flex w-full items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-xs text-[#C8DFE8] hover:border-teal-500/30"
                    >
                      <span>{p.propertyName} <span className="text-[#4A6280]">({p.accountName})</span></span>
                      {connection?.ga4PropertyId === p.propertyId && <Check size={13} className="text-teal-400" />}
                    </button>
                  ))}
                  {propertiesQuery.data.ga4Properties.length === 0 && <p className="text-xs text-[#4A6280]">No GA4 properties found on this Google account.</p>}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-wide text-[#4A6280]">Search Console site</p>
                <div className="space-y-1">
                  {propertiesQuery.data.gscSites.map((s) => (
                    <button
                      key={s.siteUrl}
                      onClick={() => selectMutation.mutate({ gscSiteUrl: s.siteUrl, gscSiteName: s.siteUrl })}
                      className="flex w-full items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-xs text-[#C8DFE8] hover:border-teal-500/30"
                    >
                      <span>{s.siteUrl}</span>
                      {connection?.gscSiteUrl === s.siteUrl && <Check size={13} className="text-teal-400" />}
                    </button>
                  ))}
                  {propertiesQuery.data.gscSites.length === 0 && <p className="text-xs text-[#4A6280]">No verified Search Console sites found on this Google account.</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
