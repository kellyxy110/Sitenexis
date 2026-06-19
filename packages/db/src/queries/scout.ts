import type { Prisma } from '../../generated';
import { db } from '../client';
import type { ScoutAnalysisResult } from '@sitenexis/shared';

export async function saveScoutAnalysis(
  auditId: string,
  domain: string,
  result: ScoutAnalysisResult,
): Promise<void> {
  await db.scoutAnalysis.upsert({
    where: { auditId },
    create: {
      auditId,
      domain,
      state: result.state,
      resultJson: result as unknown as Prisma.InputJsonValue,
    },
    update: {
      state: result.state,
      resultJson: result as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function getScoutAnalysis(auditId: string): Promise<ScoutAnalysisResult | null> {
  const record = await db.scoutAnalysis.findUnique({ where: { auditId } });
  if (!record) return null;
  return record.resultJson as unknown as ScoutAnalysisResult;
}
