import type { Prisma } from '../../generated';
import { db } from '../client';
import type { AiGovernanceReport } from '@sitenexis/shared';

export async function saveAiGovernanceReport(auditId: string, report: AiGovernanceReport): Promise<void> {
  await db.aiGovernanceReport.upsert({
    where: { auditId },
    create: {
      auditId,
      overallScore: report.overallScore,
      scoreBreakdown: report.scoreBreakdown as unknown as Prisma.InputJsonValue,
      contentSignal: report.contentSignal as unknown as Prisma.InputJsonValue,
      namedBotAccess: report.namedBotAccess as unknown as Prisma.InputJsonValue,
      hasLlmsTxt: report.hasLlmsTxt,
      hasAiTxt: report.hasAiTxt,
      hasSecurityTxt: report.hasSecurityTxt,
      hasSitemapDeclaration: report.hasSitemapDeclaration,
      issues: report.issues as unknown as Prisma.InputJsonValue,
      limitations: report.limitations,
    },
    update: {
      overallScore: report.overallScore,
      scoreBreakdown: report.scoreBreakdown as unknown as Prisma.InputJsonValue,
      contentSignal: report.contentSignal as unknown as Prisma.InputJsonValue,
      namedBotAccess: report.namedBotAccess as unknown as Prisma.InputJsonValue,
      hasLlmsTxt: report.hasLlmsTxt,
      hasAiTxt: report.hasAiTxt,
      hasSecurityTxt: report.hasSecurityTxt,
      hasSitemapDeclaration: report.hasSitemapDeclaration,
      issues: report.issues as unknown as Prisma.InputJsonValue,
      limitations: report.limitations,
    },
  });
}

export async function getAiGovernanceReport(auditId: string): Promise<AiGovernanceReport | null> {
  const r = await db.aiGovernanceReport.findUnique({ where: { auditId } });
  if (!r) return null;
  return {
    version: 'ai-governance-v1',
    assessedAt: r.createdAt.toISOString(),
    overallScore: r.overallScore,
    scoreBreakdown: r.scoreBreakdown as unknown as AiGovernanceReport['scoreBreakdown'],
    contentSignal: r.contentSignal as unknown as AiGovernanceReport['contentSignal'],
    namedBotAccess: r.namedBotAccess as unknown as AiGovernanceReport['namedBotAccess'],
    hasLlmsTxt: r.hasLlmsTxt,
    hasAiTxt: r.hasAiTxt,
    hasSecurityTxt: r.hasSecurityTxt,
    hasSitemapDeclaration: r.hasSitemapDeclaration,
    issues: r.issues as unknown as AiGovernanceReport['issues'],
    limitations: r.limitations,
  };
}
