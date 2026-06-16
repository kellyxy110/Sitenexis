import { NextResponse } from 'next/server';
import type { GTLResponse, GTLState, AuditStatus } from '@sitenexis/shared';

export function gtlResponse<T>(state: GTLState, data: T | null): NextResponse<GTLResponse<T>> {
  return NextResponse.json<GTLResponse<T>>({
    state,
    timestamp: new Date().toISOString(),
    data,
  });
}

export function gtlEmpty(): NextResponse<GTLResponse<null>> {
  return NextResponse.json<GTLResponse<null>>({
    state: 'empty',
    timestamp: new Date().toISOString(),
    data: null,
  });
}

// Resolves GTL state for sub-report routes.
// hasData: whether the sub-report data was found in the DB.
// auditStatus: the audit's current processing status.
export function resolveGTLState(auditStatus: AuditStatus, hasData: boolean): GTLState {
  if (hasData) {
    return auditStatus === 'complete' ? 'complete' : 'partial';
  }
  if (auditStatus === 'running' || auditStatus === 'queued') return 'partial';
  return 'empty';
}
