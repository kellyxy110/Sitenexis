export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { isFullyConfigured } from '@/lib/mode';

interface Params { params: Promise<{ id: string }> }

async function resolveApiKey(req: NextRequest): Promise<{ userId: string } | null> {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  const raw = auth.slice(7).trim();
  if (!raw) return null;

  const keyHash = createHash('sha256').update(raw).digest('hex');
  try {
    const { db } = await import('@sitenexis/db');
    const key = await (db as unknown as {
      apiKey: {
        findFirst: (args: object) => Promise<{ userId: string; id: string } | null>;
        update: (args: object) => Promise<unknown>;
      };
    }).apiKey.findFirst({
      where: { keyHash, archivedAt: null },
      select: { userId: true, id: true },
    });
    if (!key) return null;

    const { getUserById } = await import('@sitenexis/db');
    const user = await getUserById(key.userId);
    if (!user || (user.plan !== 'agency' && user.plan !== 'enterprise')) return null;

    await (db as unknown as {
      apiKey: { update: (args: object) => Promise<unknown> };
    }).apiKey.update({ where: { id: key.id }, data: { lastUsed: new Date() } });

    return { userId: key.userId };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  if (!isFullyConfigured()) {
    return NextResponse.json({ error: 'API access requires a connected Supabase project' }, { status: 503 });
  }

  const caller = await resolveApiKey(req);
  if (!caller) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { getAuditById, getAuditScores, getAIVisibilityScore, getIssuesByAudit } = await import('@sitenexis/db');

    const audit = await getAuditById(id);
    if (!audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
    if ((audit as { userId: string }).userId !== caller.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [scores, aiScores, issues] = await Promise.all([
      getAuditScores(id),
      getAIVisibilityScore(id),
      getIssuesByAudit(id),
    ]);

    const criticalCount  = issues.filter((i) => i.severity === 'critical').length;
    const warningCount   = issues.filter((i) => i.severity === 'warning').length;

    return NextResponse.json({
      object: 'audit',
      id: audit.id,
      domain: audit.domain,
      status: audit.status,
      createdAt: audit.createdAt,
      completedAt: audit.completedAt,
      pageCount: audit.pageCount,
      scores: scores
        ? {
            overall:          scores.overall,
            seoScore:         scores.seoScore,
            aiScore:          scores.aiScore,
            schemaScore:      scores.schemaScore,
            linkGraphScore:   scores.linkGraphScore,
            performanceScore: scores.performanceScore,
          }
        : null,
      aiVisibilityScores: aiScores
        ? {
            aiVisibilityScore:       aiScores.aiVisibilityScore,
            machineReadabilityScore: aiScores.machineReadabilityScore,
            entityConfidenceScore:   aiScores.entityConfidenceScore,
            retrievalReadinessScore: aiScores.retrievalReadinessScore,
            citationProbabilityScore: aiScores.citationProbabilityScore,
            semanticTrustScore:      aiScores.semanticTrustScore,
            recommendationConfidence: aiScores.recommendationConfidence,
          }
        : null,
      issues: {
        critical: criticalCount,
        warning:  warningCount,
        total:    issues.length,
        items: issues.slice(0, 50).map((i) => ({
          id:             i.id,
          module:         i.module,
          type:           i.type,
          severity:       i.severity,
          message:        i.message,
          recommendation: i.recommendation,
        })),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
