'use client';

import { useQuery } from '@tanstack/react-query';
import type { GTLResponse, GTLState } from '@sitenexis/shared';

export interface MeData {
  id?: string;
  email?: string;
  plan: string;
  isDemo: boolean;
  creditBalance?: number;
  isUnlimited?: boolean;
}

/** Returns the current authenticated user's profile and plan. */
export function useMe() {
  return useQuery<MeData>({
    queryKey: ['me'],
    queryFn: () =>
      fetch('/api/me').then((r) => {
        if (!r.ok) return { plan: 'free', isDemo: true } as MeData;
        return r.json() as Promise<MeData>;
      }),
    staleTime: 60_000,
  });
}

export interface AuditSummary {
  id: string;
  domain: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  createdAt: string;
  completedAt: string | null;
  scores?: {
    overall: number;
    seoScore: number;
    aiScore: number;
    schemaScore: number;
    linkGraphScore: number;
    performanceScore: number;
  } | null;
  _count?: { issues: number };
}

interface AuditsResponse {
  data: AuditSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** Returns the user's audits and helpers to pick the active one. */
export function useAudits(pageSize = 50) {
  return useQuery<AuditsResponse>({
    queryKey: ['audits-list', pageSize],
    queryFn: () =>
      fetch(`/api/audits?pageSize=${pageSize}`).then((r) => {
        if (!r.ok) throw new Error('Failed to load audits');
        return r.json() as Promise<AuditsResponse>;
      }),
    staleTime: 60_000,
  });
}

/** Returns the most recent completed audit, or null if none exists. */
export function useLatestAudit() {
  const { data, isLoading, error } = useAudits(20);
  const latest = data?.data.find((a) => a.status === 'complete') ?? null;
  return { audit: latest, isLoading, error };
}

/** Fetches a specific audit sub-report once auditId is known.
 *  Returns TanStack Query result with `data: T | null` unwrapped from the GTL envelope,
 *  plus `gtlState: GTLState | null` for explicit state rendering.
 */
export function useAuditSubReport<T>(auditId: string | null, endpoint: string) {
  const query = useQuery<GTLResponse<T>>({
    queryKey: ['audit-sub', auditId, endpoint],
    queryFn: () =>
      fetch(`/api/audit/${auditId}/${endpoint}`).then((r) => {
        if (!r.ok) throw new Error(`Failed to load ${endpoint}`);
        return r.json() as Promise<GTLResponse<T>>;
      }),
    enabled: !!auditId,
    staleTime: 120_000,
  });

  return {
    ...query,
    gtlState: (query.data?.state ?? null) as GTLState | null,
    data: query.data?.data ?? null,
  };
}
