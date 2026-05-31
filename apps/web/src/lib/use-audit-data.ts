'use client';

import { useQuery } from '@tanstack/react-query';

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

/** Fetches a specific audit sub-report once auditId is known. */
export function useAuditSubReport<T>(auditId: string | null, endpoint: string) {
  return useQuery<T>({
    queryKey: ['audit-sub', auditId, endpoint],
    queryFn: () =>
      fetch(`/api/audit/${auditId}/${endpoint}`).then((r) => {
        if (!r.ok) throw new Error(`Failed to load ${endpoint}`);
        return r.json() as Promise<T>;
      }),
    enabled: !!auditId,
    staleTime: 120_000,
  });
}
