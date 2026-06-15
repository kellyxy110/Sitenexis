export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';
import { listDemoAudits } from '@/lib/demo-store';

export interface PortfolioDomain {
  domain: string;
  latestAuditId: string;
  latestScore: number | null;
  latestAiScore: number | null;
  prevScore: number | null;
  trend: 'up' | 'down' | 'flat' | null;
  trendDelta: number | null;
  lastAuditDate: string;
  criticalIssues: number;
  auditCount: number;
  status: 'complete' | 'running' | 'queued' | 'failed';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch {
    return unauthorizedResponse();
  }

  if (!isFullyConfigured()) {
    const audits = listDemoAudits();
    const portfolio = buildPortfolio(audits.map((a) => ({
      domain: a.domain,
      id: a.id,
      status: a.status,
      createdAt: a.createdAt,
      scores: a.scores ? { overall: a.scores.overall, aiScore: a.scores.aiScore } : null,
      _count: { issues: a.issues.filter((i) => i.severity === 'critical').length },
      aiVisibilityScores: null,
    })));
    return NextResponse.json(portfolio);
  }

  try {
    const { listAuditsByUser } = await import('@sitenexis/db');
    const { data } = await listAuditsByUser(user.id, 1, 500);

    const portfolio = buildPortfolio(data.map((a) => ({
      domain: a.domain,
      id: a.id,
      status: a.status,
      createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
      scores: (a as { scores?: { overall: number; aiScore: number } | null }).scores
        ? { overall: (a as { scores: { overall: number; aiScore: number } }).scores.overall, aiScore: (a as { scores: { overall: number; aiScore: number } }).scores.aiScore }
        : null,
      _count: (a as { _count?: { issues: number } })._count ?? { issues: 0 },
      aiVisibilityScores: (a as { aiVisibilityScores?: { aiVisibilityScore: number } | null }).aiVisibilityScores ?? null,
    })));

    return NextResponse.json(portfolio);
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}

interface AuditSummary {
  domain: string;
  id: string;
  status: string;
  createdAt: string;
  scores: { overall: number; aiScore: number } | null;
  _count: { issues: number };
  aiVisibilityScores: { aiVisibilityScore: number } | null;
}

function buildPortfolio(audits: AuditSummary[]): PortfolioDomain[] {
  // Group by domain, latest first
  const grouped = new Map<string, AuditSummary[]>();
  for (const a of audits) {
    const existing = grouped.get(a.domain) ?? [];
    existing.push(a);
    grouped.set(a.domain, existing);
  }

  const domains: PortfolioDomain[] = [];
  for (const [domain, domainAudits] of grouped) {
    const sorted = [...domainAudits].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const latest = sorted[0];
    const prev   = sorted.find((a) => a.id !== latest.id && a.scores != null) ?? null;

    const latestScore = latest.scores?.overall ?? null;
    const prevScore   = prev?.scores?.overall ?? null;
    let trend: PortfolioDomain['trend'] = null;
    let trendDelta: number | null = null;

    if (latestScore !== null && prevScore !== null) {
      trendDelta = Math.round(latestScore - prevScore);
      trend = trendDelta > 1 ? 'up' : trendDelta < -1 ? 'down' : 'flat';
    }

    domains.push({
      domain,
      latestAuditId: latest.id,
      latestScore,
      latestAiScore: latest.aiVisibilityScores?.aiVisibilityScore ?? latest.scores?.aiScore ?? null,
      prevScore,
      trend,
      trendDelta,
      lastAuditDate: latest.createdAt,
      criticalIssues: latest._count.issues,
      auditCount: sorted.length,
      status: latest.status as PortfolioDomain['status'],
    });
  }

  return domains.sort((a, b) => new Date(b.lastAuditDate).getTime() - new Date(a.lastAuditDate).getTime());
}
