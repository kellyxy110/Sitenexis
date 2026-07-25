# SiteNexis Enterprise AI Visibility Foundation Audit

Audit date: 2026-07-25  
Scope: public discovery, technical SEO, AI-readable resources, metadata, structured data, security metadata, performance hints, accessibility signals, and standards compliance.  
Implementation status: baseline audit completed; the foundation remediation described below has since been applied in the repository. Re-run the validation command and production-response checks before release.

## Remediation status

The repository now includes the missing AI/public resources, a single route-owned `llms.txt`, complete named crawler coverage with repeated private-route exclusions, stable sitemap date behavior, canonical `sitenexis.vercel.app` fallbacks (overridden by `NEXT_PUBLIC_APP_URL` when a custom domain is added), viewport/manifest metadata, and an automated foundation validation script (`pnpm validate:foundation`). CSP production behavior no longer enables `unsafe-eval`; `unsafe-inline` remains intentionally required by the current Next.js theme/GTM integration and should be migrated to nonce/hash-based CSP in a dedicated compatibility pass.

## Executive summary

SiteNexis already has a substantial metadata foundation: a global Next.js metadata object, a dynamic 1,200×630 OpenGraph image route, JSON-LD for Organization, Person, WebSite, SoftwareApplication, FAQPage, and SearchAction, plus generated robots and sitemap routes. Blog detail pages add canonical, article OpenGraph/Twitter metadata and Article JSON-LD. The application also uses `next/font` with `display: swap` and sends several useful security headers.

The foundation is not yet enterprise-complete. The most material issues are:

1. AI crawler rules are incomplete and inconsistent. The wildcard group disallows `/dashboard/`, `/api/`, and `/audit/`, but the explicit AI groups only allow `/`; under robots group semantics those explicit groups do not inherit the wildcard disallows. Private application and API paths may therefore be crawlable by explicitly named AI bots.
2. `/llms.txt` is implemented twice: `src/app/llms.txt/route.ts` and `public/llms.txt`. The canonical ownership and deployment behavior should be verified and reduced to one source.
3. `ai.txt`, RFC 9116 `security.txt`, `humans.txt`, RSS, and `manifest.webmanifest` are absent.
4. The sitemap covers a broad manually maintained public route list and blog posts, but emits `new Date()` for every static URL on every request, uses a Vercel fallback hostname when the production URL is not configured, and needs automated route/URL validation.
5. Global metadata is strong, but page-level metadata coverage is not systematically enforced. Most marketing pages appear to inherit the root title/description/canonical; there is no metadata validation test for title length, description length, canonical correctness, OpenGraph/Twitter completeness, or noindex/private route behavior.
6. Structured data is ambitious and useful for entity understanding, but several claims are product/business assertions that require a maintenance owner. FAQPage markup should be treated as semantic/AI-readable markup, not as a guaranteed Google rich-result feature.
7. Security headers are present, but CSP still permits `unsafe-inline` and `unsafe-eval`, there is no explicit COOP/CORP/COEP policy, and the current policy should be tested against Stripe, GTM, Supabase, image, font, SSE, and OAuth flows before tightening.
8. Accessibility and performance metadata are not governed by a repeatable automated audit. Existing code contains good semantic elements and focus styles in places, but there is no repository-level WCAG 2.2 AA or Core Web Vitals gate.

## Current resource inventory

| Resource | Current location | Status | Finding |
|---|---|---|---|
| robots.txt | `apps/web/src/app/robots.ts` | Implemented | Incomplete bot list; explicit AI groups need private-path disallows; sitemap hostname depends on environment. |
| sitemap.xml | `apps/web/src/app/sitemap.ts` | Implemented | Includes static routes and `BLOG_POSTS`; dates are generated at request time; route list is manually maintained. |
| llms.txt | `apps/web/src/app/llms.txt/route.ts`, `apps/web/public/llms.txt` | Duplicate | Two sources can drift or conflict. Route content is more complete than the static file. |
| ai.txt | expected `/ai.txt` | Missing | Must be added as experimental, non-standard guidance. |
| security.txt | expected `/.well-known/security.txt` | Missing | Must follow RFC 9116 fields and date semantics. |
| humans.txt | expected `/humans.txt` | Missing | Can be added without sensitive operational details. |
| RSS | expected `/rss.xml` | Missing | Blog data already exists in `BLOG_POSTS`, so this can be generated deterministically. |
| Web App Manifest | expected `/manifest.webmanifest` | Missing | No manifest route or static manifest found. |
| favicon | `apps/web/public/favicon.svg`, `src/app/icon.tsx` | Present | Root metadata references SVG and `/apple-icon`; verify `/apple-icon` is a valid generated asset. |
| OpenGraph image | `apps/web/src/app/og-image/route.tsx` | Implemented | Correct 1200×630 PNG route with controlled caching. Twitter currently reuses it, which is valid. |
| Google verification | `public/google042c5579d9893788.html`, root metadata | Present | Two Google verification tokens are configured; ownership and intended environments should be documented. |
| ads.txt | `apps/web/public/ads.txt` | Present | Contents and publisher relationship require business-owner validation. |

