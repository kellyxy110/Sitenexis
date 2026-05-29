/**
 * AI Engine Stability Test Suite — TEST MODE ONLY
 * Do NOT modify production code. Execute and report only.
 */

import { analyzeMachineReadability } from './packages/analyzers/src/machine-readability/engine';
import { analyzeCitationProbability } from './packages/analyzers/src/citation/engine';
import { buildPerceptionGraph } from './packages/analyzers/src/perception-graph/engine';
import { analyzeEntityIntelligence } from './packages/analyzers/src/entity/engine';
import { analyzeSemanticTrust } from './packages/analyzers/src/semantic-trust/engine';
import type { CrawledPage } from './packages/shared/src/types';

// Fixture matching the exact CrawledPage shape from packages/shared/src/types.ts
const makePage = (url: string, bodyText: string, h1: string | null, schemaMarkup: unknown[] = []): CrawledPage => ({
  url,
  statusCode: 200,
  redirectChain: [],
  title: h1,
  metaDescription: 'Test page meta description for ' + url,
  h1,
  headings: h1 ? [{ level: 1, text: h1 }] : [],
  bodyText,
  wordCount: bodyText.split(/\s+/).length,
  internalLinks: ['https://github.com/', 'https://github.com/features', 'https://github.com/pricing'],
  externalLinks: ['https://en.wikipedia.org/wiki/GitHub'],
  images: [{ src: 'https://github.com/logo.png', alt: 'GitHub logo' }],
  canonicalUrl: url,
  robotsDirectives: [],
  schemaMarkup,
  responseTimeMs: 300,
  contentType: 'text/html',
  crawledAt: new Date('2026-05-26T00:00:00Z'),
});

const BODY_HOME = `GitHub is a developer platform founded in 2008 by Tom Preston-Werner, Chris Wanstrath, PJ Hyett, and Scott Chacon.
It was acquired by Microsoft in 2018 for approximately 7.5 billion USD.
GitHub hosts over 100 million developers and more than 420 million repositories.
The platform provides Git-based version control, collaboration tools, CI/CD pipelines via GitHub Actions,
project management features, security scanning, and AI-assisted coding through GitHub Copilot.
GitHub is headquartered in San Francisco, California.
The primary programming languages supported include Python, JavaScript, TypeScript, Java, Go, Rust, and C++.
Enterprise customers include Google, Microsoft, Facebook, Amazon, and thousands of Fortune 500 companies.
GitHub's freemium model offers unlimited public repositories and limited private repositories on the free tier.
The platform integrates with over 1000 third-party developer tools through its Marketplace.`;

const BODY_FEATURES = `GitHub Actions enables automated CI/CD workflows directly in your repository.
GitHub Copilot is an AI pair programmer powered by OpenAI Codex that suggests code completions.
GitHub Advanced Security provides code scanning, secret scanning, and dependency review.
Pull requests allow teams to collaborate on code changes before merging to the main branch.
GitHub Issues provides project tracking with labels, milestones, and assignments.
GitHub Packages hosts private npm, Maven, NuGet, RubyGems, and Docker packages.
GitHub Pages provides free static website hosting directly from a repository.
GitHub Discussions enables community-style conversations separate from issues.
The GitHub API provides REST and GraphQL endpoints for programmatic access.
GitHub supports OAuth, SAML SSO, and two-factor authentication for security.`;

const BODY_PRICING = `GitHub offers four pricing tiers: Free, Team, Enterprise, and GitHub One.
The Free plan includes unlimited public repositories and 2,000 Actions minutes per month.
The Team plan costs 4 USD per user per month and includes 3,000 Actions minutes.
The Enterprise plan starts at 21 USD per user per month with advanced security features.
Annual billing provides a discount versus monthly billing on all paid plans.
GitHub Education offers free access to Team plan features for verified students and educators.
Large organizations can negotiate custom pricing through GitHub sales team.
All plans include unlimited collaborators for public repositories.
Private repository features vary significantly between Free and paid tiers.
GitHub Sponsors allows developers to receive financial support from the community.`;

const pages: CrawledPage[] = [
  makePage('https://github.com/', BODY_HOME, "GitHub: Let's build from here", [
    { '@type': 'Organization', name: 'GitHub', url: 'https://github.com', foundingDate: '2008',
      sameAs: 'https://en.wikipedia.org/wiki/GitHub', location: 'San Francisco, CA' }
  ]),
  makePage('https://github.com/features', BODY_FEATURES, 'Features', []),
  makePage('https://github.com/pricing', BODY_PRICING, 'Pricing', []),
];

import type { EntityIntelligenceReport, SchemaScore } from './packages/shared/src/types';

