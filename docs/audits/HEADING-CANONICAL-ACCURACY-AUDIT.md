# Heading and canonical accuracy audit

Status: implemented and ready for validation

## Problem

Each page record must keep the values found on that page. It must not copy values from the home page or another page.

## Reproduction

Controlled tests:

- packages/adapters/src/web-extraction/__tests__/page-isolation.test.ts
- packages/adapters/src/web-extraction/__tests__/page-accuracy.test.ts

The fixture uses different values for the home page and the About page. Both pages use shared navigation and footer headings. The test fetches both pages at the same time and checks title, description, H1, canonical, body text, H2 order, redirects, missing canonical, and content hash.

## Root cause

The fetch adapter created a new result object for each fetch. The first controlled test did not show shared object reuse.

The data path had three defects:

1. Page lookup used the raw URL. URL fragments, default ports, duplicate slashes, and trailing slashes could create different identities.
2. The serverless update wrote only status, title, description, H1, and word count. It did not replace canonical, body text, schema, links, or crawl time. A retry could keep old evidence.
3. The Page model did not store H2 evidence, requested URL, final URL, or content hash.

Concurrent find and create operations also had no normalized audit page identity. The application now deduplicates each crawl result and uses the normalized requested URL for lookup.

## Changes

The extractor now stores requested URL and final URL separately. It resolves relative canonicals against the final response URL. Missing canonical stays null. It stores all H1 and H2 values in DOM order and generates a content hash.

The Page model now stores normalized URL, requested URL, final URL, H2 JSON, heading evidence JSON, content hash, extraction mode, and extraction confidence.

The serverless write updates every page-specific field. It does not keep old canonical or body values when the current response has no value.

## Data ownership

1. requested URL
2. normalized page identity
3. fetched response
4. final response URL
5. raw HTML
6. page-local extraction object
7. page-local database row
8. audit API response
9. page report

The declared canonical is evidence. It is not the page identity.

## Database update

This repository uses Prisma db push. The new Page fields are additive.

```bash
pnpm --filter @sitenexis/db db:push
pnpm --filter @sitenexis/db db:generate
```

Existing rows have null provenance fields. No old page data is deleted by this change. Existing duplicate rows need a separate reviewed cleanup.

## Validation

Completed:

- adapter typecheck
- database typecheck
- concurrent page isolation test
- redirect regression test
- H1 and H2 order test
- relative and missing canonical tests
- content hash test

The web typecheck reached the local command timeout without diagnostics. Run it again in CI or in a clean workspace.

## Known limits

- Static fetch does not execute client-only JavaScript.
- Shared template headings remain raw evidence. Duplicate analysis must classify template headings.
- Production must receive the additive schema update before new fields can be written.

## Launch recommendation

Apply the additive schema update. Run the full web typecheck and production build. Run one small approved fixture audit. Deploy only after the page comparison passes.
## Canonical parser follow-up

The forensic comparison for audit `cms5kim9i0009bvkb0i4i2xw5` found a separate parser defect.

The old parser matched the first link element with a broad pattern. On truvyx.org, preload links appeared before the declared canonical link. The crawler therefore reported a preload URL as the canonical value.

The parser now:

- scans link elements only
- treats rel as case-insensitive space-separated tokens
- requires the canonical token and a non-empty href
- resolves relative values against the final response URL
- records raw and resolved values, count, source, validity, and self-reference
- preserves duplicate and conflicting declarations
- leaves a missing canonical as null

The five-page live re-verification returned the declared canonical `https://truvyx.org/` for `/blog`, `/security`, `/privacy`, `/guide`, and `/aup`. H1 and H2 values remained page-specific. Each page was correctly marked non-self-referencing.

This is not data contamination. The audited website declares the homepage as canonical for these pages. The SiteNexis defect was the preload link being selected by the old parser.

Production API, dashboard, CSV, and PDF verification remains incomplete because unauthenticated requests return HTTP 401. These layers must be checked with an authenticated session after deployment.