## Robots.txt audit

Current rules:

- Wildcard: allow `/`; disallow `/dashboard/`, `/api/`, `/audit/`.
- Explicit allow-only groups: `GPTBot`, `OAI-SearchBot`, `Google-Extended`, `PerplexityBot`, `ClaudeBot`, `anthropic-ai`, `CCBot`, `Diffbot`, `Bytespider`, and `cohere-ai`.
- Sitemap points to `NEXT_PUBLIC_APP_URL` or `https://sitenexis.vercel.app`.

Requested crawler coverage is incomplete. The following are not present: `ChatGPT-User`, `Claude-SearchBot`, `Bingbot`, `Applebot`, `Applebot-Extended`, `MistralAI`, `Amazonbot`, and `Meta-ExternalAgent`.

Important semantics decision for implementation: a user-agent-specific group is evaluated instead of the wildcard group. Therefore an explicit group containing only `Allow: /` should not be assumed to inherit the wildcard disallows. Every explicitly named AI/search group must either repeat the private-path disallows or be intentionally documented as public-only with precise exclusions. Public audit URLs and private dashboard/API URLs must be separated deliberately; do not expose authenticated resources to crawlers merely to improve discovery.

Required future validation:

- Parse the generated output using a robots parser, not string matching alone.
- Assert the home, marketing, blog, docs, and public tool routes are allowed.
- Assert `/dashboard/`, `/api/`, auth callbacks, account routes, and audit result routes are disallowed for every crawler group unless a product rule explicitly says otherwise.
- Assert sitemap URL is absolute, HTTPS, canonical, and production-specific.
- Record the decision for training crawlers versus retrieval/search crawlers; `GPTBot` and `OAI-SearchBot` are not interchangeable policy labels.

## Sitemap audit

`apps/web/src/app/sitemap.ts` includes 26 manually listed static URLs and all `BLOG_POSTS` entries. It intentionally excludes login/signup/reset-password routes and includes legal, marketing, tool, docs, and content routes. That is directionally correct.

Findings:

- `lastModified: new Date()` makes every URL appear freshly modified on every request. This is not truthful and can create unnecessary recrawl signals. Use source-controlled or content-derived dates; use the post publication/update date for articles.
- The fallback `https://sitenexis.vercel.app` is a deployment hostname, not necessarily the canonical production hostname. A missing production URL should be a build/configuration warning, not silently emitted as canonical metadata.
- The static route list must be validated against actual public routes so deleted or renamed pages do not enter the sitemap.
- Dynamic tool/audit routes need an explicit policy. Authenticated dashboard routes must remain out. Public audit URLs should only be listed if they are genuinely indexable and have stable canonical pages.
- `changeFrequency` and `priority` are advisory metadata, not ranking controls. Keep them only where they reflect publishing behavior and do not treat them as guaranteed Google signals.
- The sitemap should be checked for duplicate URLs, invalid URL encoding, non-HTTPS URLs, redirects, noindex pages, and URLs blocked by robots.

## Metadata and canonicalization audit

### Strengths

- `metadataBase` is configured.
- Root title, description, canonical, OpenGraph, Twitter, icons, and verification metadata exist.
- Blog posts generate route-specific title, description, canonical, OpenGraph article metadata, Twitter cards, and article JSON-LD.
- The HTML root declares `lang="en"`.
- The OpenGraph route declares the correct 1200×630 dimensions and returns PNG.

### Gaps and risks

- No automated page inventory verifies metadata for every public page. Pages without `generateMetadata` inherit the root title/description, which is technically valid but weak for discoverability and social sharing.
- Canonicals mix relative root canonical values and absolute OpenGraph URLs. This is supported by Next.js, but an automated rendered-HTML check should verify the final absolute canonical URL.
- The hostname fallback can make metadata, sitemap, JSON-LD, and OpenGraph URLs point to a Vercel hostname in an incorrectly configured production environment.
- There is no explicit metadata policy for `robots`, `authors`, `publisher`, `keywords`, `alternates`, or language alternates. `keywords` should not be added for search ranking purposes; use page content and structured data instead.
- Root JSON-LD embeds a support email and founder identity. This is public information and should be confirmed as intentional, current, and consistent with the privacy/contact policy.
- Blog cards render dates as strings from the content manifest. The RSS and JSON-LD layers must parse and validate the same dates to avoid contradictory publication metadata.

