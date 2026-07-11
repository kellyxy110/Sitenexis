// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — optional peer dependency; only available when installed
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Font,
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
} from '@react-pdf/renderer';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — react types resolved from root workspace
import { createElement } from 'react';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — optional peer dependency
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — db accessed only by report generator (architectural exception documented in CLAUDE.md)
import { db } from '@sitenexis/db';
import { type AuditScores, type SEOIssueSeverity } from '@sitenexis/shared';
import { signReport, attachOutputHash, type ReportIntegrity } from './integrity';

// ─── Brand tokens ─────────────────────────────────────────────────────────────

const C = {
  navy:     '#0A1628',
  cyan:     '#00C8FF',
  teal:     '#0BCEBC',
  amber:    '#F59E0B',
  red:      '#EF4444',
  green:    '#22C55E',
  lightBg:  '#EBF8FF',
  textDark: '#1A2C42',
  textMid:  '#4A6280',
  white:    '#FFFFFF',
  border:   '#D1E3F0',
};

// Use built-in Helvetica — always available in react-pdf without embedding
Font.register({ family: 'Helvetica', fonts: [] });

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: C.white,
    paddingHorizontal: 40,
    paddingTop: 40,
    paddingBottom: 52,
    color: C.textDark,
    fontSize: 9,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 6,
    fontSize: 8,
    color: C.textMid,
  },

  // ── Cover ──
  coverPage: {
    fontFamily: 'Helvetica',
    backgroundColor: C.navy,
    paddingHorizontal: 50,
    paddingTop: 80,
    paddingBottom: 52,
    flex: 1,
  },
  wordmark: {
    fontSize: 28,
    color: C.cyan,
    letterSpacing: 2,
    marginBottom: 6,
    fontFamily: 'Helvetica-Bold',
  },
  tagline: {
    fontSize: 10,
    color: C.teal,
    letterSpacing: 1,
    marginBottom: 80,
  },
  coverDomain: {
    fontSize: 34,
    color: C.white,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  coverLabel: {
    fontSize: 11,
    color: C.cyan,
    letterSpacing: 2,
    marginBottom: 60,
  },
  coverMeta: {
    fontSize: 9,
    color: C.textMid,
    lineHeight: 1.6,
  },
  coverConfidential: {
    marginTop: 40,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E3A5F',
    fontSize: 8,
    color: '#4A6280',
    letterSpacing: 1,
  },

  // ── Section header ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.navy,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 13,
    color: C.white,
    fontFamily: 'Helvetica-Bold',
    flex: 1,
  },
  sectionScore: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
  },

  // ── Score circles (scorecard) ──
  scorecardRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  scoreCircleWrap: {
    alignItems: 'center',
    width: 90,
  },
  scoreCircleOuter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  scoreCircleNum: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
  },
  scoreCircleLabel: {
    fontSize: 8,
    color: C.textMid,
    textAlign: 'center',
  },

  // ── Severity tally ──
  tallyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 20,
  },
  tallyBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  tallyCount: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
  },
  tallyLabel: {
    fontSize: 8,
    marginTop: 2,
  },

  // ── Issues table ──
  table: {
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: C.navy,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tableRowAlt: {
    backgroundColor: C.lightBg,
  },
  colUrl:   { width: '22%', fontSize: 7, color: C.textDark, paddingRight: 4 },
  colMsg:   { width: '32%', fontSize: 7, color: C.textDark, paddingRight: 4 },
  colSev:   { width: '12%', fontSize: 7, textAlign: 'center' },
  colRec:   { width: '34%', fontSize: 7, color: C.textMid },
  colHeaderText: { fontSize: 7, color: C.white, fontFamily: 'Helvetica-Bold' },

  // ── Stats row ──
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  statBox: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    minWidth: 80,
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: C.navy,
  },
  statLabel: {
    fontSize: 7,
    color: C.textMid,
    marginTop: 2,
  },

  // ── Action plan ──
  actionItem: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  actionNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  actionNumText: {
    fontSize: 9,
    color: C.navy,
    fontFamily: 'Helvetica-Bold',
  },
  actionBody: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: C.textDark,
    marginBottom: 2,
  },
  actionRec: {
    fontSize: 8,
    color: C.textMid,
    lineHeight: 1.4,
  },
  actionSevBadge: {
    fontSize: 7,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginLeft: 8,
    alignSelf: 'flex-start',
  },

  // ── Page title for section pages ──
  pageTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: C.navy,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 9,
    color: C.textMid,
    marginBottom: 18,
  },
});

