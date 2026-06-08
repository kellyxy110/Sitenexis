export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { getDemoAudit } from '@/lib/demo-store';
import { isFullyConfigured } from '@/lib/mode';

interface Params {
  params: Promise<{ id: string }>;
}

function escapeCSV(val: unknown): string {
  const s = val === null || val === undefined ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(...cols: unknown[]): string {
  return cols.map(escapeCSV).join(',');
}

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch {
    return unauthorizedResponse();
  }

  const { id } = await params;

  // Resolve audit from demo store or DB
  let audit: Record<string, unknown> | null = null;

  const demoAudit = getDemoAudit(id);
  if (demoAudit) {
    if (demoAudit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    audit = demoAudit as unknown as Record<string, unknown>;
  } else if (isFullyConfigured()) {
    try {
      const { getAuditWithResults } = await import('@sitenexis/db');
      const result = await getAuditWithResults(id) as (Record<string, unknown> & { userId: string }) | null;
      if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (result.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      audit = result;
    } catch {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  } else {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const scores = (audit.scores ?? {}) as Record<string, unknown>;
  const issues = (audit.issues ?? []) as Array<Record<string, unknown>>;

  const criticalCount = issues.filter((i) => i['severity'] === 'critical').length;
  const warningCount  = issues.filter((i) => i['severity'] === 'warning').length;
  const infoCount     = issues.filter((i) => i['severity'] === 'info').length;

  // ── Build CSV ──────────────────────────────────────────────────────────────

  const headers = [
    'Audit ID', 'Domain', 'Status', 'Page Count',
    'Overall Score', 'SEO Score', 'AI Visibility Score',
    'Schema Score', 'Link Graph Score', 'Performance Score',
    'Critical Issues', 'Warning Issues', 'Info Issues',
    'Completed At', 'Created At',
  ];

  const dataRow = [
    audit['id'],
    audit['domain'],
    audit['status'],
    audit['pageCount'] ?? '',
    (scores['overall'] as number | undefined) ?? '',
    (scores['seoScore'] as number | undefined) ?? '',
    (scores['aiScore'] as number | undefined) ?? '',
    (scores['schemaScore'] as number | undefined) ?? '',
    (scores['linkGraphScore'] as number | undefined) ?? '',
    (scores['performanceScore'] as number | undefined) ?? '',
    criticalCount,
    warningCount,
    infoCount,
    audit['completedAt'] ?? '',
    audit['createdAt'] ?? '',
  ];

  // Issues detail section
  const issueHeaders = ['URL', 'Module', 'Type', 'Severity', 'Message', 'Recommendation'];
  const issueRows = issues.map((iss) => [
    iss['pageUrl'] ?? iss['url'] ?? '',
    iss['module'] ?? '',
    iss['type'] ?? '',
    iss['severity'] ?? '',
    iss['message'] ?? '',
    iss['recommendation'] ?? '',
  ]);

  const lines: string[] = [
    '# SiteNexis Audit Export',
    `# Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    row(...headers),
    row(...dataRow),
    '',
    '## Issues',
    row(...issueHeaders),
    ...issueRows.map((r) => row(...r)),
  ];

  const csv = lines.join('\r\n');
  const filename = `sitenexis-audit-${String(audit['domain']).replace(/[^a-z0-9]/gi, '-')}-${id.slice(0, 8)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
