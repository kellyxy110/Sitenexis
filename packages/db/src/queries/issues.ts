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
    problem?: string;
    solution?: string;
    fixCode?: string;
    fixLanguage?: string;
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

export async function getIssuesByPage(pageId: string): Promise<Issue[]> {
  return db.issue.findMany({ where: { pageId }, orderBy: [{ severity: 'asc' }, { module: 'asc' }] });
}

export async function getIssuesBySeverity(
  auditId: string,
  severity: IssueSeverity
): Promise<Issue[]> {
  return db.issue.findMany({ where: { auditId, severity } });
}

export async function getIssueById(id: string): Promise<Issue | null> {
  return db.issue.findUnique({ where: { id } });
}

export async function saveFix(
  issueId: string,
  fix: {
    problem: string;
    solution: string;
    fixCode: string;
    fixLanguage: string;
  }
): Promise<void> {
  await db.issue.update({
    where: { id: issueId },
    data: {
      problem: fix.problem,
      solution: fix.solution,
      fixCode: fix.fixCode,
      fixLanguage: fix.fixLanguage,
    },
  });
}

export async function getIssuesWithFixes(auditId: string): Promise<Issue[]> {
  return db.issue.findMany({
    where: { auditId, NOT: { fixCode: null } },
    orderBy: [{ severity: 'asc' }, { module: 'asc' }],
  });
}
