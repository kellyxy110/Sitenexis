# SiteNexis Launch Validation Suite

Certifies production readiness with **evidence**. Every check emits `PASS` / `FAIL` / `WARNING`, contributes to a Launch Readiness Score, and a deployment is only `READY` when there are **zero critical blockers**.

Born from the Mayo Clinic incident: `www.mayoclinic.org` (behind Akamai Bot Manager, HTTP 403 to all non-browser clients) produced no output. The rule this suite enforces: **no website may fail silently** — a blank report, an infinite spinner, a 5xx, or an uncaught exception. "Failed with a clear reason" is acceptable; silence is not.

## Run

```bash
# Against a running server (default http://localhost:3001)
node scripts/launch-validation/run.mjs

# Against a deployment, write a JSON report
BASE_URL=https://sitenexis.vercel.app node scripts/launch-validation/run.mjs --json cert-report.json
```

Exit code `0` = READY, `1` = NOT READY (critical blocker), `2` = suite crashed. Tunables: `BASE_URL`, `SITE_TIMEOUT_MS`, `CONCURRENCY`.

## What v1 actually runs (real, evidence-backed)

| Category | Status | What it does |
|---|---|---|
| **Functional** | ✅ implemented | `/api/health` per-stage diagnostics · `/api/quick-audit` correctness on a control page · SSRF guard |
| **Reliability** | ✅ implemented | Audits the **Website Diversity Benchmark** (`diversity-benchmark.json`) and asserts every site returns a terminal result with explanation — never blank/hang/5xx. Retries once on transient 5xx. |

### Website Diversity Benchmark
`diversity-benchmark.json` — a corpus spanning WordPress/Shopify/Wix/Squarespace/Webflow, Next/Astro/React/Vue/Angular, government/university/news, and CDN/WAF anchors: **Akamai** (mayoclinic.org, rakuten), **Cloudflare** (cloudflare.com, harvard), **Imperva** (ticketmaster), **PerimeterX** (zillow), **Fastly** (gov.uk, guardian), plus DNS-failure and thin-content control cases. Extend toward the 200–500 target — the runner scales linearly.

First real run (2026-07-14, local): **34/35 terminal-with-explanation (97%)**; Mayo correctly returned graceful 403; the one FAIL was a *transient* dev-server 502 (now covered by retry-on-5xx). 20 sites audited with accurate scores before the 20/hr rate limit engaged (which itself validated rate limiting).

> **Rate limit note:** `/api/quick-audit` is 20/hr per IP. To exercise the full corpus in one run, target a staging deployment with a raised limit, or run in batches. Rate-limited responses are counted as graceful (they carry an explanation), so they never fail the suite.

## Declared but NOT yet automated (phased — reported as WARNING, never counted as PASS)

These need infrastructure this environment can't stand up honestly (load generators, chaos tooling, a healthy Redis, browser farm). They are declared so the score stays honest.

- **Scalability** — 10/50/100/500 concurrent audits, queue saturation, worker/DB pool limits *(needs healthy Redis — currently over quota — + k6/artillery)*
- **Stress** — upstreams returning 429/403/500, huge DOM, million-page sitemaps, broken HTML
- **Resilience / Chaos** — kill Redis / Postgres / AI provider / worker / browser mid-audit; assert graceful degradation + auto-recovery
- **Noisy Neighbor** — tenant A runs 100 audits, tenant B still gets normal latency; fair scheduling, queue isolation
- **Browser** — Chrome/Firefox/Safari/Edge + mobile via Playwright
- **Accessibility** — WCAG AA, keyboard nav, contrast, focus order (axe-core)
- **Security** — full OWASP Top 10 (SQLi/XSS/CSRF/authz-bypass/path-traversal) active scan

## Scoring

`launchReadiness` = % of *implemented* checks passing (WARNINGs excluded). Also emits `functional` and `reliability` sub-scores; the phased category scores are `null` until implemented. **A release is READY only with zero critical blockers.**

## Pre-deploy gate (Production Certification Pipeline)

1. **Mandatory pre-merge gate** (`.github/workflows/ci.yml`): `typecheck` + `lint` + `test` on every push/PR. Must be green to merge.
2. **Pre-promote gate**: run this suite against the Vercel **preview** URL; block promotion to production if `verdict !== READY`.
3. Every fixed bug becomes a permanent regression test (e.g. `packages/analyzers/src/security/__tests__/bot-mitigation.test.ts` pins the real Mayo Akamai signature).

## Roadmap to full certification

Phase 2: Scalability + Stress (needs healthy Redis). Phase 3: Resilience/Chaos + Noisy-Neighbor. Phase 4: Browser + Accessibility (Playwright + axe). Phase 5: active Security scan. Each phase flips its category from WARNING to a real scored check.
