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
  if (r.status >= 500) return { verdict: 'FAIL', reason: `platform ${r.status} (server error, not graceful)` };
  if (!r.body) return { verdict: 'FAIL', reason: `non-JSON/empty body (len=${r.rawLen})` };
  const b = r.body;
  if (r.status === 200 && typeof b.quickScore === 'number') {
    return { verdict: 'PASS', reason: `audited (score=${b.quickScore}, ${b.wordCount ?? '?'}w) ${r.ms}ms` };
  }
  const reason = b.error ? (typeof b.error === 'string' ? b.error : JSON.stringify(b.error)) : b.status ? `http ${b.status}` : null;
  if (reason) return { verdict: 'PASS', reason: `graceful: ${String(reason).slice(0, 80)}` };
  return { verdict: 'FAIL', reason: '200 but no score and no explanation — blank/ambiguous' };
}

export async function run({ baseUrl, corpus, concurrency = 5, perSiteTimeoutMs = 40_000 }) {
  const { checks, record } = createRecorder('reliability');
  const sites = corpus.sites;
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
      perSite.push({ url: site.url, protection: site.protection, ...classify(out ?? {}, error, perSiteTimeoutMs) });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, sites.length) }, worker));

  for (const p of perSite) {
    console.log(`      ${p.verdict === 'PASS' ? '✓' : '✗'} ${p.url.padEnd(46)} [${p.protection}] ${p.reason}`);
  }
  const fails = perSite.filter((p) => p.verdict === 'FAIL');
  const audited = perSite.filter((p) => /audited/.test(p.reason)).length;
  const rateLimited = perSite.filter((p) => /rate limit/i.test(p.reason)).length;

  record('reliability: no benchmark site fails silently', fails.length === 0 ? STATUS.PASS : STATUS.FAIL,
    `${perSite.length - fails.length}/${perSite.length} terminal-with-explanation; ${audited} fully audited; ${rateLimited} rate-limited; ${fails.length} silent failures`,
    { critical: fails.length > 0 });

  if (rateLimited > 0) {
    record('reliability: full-corpus crawl coverage', STATUS.SKIP,
      `${rateLimited} sites hit the 20/hr quick-audit rate limit (counted graceful)`,
      { enableWith: 'run against staging with raised rate limit, or QUICK_AUDIT_RATE_LIMIT bypass' });
  }
  return { checks, perSite };
}
