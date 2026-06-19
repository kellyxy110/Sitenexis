import type { Prisma } from '../../generated';
import { db } from '../client';
import type { InformationGainResult } from '@sitenexis/shared';

export async function saveIGEResult(auditId: string, result: InformationGainResult): Promise<void> {
  await db.informationGainResult.upsert({
    where: { auditId },
    create: {
      auditId,
      keyword: result.keyword,
      targetUrl: result.targetUrl,
      cohortSize: result.cohortSize,
      overallScore: result.informationGainScore,
      confidence: result.confidence,
      state: result.state,
      cohortPagesJson: result.factLayer.sourcedFromUrls as unknown as Prisma.InputJsonValue,
      resultJson: result as unknown as Prisma.InputJsonValue,
    },
    update: {
      keyword: result.keyword,
      targetUrl: result.targetUrl,
      cohortSize: result.cohortSize,
      overallScore: result.informationGainScore,
      confidence: result.confidence,
      state: result.state,
      cohortPagesJson: result.factLayer.sourcedFromUrls as unknown as Prisma.InputJsonValue,
      resultJson: result as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function getIGEResult(auditId: string): Promise<InformationGainResult | null> {
  const record = await db.informationGainResult.findUnique({ where: { auditId } });
  if (!record) return null;
  return record.resultJson as unknown as InformationGainResult;
}
