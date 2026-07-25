import type { Prisma } from '../../generated';
import { db } from '../client';
import type { MachineTrustSecurityReport } from '@sitenexis/shared';

export async function saveMachineTrustSecurityRecord(
  auditId: string,
  report: MachineTrustSecurityReport,
): Promise<void> {
  const criticalFindings = report.findings.filter((f) => f.severity === 'critical').length;
  const warningFindings = report.findings.filter((f) => f.severity === 'warning').length;
  const infoFindings = report.findings.filter((f) => f.severity === 'info').length;

  await db.machineTrustSecurityRecord.upsert({
    where: { auditId },
    create: {
      auditId,
      overallScore: report.overallScore,
      confidence: report.confidence,
      scoreBreakdown: report.scoreBreakdown as unknown as Prisma.InputJsonValue,
      criticalFindings,
      warningFindings,
      infoFindings,
      resourcesAssessed: report.resourcesAssessed,
    },
    update: {
      overallScore: report.overallScore,
      confidence: report.confidence,
      scoreBreakdown: report.scoreBreakdown as unknown as Prisma.InputJsonValue,
      criticalFindings,
      warningFindings,
      infoFindings,
      resourcesAssessed: report.resourcesAssessed,
    },
  });
}

export async function getMachineTrustSecurityRecord(
  auditId: string,
): Promise<MachineTrustSecurityReport | null> {
  const r = await db.machineTrustSecurityRecord.findUnique({ where: { auditId } });
  if (!r) return null;
  return {
    version: 'machine-trust-security-v1',
    assessedAt: r.createdAt.toISOString(),
    overallScore: r.overallScore,
    confidence: r.confidence,
    scoreBreakdown: r.scoreBreakdown as unknown as MachineTrustSecurityReport['scoreBreakdown'],
    findings: [],
    evidence: [],
    resourcesAssessed: r.resourcesAssessed,
    limitations: [],
  };
}

export interface MachineTrustSecurityHistoryPoint {
  auditId: string;
  createdAt: Date;
  overallScore: number | null;
  criticalFindings: number;
  warningFindings: number;
  infoFindings: number;
}

export async function getMachineTrustSecurityHistory(
  userId: string,
  domain: string,
  limit = 12,
): Promise<MachineTrustSecurityHistoryPoint[]> {
  const records = await db.machineTrustSecurityRecord.findMany({
    where: { audit: { userId, domain, archivedAt: null } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: {
      auditId: true,
      createdAt: true,
      overallScore: true,
      criticalFindings: true,
      warningFindings: true,
      infoFindings: true,
    },
  });
  return records;
}
