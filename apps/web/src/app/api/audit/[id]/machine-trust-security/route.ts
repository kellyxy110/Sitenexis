export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { buildMachineTrustSecurityReport } from '@sitenexis/analyzers';
import type { MachineTrustResource } from '@sitenexis/shared';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { gtlEmpty, gtlResponse, resolveGTLState } from '@/lib/gtl';
import { logger } from '@/lib/logger';

interface Params { params: Promise<{ id: string }> }
interface SecurityAuditPage {
  id: string;
  url: string;
  bodyText: string;
  schemaMarkup?: unknown;
  responseHeaders?: Record<string, string>;
}
interface SecurityAudit {
  id: string;
  userId: string;
  status: 'queued' | 'running' | 'partial' | 'complete' | 'failed';
  pages: SecurityAuditPage[];
}

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  try {
    const { getAuditWithResults } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id, user.id) as unknown as SecurityAudit | null;
    if (!audit) return gtlEmpty();
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const resources: MachineTrustResource[] = audit.pages.flatMap((page) => {
      const pageResource: MachineTrustResource = { id: page.id, kind: 'page', url: page.url, content: page.bodyText ?? '', fetchedAt: new Date().toISOString(), ...(page.responseHeaders ? { headers: page.responseHeaders } : {}) };
      const resourcesForPage: MachineTrustResource[] = [pageResource];
      if (page.schemaMarkup) resourcesForPage.push({ id: `${page.id}-structured-data`, kind: 'structured_data', url: page.url, content: JSON.stringify(page.schemaMarkup), fetchedAt: new Date().toISOString() });
      if (page.responseHeaders) resourcesForPage.push({ id: `${page.id}-headers`, kind: 'response_headers', url: page.url, content: JSON.stringify(page.responseHeaders), headers: page.responseHeaders, fetchedAt: new Date().toISOString() });
      return resourcesForPage;
    });
    const state = resolveGTLState(audit.status, resources.length > 0);
    return gtlResponse(state, buildMachineTrustSecurityReport({ resources, expectedMachineResources: ['machine_resource', 'structured_data', 'response_headers'] }));
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/machine-trust-security failed');
    return NextResponse.json({ error: 'Failed to build Machine Trust security report' }, { status: 500 });
  }
}
