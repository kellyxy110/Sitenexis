import type { Prisma } from '../../generated';
import { db } from '../client';
import type { RedLabReport } from '@sitenexis/shared';

export async function saveRedLabReport(auditId: string, report: RedLabReport): Promise<void> {
  await db.redLabReport.upsert({
    where: { auditId },
    create: {
      auditId,
      overallScore: report.overallScore,
      scoreBreakdown: report.scoreBreakdown as unknown as Prisma.InputJsonValue,
      exposedPaths: report.exposedPaths as unknown as Prisma.InputJsonValue,
      vulnerableLibraries: report.vulnerableLibraries as unknown as Prisma.InputJsonValue,
      pathsChecked: report.pathsChecked,
      issues: report.issues as unknown as Prisma.InputJsonValue,
      limitations: report.limitations,
    },
    update: {
      overallScore: report.overallScore,
      scoreBreakdown: report.scoreBreakdown as unknown as Prisma.InputJsonValue,
      exposedPaths: report.exposedPaths as unknown as Prisma.InputJsonValue,
      vulnerableLibraries: report.vulnerableLibraries as unknown as Prisma.InputJsonValue,
      pathsChecked: report.pathsChecked,
      issues: report.issues as unknown as Prisma.InputJsonValue,
      limitations: report.limitations,
    },
  });
}

export async function getRedLabReport(auditId: string): Promise<RedLabReport | null> {
  const r = await db.redLabReport.findUnique({ where: { auditId } });
  if (!r) return null;
  return {
    version: 'redlab-v1',
    assessedAt: r.createdAt.toISOString(),
    overallScore: r.overallScore,
    scoreBreakdown: r.scoreBreakdown as unknown as RedLabReport['scoreBreakdown'],
    exposedPaths: r.exposedPaths as unknown as RedLabReport['exposedPaths'],
    vulnerableLibraries: r.vulnerableLibraries as unknown as RedLabReport['vulnerableLibraries'],
    pathsChecked: r.pathsChecked,
    issues: r.issues as unknown as RedLabReport['issues'],
    limitations: r.limitations,
  };
}
