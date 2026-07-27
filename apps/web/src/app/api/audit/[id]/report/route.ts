export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import type {
  MRSInput,
  MRSReport,
  RetrievalSimulationResult,
  MachineTrustScore,
  TemporalAuthorityResult,
  RecommendationSurfaceMap,
  SyntheticEntityAnalysis,
} from '@sitenexis/shared';

interface EntitySummary {
  name: string;
  type: string;
  mentionCount: number;
  consistencyScore: number;
  disambiguationScore: number;
  sameAsUrls: string[];
}

interface ExecutiveSummarySectionLite {
  name: string;
  score: number;
  score_label: string;
  strengths: string[];
  issues: string[];
  narrative: string;
}

interface ExecutiveSummaryLite {
  overall_verdict: string;
  composite_score: number;
  composite_label: string;
  sections: ExecutiveSummarySectionLite[];
  top_recommendations: string[];
  benchmark_statement: string;
  trajectory: string;
}

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

interface SecuritySummary {
  overallScore: number | null;
  grade: string;
  secretsFound: number;
  riskyFilesExposed: number;
  headers: { assessed: boolean; score: number | null };
  trustSignals: { score: number; present: string[]; socialProfiles: string[] };
  findings: { severity: string; title: string; recommendation: string }[];
}

interface BrandSummary {
  brandPresenceScore: number;
  foundProfiles: { platform: string; inSameAs: boolean }[];
  missingRecommended: string[];
  notes: string[];
}

function securitySection(sec: SecuritySummary): string {
  const headerLine = sec.headers.assessed
    ? `Security headers: <span style="color:#cbd5e1">${sec.headers.score}/100</span>`
    : `Security headers: <span style="color:#94a3b8">not assessed (headers unavailable)</span>`;
  const top = sec.findings.slice(0, 8).map((f) => issueRow({ severity: f.severity, message: f.title, recommendation: f.recommendation }));
  return `
    <div class="section-label" style="margin-top:8px">Security &amp; Trust</div>
    <div class="score-grid">
      ${card('Security & Trust', sec.overallScore)}
      <div style="background:#0d2137;border:1px solid #1e3a5f;border-radius:8px;padding:14px;flex:2;min-width:220px">
        <div style="color:#94a3b8;font-size:12px;line-height:1.9">
          ${headerLine}<br>
          Trust signals: <span style="color:#cbd5e1">${sec.trustSignals.score}/100</span> · social: ${sec.trustSignals.socialProfiles.length ? escHtml(sec.trustSignals.socialProfiles.join(', ')) : '<span style="color:#ef4444">none</span>'}<br>
          Exposed secrets: <span style="color:${sec.secretsFound > 0 ? '#ef4444' : '#22c55e'}">${sec.secretsFound}</span> · risky files: <span style="color:${sec.riskyFilesExposed > 0 ? '#ef4444' : '#22c55e'}">${sec.riskyFilesExposed}</span>
        </div>
      </div>
    </div>
    ${top.length > 0 ? `<table style="width:100%;border-collapse:collapse;margin-bottom:24px"><tbody>${top.join('')}</tbody></table>` : ''}`;
}

function brandSection(brand: BrandSummary): string {
  const profiles = brand.foundProfiles.length
    ? brand.foundProfiles.map((p) => `<span style="display:inline-block;background:#0d2137;border:1px solid #1e3a5f;border-radius:12px;padding:3px 10px;margin:2px;font-size:12px;color:#cbd5e1">${escHtml(p.platform)}${p.inSameAs ? ' <span style="color:#22c55e">✓ sameAs</span>' : ''}</span>`).join('')
    : '<span style="color:#ef4444;font-size:12px">No profiles detected</span>';
  const notes = brand.notes.slice(0, 4).map((n) => `<li style="margin-bottom:4px">${escHtml(n)}</li>`).join('');
  return `
    <div class="section-label" style="margin-top:8px">Brand Presence</div>
    <div class="score-grid">
      ${card('Brand Presence', brand.brandPresenceScore)}
      <div style="background:#0d2137;border:1px solid #1e3a5f;border-radius:8px;padding:14px;flex:2;min-width:220px">
        <div style="margin-bottom:6px">${profiles}</div>
        ${brand.missingRecommended.length ? `<div style="color:#94a3b8;font-size:12px">Missing recommended: ${escHtml(brand.missingRecommended.join(', '))}</div>` : ''}
      </div>
    </div>
    ${notes ? `<ul style="color:#94a3b8;font-size:12px;margin:0 0 24px 18px">${notes}</ul>` : ''}`;
}

