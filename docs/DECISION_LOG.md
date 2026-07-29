# Decision log

## 2026-07-29: Page-level crawl evidence

Decision: Store page identity and page evidence separately.

Reason: A declared canonical can point to another URL. It must not replace the URL that SiteNexis crawled.

Page records now distinguish requested URL, normalized requested URL, final URL after redirects, and declared canonical URL.

Decision: Use the normalized requested URL for lookup within one audit.

Reason: Fragments, default ports, duplicate slashes, and trailing slash differences must not create accidental duplicate page records.

Decision: Replace all page-specific fields on update.

Reason: A retry can return no canonical or different content. The database must not keep old values from a previous response.

Decision: Store all H1 and H2 evidence and a content hash.

Reason: The report must show the real heading list for each URL. A content hash makes cross-page contamination easy to detect.

Decision: Use deterministic extraction for values and AI only for explanation.

Reason: AI must not invent a heading, canonical, or page value.

Migration: The new Page fields are additive. Use Prisma db push after review. Do not delete or reset production data.
## 2026-07-29: Canonical link extraction

Decision: Select canonical only from a link element whose rel token list contains the canonical token.

Reason: The previous parser could select a preload link when preload appeared before the declared canonical link.

Decision: Keep extracted canonical evidence separate from diagnostic health.

Reason: `https://truvyx.org/` is the declared canonical on the selected pages. It is not a self-canonical for those pages. SiteNexis must report the declaration and then explain the non-self-referencing diagnostic.

Validation: 16 canonical regression tests and 105 adapter tests pass. Five live Truvyx pages return the declared homepage canonical. Production API, dashboard, CSV, and PDF values remain unverified until authenticated access is available.