export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';

interface Params {
  params: Promise<{ id: string }>;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function scoreLabel(n: number | null): string {
  if (n === null) return 'N/A';
  if (n >= 90) return 'Excellent';
  if (n >= 70) return 'Good';
  if (n >= 50) return 'Needs Work';
  return 'Critical';
}

function scoreColor(n: number | null): string {
  if (n === null) return '#94a3b8';
  if (n >= 90) return '#22c55e';
  if (n >= 70) return '#0bcebc';
  if (n >= 50) return '#f59e0b';
  return '#ef4444';
}

function card(label: string, value: number | null): string {
  const color = scoreColor(value);
  const display = value !== null ? String(value) : 'N/A';
  const bar = value !== null
    ? `<div style="background:#1e3a5f;border-radius:4px;height:6px;margin-top:6px"><div style="background:${color};border-radius:4px;height:6px;width:${value}%"></div></div>`
    : '';
  return `<div style="background:#0d2137;border:1px solid #1e3a5f;border-radius:8px;padding:14px;flex:1;min-width:130px">
    <div style="color:#94a3b8;font-size:11px;margin-bottom:2px">${label}</div>
    <div style="color:${color};font-size:26px;font-weight:700;line-height:1.2">${display}</div>
    <div style="color:${color};font-size:11px">${scoreLabel(value)}</div>
    ${bar}
  </div>`;
}

function issueRow(i: { severity: string; message: string; recommendation: string }): string {
  const badge = i.severity === 'critical' ? '#ef4444' : i.severity === 'warning' ? '#f59e0b' : '#3b82f6';
  return `<tr style="border-bottom:1px solid #1e3a5f">
    <td style="padding:10px 12px;vertical-align:top"><span style="background:${badge};color:#fff;font-size:10px;padding:2px 7px;border-radius:4px;text-transform:uppercase;white-space:nowrap">${escHtml(i.severity)}</span></td>
    <td style="padding:10px 12px;color:#cbd5e1;font-size:13px;vertical-align:top">${escHtml(i.message)}</td>
    <td style="padding:10px 12px;color:#94a3b8;font-size:12px;vertical-align:top">${escHtml(i.recommendation)}</td>
  </tr>`;
}

function generateReportHTML(
  domain: string,
  createdAt: Date,
  scores: Record<string, number | null>,
  aiScores: Record<string, number | null>,
  issues: Array<{ severity: string; message: string; recommendation: string }>,
  sseScores: Record<string, number | null> | undefined,
  integrity: { reportId: string; inputHash: string; engineVersion: string; signedAt: string },
): string {
  const date = createdAt.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  const overall = scores['overall'] ?? null;
  const overallColor = scoreColor(overall);

  const tier1: [string, number | null][] = [
    ['SEO Health', scores['seoScore'] ?? null],
    ['Schema Completeness', scores['schemaScore'] ?? null],
    ['Link Graph Strength', scores['linkGraphScore'] ?? null],
    ['Technical Performance', scores['performanceScore'] ?? null],
  ];

  const tier2: [string, number | null][] = [
    ['AI Visibility', scores['aiScore'] ?? null],
    ['Machine Readability', aiScores['machineReadabilityScore'] ?? null],
    ['Entity Confidence', aiScores['entityConfidenceScore'] ?? null],
    ['Retrieval Readiness', aiScores['retrievalReadinessScore'] ?? null],
    ['Citation Probability', aiScores['citationProbabilityScore'] ?? null],
    ['Semantic Trust', aiScores['semanticTrustScore'] ?? null],
    ['Recommendation Confidence', aiScores['recommendationConfidence'] ?? null],
  ];

  const tier3: [string, number | null][] = sseScores ? [
    ['GEO Score',           sseScores['geoScore'] ?? null],
    ['SNS Master Score',    sseScores['snsMasterScore'] ?? null],
    ['Topical Authority',   sseScores['topicalAuthorityScore'] ?? null],
    ['Semantic Density',    sseScores['semanticDensityScore'] ?? null],
    ['AI Crawlability',     sseScores['aiCrawlabilityScore'] ?? null],
  ] : [];

  const critical = issues.filter((i) => i.severity === 'critical').slice(0, 12);
  const warnings = issues.filter((i) => i.severity === 'warning').slice(0, 12);
  const hasIssues = critical.length > 0 || warnings.length > 0;

  const issueTable = (rows: typeof issues) => `
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <thead><tr style="background:#0d2137">
        <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;width:85px">Severity</th>
        <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase">Issue</th>
        <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase">Recommendation</th>
      </tr></thead>
      <tbody>${rows.map(issueRow).join('')}</tbody>
    </table>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SiteNexis Report — ${domain}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0a1628;background-image:url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='340'%20height='240'%3E%3Ctext%20x='20'%20y='130'%20transform='rotate(-28%20170%20120)'%20fill='%23ffffff'%20fill-opacity='0.035'%20font-family='Georgia,serif'%20font-size='30'%20font-weight='700'%3ESiteNexis%3C/text%3E%3C/svg%3E");color:#e2e8f0;font-family:Calibri,system-ui,sans-serif;font-size:14px;line-height:1.6}
  @media print{body{background:#fff;background-image:url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='340'%20height='240'%3E%3Ctext%20x='20'%20y='130'%20transform='rotate(-28%20170%20120)'%20fill='%230a1628'%20fill-opacity='0.05'%20font-family='Georgia,serif'%20font-size='30'%20font-weight='700'%3ESiteNexis%3C/text%3E%3C/svg%3E");color:#000;font-size:11px;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:18mm}}
  h2{font-family:Georgia,serif;color:#f1f5f9;font-size:16px;margin:28px 0 14px}
  .page{max-width:960px;margin:0 auto;padding:32px 24px}
  .score-grid{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:28px}
  .section-label{color:#00c8ff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #1e3a5f}
</style>
</head>
<body>
<div class="page">

  <div style="border-bottom:2px solid #1e3a5f;padding-bottom:20px;margin-bottom:28px;display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px">
    <div>
      <div style="color:#00c8ff;font-size:20px;font-weight:700;font-family:Georgia,serif">SiteNexis</div>
      <div style="color:#f1f5f9;font-size:26px;font-weight:700;margin-top:4px">${escHtml(domain)}</div>
      <div style="color:#64748b;font-size:13px;margin-top:2px">Machine Trust Intelligence Report · ${date}</div>
    </div>
    <div style="text-align:right">
      <div style="color:#94a3b8;font-size:11px;margin-bottom:2px">OVERALL SCORE</div>
      <div style="color:${overallColor};font-size:52px;font-weight:700;line-height:1">${overall ?? 'N/A'}</div>
      <div style="color:${overallColor};font-size:13px">${scoreLabel(overall)}</div>
    </div>
  </div>

  <div class="section-label">Tier 1 — Infrastructure</div>
  <div class="score-grid">${tier1.map(([l, v]) => card(l, v)).join('')}</div>

  <div class="section-label">Tier 2 — AI Visibility</div>
  <div class="score-grid">${tier2.map(([l, v]) => card(l, v)).join('')}</div>

  ${tier3.length > 0 ? `<div class="section-label">Tier 3 — Machine Trust Signals</div><div class="score-grid">${tier3.map(([l, v]) => card(l, v)).join('')}</div>` : ''}

  ${critical.length > 0 ? `<div class="section-label" style="margin-top:8px">Critical Issues (${critical.length})</div>${issueTable(critical)}` : ''}
  ${warnings.length > 0 ? `<div class="section-label">Warnings (${warnings.length})</div>${issueTable(warnings)}` : ''}
  ${!hasIssues ? '<div class="section-label">Issues</div><p style="color:#4a6280;font-style:italic;padding:12px 0">No issues detected in this audit.</p>' : ''}

  <div style="margin-top:40px;padding-top:14px;border-top:1px solid #1e3a5f;color:#4a6280;font-size:11px;text-align:center">
    Generated by SiteNexis · AI Retrieval + Machine Trust Intelligence System · sitenexis.com<br>
    All AI visibility and surface estimates are probabilistic models based on measurable content signals.
  </div>

  <div style="margin-top:16px;padding:12px 14px;background:#0d2137;border:1px solid #1e3a5f;border-radius:8px;color:#64748b;font-size:10px;line-height:1.6;word-break:break-all">
    <div style="color:#00c8ff;font-weight:700;letter-spacing:1px;margin-bottom:4px">REPORT INTEGRITY</div>
    <div>Report ID: <span style="color:#cbd5e1">${escHtml(integrity.reportId)}</span></div>
    <div>Integrity (SHA-256): <span style="color:#cbd5e1">${escHtml(integrity.inputHash)}</span></div>
    <div>Engine: ${escHtml(integrity.engineVersion)} · Signed: ${escHtml(integrity.signedAt)}</div>
    <div style="margin-top:4px;color:#4a6280;font-style:italic">This signature verifies the report was generated by SiteNexis from the audit data above and has not been altered.</div>
  </div>

</div>
</body>
</html>`;
}

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch {
    return unauthorizedResponse();
  }