const stubEntityReport: EntityIntelligenceReport = {
  entitiesDetected: [
    {
      id: 'ent-1', name: 'GitHub', normalizedName: 'github', type: 'Organization',
      description: 'Developer platform for version control and collaboration',
      sameAsUrls: ['https://en.wikipedia.org/wiki/GitHub'],
      mentionCount: 8,
      consistencyScore: 85,
      disambiguationScore: 82,
    },
    {
      id: 'ent-2', name: 'Microsoft', normalizedName: 'microsoft', type: 'Organization',
      description: null,
      sameAsUrls: [],
      mentionCount: 2,
      consistencyScore: 60,
      disambiguationScore: 70,
    },
  ],
  primaryEntity: {
    id: 'ent-1', name: 'GitHub', normalizedName: 'github', type: 'Organization',
    description: 'Developer platform for version control and collaboration',
    sameAsUrls: ['https://en.wikipedia.org/wiki/GitHub'],
    mentionCount: 8,
    consistencyScore: 85,
    disambiguationScore: 82,
  },
  entityConsistencyScore: 78,
  entityCoverageScore: 65,
  disambiguationScore: 82,
  entityConfidenceScore: 75,
  inconsistencies: [],
  missingAttributes: ['contactPoint'],
  recommendations: ['Add contactPoint schema'],
};

const stubSchemaScore: SchemaScore = {
  score: 68,
  issues: [],
  detectedTypes: ['Organization'],
  coverage: 0.33,
  pageAnalyses: [],
};