// ─── Score colour helpers ─────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 90) return C.green;
  if (score >= 70) return C.teal;
  if (score >= 50) return C.amber;
  return C.red;
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs Work';
  return 'Critical';
}

function sevColor(sev: SEOIssueSeverity | string): string {
  if (sev === 'critical') return C.red;
  if (sev === 'warning')  return C.amber;
  return C.teal;
}

function sevBg(sev: SEOIssueSeverity | string): string {
  if (sev === 'critical') return '#FEE2E2';
  if (sev === 'warning')  return '#FEF3C7';
  return '#CCFBF1';
}

// ─── Generic issue shape ──────────────────────────────────────────────────────

interface NormalisedIssue {
  url: string;
  message: string;
  severity: string;
  recommendation: string;
  module: string;
}

function normaliseSeoIssues(scores: AuditScores): NormalisedIssue[] {
  return scores.seo.issues.map((i) => ({
    url: i.url,
    message: i.message,
    severity: i.severity,
    recommendation: i.recommendation,
    module: 'SEO',
  }));
}

function normaliseAiIssues(scores: AuditScores): NormalisedIssue[] {
  return scores.aiReadability.pageScores
    .filter((p) => p.total !== null && (p.total ?? 0) < 50)
    .slice(0, 10)
    .map((p) => ({
      url: p.url,
      message: `AI Readability score: ${p.total ?? 'n/a'}/100`,
      severity: (p.total ?? 0) < 30 ? 'critical' : 'warning',
      recommendation: scores.aiReadability.recommendations[0] ?? 'Improve entity clarity and conversational structure.',
      module: 'AI Readability',
    }));
}

function normaliseSchemaIssues(scores: AuditScores): NormalisedIssue[] {
  return scores.schema.issues.map((i) => ({
    url: i.url,
    message: i.message,
    severity: i.severity,
    recommendation: i.recommendation,
    module: 'Schema',
  }));
}

function normaliseLinkIssues(scores: AuditScores): NormalisedIssue[] {
  const issues: NormalisedIssue[] = [];
  for (const url of scores.linkGraph.orphanPages.slice(0, 5)) {
    issues.push({
      url,
      message: 'Orphan page — no internal links pointing to this URL',
      severity: 'warning',
      recommendation: 'Add at least one internal link to this page from a related page.',
      module: 'Link Graph',
    });
  }
  for (const suggestion of scores.linkGraph.linkSuggestions.slice(0, 5)) {
    issues.push({
      url: suggestion.from,
      message: `Suggested link to: ${suggestion.to}`,
      severity: 'info',
      recommendation: suggestion.reason,
      module: 'Link Graph',
    });
  }
  return issues;
}

function normalisePerformanceIssues(scores: AuditScores): NormalisedIssue[] {
  return scores.performance.issues.map((i) => ({
    url: i.url,
    message: i.message,
    severity: i.severity,
    recommendation: i.recommendation,
    module: 'Performance',
  }));
}

function allIssues(scores: AuditScores): NormalisedIssue[] {
  return [
    ...normaliseSeoIssues(scores),
    ...normaliseAiIssues(scores),
    ...normaliseSchemaIssues(scores),
    ...normaliseLinkIssues(scores),
    ...normalisePerformanceIssues(scores),
  ];
}

// ─── React-PDF component helpers ─────────────────────────────────────────────

function Footer({ pageNumber, domain }: { pageNumber: number; domain: string }) {
  return createElement(View, { style: s.footer }, [
    createElement(Text, { key: 'domain' }, domain),
    createElement(Text, { key: 'conf' }, 'Confidential — SiteNexis Audit Report'),
    createElement(Text, { key: 'pn' }, `Page ${pageNumber}`),
  ]);
}