  const { id } = await params;

  try {
    const { getAuditWithResults, getAuditScores, getAIVisibilityScore, getIssuesByAudit, getSseScore } = await import('@sitenexis/db');

    const [audit, scores, aiScores, issues, sse] = await Promise.all([
      getAuditWithResults(id),
      getAuditScores(id),
      getAIVisibilityScore(id),
      getIssuesByAudit(id),
      getSseScore(id).catch(() => null),
    ]);

    if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if ((audit as { userId: string }).userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!scores) return NextResponse.json({ error: 'Audit not complete — run an audit first' }, { status: 404 });

    const auditTyped = audit as { domain: string; createdAt: Date };
    const scoresRecord: Record<string, number | null> = {
      overall: scores.overall, seoScore: scores.seoScore, aiScore: scores.aiScore,
      schemaScore: scores.schemaScore, linkGraphScore: scores.linkGraphScore, performanceScore: scores.performanceScore,
    };
    const aiScoresRecord: Record<string, number | null> = {
      machineReadabilityScore: aiScores?.machineReadabilityScore ?? null,
      entityConfidenceScore: aiScores?.entityConfidenceScore ?? null,
      retrievalReadinessScore: aiScores?.retrievalReadinessScore ?? null,
      citationProbabilityScore: aiScores?.citationProbabilityScore ?? null,
      semanticTrustScore: aiScores?.semanticTrustScore ?? null,
      recommendationConfidence: aiScores?.recommendationConfidence ?? null,
    };

    const sseRecord: Record<string, number | null> | undefined = sse ? {
      geoScore:            sse.geoScore,
      snsMasterScore:      sse.snsMasterScore,
      topicalAuthorityScore: sse.topicalAuthorityScore,
      semanticDensityScore:  sse.semanticDensityScore,
      aiCrawlabilityScore:   sse.aiCrawlabilityScore,
    } : undefined;

    const reportIssues = issues.map((i) => ({ severity: i.severity, message: i.message, recommendation: i.recommendation }));

    // Sign the report from its canonical inputs — tamper-evident report identity
    const { signReport } = await import('@sitenexis/analyzers');
    const integrity = signReport({
      auditId: id,
      input: {
        domain: auditTyped.domain,
        createdAt: auditTyped.createdAt.toISOString(),
        scores: scoresRecord,
        aiScores: aiScoresRecord,
        sse: sseRecord ?? null,
        issues: reportIssues,
      },
    });

    const html = generateReportHTML(
      auditTyped.domain,
      auditTyped.createdAt,
      scoresRecord,
      aiScoresRecord,
      reportIssues,
      sseRecord,
      { reportId: integrity.reportId, inputHash: integrity.inputHash, engineVersion: integrity.engineVersion, signedAt: integrity.signedAt },
    );

    const filename = `sitenexis-report-${auditTyped.domain.replace(/[^a-z0-9.-]/gi, '-')}-${new Date().toISOString().slice(0, 10)}.html`;
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
