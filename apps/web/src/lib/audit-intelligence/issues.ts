export interface AuditIssueSummaryItem {
  module: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  affectedPageCount: number;
}

export interface AuditIssueSummary {
  domain: string;
  totalRawIssues: number;
  critical: AuditIssueSummaryItem[];
  warning: AuditIssueSummaryItem[];
  info: AuditIssueSummaryItem[];
}

/**
 * Deduplicated, severity-grouped issue list — reuses the same canonical
 * `dedupeFindings` module as the Action Plan tab, Fix Plan/Roadmap, the PDF,
 * Executive Summary, and Narrative Report, so severity classification is
 * never reimplemented here. Used by Telegram's /issues command.
 */
export async function getAuditIssueSummary(auditId: string): Promise<AuditIssueSummary | null> {
  const { getAuditById, getIssuesByAudit } = await import('@sitenexis/db');
  const { dedupeFindings } = await import('@sitenexis/analyzers');

  const audit = await getAuditById(auditId);
  if (!audit) return null;

  const rawIssues = await getIssuesByAudit(auditId);
  const groups = dedupeFindings(
    rawIssues.map((issue) => ({
      module: issue.module,
      type: issue.type,
      severity: issue.severity as 'critical' | 'warning' | 'info',
      message: issue.message,
      recommendation: issue.recommendation,
      pageUrl: issue.pageUrl,
    })),
  );

  const byServerity: Record<'critical' | 'warning' | 'info', AuditIssueSummaryItem[]> = {
    critical: [], warning: [], info: [],
  };

  for (const group of groups) {
    const rep = group.representative;
    byServerity[rep.severity].push({
      module: rep.module,
      severity: rep.severity,
      message: group.affectedPageCount > 1 ? `${rep.message} (affects ${group.affectedPageCount} pages)` : rep.message,
      affectedPageCount: group.affectedPageCount,
    });
  }

  return {
    domain: audit.domain,
    totalRawIssues: rawIssues.length,
    critical: byServerity.critical,
    warning: byServerity.warning,
    info: byServerity.info,
  };
}
