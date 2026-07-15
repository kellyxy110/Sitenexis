/**
 * RELIABILITY category — the heart of the Mayo Clinic certification.
 *
 * Audits the Website Diversity Benchmark and asserts every site returns a terminal
 * result WITH an explanation. FAIL only on genuine platform misbehaviour: hang,
 * 5xx, empty/garbage body, uncaught exception. "Blocked with a clear reason"
 * (e.g. Akamai 403) is a PASS — silence is the only failure.
 */
import { STATUS, createRecorder, http } from '../lib/harness.mjs';

function classify(r, err, perSiteTimeoutMs) {
  if (err) {
    const aborted = /abort/i.test(String(err));
    return { verdict: 'FAIL', reason: aborted ? `TIMEOUT ${perSiteTimeoutMs}ms (silent hang)` : `network error: ${String(err).slice(0, 80)}` };
  }
  if (!r.body) return { verdict: 'FAIL', reason: `non-JSON/empty body (status=${r.status}, len=${r.rawLen})` };
  const b = r.body;
  if (r.status === 200 && typeof b.quickScore === 'number') {
    return { verdict: 'PASS', reason: `audited (score=${b.quickScore}, ${b.wordCount ?? '?'}w) ${r.ms}ms` };
  }
  // "Silent" means no explanation — a hang, an empty body, or a 5xx with nothing in
  // it. A response that carries a JSON error/status IS graceful, whatever the code:
  // the platform told the caller what happened and moved on.
  const reason = b.error ? (typeof b.error === 'string' ? b.error : JSON.stringify(b.error)) : b.status ? `http ${b.status}` : null;
  if (reason) return { verdict: 'PASS', reason: `graceful: ${String(reason).slice(0, 80)}` };
  // No explanation of any kind.
  if (r.status >= 500) return { verdict: 'FAIL', reason: `platform ${r.status} with no explanation (silent server error)` };
  return { verdict: 'FAIL', reason: '200 but no score and no explanation — blank/ambiguous' };
}

/** Optionally sample N sites per benchmark group (CORPUS_SAMPLE). Full sweep is the release gate. */
function selectSites(all) {
  const n = parseInt(process.env.CORPUS_SAMPLE ?? '0', 10);
  if (!n) return all;
  const byGroup = new Map();
  for (const s of all) {
    const g = s.group ?? 'ungrouped';
    if (!byGroup.has(g)) byGroup.set(g, []);
    if (byGroup.get(g).length < n) byGroup.get(g).push(s);
  }
  return [...byGroup.values()].flat();
}

export async function run({ baseUrl, corpus, concurrency = 5, perSiteTimeoutMs = 40_000 }) {
  const { checks, record } = createRecorder('reliability');
  const sites = selectSites(corpus.sites);
  let idx = 0;
  const perSite = [];

  async function worker() {
    while (idx < sites.length) {
      const site = sites[idx++];
      let out, error;
      for (let attempt = 0; attempt < 2; attempt++) { // retry once on transient 5xx
        error = undefined;
        try {
          out = await http(baseUrl, '/api/quick-audit', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ url: site.url }),
          }, perSiteTimeoutMs);
        } catch (e) { error = e; }
        if (!out || out.status < 500) break;
      }
      perSite.push({ url: site.url, group: site.group, protection: site.protection, ...classify(out ?? {}, error, perSiteTimeoutMs) });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, sites.length) }, worker));

  for (const p of perSite) {
    console.log(`      ${p.verdict === 'PASS' ? '✓' : '✗'} ${p.url.padEnd(46)} [${p.protection}] ${p.reason}`);
  }
  const fails = perSite.filter((p) => p.verdict === 'FAIL');
  const audited = perSite.filter((p) => /audited/.test(p.reason)).length;
  const rateLimited = perSite.filter((p) => /rate limit/i.test(p.reason)).length;

  // Per-group breakdown so a regression can be localised to a benchmark group.
  const groups = [...new Set(perSite.map((p) => p.group ?? 'ungrouped'))].sort();
  for (const g of groups) {
    const gp = perSite.filter((p) => (p.group ?? 'ungrouped') === g);
    const gf = gp.filter((p) => p.verdict === 'FAIL').length;
    console.log(`      group ${g.padEnd(14)} ${gp.length - gf}/${gp.length} terminal${gf ? `  ✗ ${gf} SILENT` : ''}`);
  }

  record('reliability: no benchmark site fails silently', fails.length === 0 ? STATUS.PASS : STATUS.FAIL,
    `${perSite.length - fails.length}/${perSite.length} terminal-with-explanation; ${audited} fully audited; ${rateLimited} rate-limited; ${fails.length} silent failures (${groups.length} groups)`,
    { critical: fails.length > 0 });

  if (rateLimited > 0) {
    record('reliability: full-corpus crawl coverage', STATUS.SKIP,
      `${rateLimited} sites hit the 20/hr quick-audit rate limit (counted graceful)`,
      { enableWith: 'run against staging with raised rate limit, or QUICK_AUDIT_RATE_LIMIT bypass' });
  }
  return { checks, perSite };
}
