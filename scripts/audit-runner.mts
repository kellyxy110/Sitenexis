/**
 * Standalone audit runner — no DB required.
 * Usage: tsx scripts/audit-runner.ts <domain>
 */
import { getFetchExtractionAdapter } from '@sitenexis/adapters';
import type { CrawledPage } from '@sitenexis/shared';

const domain = process.argv[2] ?? 'bruceandbutler.com';

function getSchemaTypes(page: CrawledPage): string[] {
  return page.schemaMarkup
    .map((s) => (typeof s === 'object' && s !== null && '@type' in s ? String((s as Record<string,unknown>)['@type']) : null))
    .filter((t): t is string => t !== null);
}

function analyseSEO(pages: CrawledPage[]) {
  const issues: { type: string; severity: string; url: string; message: string; recommendation: string }[] = [];
  let deductions = 0;
  for (const page of pages) {
    if (!page.title) { issues.push({ type:'missing_title', severity:'critical', url:page.url, message:'No <title> tag', recommendation:'Add a descriptive title (50–60 chars).' }); deductions += 10; }
    else if (page.title.length > 70) { issues.push({ type:'title_too_long', severity:'warning', url:page.url, message:`Title is ${page.title.length} chars`, recommendation:'Shorten to under 70 chars.' }); deductions += 3; }
    else if (page.title.length < 20) { issues.push({ type:'title_too_short', severity:'warning', url:page.url, message:`Title is only ${page.title.length} chars`, recommendation:'Expand title to at least 20 chars.' }); deductions += 3; }
    if (!page.metaDescription) { issues.push({ type:'missing_meta_desc', severity:'warning', url:page.url, message:'No meta description', recommendation:'Add a meta description (120–155 chars).' }); deductions += 5; }
    else if (page.metaDescription.length > 165) { issues.push({ type:'meta_desc_too_long', severity:'info', url:page.url, message:`Meta desc is ${page.metaDescription.length} chars`, recommendation:'Trim to under 155 chars.' }); deductions += 1; }
    if (!page.h1) { issues.push({ type:'missing_h1', severity:'critical', url:page.url, message:'No H1 tag', recommendation:'Add a single H1 that describes the page topic.' }); deductions += 8; }
    if (!page.canonicalUrl) { issues.push({ type:'missing_canonical', severity:'warning', url:page.url, message:'No canonical link', recommendation:'Add rel=canonical to every page.' }); deductions += 4; }
    if (page.wordCount < 300 && pages.indexOf(page) > 0) { issues.push({ type:'thin_content', severity:'info', url:page.url, message:`Only ${page.wordCount} words`, recommendation:'Aim for 500+ words on key pages.' }); deductions += 2; }
    if (page.robotsDirectives.some(d => d.toLowerCase().includes('noindex'))) { issues.push({ type:'noindex', severity:'warning', url:page.url, message:'noindex directive', recommendation:'Remove if page should be discoverable.' }); deductions += 5; }
  }
  return { score: Math.max(0, Math.min(100, 100 - Math.round(deductions / Math.max(pages.length, 1)))), issues };
}

function analyseSchema(pages: CrawledPage[]) {
  const desiredTypes = ['Organization','WebSite','Article','BlogPosting','FAQPage','Product','LocalBusiness','Person','BreadcrumbList','Service'];
  const hp = pages[0] ? getSchemaTypes(pages[0]) : [];
  const schemaPages = pages.filter(p => p.schemaMarkup.length > 0).length;
  let score = 40;
  if (schemaPages > 0) score += 20;
  if (desiredTypes.some(t => hp.includes(t))) score += 20;
  if (schemaPages >= pages.length * 0.5) score += 10;
  if (hp.includes('WebSite') || hp.includes('Organization')) score += 10;
  return { score: Math.min(100, score), homepageTypes: hp, pagesWithSchema: schemaPages };
}