function ScoreCircle({ score, label }: { score: number; label: string }) {
  const color = scoreColor(score);
  return createElement(View, { style: s.scoreCircleWrap }, [
    createElement(
      View,
      { key: 'outer', style: { ...s.scoreCircleOuter, borderColor: color } },
      [createElement(Text, { key: 'num', style: { ...s.scoreCircleNum, color } }, String(score))]
    ),
    createElement(Text, { key: 'label', style: s.scoreCircleLabel }, label),
    createElement(Text, { key: 'grade', style: { fontSize: 8, color, marginTop: 2 } }, scoreLabel(score)),
  ]);
}

function IssueTable({ issues, showModule = false }: { issues: NormalisedIssue[]; showModule?: boolean }) {
  const rows = issues.slice(0, 10);
  return createElement(View, { style: s.table }, [
    // Header
    createElement(View, { key: 'hdr', style: s.tableHeader }, [
      showModule
        ? createElement(View, { key: 'mod', style: { ...s.colUrl, width: '14%' } },
            [createElement(Text, { style: s.colHeaderText }, 'Module')])
        : null,
      createElement(View, { key: 'url', style: showModule ? { ...s.colUrl, width: '18%' } : s.colUrl },
        [createElement(Text, { style: s.colHeaderText }, 'Page URL')]),
      createElement(View, { key: 'msg', style: s.colMsg },
        [createElement(Text, { style: s.colHeaderText }, 'Issue')]),
      createElement(View, { key: 'sev', style: s.colSev },
        [createElement(Text, { style: s.colHeaderText }, 'Severity')]),
      createElement(View, { key: 'rec', style: s.colRec },
        [createElement(Text, { style: s.colHeaderText }, 'Recommendation')]),
    ].filter(Boolean)),
    // Rows
    ...rows.map((issue, idx) =>
      createElement(
        View,
        { key: `row-${idx}`, style: idx % 2 === 1 ? { ...s.tableRow, ...s.tableRowAlt } : s.tableRow },
        [
          showModule
            ? createElement(View, { key: 'mod', style: { ...s.colUrl, width: '14%' } },
                [createElement(Text, {}, issue.module)])
            : null,
          createElement(View, { key: 'url', style: showModule ? { ...s.colUrl, width: '18%' } : s.colUrl },
            [createElement(Text, {}, truncate(issue.url, 30))]),
          createElement(View, { key: 'msg', style: s.colMsg },
            [createElement(Text, {}, issue.message)]),
          createElement(View, { key: 'sev', style: s.colSev },
            [createElement(Text, {
              style: { color: sevColor(issue.severity), fontFamily: 'Helvetica-Bold', fontSize: 7 },
            }, issue.severity.toUpperCase())]),
          createElement(View, { key: 'rec', style: s.colRec },
            [createElement(Text, {}, truncate(issue.recommendation, 90))]),
        ].filter(Boolean)
      )
    ),
  ]);
}

function StatBox({ value, label }: { value: string | number; label: string }) {
  return createElement(View, { style: s.statBox }, [
    createElement(Text, { key: 'v', style: s.statValue }, String(value)),
    createElement(Text, { key: 'l', style: s.statLabel }, label),
  ]);
}

// ─── Document definition ──────────────────────────────────────────────────────

interface ReportData {
  domain: string;
  auditDate: Date;
  crawlDurationMs: number | null;
  scores: AuditScores;
  integrity: ReportIntegrity;
}

