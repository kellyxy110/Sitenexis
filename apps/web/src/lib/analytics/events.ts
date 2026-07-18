/**
 * Typed SiteNexis event tracker.
 * Pushes to the GTM dataLayer — GTM owns routing events to GA4 and any future
 * destination. This module is the single source of truth for event names and
 * payload shapes; never push to dataLayer directly from elsewhere.
 */
'use client';

type AuthMethod = 'email' | 'google' | 'github' | 'twitter' | 'discord';
type GoogleProvider = 'ga4' | 'search_console';

interface SiteNexisEventMap {
  signup: { method: AuthMethod };
  login: { method: AuthMethod };
  website_added: { domain: string };
  audit_started: { auditId: string; domain: string; executionMode: 'bullmq' | 'serverless' };
  audit_completed: { auditId: string; domain: string; overallScore: number; durationMs?: number };
  audit_failed: { auditId: string; domain: string; reason: string };
  report_viewed: { auditId: string; reportType: string };
  report_downloaded: { auditId: string; format: 'pdf' | 'json' };
  recommendation_viewed: { auditId: string; recommendationId: string };
  recommendation_applied: { auditId: string; recommendationId: string };
  integration_connected: { provider: GoogleProvider };
  sync_completed: { provider: GoogleProvider; recordCount?: number };
  sync_failed: { provider: GoogleProvider; reason: string };
}

export type SiteNexisEventName = keyof SiteNexisEventMap;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/**
 * Fire a typed SiteNexis event into the GTM dataLayer.
 * No-ops server-side and when GTM hasn't loaded (window.dataLayer absent is
 * fine — GTM initialises the array itself; we just append defensively).
 */
export function trackEvent<K extends SiteNexisEventName>(
  name: K,
  params: SiteNexisEventMap[K],
): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event: `sn_${name}`, ...params });
}