function scoreAIVisibility(pages: CrawledPage[]) {
  if (!pages.length) return { aiScore:0, machineReadabilityScore:0, entityConfidenceScore:0, retrievalReadinessScore:0, citationProbabilityScore:0, semanticTrustScore:0, recommendationConfidence:0 };
  const avgWC = pages.reduce((s,p) => s+p.wordCount, 0) / pages.length;
  const hasH = pages.filter(p => p.headings.length>0).length / pages.length;
  const hasSch = pages.filter(p => p.schemaMarkup.length>0).length / pages.length;
  const mr = Math.min(100, Math.round(Math.min(25,(avgWC/600)*25) + hasH*30 + hasSch*25 + (pages.filter(p=>p.h1).length/pages.length)*20));
  const hasOrg = pages.some(p => getSchemaTypes(p).some(t => ['Organization','LocalBusiness'].includes(t)));
  const avgH = pages.reduce((s,p)=>s+p.headings.length,0)/pages.length;
  const ec = Math.min(100, Math.round((hasOrg?40:15)+Math.min(30,avgH*5)+(pages[0]?.title?15:0)+(hasSch>0?15:0)));
  const hasFAQ = pages.some(p => getSchemaTypes(p).some(t => ['FAQPage','HowTo'].includes(t)));
  const rr = Math.min(100, Math.round(mr*0.6+(hasFAQ?25:0)+(pages.filter(p=>p.wordCount>400).length/pages.length)*15));
  const hasArt = pages.some(p => getSchemaTypes(p).some(t => ['Article','BlogPosting','NewsArticle'].includes(t)));
  const cp = Math.min(100, Math.round(ec*0.4+rr*0.3+(hasArt?20:0)+(hasSch>0.3?10:0)));
  const hsCan = pages.filter(p=>p.canonicalUrl).length/pages.length;
  const st = Math.min(100, Math.round(50+hsCan*20+(pages[0]?.schemaMarkup.length?15:0)+(pages.filter(p=>!p.robotsDirectives.some(d=>d.toLowerCase().includes('noindex'))).length/pages.length)*15));
  const ai = Math.min(100, Math.round(mr*0.15+ec*0.20+rr*0.20+cp*0.20+st*0.15));
  const rc = Math.min(100, Math.round(ec*0.30+cp*0.30+st*0.20+mr*0.20));
  return { aiScore:ai, machineReadabilityScore:mr, entityConfidenceScore:ec, retrievalReadinessScore:rr, citationProbabilityScore:cp, semanticTrustScore:st, recommendationConfidence:rc };
}

function computeTrust(pages: CrawledPage[], schemaScore: number) {
  const authorityDomains = ['wikipedia.org','wikidata.org','linkedin.com','twitter.com','x.com','facebook.com','github.com','crunchbase.com','bloomberg.com','reuters.com','companies.gov.uk','companieshouse.gov.uk'];
  const allExt = pages.flatMap(p => p.externalLinks);
  const authLinks = allExt.filter(u => authorityDomains.some(d => u.includes(d)));
  const uniqueAuth = new Set(authLinks.map(u => { try { return new URL(u).hostname; } catch { return u; } }));
  const hasOrg = pages.some(p => getSchemaTypes(p).some(t => ['Organization','LocalBusiness','Corporation'].includes(t)));
  const hasSameAs = pages.some(p => p.schemaMarkup.some(s => typeof s==='object'&&s!==null&&'sameAs' in s));
  const pagesWithBoth = pages.filter(p => p.h1 && p.schemaMarkup.length>0).length;
  const ec = Math.min(100, 25+(hasOrg?35:0)+(authLinks.length>0?20:0)+(hasSameAs?20:0));
  const sta = Math.min(100, Math.round(schemaScore*0.75+(pagesWithBoth/Math.max(1,pages.length))*25));
  const ev = Math.min(100, 20+Math.min(60,uniqueAuth.size*15)+(hasSameAs?20:0));
  const dr = Math.min(100, 68+(hasOrg?12:0)+(hasSameAs?5:0));
  const overall = Math.min(100, Math.round(ec*0.35+sta*0.25+ev*0.30+dr*0.10));
  return { overall, entityCredibility:ec, schemaTrustAlignment:sta, externalValidation:ev, degradationResistance:dr, hasOrgSchema:hasOrg, hasSameAs, uniqueAuthDomains:uniqueAuth.size };
}

