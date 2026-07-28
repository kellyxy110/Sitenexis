/**
 * Direct-pipeline validation runner.
 * Creates real Audit rows against the production DB and runs the exact
 * `runServerlessAudit` pipeline used in production, bypassing the web UI,
 * Supabase auth, and the credit-gated API route entirely.
 *
 * Usage (from apps/web):
 *   node_modules/.bin/tsx scripts/validate-5-sites.mts
 *
 * Temporary validation tool — not part of the app. Delete after use.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

function loadEnv(path: string): void {
  const txt = readFileSync(path, 'utf8');
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv('C:/Users/user/desktop/SiteNexis/apps/web/.env');

const OUT_DIR = 'C:/Users/user/AppData/Local/Temp/claude/C--Users-user-desktop-SiteNexis/a9f389e6-006d-4641-8b38-d73c6f437582/scratchpad/validation-results';
mkdirSync(OUT_DIR, { recursive: true });

const SITES: Array<{ label: string; domain: string }> = [
  { label: 'sitenexis',       domain: 'sitenexis.vercel.app' },
  { label: 'saas',            domain: 'linear.app' },
  { label: 'ecommerce',       domain: 'allbirds.com' },
  { label: 'gov-edu',         domain: 'www.harvard.edu' },
  { label: 'thin-content',    domain: 'example.com' },
];

async function main(): Promise<void> {
  const db = await import('@sitenexis/db');
  const { runServerlessAudit } = await import('../src/lib/serverless-audit');

  const owner = await db.getUserByEmail('kellyxy110@gmail.com');
  if (!owner) throw new Error('Owner user kellyxy110@gmail.com not found in production DB');
  console.log(`[validation] owner user id: ${owner.id}`);

  for (const site of SITES) {
    console.log(`\n[validation] ===== ${site.label} (${site.domain}) =====`);
    const t0 = Date.now();
    const audit = await db.createAudit(owner.id, site.domain);
    console.log(`[validation] created audit ${audit.id}`);

    try {
      await runServerlessAudit(audit.id, site.domain, owner.id);
    } catch (err) {
      console.error(`[validation] runServerlessAudit threw for ${site.domain}:`, err);
    }

    const full = await db.getAuditWithResults(audit.id);
    const [
      issues, trust, temporal, retrievalSims, surfaceMap,
      sii, scout, ige, aiGov, redlab, syntheticEntity,
    ] = await Promise.all([
      db.getIssuesByAudit(audit.id).catch((e: unknown) => ({ error: String(e) })),
      db.getMachineTrustScore(audit.id).catch((e: unknown) => ({ error: String(e) })),
      db.getTemporalAuthorityRecord(audit.id).catch((e: unknown) => ({ error: String(e) })),
      db.getRetrievalSimulations(audit.id).catch((e: unknown) => ({ error: String(e) })),
      db.getRecommendationSurfaceMap(audit.id).catch((e: unknown) => ({ error: String(e) })),
      db.getSIIScore(audit.id).catch((e: unknown) => ({ error: String(e) })),
      db.getScoutAnalysis(audit.id).catch((e: unknown) => ({ error: String(e) })),
      db.getIGEResult(audit.id).catch((e: unknown) => ({ error: String(e) })),
      db.getAiGovernanceReport(audit.id).catch((e: unknown) => ({ error: String(e) })),
      db.getRedLabReport(audit.id).catch((e: unknown) => ({ error: String(e) })),
      db.getLatestSyntheticEntityAnalysis(audit.id).catch((e: unknown) => ({ error: String(e) })),
    ]);

    const result = {
      label: site.label,
      domain: site.domain,
      auditId: audit.id,
      durationMs: Date.now() - t0,
      status: full && 'status' in full ? full.status : null,
      pageCount: full && 'pageCount' in full ? full.pageCount : null,
      scores: full && 'scores' in full ? full.scores : null,
      aiVisibilityScores: full && 'aiVisibilityScores' in full ? full.aiVisibilityScores : null,
      agentManifest: full && 'agentManifest' in full ? (full as Record<string, unknown>)['agentManifest'] : null,
      issuesCount: Array.isArray(issues) ? issues.length : issues,
      issuesSample: Array.isArray(issues) ? issues.slice(0, 20) : issues,
      trust,
      temporal,
      retrievalSims,
      surfaceMap,
      sii,
      scout,
      ige,
      aiGov,
      redlab,
      syntheticEntity,
    };

    const outPath = `${OUT_DIR}/${site.label}.json`;
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(`[validation] wrote ${outPath} (${Date.now() - t0}ms, status=${result.status}, pages=${result.pageCount})`);
  }

  console.log('\n[validation] all sites complete');
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
