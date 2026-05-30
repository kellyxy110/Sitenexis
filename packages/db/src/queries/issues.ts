import { type Issue, type IssueSeverity } from '../../generated';
import { db } from '../client';

export type { Issue };

export async function saveIssues(
  auditId: string,
  issues: Array<{
    pageId?: string;
    module: string;
    type: string;
    severity: IssueSeverity;
    message: string;
    recommendation: string;
  }>
): Promise<void> {
  await db.issue.createMany({
    data: issues.map((issue) => ({ auditId, ...issue })),
  });
}

export async function getIssuesByAudit(auditId: string): Promise<Issue[]> {
  return db.issue.findMany({
    where: { auditId },
    orderBy: [
      { severity: 'asc' },
      { module: 'asc' },
    ],
  });
}

export async function getIssuesBySeverity(
  auditId: string,
  severity: IssueSeverity
): Promise<Issue[]> {
  return db.issue.findMany({ where: { auditId, severity } });
}
