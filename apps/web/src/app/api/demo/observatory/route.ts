export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { isFullyConfigured } from '@/lib/mode';

// Real labels for the real demo domains shown on the homepage — not fabricated
// data, just human-readable metadata for companies that already exist and
// have a real completed audit in the database.
const DEMO_METADATA: Record<string, { label: string; category: string; description: string }> = {
  'genshipyard.com': { label: 'GenShipyard', category: 'SaaS', description: 'AI company website' },
  'alwajudproperties.com': { label: 'Alwajud Properties', category: 'Real Estate', description: 'Real estate portfolio' },
  'inforsphere.com': { label: 'InforSphere', category: 'SaaS', description: 'Enterprise data platform' },
  'community.genhub.fun': { label: 'GenHub Community', category: 'Community', description: 'Community platform' },
  'tryprofound.com': { label: 'Profound', category: 'SaaS', description: 'AI visibility platform' },
};

export interface ObservatoryCard {
  domain: string;
  label: string;
  category: string;
  description: string;
  completedAt: string;
  pageCount: number;
  overall: number;
  aiVisibility: number | null;
  machineTrust: number | null;
  retrieval: number | null;
  citation: number | null;
  schema: number;
  critical: number;
  warnings: number;
  passed: number;
  badges: string[];
  confidence: 'medium' | 'high';
  topIssues: { severity: string; module: string; message: string; recommendation: string }[];
}

export interface ObservatoryStats {
  totalAuditsCompleted: number;
  averageOverallScore: number;
  domainsAnalyzed: number;
  categoriesRepresented: number;
}

function computeBadges(card: Pick<ObservatoryCard, 'overall' | 'aiVisibility' | 'machineTrust' | 'schema' | 'critical'>): string[] {
  const badges: string[] = [];
  if ((card.aiVisibility ?? 0) >= 70) badges.push('AI Ready');
  if (card.schema >= 70) badges.push('Schema Complete');
  else if (card.schema >= 40) badges.push('Schema Partial');
  if ((card.machineTrust ?? 0) >= 70) badges.push('Trustworthy');
  if (card.critical === 0) badges.push('No Critical Issues');
  if (card.overall >= 80) badges.push('Machine Friendly');
  return badges;
}

export async function GET(): Promise<NextResponse> {
  if (!isFullyConfigured()) {
    return NextResponse.json({ cards: [] as ObservatoryCard[], stats: null as ObservatoryStats | null });
  }

  try {
    const { db } = await import('@sitenexis/db');
    const audits = await db.audit.findMany({
      where: { isDemo: true, status: 'complete', archivedAt: null },
      include: { scores: true, aiVisibilityScores: true, issues: true },
      orderBy: { domain: 'asc' },
    });

    const cards: ObservatoryCard[] = audits
      .filter((a) => a.scores !== null)
      .map((a) => {
        const meta = DEMO_METADATA[a.domain] ?? { label: a.domain, category: 'Other', description: '' };
        const critical = a.issues.filter((i) => i.severity === 'critical').length;
        const warnings = a.issues.filter((i) => i.severity === 'warning').length;
        const passed = a.issues.filter((i) => i.severity === 'info').length;
        const card = {
          domain: a.domain,
          label: meta.label,
          category: meta.category,
          description: meta.description,
          completedAt: (a.completedAt ?? a.createdAt).toISOString(),
          pageCount: a.pageCount ?? 0,
          overall: a.scores!.overall,
          aiVisibility: a.aiVisibilityScores?.aiVisibilityScore ?? null,
          machineTrust: a.aiVisibilityScores?.semanticTrustScore ?? null,
          retrieval: a.aiVisibilityScores?.retrievalReadinessScore ?? null,
          citation: a.aiVisibilityScores?.citationProbabilityScore ?? null,
          schema: a.scores!.schemaScore,
          critical,
          warnings,
          passed,
          confidence: (a.aiVisibilityScores ? 'high' : 'medium') as 'medium' | 'high',
          topIssues: a.issues
            .slice()
            .sort((x, y) => (x.severity === 'critical' ? 0 : x.severity === 'warning' ? 1 : 2) - (y.severity === 'critical' ? 0 : y.severity === 'warning' ? 1 : 2))
            .slice(0, 5)
            .map((i) => ({ severity: i.severity, module: i.module, message: i.message, recommendation: i.recommendation })),
        };
        return { ...card, badges: computeBadges(card) };
      });

    const stats: ObservatoryStats | null = cards.length > 0 ? {
      totalAuditsCompleted: await db.audit.count({ where: { status: 'complete', archivedAt: null } }),
      averageOverallScore: Math.round(cards.reduce((sum, c) => sum + c.overall, 0) / cards.length),
      domainsAnalyzed: cards.length,
      categoriesRepresented: new Set(cards.map((c) => c.category)).size,
    } : null;

    return NextResponse.json({ cards, stats });
  } catch {
    return NextResponse.json({ cards: [] as ObservatoryCard[], stats: null as ObservatoryStats | null });
  }
}