function intelligenceReportSection(summary: ExecutiveSummaryLite | null): string {
  if (!summary) {
    return `
    <div class="section-label" style="margin-top:8px">Intelligence Report</div>
    <p style="color:#4a6280;font-style:italic;padding:12px 0 24px">Not yet generated for this audit. Open the Intelligence Report tab on the dashboard once, then re-download this PDF to include the full editorial assessment.</p>`;
  }
  const compositeColor = scoreColor(summary.composite_score * 10);
  const sections = summary.sections.map((s) => `
    <div style="background:#0d2137;border:1px solid #1e3a5f;border-radius:8px;padding:14px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;gap:12px">
        <div style="color:#f1f5f9;font-size:13px;font-weight:700">${escHtml(s.name)}</div>
        <div style="color:#00c8ff;font-size:13px;font-weight:700;white-space:nowrap">${s.score.toFixed(1)}/10 · ${escHtml(s.score_label)}</div>
      </div>
      <div style="color:#94a3b8;font-size:12px;margin-bottom:6px">${escHtml(s.narrative)}</div>
      ${s.strengths.length ? `<div style="color:#22c55e;font-size:11px;margin-bottom:2px">+ ${s.strengths.map(escHtml).join(' · ')}</div>` : ''}
      ${s.issues.length ? `<div style="color:#f59e0b;font-size:11px">− ${s.issues.map(escHtml).join(' · ')}</div>` : ''}
    </div>`).join('');
  const recs = summary.top_recommendations.map((r) => `<li style="margin-bottom:4px">${escHtml(r)}</li>`).join('');
  return `
    <div class="section-label" style="margin-top:8px">Intelligence Report</div>
    <div style="background:#0d2137;border:1px solid #1e3a5f;border-radius:8px;padding:14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div style="color:#cbd5e1;font-size:13px;max-width:640px">${escHtml(summary.overall_verdict)}</div>
      <div style="text-align:right">
        <div style="color:#94a3b8;font-size:11px">COMPOSITE</div>
        <div style="color:${compositeColor};font-size:28px;font-weight:700">${summary.composite_score.toFixed(1)}/10</div>
        <div style="color:${compositeColor};font-size:11px">${escHtml(summary.composite_label)}</div>
      </div>
    </div>
    ${sections}
    ${recs ? `<div style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;margin:12px 0 4px">Top Recommendations</div><ul style="color:#cbd5e1;font-size:12px;margin:0 0 10px 18px">${recs}</ul>` : ''}
    <div style="color:#64748b;font-size:11px;font-style:italic;margin-bottom:24px">${escHtml(summary.benchmark_statement)} ${escHtml(summary.trajectory)}</div>`;
}

function machineResourceSection(mrs: MRSReport): string {
  const cards = mrs.scoreCards.map((c) => card(c.label, c.value)).join('');
  const strengths = mrs.strengths.map((s) => `<li style="margin-bottom:4px">${escHtml(s)}</li>`).join('');
  const weaknesses = mrs.weaknesses.map((s) => `<li style="margin-bottom:4px">${escHtml(s)}</li>`).join('');
  const recs = mrs.recommendations.slice(0, 8).map((r) => {
    const badge = r.priority === 'P0' ? '#ef4444' : r.priority === 'P1' ? '#f59e0b' : '#3b82f6';
    return `<tr style="border-bottom:1px solid #1e3a5f">
      <td style="padding:8px 10px;vertical-align:top"><span style="background:${badge};color:#fff;font-size:10px;padding:2px 7px;border-radius:4px">${escHtml(r.priority)}</span></td>
      <td style="padding:8px 10px;color:#cbd5e1;font-size:12px;vertical-align:top">${escHtml(r.title)}</td>
      <td style="padding:8px 10px;color:#94a3b8;font-size:11px;vertical-align:top;white-space:nowrap">${escHtml(r.difficulty)} · ${escHtml(r.estimatedTime)}</td>
    </tr>`;
  }).join('');
  return `
    <div class="section-label" style="margin-top:8px">Machine Resource Studio</div>
    <div class="score-grid">${cards}</div>
    <div style="color:#cbd5e1;font-size:13px;margin-bottom:8px">${escHtml(mrs.executiveSummary)}</div>
    <div style="color:#94a3b8;font-size:12px;margin-bottom:6px">${escHtml(mrs.technicalExplanation)}</div>
    <div style="color:#94a3b8;font-size:12px;margin-bottom:12px">${escHtml(mrs.aiExplanation)}</div>
    ${strengths || weaknesses ? `<div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:12px">
      ${strengths ? `<div style="flex:1;min-width:220px"><div style="color:#22c55e;font-size:11px;font-weight:700;margin-bottom:4px">STRENGTHS</div><ul style="color:#cbd5e1;font-size:12px;margin:0 0 0 16px">${strengths}</ul></div>` : ''}
      ${weaknesses ? `<div style="flex:1;min-width:220px"><div style="color:#ef4444;font-size:11px;font-weight:700;margin-bottom:4px">WEAKNESSES</div><ul style="color:#cbd5e1;font-size:12px;margin:0 0 0 16px">${weaknesses}</ul></div>` : ''}
    </div>` : ''}
    ${recs ? `<table style="width:100%;border-collapse:collapse;margin-bottom:12px"><tbody>${recs}</tbody></table>` : ''}
    ${mrs.limitations.length ? `<div style="color:#64748b;font-size:11px;font-style:italic;margin-bottom:24px">Limitations: ${mrs.limitations.map(escHtml).join(' ')}</div>` : '<div style="margin-bottom:24px"></div>'}`;
}

function entityIntelligenceSection(entities: EntitySummary[]): string {
  if (!entities.length) {
    return `<div class="section-label" style="margin-top:8px">Entity Intelligence</div><p style="color:#4a6280;font-style:italic;padding:12px 0 24px">No entities detected for this audit.</p>`;
  }
  const rows = entities.slice(0, 15).map((e) => `
    <tr style="border-bottom:1px solid #1e3a5f">
      <td style="padding:8px 10px;color:#cbd5e1;font-size:12px">${escHtml(e.name)}</td>
      <td style="padding:8px 10px;color:#94a3b8;font-size:11px">${escHtml(e.type)}</td>
      <td style="padding:8px 10px;color:#94a3b8;font-size:11px">${e.mentionCount}</td>
      <td style="padding:8px 10px;color:${e.consistencyScore >= 70 ? '#22c55e' : '#f59e0b'};font-size:11px">${Math.round(e.consistencyScore)}</td>
      <td style="padding:8px 10px;color:${e.disambiguationScore >= 70 ? '#22c55e' : '#f59e0b'};font-size:11px">${Math.round(e.disambiguationScore)}</td>
      <td style="padding:8px 10px;color:#64748b;font-size:11px">${e.sameAsUrls.length}</td>
    </tr>`).join('');
  return `
    <div class="section-label" style="margin-top:8px">Entity Intelligence (${entities.length})</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <thead><tr style="background:#0d2137">
        <th style="padding:8px 10px;text-align:left;color:#64748b;font-size:10px;text-transform:uppercase">Entity</th>
        <th style="padding:8px 10px;text-align:left;color:#64748b;font-size:10px;text-transform:uppercase">Type</th>
        <th style="padding:8px 10px;text-align:left;color:#64748b;font-size:10px;text-transform:uppercase">Mentions</th>
        <th style="padding:8px 10px;text-align:left;color:#64748b;font-size:10px;text-transform:uppercase">Consistency</th>
        <th style="padding:8px 10px;text-align:left;color:#64748b;font-size:10px;text-transform:uppercase">Disambig.</th>
        <th style="padding:8px 10px;text-align:left;color:#64748b;font-size:10px;text-transform:uppercase">sameAs</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function machineTrustSection(trust: MachineTrustScore | null): string {
  if (!trust) return '';
  return `
    <div class="section-label" style="margin-top:8px">Machine Trust</div>
    <div class="score-grid">
      ${card('Machine Trust', trust.overall)}
      ${card('Entity Credibility', trust.entityCredibilityScore)}
      ${card('Schema Alignment', trust.schemaTrustAlignmentScore)}
      ${card('External Validation', trust.externalValidationScore)}
      ${card('Contradiction Absence', trust.contradictionAbsenceScore)}
      ${card('Degradation Resistance', trust.trustDegradationResistance)}
    </div>
    <div style="color:#94a3b8;font-size:12px;margin-bottom:24px">Cross-source validation index: ${Math.round(trust.crossSourceValidationIndex * 100)}% of claims externally validated.</div>`;
}

function temporalAuthoritySection(t: TemporalAuthorityResult | null): string {
  if (!t) return '';
  if (t.isBaseline) {
    return `<div class="section-label" style="margin-top:8px">Temporal Authority</div><p style="color:#4a6280;font-style:italic;padding:12px 0 24px">Baseline established on this audit. Velocity and drift will be calculated starting with the next audit.</p>`;
  }
  return `
    <div class="section-label" style="margin-top:8px">Temporal Authority</div>
    <div class="score-grid">
      ${card('Authority Velocity', t.authorityVelocityScore)}
      ${card('Trust Stability', Math.round(t.trustStabilityIndex * 100))}
      ${card('Content Freshness', Math.round(t.contentFreshnessImpactFactor * 100))}
      ${card('Semantic Drift Resistance', Math.round((1 - t.semanticDriftIndex) * 100))}
    </div>
    <div style="color:#94a3b8;font-size:12px;margin-bottom:24px">Update frequency: <span style="color:#cbd5e1">${escHtml(t.updateFrequencyClassification)}</span>${t.stalePagesAtRisk.length ? ` · ${t.stalePagesAtRisk.length} page(s) at risk of decay` : ''}</div>`;
}

function recommendationSurfacesSection(s: RecommendationSurfaceMap | null): string {
  if (!s) return '';
  return `
    <div class="section-label" style="margin-top:8px">Recommendation Surfaces <span style="color:#4a6280;font-weight:400;text-transform:none;letter-spacing:0">(estimated)</span></div>
    <div class="score-grid">
      ${card('AI Overviews', s.surfaces.aiOverviews.inclusionProbability)}
      ${card('Chat Recommendation', s.surfaces.chatRecommendation.inclusionProbability)}
      ${card('Voice Retrieval', s.surfaces.voiceRetrieval.inclusionProbability)}
      ${card('Agent Discovery', s.surfaces.agentDiscovery.inclusionProbability)}
    </div>
    ${s.missingVisibilityChannels.length ? `<div style="color:#94a3b8;font-size:12px;margin-bottom:24px">Missing visibility channels: ${s.missingVisibilityChannels.map(escHtml).join(', ')}</div>` : '<div style="margin-bottom:24px"></div>'}`;
}

function retrievalSimulationSection(sims: RetrievalSimulationResult[]): string {
  const simulated = sims.filter((r) => r.simulated);
  if (!simulated.length) return '';
  const avg = (vals: number[]): number | null => (vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null);
  const fragile = simulated.reduce((s, r) => s + r.fragileClaimsCount, 0);
  return `
    <div class="section-label" style="margin-top:8px">Retrieval Simulation (${simulated.length} page${simulated.length === 1 ? '' : 's'} sampled)</div>
    <div class="score-grid">
      ${card('Retrieval Quality', avg(simulated.map((r) => r.retrievalQualityScore ?? 0)))}
      ${card('Chunk Stability', avg(simulated.map((r) => (r.chunkStabilityIndex ?? 0) * 100)))}
      ${card('Citation Eligibility', avg(simulated.map((r) => r.citationEligibilityScore ?? 0)))}
    </div>
    <div style="color:#94a3b8;font-size:12px;margin-bottom:24px">${fragile} claim(s) flagged as fragile under summarisation compression.</div>`;
}

function authenticitySection(s: SyntheticEntityAnalysis | null): string {
  if (!s) return '';
  const patterns = s.detectedPatterns.slice(0, 6).map((p) => `<li style="margin-bottom:4px">${escHtml(p.patternType.replace(/_/g, ' '))} <span style="color:#64748b">(confidence ${Math.round(p.confidence * 100)}%)</span></li>`).join('');
  return `
    <div class="section-label" style="margin-top:8px">Entity Authenticity</div>
    <div class="score-grid">
      ${card('Authenticity Confidence', s.entityAuthenticityConfidence)}
      ${card('Network Integrity', s.networkIntegrityScore)}
    </div>
    ${patterns ? `<div style="color:#94a3b8;font-size:11px;font-weight:700;text-transform:uppercase;margin-bottom:4px">Detected Patterns</div><ul style="color:#cbd5e1;font-size:12px;margin:0 0 24px 18px">${patterns}</ul>` : '<div style="margin-bottom:24px"></div>'}`;
}

function generateReportHTML(
  domain: string,
  createdAt: Date,
  scores: Record<string, number | null>,
  aiScores: Record<string, number | null>,
  issues: Array<{ severity: string; message: string; recommendation: string }>,
  sseScores: Record<string, number | null> | undefined,
  integrity: { reportId: string; inputHash: string; engineVersion: string; signedAt: string },
  security: SecuritySummary | null,
  brand: BrandSummary | null,
  extras: {
    intelligence: ExecutiveSummaryLite | null;
    mrs: MRSReport;
    entities: EntitySummary[];
    trust: MachineTrustScore | null;
    temporal: TemporalAuthorityResult | null;
    surfaces: RecommendationSurfaceMap | null;
    retrieval: RetrievalSimulationResult[];
    authenticity: SyntheticEntityAnalysis | null;
  },
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

  ${intelligenceReportSection(extras.intelligence)}
  ${machineResourceSection(extras.mrs)}
  ${entityIntelligenceSection(extras.entities)}
  ${machineTrustSection(extras.trust)}
  ${temporalAuthoritySection(extras.temporal)}
  ${recommendationSurfacesSection(extras.surfaces)}
  ${retrievalSimulationSection(extras.retrieval)}
  ${authenticitySection(extras.authenticity)}

  ${security ? securitySection(security) : ''}
  ${brand ? brandSection(brand) : ''}

  ${critical.length > 0 ? `<div class="section-label" style="margin-top:8px">Critical Issues (${critical.length})</div>${issueTable(critical)}` : ''}
  ${warnings.length > 0 ? `<div class="section-label">Warnings (${warnings.length})</div>${issueTable(warnings)}` : ''}
  ${!hasIssues ? '<div class="section-label">Issues</div><p style="color:#4a6280;font-style:italic;padding:12px 0">No issues detected in this audit.</p>' : ''}

  <div style="margin-top:40px;padding-top:14px;border-top:1px solid #1e3a5f;color:#4a6280;font-size:11px;text-align:center">
    Generated by SiteNexis · AI Retrieval + Machine Trust Intelligence System · sitenexis.vercel.app<br>
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
    const {
      getAuditWithResults, getAuditScores, getAIVisibilityScore, getIssuesByAudit, getSseScore,
      getMachineTrustScore, getTemporalAuthorityRecord, getRetrievalSimulations, getRecommendationSurfaceMap,
      getEntitiesByAudit, getLatestSyntheticEntityAnalysis,
    } = await import('@sitenexis/db');

    const [audit, scores, aiScores, issues, sse, trust, temporal, retrievalSims, surfaceMap, rawEntities, authenticity] = await Promise.all([
      getAuditWithResults(id),
      getAuditScores(id),
      getAIVisibilityScore(id),
      getIssuesByAudit(id),
      getSseScore(id).catch(() => null),
      getMachineTrustScore(id).catch(() => null),
      getTemporalAuthorityRecord(id).catch(() => null),
      getRetrievalSimulations(id).catch(() => [] as RetrievalSimulationResult[]),
      getRecommendationSurfaceMap(id).catch(() => null),
      getEntitiesByAudit(id).catch(() => []),
      getLatestSyntheticEntityAnalysis(id).catch(() => null),
    ]);

    if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if ((audit as { userId: string }).userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!scores) return NextResponse.json({ error: 'Audit not complete — run an audit first' }, { status: 404 });

    const auditTyped = audit as {
      id: string;
      domain: string;
      createdAt: Date;
      completedAt: Date | null;
      pageCount: number | null;
      pages: Array<{ id: string; url: string; statusCode: number; isIndexable: boolean; wordCount: number; internalLinks: number; externalLinks: number }>;
    };
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

    // Security & Brand Presence live in the auditScore breakdown JSON (Modules 12 & 13)
    const breakdown = (scores as { breakdown?: Record<string, unknown> }).breakdown ?? {};
    const security = (breakdown['security'] ?? null) as SecuritySummary | null;
    const brand = (breakdown['brandPresence'] ?? null) as BrandSummary | null;

    const mrsInput: MRSInput = {
      audit: {
        id: auditTyped.id,
        domain: auditTyped.domain,
        completedAt: auditTyped.completedAt?.toISOString() ?? null,
        pageCount: auditTyped.pageCount,
      },
      scores: scores ? {
        overall: scores.overall, seoScore: scores.seoScore, aiScore: scores.aiScore,
        schemaScore: scores.schemaScore, linkGraphScore: scores.linkGraphScore, performanceScore: scores.performanceScore,
      } : null,
      aiVisibility: aiScores ? {
        aiVisibilityScore: aiScores.aiVisibilityScore,
        machineReadabilityScore: aiScores.machineReadabilityScore,
        entityConfidenceScore: aiScores.entityConfidenceScore,
        retrievalReadinessScore: aiScores.retrievalReadinessScore,
        citationProbabilityScore: aiScores.citationProbabilityScore,
        semanticTrustScore: aiScores.semanticTrustScore,
        recommendationConfidence: aiScores.recommendationConfidence,
      } : null,
      pages: auditTyped.pages.map((p) => ({ id: p.id, url: p.url, statusCode: p.statusCode, isIndexable: p.isIndexable, wordCount: p.wordCount, internalLinks: p.internalLinks, externalLinks: p.externalLinks })),
      issues: issues.map((i) => ({ id: i.id, module: i.module, type: i.type, severity: i.severity, message: i.message, recommendation: i.recommendation, ...(i.pageUrl !== undefined ? { pageUrl: i.pageUrl } : {}), createdAt: i.createdAt.toISOString() })),
    };
    const { buildMachineResourceStudioReport } = await import('@sitenexis/analyzers');
    const mrs = buildMachineResourceStudioReport(mrsInput);

    const entitySummaries: EntitySummary[] = rawEntities.map((e) => ({
      name: e.name, type: e.type, mentionCount: e.mentionCount,
      consistencyScore: e.consistencyScore, disambiguationScore: e.disambiguationScore, sameAsUrls: e.sameAsUrls,
    }));

    // Intelligence Report — best effort, read-only: the Reporting agent never triggers new AI
    // analysis (CLAUDE.md §29), so this only surfaces an already-generated & cached summary.
    let intelligence: ExecutiveSummaryLite | null = null;
    try {
      const { createRedisClient, getRedisUrl } = await import('@sitenexis/crawler');
      if (getRedisUrl()) {
        const client = createRedisClient(false);
        const cached = await client.get(`exec-summary:${id}:v1.0`);
        if (cached) intelligence = JSON.parse(cached) as ExecutiveSummaryLite;
      }
    } catch { /* best effort — Redis unavailable */ }

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
      security,
      brand,
      { intelligence, mrs, entities: entitySummaries, trust, temporal, surfaces: surfaceMap, retrieval: retrievalSims, authenticity },
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