function buildDocument(data: ReportData) {
  const { domain, auditDate, crawlDurationMs, scores, integrity } = data;
  const all = allIssues(scores);
  const criticalCount = all.filter((i) => i.severity === 'critical').length;
  const warningCount  = all.filter((i) => i.severity === 'warning').length;
  const infoCount     = all.filter((i) => i.severity === 'info').length;

  const dateStr = auditDate.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const durationStr = crawlDurationMs
    ? `${Math.round(crawlDurationMs / 1000)}s crawl duration`
    : 'Duration unavailable';

  // Top 10 prioritised actions: critical first, then warning, then info
  const actionPlan = [...all]
    .sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3);
    })
    .filter((v, i, arr) => arr.findIndex((x) => x.message === v.message) === i)
    .slice(0, 10);

  const pages = [
    // ── Page 1: Cover ──────────────────────────────────────────────────────
    createElement(
      Page,
      { key: 'cover', style: s.coverPage },
      [
        createElement(Text, { key: 'wm', style: s.wordmark }, 'SITENEXIS'),
        createElement(Text, { key: 'tl', style: s.tagline }, 'AI RETRIEVAL + MACHINE TRUST INTELLIGENCE'),
        createElement(Text, { key: 'dom', style: s.coverDomain }, domain),
        createElement(Text, { key: 'lbl', style: s.coverLabel }, 'AUDIT REPORT'),
        createElement(View, { key: 'meta' }, [
          createElement(Text, { key: 'd', style: s.coverMeta }, `Date: ${dateStr}`),
          createElement(Text, { key: 'dur', style: { ...s.coverMeta, marginTop: 4 } }, durationStr),
          createElement(Text, { key: 'pages', style: { ...s.coverMeta, marginTop: 4 } },
            `Pages audited: ${scores.seo.issues.map((i) => i.url).filter((v, i, a) => a.indexOf(v) === i).length || 'n/a'}`),
        ]),
        createElement(Text, { key: 'conf', style: s.coverConfidential },
          'CONFIDENTIAL — This report is prepared exclusively for the audited domain owner.'),
        // Integrity signature — verifiable, tamper-evident report identity
        createElement(View, { key: 'integrity', style: { marginTop: 18 } }, [
          createElement(Text, { key: 'id', style: { fontSize: 8, color: C.cyan, letterSpacing: 1, fontFamily: 'Helvetica-Bold' } },
            `REPORT ID: ${integrity.reportId}`),
          createElement(Text, { key: 'hash', style: { fontSize: 7, color: '#4A6280', marginTop: 3 } },
            `Integrity (SHA-256): ${integrity.inputHash}`),
          createElement(Text, { key: 'engine', style: { fontSize: 7, color: '#4A6280', marginTop: 2 } },
            `Engine: ${integrity.engineVersion}  ·  Signed: ${new Date(integrity.signedAt).toISOString()}`),
        ]),
      ]
    ),

    // ── Page 2: Executive Scorecard ────────────────────────────────────────
    createElement(
      Page,
      { key: 'scorecard', size: 'A4', style: s.page },
      [
        createElement(Text, { key: 'title', style: s.pageTitle }, 'Executive Scorecard'),
        createElement(Text, { key: 'sub', style: s.pageSubtitle }, `Audit of ${domain} — ${dateStr}`),

        // Overall score banner
        createElement(View, {
          key: 'overall',
          style: {
            backgroundColor: scoreColor(scores.overall),
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: 6,
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 24,
          },
        }, [
          createElement(Text, {
            key: 'num',
            style: { fontSize: 36, color: C.white, fontFamily: 'Helvetica-Bold', marginRight: 16 },
          }, String(scores.overall)),
          createElement(View, { key: 'info' }, [
            createElement(Text, {
              key: 'lbl',
              style: { fontSize: 14, color: C.white, fontFamily: 'Helvetica-Bold' },
            }, 'Overall Machine Trust Score'),
            createElement(Text, {
              key: 'grade',
              style: { fontSize: 10, color: C.white, marginTop: 2 },
            }, scoreLabel(scores.overall)),
          ]),
        ]),

        // Score circles
        createElement(View, { key: 'circles', style: s.scorecardRow }, [
          createElement(ScoreCircle as unknown as string, { key: 'seo',   score: scores.seo.score,           label: 'SEO Health' }),
          createElement(ScoreCircle as unknown as string, { key: 'ai',    score: scores.aiReadability.score, label: 'AI Readability' }),
          createElement(ScoreCircle as unknown as string, { key: 'schema',score: scores.schema.score,        label: 'Schema' }),
          createElement(ScoreCircle as unknown as string, { key: 'links', score: scores.linkGraph.score,     label: 'Link Strength' }),
          createElement(ScoreCircle as unknown as string, { key: 'perf',  score: scores.performance.score,   label: 'Performance' }),
        ]),

        // Issue severity tally
        createElement(Text, { key: 'issuehdr', style: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.navy, marginBottom: 10 } }, 'Issue Summary'),
        createElement(View, { key: 'tally', style: s.tallyRow }, [
          createElement(View, { key: 'crit', style: { ...s.tallyBadge, backgroundColor: '#FEE2E2' } }, [
            createElement(Text, { key: 'n', style: { ...s.tallyCount, color: C.red } }, String(criticalCount)),
            createElement(Text, { key: 'l', style: { ...s.tallyLabel, color: C.red } }, 'Critical'),
          ]),
          createElement(View, { key: 'warn', style: { ...s.tallyBadge, backgroundColor: '#FEF3C7' } }, [
            createElement(Text, { key: 'n', style: { ...s.tallyCount, color: C.amber } }, String(warningCount)),
            createElement(Text, { key: 'l', style: { ...s.tallyLabel, color: C.amber } }, 'Warning'),
          ]),
          createElement(View, { key: 'info', style: { ...s.tallyBadge, backgroundColor: '#CCFBF1' } }, [
            createElement(Text, { key: 'n', style: { ...s.tallyCount, color: C.teal } }, String(infoCount)),
            createElement(Text, { key: 'l', style: { ...s.tallyLabel, color: C.teal } }, 'Info'),
          ]),
        ]),

        // Stats
        createElement(View, { key: 'stats', style: s.statsRow }, [
          createElement(StatBox as unknown as string, { key: 'pages',  value: scores.linkGraph.nodes.length, label: 'Pages Crawled' }),
          createElement(StatBox as unknown as string, { key: 'orphan', value: scores.linkGraph.orphanPages.length, label: 'Orphan Pages' }),
          createElement(StatBox as unknown as string, { key: 'schema', value: scores.schema.detectedTypes.length, label: 'Schema Types' }),
          createElement(StatBox as unknown as string, { key: 'cov',    value: `${Math.round(scores.schema.coverage * 100)}%`, label: 'Schema Coverage' }),
          createElement(StatBox as unknown as string, { key: 'lcp',    value: scores.performance.lcp ? `${scores.performance.lcp.toFixed(1)}s` : 'N/A', label: 'LCP (median)' }),
        ]),

        createElement(Footer as unknown as string, { key: 'footer', pageNumber: 2, domain }),
      ]
    ),

    // ── Pages 3–8: Module sections ─────────────────────────────────────────
    ...buildModulePage('SEO Health', scores.seo.score, normaliseSeoIssues(scores), 3, domain, [
      { value: scores.seo.issues.filter((i) => i.severity === 'critical').length, label: 'Critical Issues' },
      { value: scores.seo.issues.filter((i) => i.severity === 'warning').length,  label: 'Warnings' },
      { value: Math.round(scores.seo.breakdown.titleOptimisation), label: 'Title Score' },
      { value: Math.round(scores.seo.breakdown.canonicalisation),  label: 'Canonical Score' },
      { value: Math.round(scores.seo.breakdown.crawlability),      label: 'Crawlability' },
    ]),

    ...buildModulePage('AI Readability', scores.aiReadability.score, normaliseAiIssues(scores), 4, domain, [
      { value: Math.round(scores.aiReadability.breakdown.entityClarity), label: 'Entity Clarity' },
      { value: Math.round(scores.aiReadability.breakdown.conversationalReadiness), label: 'Conversational' },
      { value: Math.round(scores.aiReadability.breakdown.aiExtractability), label: 'Extractability' },
      { value: Math.round(scores.aiReadability.breakdown.knowledgeGraphStructure), label: 'Knowledge Graph' },
      { value: scores.aiReadability.missingEntities.length, label: 'Missing Entities' },
    ]),

    ...buildModulePage('Schema Intelligence', scores.schema.score, normaliseSchemaIssues(scores), 5, domain, [
      { value: `${Math.round(scores.schema.coverage * 100)}%`, label: 'Schema Coverage' },
      { value: scores.schema.detectedTypes.length, label: 'Types Detected' },
      { value: scores.schema.issues.filter((i) => i.severity === 'critical').length, label: 'Critical Issues' },
      { value: scores.schema.issues.filter((i) => i.severity === 'warning').length,  label: 'Warnings' },
      { value: scores.schema.issues.filter((i) => i.severity === 'info').length,     label: 'Suggestions' },
    ]),

    ...buildModulePage('Internal Link Graph', scores.linkGraph.score, normaliseLinkIssues(scores), 6, domain, [
      { value: scores.linkGraph.nodes.length,         label: 'Total Pages' },
      { value: scores.linkGraph.orphanPages.length,   label: 'Orphan Pages' },
      { value: scores.linkGraph.edges.length,         label: 'Internal Links' },
      { value: scores.linkGraph.weakClusters.length,  label: 'Weak Clusters' },
      { value: scores.linkGraph.avgPageRank.toFixed(4), label: 'Avg PageRank' },
    ]),

    ...buildModulePage('Performance', scores.performance.score, normalisePerformanceIssues(scores), 7, domain, [
      { value: scores.performance.lighthouseScore ?? 'N/A', label: 'Lighthouse Score' },
      { value: scores.performance.lcp ? `${scores.performance.lcp.toFixed(1)}s` : 'N/A', label: 'LCP (median)' },
      { value: scores.performance.cls ? scores.performance.cls.toFixed(3) : 'N/A', label: 'CLS (median)' },
      { value: scores.performance.ttfb ? `${scores.performance.ttfb}ms` : 'N/A', label: 'TTFB (avg)' },
      { value: scores.performance.issues.filter((i) => i.severity === 'critical').length, label: 'Critical Issues' },
    ]),

    // ── Final page: Action Plan ─────────────────────────────────────────────
    createElement(
      Page,
      { key: 'action', size: 'A4', style: s.page },
      [
        createElement(Text, { key: 'title', style: s.pageTitle }, 'Action Plan'),
        createElement(Text, { key: 'sub', style: s.pageSubtitle },
          'Top 10 highest-impact fixes across all modules, prioritised by severity'),

        ...actionPlan.map((item, idx) =>
          createElement(View, { key: `action-${idx}`, style: s.actionItem }, [
            createElement(View, { key: 'num', style: s.actionNum }, [
              createElement(Text, { key: 't', style: s.actionNumText }, String(idx + 1)),
            ]),
            createElement(View, { key: 'body', style: s.actionBody }, [
              createElement(View, { key: 'row', style: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 } }, [
                createElement(Text, { key: 'title', style: s.actionTitle }, item.message),
                createElement(View, {
                  key: 'badge',
                  style: {
                    ...s.actionSevBadge,
                    backgroundColor: sevBg(item.severity),
                    color: sevColor(item.severity),
                  },
                }, [createElement(Text, { key: 't' }, item.severity.toUpperCase())]),
              ]),
              createElement(Text, { key: 'url', style: { fontSize: 7, color: C.textMid, marginBottom: 3 } }, item.url),
              createElement(Text, { key: 'rec', style: s.actionRec }, item.recommendation),
            ]),
          ])
        ),

        createElement(Footer as unknown as string, { key: 'footer', pageNumber: 8, domain }),
      ]
    ),
  ];

  return createElement(Document, { title: `SiteNexis Audit — ${domain}` }, ...pages);
}

