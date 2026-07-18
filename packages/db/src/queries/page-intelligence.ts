import type { Prisma, OptimizationSessionStatus } from '../../generated';
import { db } from '../client';

/**
 * Page Intelligence — versioned optimization sessions.
 * Tenant boundary: userId. Ownership is additionally always re-checked at the
 * route layer against the session's auditId before any read/write.
 */

export interface RecommendationEntry {
  action: string;
  rationale: string;
  sourceFindingIds: string[];
  expectedImpact: string;
}

export interface CitabilityEntry {
  engine: string;
  likelihood: 'low' | 'medium' | 'high';
  reasoning: string;
}

export interface CreateOptimizationSessionInput {
  auditId: string;
  pageId: string;
  userId: string;
  diagnosis: string;
  originalTitle: string | null;
  originalMetaDescription: string | null;
  originalH1: string | null;
  originalBodyText: string;
  optimizedTitle: string | null;
  optimizedMetaDescription: string | null;
  optimizedH1: string | null;
  optimizedBodyText: string;
  scoresSnapshot: Record<string, unknown>;
  recommendations: RecommendationEntry[];
  citabilityByEngine: CitabilityEntry[];
}

export async function createOptimizationSession(input: CreateOptimizationSessionInput) {
  return db.optimizationSession.create({
    data: {
      auditId: input.auditId,
      pageId: input.pageId,
      userId: input.userId,
      diagnosis: input.diagnosis,
      originalTitle: input.originalTitle,
      originalMetaDescription: input.originalMetaDescription,
      originalH1: input.originalH1,
      originalBodyText: input.originalBodyText,
      optimizedTitle: input.optimizedTitle,
      optimizedMetaDescription: input.optimizedMetaDescription,
      optimizedH1: input.optimizedH1,
      optimizedBodyText: input.optimizedBodyText,
      scoresSnapshot: input.scoresSnapshot as Prisma.InputJsonValue,
      recommendations: input.recommendations as unknown as Prisma.InputJsonValue,
      citabilityByEngine: input.citabilityByEngine as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function getOptimizationSession(sessionId: string) {
  return db.optimizationSession.findUnique({ where: { id: sessionId } });
}

export async function getOptimizationSessionsForPage(pageId: string, userId: string) {
  return db.optimizationSession.findMany({
    where: { pageId, userId, archivedAt: null },
    orderBy: { createdAt: 'desc' },
  });
}

export async function setOptimizationSessionStatus(
  sessionId: string,
  status: OptimizationSessionStatus,
): Promise<void> {
  await db.optimizationSession.update({
    where: { id: sessionId },
    data: { status, ...(status === 'published' ? { publishedAt: new Date() } : {}) },
  });
}
