export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';

// ── Zod schema ────────────────────────────────────────────────────────────────

const StoredResultSchema = z.object({
  cachedAt: z.string(),
  ageHours: z.number().nonnegative(),
  fresh:    z.boolean(),
});

const PageMetricsSchema = z.object({
  wordCount:             z.number().nonnegative().optional(),
  metaTagCount:          z.number().nonnegative().optional(),
  schemaMarkupDensity:   z.number().min(0).max(1).optional(),
  isNew:                 z.boolean().optional(),
  hasDynamicContent:     z.boolean().optional(),
  pageCount:             z.number().nonnegative().optional(),
}).optional();

const OrchestrateRequestSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  crawlDataType: z.enum(['full_page', 'partial', 'multi_page']),
  userIntent: z.enum([
    'seo_audit',
    'ai_visibility',
    'entity_mapping',
    'retrieval_analysis',
    'full_intelligence',
  ]).nullable().optional(),
  existingResults: z.object({
    siteAudit:        StoredResultSchema.optional(),
    aiVisibility:     StoredResultSchema.optional(),
    entityExtraction: StoredResultSchema.optional(),
    retrievalAnalysis: StoredResultSchema.optional(),
  }).optional(),
  pageMetrics: PageMetricsSchema,
});

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try { await requireAuth(req); } catch { return unauthorizedResponse(); }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = OrchestrateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { orchestrate } = await import('@sitenexis/agents');
    // Zod produces optional-with-undefined; orchestrator uses exactOptionalPropertyTypes.
    // Runtime values are identical — cast is safe at the validation boundary.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = { ...parsed.data, userIntent: parsed.data.userIntent ?? null } as any;
    const result = orchestrate(input as Parameters<typeof orchestrate>[0]);
    return NextResponse.json(result);
  } catch (err) {
    logger.error({ err }, 'POST /api/orchestrate failed');
    return NextResponse.json({ error: 'Orchestration failed' }, { status: 500 });
  }
}