// ─── Module page builder ──────────────────────────────────────────────────────

function buildModulePage(
  title: string,
  score: number,
  issues: NormalisedIssue[],
  pageNumber: number,
  domain: string,
  stats: Array<{ value: string | number; label: string }>
): ReturnType<typeof createElement>[] {
  return [createElement(
    Page,
    { key: `module-${pageNumber}`, size: 'A4', style: s.page },
    [
      // Section header bar
      createElement(View, { key: 'hdr', style: s.sectionHeader }, [
        createElement(Text, { key: 'title', style: s.sectionTitle }, title),
        createElement(Text, {
          key: 'score',
          style: { ...s.sectionScore, color: scoreColor(score) },
        }, `${score} / 100`),
      ]),

      // Stats row
      createElement(View, { key: 'stats', style: s.statsRow },
        stats.map((stat, i) =>
          createElement(StatBox as unknown as string, { key: `stat-${i}`, value: stat.value, label: stat.label })
        )
      ),

      // Issues table
      issues.length > 0
        ? createElement(IssueTable as unknown as string, { key: 'table', issues })
        : createElement(Text, { key: 'no-issues', style: { color: C.teal, fontSize: 10, marginTop: 8 } },
            'No issues detected for this module.'),

      createElement(Footer as unknown as string, { key: 'footer', pageNumber, domain }),
    ]
  )];
}