async function groqScore(pages: CrawledPage[], dom: string) {
  const key = process.env['GROQ_API_KEY'];
  if (!key) return null;
  const data = { domain:dom, pagesAnalyzed:pages.length, pages: pages.slice(0,8).map(p => ({ url:p.url, title:p.title, h1:p.h1, wordCount:p.wordCount, schemaTypes:getSchemaTypes(p), hasCanonical:Boolean(p.canonicalUrl), headingCount:p.headings.length, excerpt:p.bodyText.slice(0,500) })) };
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`}, body:JSON.stringify({ model:'llama-3.3-70b-versatile', temperature:0.1, max_tokens:512, response_format:{type:'json_object'}, messages:[{role:'system',content:'AI visibility analysis engine. Return ONLY valid JSON.'},{role:'user',content:`Analyze for AI retrievability and machine trust. Return JSON with keys: machineReadabilityScore, entityConfidenceScore, retrievalReadinessScore, citationProbabilityScore, semanticTrustScore, recommendationConfidence, aiVisibilityScore (all 0-100 integers). Be specific — do not cluster around 50.\n\n${JSON.stringify(data)}`}] }) });
    if (!r.ok) return null;
    const json = await r.json() as { choices: Array<{ message: { content: string } }> };
    return JSON.parse(json.choices[0]!.message.content) as Record<string, number>;
  } catch { return null; }
}

// ── main ──────────────────────────────────────────────────────────────────────

const extractor = getFetchExtractionAdapter();
const t0 = Date.now();
process.stderr.write(`[audit] crawling ${domain}...\n`);

const rawPages = await extractor.crawlDomain(domain, { maxPages: 30, concurrency: 4, timeoutMs: 15_000, ctx: { domain } });

process.stderr.write(`[audit] ${rawPages.length} pages in ${Date.now()-t0}ms, running analysis...\n`);

const { score: seoScore, issues: seoIssues } = analyseSEO(rawPages);
const { score: schemaScore, homepageTypes, pagesWithSchema } = analyseSchema(rawPages);
const heuristic = scoreAIVisibility(rawPages);
const groq = await groqScore(rawPages, domain);
const ai = {
  aiScore: groq?.aiVisibilityScore ?? heuristic.aiScore,
  machineReadabilityScore: groq?.machineReadabilityScore ?? heuristic.machineReadabilityScore,
  entityConfidenceScore: groq?.entityConfidenceScore ?? heuristic.entityConfidenceScore,
  retrievalReadinessScore: groq?.retrievalReadinessScore ?? heuristic.retrievalReadinessScore,
  citationProbabilityScore: groq?.citationProbabilityScore ?? heuristic.citationProbabilityScore,
  semanticTrustScore: groq?.semanticTrustScore ?? heuristic.semanticTrustScore,
  recommendationConfidence: groq?.recommendationConfidence ?? heuristic.recommendationConfidence,
};
const trust = computeTrust(rawPages, schemaScore);
const overall = Math.round(seoScore*0.25 + ai.aiScore*0.40 + schemaScore*0.15 + 60*0.20);
const avgWC = Math.round(rawPages.reduce((s,p)=>s+p.wordCount,0)/Math.max(1,rawPages.length));
const hp = rawPages[0];

const report = {
  meta: { domain, crawledAt:new Date().toISOString(), pagesAnalyzed:rawPages.length, aiAnalysis:groq?'groq':'heuristic', durationMs:Date.now()-t0 },
  scores: { overall, seo:seoScore, aiVisibility:ai.aiScore, schema:schemaScore, machineTrust:trust.overall, machineReadability:ai.machineReadabilityScore, entityConfidence:ai.entityConfidenceScore, retrievalReadiness:ai.retrievalReadinessScore, citationProbability:ai.citationProbabilityScore, semanticTrust:ai.semanticTrustScore, recommendationConfidence:ai.recommendationConfidence },
  site: { title:hp?.title, metaDescription:hp?.metaDescription, h1:hp?.h1, canonicalUrl:hp?.canonicalUrl, homepageSchemaTypes:homepageTypes, allSchemaTypes:[...new Set(rawPages.flatMap(p=>getSchemaTypes(p)))], pagesWithSchema, totalInternalLinks:new Set(rawPages.flatMap(p=>p.internalLinks)).size, totalExternalLinks:new Set(rawPages.flatMap(p=>p.externalLinks)).size, avgWordCount:avgWC, totalPages:rawPages.length },
  trust: { overall:trust.overall, entityCredibility:trust.entityCredibility, schemaTrustAlignment:trust.schemaTrustAlignment, externalValidation:trust.externalValidation, degradationResistance:trust.degradationResistance, hasOrgSchema:trust.hasOrgSchema, hasSameAs:trust.hasSameAs, uniqueAuthDomains:trust.uniqueAuthDomains },
  issues: { total:seoIssues.length, critical:seoIssues.filter(i=>i.severity==='critical').length, warning:seoIssues.filter(i=>i.severity==='warning').length, info:seoIssues.filter(i=>i.severity==='info').length, items:seoIssues.slice(0,40) },
  pages: rawPages.slice(0,20).map(p => ({ url:p.url, title:p.title, h1:p.h1, wordCount:p.wordCount, statusCode:p.statusCode, hasSchema:p.schemaMarkup.length>0, schemaTypes:getSchemaTypes(p), hasCanonical:Boolean(p.canonicalUrl), responseTimeMs:p.responseTimeMs })),
};

process.stdout.write(JSON.stringify(report, null, 2));