## Structured data audit

Current global graph includes:

- `Organization` with logo, contact points, founder, sameAs, founding date, and employee count.
- `Person` for the founder with sameAs and expertise.
- `WebSite` with publisher and `SearchAction` targeting `/audit/{domain}`.
- `SoftwareApplication` with category, feature list, screenshot, and offers.
- `FAQPage` with seven questions.

Blog detail pages add `Article` with headline, description, publication/modification dates, URL, author, publisher, keywords, and section.

Technical review:

- Organization, WebSite, Person, SoftwareApplication, Article, and FAQPage are valid Schema.org vocabulary candidates when the claims match visible page content.
- Google rich-result eligibility is narrower than Schema.org validity. FAQPage rich results are restricted and should not be promised. The markup remains useful for machine understanding.
- `SearchAction` should only be retained if the target actually implements the declared search behavior. A domain audit URL is not necessarily a site search action; this requires a product decision before implementation.
- `SoftwareApplication.offers` must remain synchronized with the public pricing page. Do not expose stale or invented plan limits.
- Blog content should use `BlogPosting` where the page is explicitly a blog post, and include `datePublished`, `dateModified`, `image`, `author`, and `publisher` consistently.
- BreadcrumbList, WebPage, and Article/BlogPosting nodes should be added only where their visible page hierarchy and content justify them.
- FAQ questions must be visible on the page and answer text must match the rendered content.
- Schema validation must detect malformed JSON-LD, missing required properties, invalid dates, inconsistent IDs, and claims absent from visible content.

## OpenGraph, Twitter, favicon, and manifest audit

- OpenGraph is implemented globally and for blog posts. The dynamic image route is correctly sized and cached.
- Twitter uses `summary_large_image` and the same dynamic image. This is acceptable; a dedicated Twitter image is optional unless branding/content differs.
- `favicon.svg` exists and is referenced. Apple icon metadata points to `/apple-icon`, but no matching public file was found in the inventory; this must be verified against Next.js generated icon conventions.
- No `manifest.webmanifest` route or public file exists.
- No verified maskable icon, PWA icon set, theme/background manifest data, display mode, or screenshots are present.
- Add a manifest only after icon assets and install behavior are intentionally defined; do not claim PWA support from a manifest alone.

## AI resources and crawler compatibility

The current `llms.txt` explains the product, scores, platform pages, blog highlights, API, and contact. It is a useful experimental convention, not an adopted web standard. It should be concise, canonical, accurate, and maintained with the public navigation structure.

Missing resources:

- `/ai.txt`: experimental AI-use, attribution, compatibility, and crawler-policy guidance. It must explicitly state that the format is not an official standard.
- `/.well-known/security.txt`: RFC 9116 contact, policy, acknowledgements, canonical, expires, preferred languages, and hiring/security links.
- `/humans.txt`: non-sensitive founder, company, mission, stack, hosting, database, and license information.
- `/rss.xml`: deterministic feed from `BLOG_POSTS`, with valid RFC 822/ISO publication dates, categories, descriptions, and canonical links.

AI compatibility claims must distinguish:

- crawler access policy (robots and HTTP access);
- content extraction/readability (HTML, headings, structured data, stable URLs);
- retrieval/citation behavior (probabilistic and provider-specific);
- SiteNexis product modeling (not direct measurement of private model internals).

No document should claim that a listed AI system will crawl, cite, rank, or recommend a page as a result of SiteNexis markup.

## Security metadata and headers audit

Current `next.config.ts` sends:

- `X-DNS-Prefetch-Control: on`;
- `X-Frame-Options: SAMEORIGIN`;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- `Permissions-Policy` disabling camera, microphone, and geolocation;
- HSTS with two-year max age, subdomains, and preload;
- CSP with `default-src`, scripts, styles, images, fonts, connects, frames, object, base URI, and form action restrictions.

Findings:

- `script-src` includes `unsafe-inline` and `unsafe-eval`; this may be required by current Next.js/GTM/third-party integrations but materially weakens CSP. A nonce/hash migration should be assessed, not applied blindly.
- Third-party origins in CSP must be verified against runtime requests, especially Stripe, GTM, Supabase, analytics, OpenRouter, and image storage.
- No explicit `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, or `Cross-Origin-Embedder-Policy` was found. These require compatibility testing before adding them.
- HSTS preload is a commitment covering subdomains. Confirm all production subdomains support HTTPS before submission/retention.
- Security headers should be validated on rendered production responses, not only source configuration; CDN/proxy behavior can alter them.
- `security.txt` is a disclosure resource, not a security header, and must not include secrets or internal infrastructure details.

## Performance metadata audit

Positive signals:

- `next/font/google` is used with `display: swap`, reducing render-blocking font behavior.
- The application uses Next.js image infrastructure in places and has controlled OG image caching.
- CSP and resource policy reduce some third-party surface area.

Needs validation or improvement:

- No explicit resource-hint policy (`preconnect`, `dns-prefetch`, `preload`) was found in the inspected root layout. Add hints only for proven critical origins; unnecessary hints cost connections.
- Review image `priority`/`loading` choices, intrinsic dimensions, responsive `sizes`, and below-the-fold lazy loading across public pages.
- Validate font payloads and whether all configured weights are used.
- Measure LCP, INP, CLS, TTFB, total blocking time, and transferred bytes on representative home, blog index, blog detail, pricing, and tool pages.
- Do not add `preload` broadly without a performance trace; it can reduce performance by competing with critical HTML/CSS.

## Accessibility audit

Positive signals found in the inspected pages include semantic `main`, `article`, `aside`, headings, native links/buttons, `lang="en"`, visible focus-related Tailwind classes in many controls, and descriptive image/link titles in places.

Gaps requiring a full rendered audit:

- No repository-level axe/WCAG 2.2 AA gate was found in the inspected test inventory.
- Category filter buttons do not visibly expose a selected state through `aria-pressed`.
- Decorative SVG/watermark content relies on visual hiding and needs continued verification that meaningful content has an accessible name.
- Global skip-link, landmark uniqueness, keyboard focus order, modal focus trapping, form error association, contrast, reduced motion, and mobile zoom behavior need automated and manual checks.
- Animated Framer Motion content should honor `prefers-reduced-motion`.
- Dynamic OG and metadata resources do not affect accessibility, but public page content must expose the same information in HTML rather than only JSON-LD.

## Validation plan

Before implementation is considered complete, add a local validation command that checks:

1. robots parser behavior for every required crawler and private/public path;
2. sitemap URL validity, route existence, canonical alignment, noindex/robots consistency, uniqueness, and truthful dates;
3. exactly one `/llms.txt` source and valid UTF-8/plain-text response;
4. RFC 9116 security.txt required fields, HTTPS canonical, future `Expires`, and reachable contact/policy URLs;
5. RSS XML well-formedness, valid dates, canonical links, categories, and complete blog coverage;
6. manifest schema, icon dimensions, theme/background colors, and asset existence;
7. rendered metadata for every public route, including title, description, canonical, OG, Twitter, language, icons, and robots behavior;
8. JSON-LD parseability, stable IDs, visible-content alignment, and Schema.org property shapes;
9. OG/Twitter response status, content type, dimensions, cache headers, and fallback behavior;
10. axe/WCAG checks on representative pages plus keyboard and reduced-motion smoke tests;
11. response security headers in a production build;
12. Lighthouse/PageSpeed measurements with documented thresholds and environment.

## Standards and source hierarchy

Implementation decisions should cite and follow, in order of authority:

- RFC 9116 for `security.txt`;
- Google Search Central documentation for robots, sitemap, canonical, structured data, and supported rich results;
- Schema.org vocabulary and property definitions;
- W3C/WAI WCAG 2.2 AA and ARIA specifications;
- WHATWG HTML, URL, Fetch, and web app manifest specifications;
- RSS 2.0 conventions plus valid XML/date handling;
- `llms.txt` and `ai.txt` only as experimental, clearly labeled conventions.

## Recommended implementation phases after audit approval

1. Establish a single canonical hostname/configuration contract and automated public-route inventory.
2. Repair robots groups with explicit private-route exclusions and add parser tests.
3. Remove the duplicate llms source and update the canonical machine-readable document.
4. Add `ai.txt`, RFC 9116 security.txt, humans.txt, RSS, and a validated manifest.
5. Add page-level metadata and structured-data helpers with tests.
6. Add production-response security-header tests and carefully evaluate CSP nonce/hash migration.
7. Add accessibility and performance validation gates.
8. Generate the requested maintenance guides, final report, and `STANDARDS_COMPLIANCE_MATRIX.md`.

## Risks and open decisions

- The canonical production domain is not safely knowable from source because code falls back to `sitenexis.vercel.app`; production configuration must confirm it.
- Whether public audit URLs should be indexable is a product/security decision. They may contain domain analysis and should not be exposed to crawlers by accident.
- Whether all named AI crawlers should be allowed is a policy decision, not merely a technical SEO default. The policy must distinguish training, search, user-triggered browsing, and third-party extraction.
- Tightening CSP can break payments, analytics, OAuth, SSE, or image loading. It requires browser/network validation.
- Adding PWA metadata without a product install/offline policy creates an inaccurate capability claim.
- Existing uncommitted worktree changes were not modified as part of this audit-only phase.