// ─── S3 uploader ──────────────────────────────────────────────────────────────

function buildS3Client(): S3Client {
  const endpoint  = process.env['S3_ENDPOINT'];
  const region    = process.env['AWS_REGION'] ?? 'auto';
  const accessKey = process.env['S3_ACCESS_KEY_ID'];
  const secretKey = process.env['S3_SECRET_ACCESS_KEY'];

  if (!endpoint || !accessKey || !secretKey) {
    throw new Error('S3 credentials not configured. Set S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.');
  }

  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
  });
}

async function uploadToS3(buffer: Buffer, key: string): Promise<string> {
  const client = buildS3Client();
  const bucket = process.env['S3_BUCKET_NAME'];

  if (!bucket) {
    throw new Error('S3_BUCKET_NAME not configured.');
  }

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: 'application/pdf',
    ContentDisposition: `attachment; filename="${key.split('/').pop()}"`,
  }));

  const endpoint = process.env['S3_ENDPOINT']!;
  return `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generate a PDF audit report, upload it to S3/R2, save the URL to the DB,
 * and return the public PDF URL.
 *
 * @param auditId - The audit record ID from the DB.
 */
export async function generateAuditReport(auditId: string): Promise<{ pdfUrl: string; integrity: ReportIntegrity }> {
  // ── Load audit + scores from DB ──────────────────────────────────────────
  const auditRecord = await db.audit.findFirst({
    where: { id: auditId, archivedAt: null },
    include: { scores: true },
  });

  if (!auditRecord) {
    throw new Error(`Audit ${auditId} not found.`);
  }
  if (!auditRecord.scores) {
    throw new Error(`Audit ${auditId} has no scores yet — run all analyzers before generating a report.`);
  }

  // Reconstruct AuditScores from DB — the DB stores breakdowns as JSON
  const dbScores = auditRecord.scores;
  const breakdown = dbScores.breakdown as Record<string, Record<string, number>>;

  const scores: AuditScores = {
    auditId,
    overall: dbScores.overall,
    seo: {
      score: dbScores.seoScore,
      issues: [],
      breakdown: {
        titleOptimisation:   breakdown['seo']?.['titleOptimisation']   ?? 0,
        metaOptimisation:    breakdown['seo']?.['metaOptimisation']    ?? 0,
        headingStructure:    breakdown['seo']?.['headingStructure']    ?? 0,
        canonicalisation:    breakdown['seo']?.['canonicalisation']    ?? 0,
        crawlability:        breakdown['seo']?.['crawlability']        ?? 0,
        imageOptimisation:   breakdown['seo']?.['imageOptimisation']   ?? 0,
      },
    },
    aiReadability: {
      score: dbScores.aiScore,
      pageScores: [],
      breakdown: {
        entityClarity:              breakdown['ai']?.['entityClarity']              ?? 0,
        conversationalReadiness:    breakdown['ai']?.['conversationalReadiness']    ?? 0,
        aiExtractability:           breakdown['ai']?.['aiExtractability']           ?? 0,
        knowledgeGraphStructure:    breakdown['ai']?.['knowledgeGraphStructure']    ?? 0,
      },
      missingEntities: [],
      recommendations: [],
    },
    schema: {
      score: dbScores.schemaScore,
      issues: [],
      detectedTypes: [],
      coverage: breakdown['schema']?.['coverage'] ?? 0,
      pageAnalyses: [],
    },
    linkGraph: {
      score: dbScores.linkGraphScore,
      nodes: [],
      edges: [],
      orphanPages: [],
      deadEndPages: [],
      overlinkedPages: [],
      underlinkedCriticalPages: [],
      weakClusters: [],
      avgPageRank: (breakdown['linkGraph'] as Record<string, unknown> | undefined)?.['avgPageRank'] as number ?? 0,
      linkSuggestions: [],
      structuralIssues: [],
      linkAuthorityFlowScore: (breakdown['linkGraph'] as Record<string, unknown> | undefined)?.['linkAuthorityFlowScore'] as number ?? 0,
      hierarchyDepth: (breakdown['linkGraph'] as Record<string, unknown> | undefined)?.['hierarchyDepth'] as number ?? 0,
      externalLinkMeta: { externalLinkCount: 0, topDomains: [], nofollowRatio: 0, externalAuthorityScore: 0 },
    },
    performance: {
      score: dbScores.performanceScore,
      lighthouseScore: null,
      lcp: breakdown['performance']?.['lcp'] ?? null,
      fid: breakdown['performance']?.['fid'] ?? null,
      cls: breakdown['performance']?.['cls'] ?? null,
      ttfb: breakdown['performance']?.['ttfb'] ?? null,
      pageResults: [],
      issues: [],
    },
    machineReadability: {
      score: (breakdown['machineReadability'] as Record<string, number> | undefined) ? 0 : 0,
      breakdown: {
        renderingFidelity: 0,
        boilerplateRatio: 0,
        chunkBoundaryQuality: 0,
        signalToNoiseRatio: 0,
        headingHierarchy: 0,
        readingOrderConsistency: 0,
        linkAnchorQuality: 0,
      },
      issues: [],
      pageScores: [],
    },
    entityIntelligence: {
      entitiesDetected: [],
      primaryEntity: null,
      entityConsistencyScore: 0,
      entityCoverageScore: 0,
      disambiguationScore: 0,
      entityConfidenceScore: 0,
      inconsistencies: [],
      missingAttributes: [],
      recommendations: [],
    },
    citationAnalysis: {
      citationProbabilityScore: 0,
      pageAnalyses: [],
      topCitationCandidates: [],
      citationBlockers: [],
      recommendations: [],
    },
    semanticTrust: {
      score: 0,
      breakdown: {
        authorshipTrust: 0,
        organisationalTrust: 0,
        contentTrust: 0,
        structuralTrust: 0,
      },
      issues: [],
      trustSignalsPresent: [],
      trustSignalsMissing: [],
    },
    perceptionGraph: {
      auditId,
      nodes: [],
      edges: [],
      perceptionConfidenceScore: 0,
    },
  };

  const auditDate = auditRecord.completedAt ?? auditRecord.createdAt;

  // ── Sign the report from its canonical inputs (before render) ─────────────
  const integrity = signReport({
    auditId,
    input: { domain: auditRecord.domain, auditDate: auditDate.toISOString(), scores },
    // Deterministic PDF — no LLM contribution, so prompt/model stay null.
  });

  const reportData: ReportData = {
    domain: auditRecord.domain,
    auditDate,
    crawlDurationMs: auditRecord.crawlDurationMs,
    scores,
    integrity,
  };

  // ── Render PDF ───────────────────────────────────────────────────────────
  const doc = buildDocument(reportData);
  const buffer = await renderToBuffer(doc);

  // Hash the rendered artifact so the delivered file can be verified later.
  const signedIntegrity = attachOutputHash(integrity, buffer);

  // ── Upload to S3/R2 ──────────────────────────────────────────────────────
  const timestamp = Date.now();
  const s3Key = `reports/${auditId}/${timestamp}.pdf`;
  const pdfUrl = await uploadToS3(buffer, s3Key);

  // ── Persist Report record ────────────────────────────────────────────────
  const generatedAt = new Date();
  const expiresAt   = new Date(generatedAt.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.report.upsert({
    where: { auditId },
    create: { auditId, pdfUrl, generatedAt, expiresAt },
    update: { pdfUrl, generatedAt, expiresAt },
  });

  return { pdfUrl, integrity: signedIntegrity };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len - 1) + '…';
}