async function runTests() {

  // ── TEST 1: DETERMINISM TEST ──────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════');
  console.log('TEST 1: DETERMINISM TEST (deterministic modules ×3)');
  console.log('═══════════════════════════════════════════════════');

  const mrRuns = [];
  const citRuns = [];
  const pgRuns = [];

  for (let i = 0; i < 3; i++) {
    mrRuns.push(analyzeMachineReadability(pages));
    citRuns.push(analyzeCitationProbability(pages as any, stubEntityReport as any, stubSchemaScore));
    pgRuns.push(buildPerceptionGraph('audit-test-001', pages as any, stubEntityReport as any));
  }

  const mrScores = mrRuns.map((r: any) => r.score);
  console.log('\n── Machine Readability ──');
  console.log('3-run scores:', mrScores);
  console.log('Issues counts:', mrRuns.map((r: any) => r.issues.length));
  console.log('Score deterministic?', mrScores.every((s: number) => s === mrScores[0]) ? 'YES ✓' : 'NO ✗ INCONSISTENCY');
  console.log('Full deep equality?', JSON.stringify(mrRuns[0]) === JSON.stringify(mrRuns[1]) && JSON.stringify(mrRuns[1]) === JSON.stringify(mrRuns[2]) ? 'PASS ✓' : 'FAIL ✗');

  console.log('\nStage breakdown (Run 1):');
  const stages = (mrRuns[0] as any).stages ?? {};
  for (const [k, v] of Object.entries(stages)) {
    console.log(`  ${k}: ${v}`);
  }
  if (!stages || Object.keys(stages).length === 0) {
    console.log('  (stages field absent or empty — stage-level breakdown NOT exposed in return value)');
  }

  const citScores = citRuns.map((r: any) => r.overallCitationScore);
  console.log('\n── Citation Probability ──');
  console.log('3-run scores:', citScores);
  console.log('Score deterministic?', citScores.every((s: number) => s === citScores[0]) ? 'YES ✓' : 'NO ✗ INCONSISTENCY');
  console.log('Full deep equality?', JSON.stringify(citRuns[0]) === JSON.stringify(citRuns[1]) && JSON.stringify(citRuns[1]) === JSON.stringify(citRuns[2]) ? 'PASS ✓' : 'FAIL ✗');
  console.log('Top blocker (Run 1):', (citRuns[0] as any).topBlockers?.[0] ?? 'none');

  const pgNodeCounts = pgRuns.map((r: any) => r.nodes.length);
  const pgEdgeCounts = pgRuns.map((r: any) => r.edges.length);
  const pgNodeIds = pgRuns.map((r: any) => r.nodes.map((n: any) => n.id).sort().join(','));
  console.log('\n── Perception Graph ──');
  console.log('Node counts:', pgNodeCounts);
  console.log('Edge counts:', pgEdgeCounts);
  console.log('Node IDs deterministic?', pgNodeIds.every((s: string) => s === pgNodeIds[0]) ? 'YES ✓' : 'NO ✗ INCONSISTENCY');
  console.log('Full deep equality?', JSON.stringify(pgRuns[0]) === JSON.stringify(pgRuns[1]) && JSON.stringify(pgRuns[1]) === JSON.stringify(pgRuns[2]) ? 'PASS ✓' : 'FAIL ✗');

  // ── TEST 2: TOKEN STRESS TEST ─────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════');
  console.log('TEST 2: TOKEN STRESS TEST (large body content)');
  console.log('═══════════════════════════════════════════════════');

  const largeParagraph = 'GitHub provides a comprehensive suite of developer tools and services designed to support the entire software development lifecycle. The platform enables teams of all sizes to collaborate on code, automate workflows, secure their applications, and deploy software. Founded in 2008 and headquartered in San Francisco, GitHub serves over 100 million developers across more than 4 million organizations worldwide. ';
  const largeBodyText = largeParagraph.repeat(40); // ~14,000+ chars
  const largePage = makePage('https://github.com/large-page', largeBodyText, 'GitHub Documentation');
  const largePages = [largePage, ...pages];

  console.log(`\nLarge page body: ${largeBodyText.length} chars`);
  console.log(`Entity prompt hard cap: 8000 chars → ${largeBodyText.length - 8000} chars will be silently dropped`);
  console.log(`Contradiction prompt cap per page: 3000 chars → ${Math.max(0, largeBodyText.length - 3000)} chars dropped`);
  console.log(`MAX_TOKENS cap: 512 tokens → entity JSON truncation risk on large pages`);

  let largeMR: any, largeMRErr: unknown = null;
  try {
    largeMR = analyzeMachineReadability(largePages);
    console.log('\n── MR on large+normal pages ──');
    console.log('Score:', largeMR.score, '(vs normal pages score:', mrRuns[0].score, ')');
    console.log('Issues count:', largeMR.issues.length);
    const snrIssue = largeMR.issues.find((i: any) => i.stage === 'signal_to_noise_ratio' || i.stage === 'signalToNoiseRatio');
    const bpIssue = largeMR.issues.find((i: any) => i.stage === 'boilerplate_ratio' || i.stage === 'boilerplateRatio');
    console.log('SNR issue raised on repetitive content?', snrIssue ? `YES — "${snrIssue.description}"` : 'NO — repetitive content not flagged');
    console.log('Boilerplate issue raised?', bpIssue ? `YES — "${bpIssue.description}"` : 'NO');
    console.log('All issues:');
    for (const issue of largeMR.issues) {
      console.log(`  [${issue.severity}] stage=${issue.stage} — ${issue.description}`);
    }
  } catch (e) {
    largeMRErr = e;
    console.log('\n── MR on large pages ──');
    console.log('THREW EXCEPTION:', (largeMRErr as Error).message);
  }

  let largeCit: any, largeCitErr: unknown = null;
  try {
    largeCit = analyzeCitationProbability(largePages as any, stubEntityReport as any, stubSchemaScore);
    console.log('\n── Citation on large+normal pages ──');
    console.log('Score:', largeCit.overallCitationScore, '— completed ✓');
    console.log('Pages processed:', largeCit.pageAnalyses.length);
  } catch (e) {
    largeCitErr = e;
    console.log('\n── Citation on large pages ──');
    console.log('THREW EXCEPTION:', (largeCitErr as Error).message);
  }

  let largePG: any, largePGErr: unknown = null;
  try {
    largePG = buildPerceptionGraph('audit-stress', largePages as any, stubEntityReport as any);
    console.log('\n── Perception Graph on large+normal pages ──');
    console.log('Nodes:', largePG.nodes.length, 'Edges:', largePG.edges.length, '— completed ✓');
  } catch (e) {
    largePGErr = e;
    console.log('\n── Perception Graph on large pages ──');
    console.log('THREW EXCEPTION:', (largePGErr as Error).message);
  }

  // ── TEST 3: CLAUDE FAILURE SIMULATION ────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════');
  console.log('TEST 3: CLAUDE FAILURE SIMULATION');
  console.log('═══════════════════════════════════════════════════');

  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalRedis = process.env.REDIS_URL;

  delete process.env.ANTHROPIC_API_KEY;
  process.env.REDIS_URL = 'redis://localhost:19999';

  console.log('\nEnvironment: ANTHROPIC_API_KEY removed, Redis → dead port 19999');
  console.log('NOTE: Modules imported before env change may have cached credentials at load time.');
  console.log('This tests whether the Anthropic client reads the key at call time or module-init time.\n');

  // Test 3a: Entity Intelligence
  const t3aStart = Date.now();
  let entityResult: any, entityError: unknown = null;
  try {
    entityResult = await analyzeEntityIntelligence(pages);
  } catch (e) {
    entityError = e;
  }
  const t3aMs = Date.now() - t3aStart;

  console.log('── Test 3a: Entity Intelligence (Claude + Redis both disabled) ──');
  if (entityError) {
    console.log('Result: THREW EXCEPTION');
    console.log('Error:', (entityError as Error).message);
  } else {
    console.log('Result: NO EXCEPTION (silently degraded)');
    console.log('entitiesDetected.length:', entityResult?.entitiesDetected?.length);
    console.log('entityConfidenceScore:', entityResult?.entityConfidenceScore);
    console.log('primaryEntity:', entityResult?.primaryEntity?.name ?? 'null');
    console.log('Fallback class:', entityResult?.entitiesDetected?.length === 0 ? 'SILENT EMPTY FALLBACK — no entities, score=0' : 'PARTIAL RESULTS');
  }
  console.log('Elapsed ms:', t3aMs);

  // Test 3b: Semantic Trust
  const t3bStart = Date.now();
  let trustResult: any, trustError: unknown = null;
  try {
    trustResult = await analyzeSemanticTrust(pages as any, stubEntityReport as any, stubSchemaScore);
  } catch (e) {
    trustError = e;
  }
  const t3bMs = Date.now() - t3bStart;

  console.log('\n── Test 3b: Semantic Trust (Claude disabled — contradiction detection) ──');
  if (trustError) {
    console.log('Result: THREW EXCEPTION');
    console.log('Error:', (trustError as Error).message);
  } else {
    console.log('Result: NO EXCEPTION');
    console.log('Trust score:', trustResult?.score);
    console.log('Breakdown authorshipTrust:', trustResult?.breakdown?.authorshipTrust);
    console.log('Breakdown organisationalTrust:', trustResult?.breakdown?.organisationalTrust);
    console.log('Breakdown contentTrust:', trustResult?.breakdown?.contentTrust);
    console.log('Breakdown structuralTrust:', trustResult?.breakdown?.structuralTrust);
    console.log('Contradictions length:', trustResult?.contradictions?.length ?? 'field absent');
    console.log('Issues count:', trustResult?.issues?.length);
    if (trustResult?.score > 0) {
      console.log('Fallback class: GRACEFUL DEGRADATION — deterministic sub-scores ran, contradiction check skipped ✓');
    } else {
      console.log('Fallback class: SILENT TOTAL FAILURE — all scores zero ✗');
    }
  }
  console.log('Elapsed ms:', t3bMs);

  // Test 3c: Edge — empty pages
  console.log('\n── Test 3c: Empty pages array (all engines) ──');

  let emptyMR: any, emptyMRErr: unknown = null;
  try { emptyMR = analyzeMachineReadability([]); } catch(e) { emptyMRErr = e; }
  console.log('MR []:', emptyMRErr ? `THREW — ${(emptyMRErr as Error).message}` : `score=${emptyMR?.score} issues=${emptyMR?.issues?.length}`);

  let emptyCit: any, emptyCitErr: unknown = null;
  try { emptyCit = analyzeCitationProbability([] as any, stubEntityReport as any, stubSchemaScore); } catch(e) { emptyCitErr = e; }
  console.log('Citation []:', emptyCitErr ? `THREW — ${(emptyCitErr as Error).message}` : `score=${emptyCit?.overallCitationScore}`);

  let emptyPG: any, emptyPGErr: unknown = null;
  try { emptyPG = buildPerceptionGraph('empty', [] as any, stubEntityReport as any); } catch(e) { emptyPGErr = e; }
  console.log('PerceptionGraph []:', emptyPGErr ? `THREW — ${(emptyPGErr as Error).message}` : `nodes=${emptyPG?.nodes?.length} edges=${emptyPG?.edges?.length}`);

  let emptyEnt: any, emptyEntErr: unknown = null;
  try { emptyEnt = await analyzeEntityIntelligence([]); } catch(e) { emptyEntErr = e; }
  console.log('Entity []:', emptyEntErr ? `THREW — ${(emptyEntErr as Error).message}` : `entities=${emptyEnt?.entitiesDetected?.length} score=${emptyEnt?.entityConfidenceScore}`);

  let emptyTrust: any, emptyTrustErr: unknown = null;
  try { emptyTrust = await analyzeSemanticTrust([] as any, stubEntityReport as any, stubSchemaScore); } catch(e) { emptyTrustErr = e; }
  console.log('SemanticTrust []:', emptyTrustErr ? `THREW — ${(emptyTrustErr as Error).message}` : `score=${emptyTrust?.score}`);

  // Restore env
  if (originalKey !== undefined) process.env.ANTHROPIC_API_KEY = originalKey;
  else delete process.env.ANTHROPIC_API_KEY;
  if (originalRedis !== undefined) process.env.REDIS_URL = originalRedis;
  else delete process.env.REDIS_URL;

  console.log('\n═══════════════════════════════════════════════════');
  console.log('ALL TESTS COMPLETE');
  console.log('═══════════════════════════════════════════════════\n');
}

runTests().catch(err => {
  console.error('\nFATAL TEST ERROR:', err);
  process.exit(1);
});
