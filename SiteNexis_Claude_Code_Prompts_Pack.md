# ⬡ SiteNexis — Claude Code Prompts Pack
### AI-Powered Website Intelligence Platform
**Version 1.0 · Complete Build Pack · 40+ Prompts**

---

> **How to use this pack:** Copy each prompt block directly into Claude Code (terminal). Run them in order within each phase, or jump to any module you need. Every prompt is self-contained with full context.

---

## 📋 TABLE OF CONTENTS

1. [Project Scaffold & Setup](#1-project-scaffold--setup)
2. [Database Schema](#2-database-schema)
3. [Crawler Engine](#3-crawler-engine)
4. [SEO Analyzer Module](#4-seo-analyzer-module)
5. [AI Readability Engine](#5-ai-readability-engine)
6. [Schema Engine](#6-schema-engine)
7. [Internal Link Graph Engine](#7-internal-link-graph-engine)
8. [Content Quality Engine](#8-content-quality-engine)
9. [Performance Engine](#9-performance-engine)
10. [Report Engine](#10-report-engine)
11. [Frontend — Landing Page](#11-frontend--landing-page)
12. [Frontend — Dashboard](#12-frontend--dashboard)
13. [Frontend — Audit Results Pages](#13-frontend--audit-results-pages)
14. [Frontend — Link Graph Visualization](#14-frontend--link-graph-visualization)
15. [API Routes](#15-api-routes)
16. [Auth & Billing](#16-auth--billing)
17. [Testing](#17-testing)
18. [Deployment](#18-deployment)

---

## 1. Project Scaffold & Setup

---

### PROMPT 1.1 — Initialize Full Project Structure

```
Create a full-stack Next.js 16 monorepo project called "sitenexis" with the following structure:

/apps
  /web          → Next.js 16 App Router frontend
/packages
  /crawler      → Node.js crawl engine (Puppeteer + Cheerio)
  /analyzers    → SEO, AI, Schema, Content analysis modules
  /db           → Prisma schema + Supabase client
  /shared       → Shared TypeScript types and utilities

Root config:
- pnpm workspaces
- TypeScript strict mode across all packages
- ESLint + Prettier configured
- Turbo for monorepo task running

In /apps/web:
- Next.js 16 App Router
- TailwindCSS
- Framer Motion
- Recharts
- shadcn/ui initialized

In /packages/crawler:
- puppeteer
- cheerio
- bullmq (job queues)
- ioredis

In /packages/analyzers:
- openai SDK
- @anthropic-ai/sdk
- zod for schema validation

Output: full package.json files, tsconfig.json files, turbo.json, and folder scaffolding with index.ts stubs for each package.
```

---

### PROMPT 1.2 — Environment Variables Setup

```
read CLAUDE.md
Create a complete environment configuration system for SiteNexis.

Generate:
1. .env.example with all required variables and inline comments explaining each one
2. /lib/env.ts — a typed, validated environment config using the "envalid" or "zod" library that throws clear errors on startup if required vars are missing

Variables needed:
- NEXT_PUBLIC_APP_URL
- DATABASE_URL (Supabase PostgreSQL)
- DIRECT_URL (Supabase direct connection)
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- ANTHROPIC_API_KEY
- OPENAI_API_KEY (optional fallback)
- REDIS_URL (for BullMQ job queues)
- S3_BUCKET_NAME
- S3_ACCESS_KEY_ID
- S3_SECRET_ACCESS_KEY
- S3_ENDPOINT (for Cloudflare R2 compatibility)
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

Make the env module importable as: import { env } from '@/lib/env'
```

---

### PROMPT 1.3 — Shared TypeScript Types

```
read CLAUDE.md
Create a /packages/shared/types.ts file with all core TypeScript types and interfaces for SiteNexis.

Include types for:

1. AuditJob
   - id, domain, status (queued | running | complete | failed), createdAt, completedAt, userId

2. CrawledPage
   - url, statusCode, title, metaDescription, h1, h2s[], bodyText, canonicalUrl
   - internalLinks[], externalLinks[], schemaBlocks[], responseTimeMs
   - isIndexable, robotsDirective

3. SEOIssue
   - type, severity (critical | warning | info), page, description, recommendation

4. SEOScore
   - overall (0-100), breakdown: { titles, meta, canonicals, robots, sitemap, links, indexability }

5. AIReadabilityScore
   - overall (0-100), entityClarity, conversationalReadiness, aiExtractability, knowledgeGraphStructure
   - missingEntities[], recommendations[]

6. SchemaAnalysis
   - schemasFound[], isValid, missingFields[], wrongTypes[], suggestions[]

7. InternalLinkGraph
   - nodes: GraphNode[], edges: GraphEdge[], orphanPages[], weakClusters[]

8. ContentQualityScore
   - overall (0-100), thinPages[], duplicateIntentGroups[], stuffedPages[], lowDepthPages[]

9. AuditReport (the master type)
   - auditId, domain, crawledAt, pagesCount
   - seoScore, aiScore, schemaAnalysis, linkGraph, contentQuality, performanceScore
   - topIssues[], summaryInsights[]

Export everything as named exports. Use strict TypeScript with no `any` types.
```

---

## 2. Database Schema

---

### PROMPT 2.1 — Prisma Schema

```
read CLAUDE.md
Create a complete Prisma schema for SiteNexis at /packages/db/schema.prisma.

Use PostgreSQL (Supabase). Include the following models:

1. User
   - id (cuid), email, name, avatarUrl, plan (free|starter|pro|agency|enterprise)
   - createdAt, updatedAt
   - relation: audits[], apiKeys[]

2. ApiKey
   - id, userId, key (unique, hashed), label, lastUsedAt, createdAt

3. Audit
   - id (cuid), userId, domain, status (queued|running|complete|failed)
   - startedAt, completedAt, errorMessage
   - pageCount, crawlDurationMs
   - relation: pages[], scores, issues[], report

4. AuditScore
   - id, auditId (unique 1:1), seoScore, aiScore, schemaScore, linkScore, performanceScore
   - scoreBreakdown (Json), createdAt

5. Page
   - id, auditId, url, statusCode, title, metaDescription, h1, canonicalUrl
   - wordCount, isIndexable, robotsDirective
   - seoIssues (Json), aiScore (Float), schemaData (Json), internalLinksOut (Json)
   - createdAt

6. Issue
   - id, auditId, pageUrl, type, severity (critical|warning|info), description, recommendation
   - module (seo|ai|schema|links|content|performance)

7. Report
   - id, auditId (unique 1:1), pdfUrl, generatedAt, expiresAt

8. UsageLog
   - id, userId, action, metadata (Json), createdAt

Include proper indexes on: domain, userId, auditId, status, severity.
Add @@map for clean table names (snake_case).
```

---

### PROMPT 2.2 — Database Client & Migrations

```
read CLAUDE.md
Set up the Prisma database client for SiteNexis at /packages/db/client.ts.

Requirements:
- Singleton Prisma client safe for Next.js dev hot-reloading (use global caching pattern)
- Connection pooling via Supabase connection pooler (use DATABASE_URL for pooled, DIRECT_URL for migrations)
- Export typed client as: export const db = prismaClient

Also create:
1. /packages/db/migrations/seed.ts — seed script that creates:
   - 1 test user (plan: pro)
   - 3 sample completed audits for "example.com", "acme.io", "testsite.dev"
   - Sample scores and 10 sample issues per audit

2. /packages/db/queries/ folder with typed query helpers:
   - getAuditById(id: string)
   - getAuditsByUser(userId: string, limit?: number)
   - getPagesByAudit(auditId: string)
   - getIssuesByAudit(auditId: string, severity?: string)
   - createAudit(domain: string, userId: string)
   - updateAuditStatus(id: string, status: string, metadata?: object)

All queries must return typed results using Prisma's generated types.
```

---

## 3. Crawler Engine
read CLAUDE.md
---

### PROMPT 3.1 — Core Crawler
read CLAUDE.md
```
Build the SiteNexis crawler engine at /packages/crawler/src/crawler.ts.

This is a full-site web crawler that mimics Googlebot behaviour.

Requirements:

CORE BEHAVIOUR
- Accept a domain string as input (e.g. "example.com")
- Auto-prefix with https:// if no protocol given
- Crawl up to 500 pages per audit (configurable via options)
- Respect robots.txt — parse and enforce Disallow rules
- Follow internal links only (same domain + subdomains)
- Handle redirects (record redirect chains, max 5 hops)
- Set User-Agent: "SiteNexis-Bot/1.0 (+https://sitenexis.com/bot)"
- Concurrent crawl: 5 pages at a time (configurable)
- Timeout per page: 15 seconds

PUPPETEER SETUP
- Use puppeteer in headless mode
- Wait for: networkidle2 or 8 second max
- Disable images and fonts for speed (use request interception)
- Extract full rendered HTML after JS execution

CHEERIO PARSING
After rendering, parse HTML with cheerio to extract:
- <title> text
- <meta name="description"> content
- <meta name="robots"> content
- <link rel="canonical"> href
- All <h1>, <h2>, <h3> texts (array)
- <body> innerText (stripped of scripts/styles)
- All <a href> links (classify internal vs external)
- All <script type="application/ld+json"> blocks (raw JSON strings)
- HTTP status code
- Response time (ms)

OUTPUT
Return a CrawledPage[] array matching the shared type.
Emit events: 'page:crawled', 'page:error', 'crawl:complete' for real-time progress.

QUEUE SYSTEM
Use BullMQ with Redis to manage crawl jobs.
Create: /packages/crawler/src/queue.ts
- CrawlQueue with concurrency 5
- Job: { auditId, domain, options }
- On completion: update audit status in DB via /packages/db client
- On failure: store error, mark audit failed

Include JSDoc on all exported functions.
```

---

### PROMPT 3.2 — Robots.txt Parser

```
read CLAUDE.md
Create a robust robots.txt parser for SiteNexis at /packages/crawler/src/robots.ts.

Requirements:
- Fetch robots.txt from the root of a given domain (with 5s timeout, fail gracefully)
- Parse all User-agent groups (support * wildcard and specific agents)
- Parse Disallow and Allow rules with path matching
- Parse Crawl-delay directive
- Parse Sitemap directives (return all sitemap URLs found)
- Support both LF and CRLF line endings

Export:
  class RobotsParser {
    static fetch(domain: string): Promise<RobotsParser>
    isAllowed(url: string, userAgent?: string): boolean
    getSitemaps(): string[]
    getCrawlDelay(userAgent?: string): number | null
  }

Also create: /packages/crawler/src/sitemap.ts
- Fetch and parse sitemap.xml (and sitemap index files with nested sitemaps)
- Handle: sitemap.xml, sitemap_index.xml, gzipped sitemaps
- Return: string[] of all URLs found in sitemap
- Max URLs to parse: 10,000

Both modules must handle network failures gracefully and return safe defaults.
```

---

## 4. SEO Analyzer Module
read CLAUDE.md
---

### PROMPT 4.1 — SEO Analyzer Core

```
read CLAUDE.md
Build the SEO Analyzer module at /packages/analyzers/src/seo/analyzer.ts.

Input: CrawledPage[] (the full crawl result array)
Output: { score: SEOScore, issues: SEOIssue[], pageScores: Record<string, number> }

Run the following checks across all pages:

TITLE TAG CHECKS (per page)
- Missing title → Critical
- Title too short (< 30 chars) → Warning
- Title too long (> 60 chars) → Warning
- Duplicate titles across pages → Warning
- Title same as H1 (exact match) → Info

META DESCRIPTION CHECKS (per page)
- Missing meta description → Warning
- Too short (< 100 chars) → Warning
- Too long (> 160 chars) → Warning
- Duplicate meta descriptions → Warning

CANONICAL CHECKS (per page)
- Missing canonical tag → Warning
- Canonical pointing to different domain → Critical
- Self-referencing canonical (correct) → pass
- Canonical chain (canonical pointing to another page that also has canonical) → Warning

ROBOTS / INDEXABILITY
- Page blocked by robots.txt but in sitemap → Critical
- noindex meta but page has inbound internal links → Warning
- Pages returning 4xx → Critical
- Pages returning 3xx with redirect chains > 2 hops → Warning

SITEMAP CHECKS (site-wide)
- Pages found in crawl but not in sitemap → Warning
- Pages in sitemap returning non-200 → Critical
- Sitemap not found → Warning

INTERNAL LINKS
- Broken internal links (destination 4xx/5xx) → Critical
- Links using redirect URLs (not final destination) → Info
- Links with empty or generic anchor text ("click here", "read more") → Info

SCORING
Weight each check category and produce an overall SEO score 0–100.
Include score breakdown by category.
Sort issues by: Critical first, then Warning, then Info.
Deduplicate identical issues.
```

---

### PROMPT 4.2 — SEO Scoring Algorithm

```
read CLAUDE.md
Create the scoring algorithm for the SiteNexis SEO module at /packages/analyzers/src/seo/scoring.ts.

The algorithm must:

1. Accept an array of SEOIssue objects
2. Apply weighted deductions based on issue type and severity:
   - Critical issue: -8 to -15 points (depending on type)
   - Warning issue: -2 to -5 points
   - Info issue: -0.5 to -1 point
3. Apply bonuses for positive signals:
   - All titles unique and within length: +5
   - All pages have meta descriptions: +5
   - Sitemap present and valid: +5
   - No broken internal links: +5
   - No redirect chains: +3
4. Cap final score between 0 and 100
5. Classify score:
   - 90–100: Excellent
   - 70–89: Good
   - 50–69: Needs Work
   - 0–49: Critical Issues

Export:
  function calculateSEOScore(issues: SEOIssue[], pageCount: number): SEOScore

Also export:
  function getSEOScoreLabel(score: number): string
  function getSEOScoreColor(score: number): string  // returns hex color for UI

Include a detailed comment block explaining the scoring rationale.
```

---

## 5. AI Readability Engine

---
read CLAUDE.md

### PROMPT 5.1 — AI Readability Scorer

```
read CLAUDE.md
Build the AI Readability Engine at /packages/analyzers/src/ai/readability.ts.

This is SiteNexis's core differentiator — the first standardised score for how well a website can be retrieved and cited by AI systems (ChatGPT, Perplexity, Google AI Overviews, Gemini).

The engine evaluates each CrawledPage on 4 dimensions:

DIMENSION 1: ENTITY CLARITY (0–25 points)
Use the Claude API (claude-sonnet-4-20250514) to evaluate:
- Does the page clearly identify who/what it is about?
- Are people, organisations, products, services named explicitly?
- Are entities defined in context (not assumed knowledge)?
- Is there an "About" or definitional section?

Prompt the AI with the page title + first 1500 chars of body text.

DIMENSION 2: CONVERSATIONAL READINESS (0–25 points)
Evaluate via AI prompt:
- Does the page directly answer questions a user might ask?
- Are there FAQ-style Q&A structures?
- Is the content written in natural language (not just keyword lists)?
- Does the H1/title match what someone would literally search for?

DIMENSION 3: AI EXTRACTABILITY (0–25 points)
Evaluate via AI prompt:
- Can the page's key facts be summarised in 2–3 sentences?
- Is there a clear, unambiguous main claim or topic?
- Is content fragmented across tabs/accordions that might not render for crawlers?
- Does the page have a logical reading flow (intro → body → conclusion)?

DIMENSION 4: KNOWLEDGE GRAPH STRUCTURE (0–25 points)
Evaluate programmatically (no API call needed):
- Does the page have meaningful internal links to related topics? (+5 per cluster link, max 10)
- Does the page link to authoritative external sources? (+5)
- Does the page have structured data (schema) that defines its topic? (+10)

IMPLEMENTATION NOTES
- Batch API calls: process 5 pages concurrently max
- Cache results: identical body text hash → skip API call
- Rate limit: 60 RPM for Claude API
- Fallback: if API unavailable, return score: null with status: "pending"

Output per page:
  {
    url: string,
    overall: number,        // 0–100
    entityClarity: number,
    conversationalReadiness: number,
    aiExtractability: number,
    knowledgeGraphStructure: number,
    missingEntities: string[],
    recommendations: string[]
  }
```

---

### PROMPT 5.2 — AI Readability Prompt Templates

```
read CLAUDE.md
Create a prompt template library for the SiteNexis AI Readability Engine at /packages/analyzers/src/ai/prompts.ts.

Build 3 prompt templates used by the AI Readability Engine:

PROMPT 1: entityClarityPrompt(title: string, bodyExcerpt: string): string
System: "You are an AI content analysis expert evaluating web pages for AI retrieval readiness."
User prompt must instruct Claude to:
- Identify named entities on the page (people, orgs, places, products, services)
- Rate entity clarity 0–25 (integer only)
- List up to 5 missing entity signals
- Return ONLY valid JSON: { score: number, missingEntities: string[] }

PROMPT 2: conversationalReadinessPrompt(title: string, headings: string[], bodyExcerpt: string): string
User prompt must instruct Claude to:
- Assess if content answers real user queries naturally
- Check for FAQ structures, direct answers, natural language
- Rate 0–25 (integer only)
- Return ONLY valid JSON: { score: number, issues: string[] }

PROMPT 3: aiExtractabilityPrompt(title: string, bodyExcerpt: string): string
User prompt must instruct Claude to:
- Try to summarise the page in exactly 2 sentences
- Rate how cleanly extractable the core content is, 0–25
- Flag issues: fragmented content, ambiguous claims, missing conclusion
- Return ONLY valid JSON: { score: number, summary: string, issues: string[] }

For each prompt:
- Keep body excerpts to max 2000 tokens to control costs
- Include explicit instruction: "Return ONLY valid JSON. No explanation. No markdown."
- Include example output in the system prompt to improve consistency

Also create: parseAIResponse<T>(raw: string): T
- Safely parse Claude API response
- Strip markdown code fences if present
- Throw descriptive error if JSON is invalid
```

---

## 6. Schema Engine

---
read CLAUDE.md

### PROMPT 6.1 — Schema Detector & Validator

```
read CLAUDE.md
Build the Schema Engine at /packages/analyzers/src/schema/engine.ts.

PHASE 1: DETECTION
Given a CrawledPage (with schemaBlocks: string[]):
- Parse all JSON-LD blocks
- Detect microdata (look for itemtype/itemprop attributes in raw HTML — accept raw HTML string as additional input)
- Detect RDFa (typeof/property attributes)
- For each schema found: extract @type, @id, key properties

PHASE 2: VALIDATION
Validate detected schemas against known schema.org rules.

Support these types with full required/recommended field lists:
- Organization: name, url, logo, contactPoint, sameAs
- LocalBusiness: name, address, telephone, openingHours, geo
- WebPage / WebSite: name, url, description
- BlogPosting / Article: headline, author, datePublished, image, publisher
- FAQPage: mainEntity (array of Question with acceptedAnswer)
- Product: name, image, description, sku, offers (with price, priceCurrency, availability)
- BreadcrumbList: itemListElement (array with item, name, position)

For each schema found, report:
- isValid: boolean
- missingRequiredFields: string[]
- missingRecommendedFields: string[]
- typeErrors: { field: string, expected: string, got: string }[]
- warningMessages: string[]

PHASE 3: SUGGESTIONS
For each page, if relevant schema type is absent, suggest it:
- Page with blog post content + no BlogPosting schema → suggest BlogPosting
- Page with product info + no Product schema → suggest Product
- Home page + no WebSite/Organization schema → suggest both
- Page with FAQ section + no FAQPage schema → suggest FAQPage

PHASE 4: AUTO-GENERATION
For flagged suggestions, generate a ready-to-use JSON-LD snippet:
  function generateSchemaSnippet(type: string, pageData: Partial<CrawledPage>): string

Output a well-formatted <script type="application/ld+json"> block.

Export main function:
  analyzeSchema(pages: CrawledPage[]): SchemaAnalysis[]
```

---

## 7. Internal Link Graph Engine
read CLAUDE.md
---

### PROMPT 7.1 — Graph Construction

```
read
Build the Internal Link Graph Engine at /packages/analyzers/src/graph/engine.ts.

INPUT: CrawledPage[] (each has url and internalLinks[])

PHASE 1: BUILD THE GRAPH
Construct a directed graph where:
- Nodes = each unique crawled page URL
- Edges = internal links between pages (directional: from → to)
- Edge weight = number of times page A links to page B

Data structure:
  type GraphNode = {
    id: string           // page URL
    label: string        // page slug or title
    pageRank: number     // calculated PageRank
    inDegree: number     // links pointing in
    outDegree: number    // links pointing out
    cluster: string      // detected topic cluster
  }

  type GraphEdge = {
    source: string
    target: string
    weight: number
  }

PHASE 2: PAGERANK CALCULATION
Implement the PageRank algorithm (10 iterations, damping factor 0.85).
Assign pageRank score to every node.

PHASE 3: ORPHAN PAGE DETECTION
A page is an orphan if: inDegree === 0 AND it is not the root URL.
Return orphanPages: string[] — list of orphan page URLs.

PHASE 4: TOPIC CLUSTER DETECTION
Use simple community detection (label propagation algorithm):
- Pages that frequently link to the same hub pages belong to the same cluster
- Assign each node a cluster label (e.g., "cluster_1", "blog_cluster", etc.)
- Detect weak clusters: clusters where internal link density < 30%

PHASE 5: LINK SUGGESTIONS
For each orphan page:
- Find 3 semantically related pages (use URL path similarity + shared keywords in title)
- Suggest: "Add a link from [related page] to [orphan page]"

Return:
  {
    nodes: GraphNode[],
    edges: GraphEdge[],
    orphanPages: string[],
    weakClusters: string[][],
    linkSuggestions: { from: string, to: string, reason: string }[]
  }
```

---

## 8. Content Quality Engine

---

### PROMPT 8.1 — Content Quality Analyzer

```
Build the Content Quality Engine at /packages/analyzers/src/content/engine.ts.

INPUT: CrawledPage[]
OUTPUT: ContentQualityScore (see shared types)

RUN THESE CHECKS:

1. THIN CONTENT DETECTION
A page is thin if ANY of:
- wordCount < 300
- Paragraph count < 3
- Ratio of boilerplate text (nav, footer, header) to body content > 60%
- bodyText is mostly repeated across other pages (>70% similarity)
Mark as thin, severity: warning or critical based on word count.

2. DUPLICATE INTENT DETECTION
Group pages by: their likely target keyword (extract from title + H1 + slug).
If 2+ pages target the same keyword intent:
- Flag as duplicate intent group
- Suggest: canonical to the stronger page, or merge content
Use simple TF-IDF cosine similarity on title+H1 to find duplicates.

3. KEYWORD STUFFING DETECTION
For each page:
- Extract top 5 keywords by frequency
- If any keyword appears more than 3x per 100 words → flag as stuffed
- Calculate keyword density %
- Severity: warning if density > 3%, critical if > 5%

4. MISSING FAQ DETECTION
If a page:
- Has a title or H1 containing "what", "how", "why", "guide", "tips", "best"
- And has NO FAQ schema AND no <details> or Q&A structure in HTML
→ Suggest adding an FAQ section

5. SEMANTIC DEPTH SCORING
Score each page's semantic depth 0–100:
- Word count contribution: up to 30 points
- Heading structure (H2s, H3s present): up to 20 points
- Presence of lists/tables: up to 10 points
- External links to authoritative sources: up to 10 points
- Internal links count (3+ = good): up to 10 points
- Image alt text completeness: up to 10 points
- Schema presence: up to 10 points

AGGREGATE OUTPUT:
- contentScore per page (0–100, avg of thin/stuffing/depth sub-scores)
- Site-wide content health score
- thinPages[], stuffedPages[], duplicateIntentGroups[], faqOpportunities[]
```

---

## 9. Performance Engine
read CLAUDE.md
---

### PROMPT 9.1 — Performance Module

```
Build the Performance Engine at /packages/analyzers/src/performance/engine.ts.

This module optionally integrates with Google Lighthouse via the lighthouse npm package.

SETUP
- Wrap Lighthouse in a safe runner that uses a shared Puppeteer browser instance
- Timeout: 60 seconds per page, fail gracefully
- Only run on a sample of pages (max 5 pages per audit to control time): homepage + 4 highest-traffic pages (by inDegree from graph)

METRICS TO EXTRACT from Lighthouse result:
  - LCP (Largest Contentful Paint) — in seconds
  - CLS (Cumulative Layout Shift) — decimal
  - FID / INP (Interaction to Next Paint)
  - TBT (Total Blocking Time) — in ms
  - Speed Index
  - Time to Interactive
  - Performance score (0–100 from Lighthouse)
  - Mobile performance score
  - Opportunities: array of { title, estimatedSavings }
  - Diagnostics: JS bundle size, image formats, render-blocking resources

THRESHOLDS (for issue generation):
  - LCP > 4s → Critical | LCP 2.5–4s → Warning | < 2.5s → Pass
  - CLS > 0.25 → Critical | CLS 0.1–0.25 → Warning | < 0.1 → Pass
  - TBT > 600ms → Critical | TBT 200–600ms → Warning | < 200ms → Pass

OUTPUT:
  type PerformanceResult = {
    url: string,
    lighthouseScore: number,
    mobileLighthouseScore: number,
    coreWebVitals: { lcp: number, cls: number, inp: number, tbt: number },
    passed: boolean,
    issues: SEOIssue[],
    opportunities: { title: string, estimatedSavingMs: number }[]
  }

IMPORTANT: If Lighthouse fails or is unavailable, return a graceful PerformanceResult with score: null and a note that performance audit was skipped.
```

---

## 10. Report Engine

---
read CLAUDE.md
### PROMPT 10.1 — PDF Report Generator

```
Build the Report Engine at /packages/analyzers/src/reports/generator.ts.

Generate a professional PDF audit report for each completed SiteNexis audit.

USE: @react-pdf/renderer (React-PDF) for PDF generation in Node.js context.

REPORT STRUCTURE (multi-page PDF):

PAGE 1: COVER PAGE
- SiteNexis logo/wordmark (text-based, styled)
- Domain audited (large, prominent)
- Audit date and duration
- "Confidential Audit Report" label

PAGE 2: EXECUTIVE SCORECARD
- 5 score circles: SEO / AI Readability / Schema / Link Strength / Performance
- Each shows score number + label + colour (green/amber/red)
- Total issues count by severity (Critical / Warning / Info)

PAGES 3–N: SECTION REPORTS
For each module (SEO, AI, Schema, Links, Content, Performance):
- Section header with score
- Top issues table (up to 10 per section): Page URL | Issue | Severity | Recommendation
- Key stats summary

FINAL PAGE: ACTION PLAN
- Top 10 most impactful fixes across all modules, prioritised by severity + estimated impact
- Format: numbered list with clear action verbs

STYLING
- Brand colours: Navy #0A1628, Cyan #00C8FF, Teal #0BCEBC
- Font: use built-in Helvetica (safe for PDF) or embed Inter via base64
- Clean, professional, data-dense but readable
- Page numbers in footer

UPLOAD
After generation:
- Upload PDF to S3/R2 using the env.S3_* credentials
- Return: { pdfUrl: string, generatedAt: Date, expiresAt: Date (30 days) }
- Save pdfUrl to the Report table in DB

Export:
  async function generateAuditReport(auditId: string): Promise<{ pdfUrl: string }>
```

---

## 11. Frontend — Landing Page
read CLAUDE.md
---

### PROMPT 11.1 — Landing Page

```
Build the SiteNexis landing page at /apps/web/app/page.tsx.

Design direction: Dark, premium, technical — like a professional intelligence platform. Not a generic SaaS template.

SECTIONS:

1. HERO
- Background: deep navy (#0A1628) with subtle animated grid lines or mesh gradient
- Large headline: "Your Website, Fully Decoded" 
- Subheadline: "SiteNexis audits every dimension of your site — SEO, AI readability, schema, content, and performance — in one scan."
- Domain input bar: large, centred, placeholder "Enter your domain (e.g. apple.com)", with a "Run Full Audit →" button in cyan
- Under input: "Free · No signup required · Results in ~60 seconds"
- Subtle animation on the input: a scanning pulse when focused

2. TRUST BAR
- "Trusted by 10,000+ developers and marketing teams"
- 5 placeholder company logos (text-based, greyed out)

3. PROBLEM SECTION
- Headline: "You're running 6 tools. We built one."
- 6 tool logos/icons (Ahrefs, SEMrush, Screaming Frog, PageSpeed, Search Console, Schema validator)
- With an arrow → single SiteNexis logo
- Brief description of the consolidation value

4. SCORES SHOWCASE
- 5 animated score circles counting up from 0 to demo values
- Labels: SEO Health · AI Readability · Schema · Link Strength · Performance
- Trigger animation on scroll into view

5. AI READABILITY FEATURE HIGHLIGHT
- Headline: "Built for the age of AI search."
- 3 columns: ChatGPT · Google AI Overviews · Perplexity
- Copy explaining how SiteNexis optimises for AI citation

6. HOW IT WORKS
- 4 steps with icons: Enter Domain → Crawl & Analyse → Score & Diagnose → Download Report
- Horizontal stepper with connector lines

7. PRICING SECTION
- 4 tier cards: Free / Starter $29 / Pro $79 / Agency $249
- Highlight Pro as "Most Popular"
- Clean card design with feature lists and CTA buttons

8. FOOTER
- Logo, tagline, links: Product, Docs, Pricing, Blog, Status
- Copyright

Use Framer Motion for: hero entrance animation, score counter animation, section fade-ins on scroll.
Use TailwindCSS throughout. Make it fully responsive.
```

---

### PROMPT 11.2 — Domain Input Component

```
Build a reusable domain input component at /apps/web/components/DomainInput.tsx.

FUNCTIONALITY:
- Accepts a domain string
- Validates input:
  - Remove http:// https:// www. prefixes automatically on blur
  - Show inline error if input is not a valid domain format (regex validation)
  - Valid: "example.com", "sub.example.co.uk", "my-site.io"
  - Invalid: "not a domain", "http://", empty string
- On submit: call onSubmit(cleanDomain: string) prop
- Show loading state while audit is initialising (spinner in button, disabled input)

DESIGN:
- Large input (height 56px on desktop, 48px mobile)
- Rounded-full or rounded-xl pill shape
- Input and button joined in one bar (button inside/attached to right)
- Button text: "Run Audit →"
- On focus: cyan border glow effect
- On loading: button shows "Starting Scan..." with a pulsing dot animation
- Error state: red border + error message below input

PROPS:
  interface DomainInputProps {
    onSubmit: (domain: string) => void | Promise<void>
    isLoading?: boolean
    placeholder?: string
    autoFocus?: boolean
  }

Also export a hook: useDomainValidation() that:
- Takes a raw string
- Returns: { isValid: boolean, cleanDomain: string, error: string | null }
```

---

## 12. Frontend — Dashboard
read CLAUDE.md
---

### PROMPT 12.1 — Main Dashboard

```
Build the SiteNexis dashboard at /apps/web/app/dashboard/page.tsx.

This is the authenticated user's home screen, showing their audit history and quick actions.

LAYOUT:
- Sidebar navigation (fixed left, collapsible on mobile)
  - Logo
  - Nav items: Dashboard, New Audit, My Domains, Reports, Settings
  - User avatar + plan badge at bottom
- Main content area (right of sidebar)

MAIN CONTENT — 3 SECTIONS:

1. HEADER ROW
- "Good morning, [Name]" greeting
- "New Audit" button (primary CTA, cyan)
- Usage indicator: "12 / 50 audits used this month" with progress bar

2. RECENT AUDITS TABLE
Columns: Domain | SEO | AI | Schema | Links | Perf | Status | Date | Actions
- Status badges: Queued (grey) / Running (blue, animated pulse) / Complete (green) / Failed (red)
- Score cells: show number + colour-coded background
- Actions: View Report | Re-run | Delete
- Sortable columns
- Pagination (10 per page)
- Empty state: illustration + "Run your first audit" CTA

3. QUICK STATS ROW (site-wide across all audits)
- 4 stat cards: Avg SEO Score | Avg AI Score | Total Issues Found | Reports Generated
- Each card: large number, label, trend arrow vs last month

Use React Query (TanStack Query) for data fetching from /api/audits.
Skeleton loading states for all data-dependent elements.
Use Recharts for a small 7-day audit volume bar chart.
```

---

### PROMPT 12.2 — Real-Time Audit Progress UI

```
Build the real-time audit progress component at /apps/web/components/AuditProgress.tsx.

This displays after the user submits a domain and the audit is running.

DESIGN: Full-screen or large modal overlay with live progress.

ELEMENTS:

1. DOMAIN DISPLAY
- Shows "Auditing: example.com" in large text
- Animated scanning icon (pulsing circle or radar sweep)

2. PROGRESS STAGES
Show 6 stages with status indicators (pending / active / complete / error):
  🔍 Crawling pages...
  📊 Analysing SEO signals...
  🧠 Scoring AI readability...
  🧱 Validating schema...
  🔗 Mapping link graph...
  📄 Generating report...

Each stage shows:
- Stage icon + label
- Sub-status text (e.g. "Crawled 47 / ~120 pages")
- Duration elapsed
- Checkmark when complete, spinner when active, grey when pending

3. LIVE COUNTERS (update in real-time)
- Pages crawled: [N]
- Issues found: [N]
- Time elapsed: [M:SS]

REAL-TIME UPDATE MECHANISM:
- Connect to Server-Sent Events at /api/audit/[id]/stream
- Parse events: { stage, pagesCount, issuesCount, message }
- On event: update UI state
- On completion event: redirect to /audit/[domain]

Also build: /app/api/audit/[id]/stream/route.ts
- Next.js Route Handler using Response with ReadableStream
- Polls audit job status from DB every 2 seconds
- Emits SSE events in format: data: { ...payload }\n\n
- Closes stream when audit status is 'complete' or 'failed'
```

---

## 13. Frontend — Audit Results Pages
read CLAUDE.md
---

### PROMPT 13.1 — Audit Overview Page

```
Build the main audit results page at /apps/web/app/audit/[domain]/page.tsx.

This is the primary report view after an audit completes.

LAYOUT: Full-width with sticky top nav showing domain + re-run button.

SECTIONS:

1. SCORE HERO (top of page)
- 5 large circular score gauges side by side
- Each gauge: animated arc, score number in centre, label below
- Colour: green (80+), amber (50–79), red (<50)
- Site-wide stats: X pages crawled · Y issues found · Z ms avg load

2. CRITICAL ISSUES BANNER
- If any Critical issues exist: red banner listing top 3 with "Fix These First" CTA

3. MODULE TABS
Tab navigation: SEO | AI Readability | Schema | Link Graph | Content | Performance
Each tab loads its sub-page component (lazy loaded).

4. SEO TAB CONTENT
- SEO score breakdown bar chart (Recharts HorizontalBar)
- Issues table: filterable by severity, sortable by page
- Quick wins highlight: top 3 easiest fixes

5. AI READABILITY TAB
- 4 dimension scores (entity clarity, conversational, extractability, knowledge graph)
- Radar chart showing 4 dimensions
- Page-by-page AI scores table
- AI recommendations list

6. SCHEMA TAB
- Schema types found (badge list)
- Validation issues table
- Auto-generated schema snippets (with copy button, syntax-highlighted)

7. CONTENT TAB
- Content quality score per page
- Thin content list
- Duplicate intent groups (grouped view)

8. PERFORMANCE TAB
- Core Web Vitals display (styled like Google's CrUX report)
- LCP / CLS / INP status indicators
- Opportunities and diagnostics list

Add a floating "Download PDF Report" button (bottom right, sticky).
```

---

### PROMPT 13.2 — Issues Table Component

```
Build a reusable issues table component at /apps/web/components/IssuesTable.tsx.

FEATURES:
- Display SEOIssue[] data
- Columns: Severity | Page URL | Issue Type | Description | Recommendation
- Severity badges: 🔴 Critical | 🟡 Warning | 🔵 Info (with count pills)
- Filterable by: severity (multi-select), module (multi-select), page URL search
- Sortable by any column
- Paginated: 20 rows per page
- Expandable rows: click row to expand full recommendation + links to affected page
- "Copy URL" button on page column
- "Export CSV" button (downloads all issues as .csv)
- Row count summary: "Showing 23 of 47 issues"

PROPS:
  interface IssuesTableProps {
    issues: SEOIssue[]
    isLoading?: boolean
    showModuleFilter?: boolean
  }

EMPTY STATE:
If no issues: show green checkmark + "No issues found in this category. Great work!"

IMPLEMENTATION NOTES:
- Use TanStack Table (react-table v8) for sorting, filtering, pagination
- Virtualise long lists (>100 rows) using TanStack Virtual
- Make severity filter sticky (persists if user switches tabs and comes back)
```

---

## 14. Frontend — Link Graph Visualization
read CLAUDE.md
---

### PROMPT 14.1 — Interactive Link Graph

```
Build the internal link graph visualization at /apps/web/components/LinkGraph.tsx.

This is a fully interactive knowledge graph showing the site's internal linking structure.

USE: react-force-graph-2d (wraps D3 force simulation)

VISUAL DESIGN:
- Dark background (#0A1628 navy)
- Nodes: circles sized by PageRank (min 6px, max 24px)
  - Colour by cluster (auto-assign distinct colours per cluster)
  - Highlight orphan nodes in red
  - Homepage node: always large, gold colour
- Edges: semi-transparent cyan lines, thickness by weight
- Node labels: show on hover OR for high-PageRank nodes always visible
- Selected node: highlighted ring + info panel opens

INTERACTIONS:
- Click node → open side panel with: URL, PageRank, in/out degree, top linking pages, link suggestions
- Hover node → tooltip: page title + scores
- Drag to pan, scroll to zoom
- Search box: type URL or page title to highlight matching node
- Filter toggle: show/hide orphan nodes, show/hide weak clusters

CONTROLS PANEL (top-left overlay):
- Zoom in / Zoom out / Fit all / Reset
- Toggle: Cluster colours | PageRank sizing | Orphan highlight
- Legend: colour key for clusters

SIDE PANEL (opens on node click):
- Page URL (with external link icon)
- SEO score for that page
- AI Readability score
- PageRank value
- Inbound links: [list of pages linking here]
- Outbound links: [list of pages this links to]
- Link suggestions: "Add link from X to this page" (from engine output)

PROPS:
  interface LinkGraphProps {
    graph: InternalLinkGraph
    onNodeClick?: (nodeId: string) => void
  }

Performance: use canvas rendering (not SVG) for graphs > 200 nodes.
```

---

## 15. API Routes
read CLAUDE.md
---

### PROMPT 15.1 — Audit API Routes

```
Build the core API routes for SiteNexis at /apps/web/app/api/.

CREATE THESE ROUTES:

1. POST /api/audit/start
Request body: { domain: string }
- Validate domain format
- Check user's plan limits (free: 1/day, starter: 50/month, etc.)
- Create Audit record in DB (status: queued)
- Enqueue BullMQ crawl job
- Return: { auditId: string, status: "queued" }

2. GET /api/audit/[id]
- Fetch audit by ID (check ownership)
- Return full AuditReport including scores, issues, pages
- If status not complete: return { status, progress }

3. GET /api/audit/[id]/stream (SSE)
- Server-Sent Events for real-time progress
- (Implementation from earlier prompt)

4. GET /api/audits
Query params: page, limit, status, domain (search)
- Return paginated list of user's audits
- Include summary scores for each

5. DELETE /api/audit/[id]
- Soft-delete audit (mark as archived)
- Cascade: archive associated pages, issues, report

6. POST /api/audit/[id]/report
- Trigger PDF report generation
- Return: { reportUrl: string } or { status: "generating" }

7. GET /api/usage
- Return current user's usage stats
- { auditsThisMonth, auditsLimit, plan, nextResetDate }

MIDDLEWARE:
Create /apps/web/middleware.ts:
- Protect all /api/* and /dashboard/* routes with Supabase auth
- Rate limit: 10 req/min per user on /api/audit/start (use upstash/ratelimit)
- Add request ID header for logging
- Log all API calls to UsageLog table

Use Next.js Route Handlers (not pages/api). Return proper HTTP status codes.
```

---

### PROMPT 15.2 — Webhook Handler
read CLAUDE.md
```
Build the Stripe webhook handler at /apps/web/app/api/webhooks/stripe/route.ts.

Handle these Stripe events:

1. checkout.session.completed
   - Extract customer email and plan from metadata
   - Update User.plan in DB
   - Create or update Stripe customer ID on user record

2. customer.subscription.updated
   - Detect plan changes (upgrades/downgrades)
   - Update User.plan accordingly
   - Plan mapping:
     - price_starter_monthly → "starter"
     - price_pro_monthly → "pro"
     - price_agency_monthly → "agency"

3. customer.subscription.deleted
   - Downgrade user to "free" plan
   - Send cancellation confirmation email (use Resend or similar)

4. invoice.payment_failed
   - Log the failure
   - (Optional) trigger dunning email

SECURITY:
- Verify Stripe webhook signature using env.STRIPE_WEBHOOK_SECRET
- Use stripe.webhooks.constructEvent()
- Reject any request with invalid signature → return 400

IMPLEMENTATION:
- Read raw request body (do NOT parse as JSON before verification)
- In Next.js App Router, use: const rawBody = await req.text()
- After verification, parse JSON and handle events

Return 200 for all valid events (even unhandled ones) to prevent Stripe retries.
Log all webhook events to console and optionally to a WebhookLog DB table.
```

---

## 16. Auth & Billing
read CLAUDE.md
---

### PROMPT 16.1 — Supabase Auth Integration

```
Set up complete authentication for SiteNexis using Supabase Auth.

CREATE:

1. /apps/web/lib/supabase/client.ts — browser Supabase client (singleton)
2. /apps/web/lib/supabase/server.ts — server Supabase client (for Server Components and API routes, using cookies)
3. /apps/web/lib/supabase/middleware.ts — refresh session in middleware

AUTH PAGES:
/apps/web/app/(auth)/login/page.tsx
- Email + password login form
- "Continue with Google" OAuth button
- "Forgot password?" link
- Link to signup

/apps/web/app/(auth)/signup/page.tsx
- Email + password + name signup
- Google OAuth
- Terms of service acceptance checkbox
- On success: redirect to /dashboard

/apps/web/app/(auth)/reset-password/page.tsx
- Request reset email form
- Confirmation message

PROTECTED LAYOUT:
/apps/web/app/dashboard/layout.tsx
- Check session server-side (use server Supabase client)
- If no session: redirect to /login
- Pass user object to children via context

USER CONTEXT:
/apps/web/lib/context/UserContext.tsx
- Provide: user object, plan, usage stats, signOut function
- Fetch usage from /api/usage on mount

After signup: automatically create User record in PostgreSQL DB via a Supabase database trigger or an API call to /api/auth/callback.
```

---

### PROMPT 16.2 — Stripe Billing Setup

```
Build the billing and subscription system for SiteNexis.

PRODUCTS TO CREATE IN STRIPE:
- Free: no product needed
- Starter: $29/month — 50 audits/month
- Pro: $79/month — unlimited audits + AI suggestions
- Agency: $249/month — bulk audits + API + team accounts

CREATE:

1. /apps/web/lib/stripe.ts
   - Stripe client singleton (server-side only)
   - Helper: getOrCreateStripeCustomer(userId, email)

2. /apps/web/app/api/billing/checkout/route.ts (POST)
   - Input: { priceId: string }
   - Create Stripe Checkout Session
   - success_url: /dashboard?upgraded=true
   - cancel_url: /pricing
   - Include metadata: { userId, plan }
   - Return: { checkoutUrl: string }

3. /apps/web/app/api/billing/portal/route.ts (POST)
   - Create Stripe Customer Portal session
   - Return: { portalUrl: string }
   - (For managing subscriptions, cancellations)

4. /apps/web/app/(marketing)/pricing/page.tsx
   - Pricing page with 4 tier cards
   - "Get Started" → POST to /api/billing/checkout → redirect to Stripe
   - "Manage Billing" button for existing subscribers → Portal

5. Plan enforcement utility: /apps/web/lib/plans.ts
   - PLAN_LIMITS: { free: { auditsPerMonth: 1 }, starter: { auditsPerMonth: 50 }, ... }
   - checkAuditLimit(userId): Promise<{ allowed: boolean, remaining: number, resetDate: Date }>

Make sure no Stripe secret keys are ever exposed to the client. All Stripe operations must be server-side only.
```

---

## 17. Testing
read CLAUDE.md
---

### PROMPT 17.1 — Unit Tests for Analyzers

```
Write comprehensive unit tests for the SiteNexis analyzer modules using Vitest.

CREATE TEST FILES:

1. /packages/analyzers/src/seo/__tests__/analyzer.test.ts
Test cases:
- Empty pages array → returns score 100, no issues
- Page with missing title → generates Critical issue
- Page with duplicate titles → generates Warning for each duplicate
- Page with too-long meta description → generates Warning
- Page blocked by robots + in sitemap → Critical issue
- Broken internal link (4xx status) → Critical issue
- All checks passing → score 90+

2. /packages/analyzers/src/schema/__tests__/engine.test.ts
Test cases:
- JSON-LD with complete Organization schema → isValid: true
- JSON-LD missing required 'name' field → isValid: false, missingRequired includes 'name'
- Invalid JSON in LD block → handled gracefully, no crash
- Page with blog content + no BlogPosting schema → suggestion generated
- FAQPage schema with malformed mainEntity → error flagged

3. /packages/analyzers/src/content/__tests__/engine.test.ts
Test cases:
- Page with 150 words → flagged as thin
- Two pages with same H1 → duplicate intent group created
- Page with keyword density > 5% → flagged as stuffed
- Page with "how to" in title + no FAQ schema → FAQ opportunity suggested

4. /packages/crawler/src/__tests__/robots.test.ts
Test cases:
- Disallow: / blocks all pages
- Disallow: /admin only blocks /admin/* pages
- Allow: /admin/public overrides Disallow: /admin
- Empty robots.txt → all pages allowed
- Network failure → returns allow-all default

Use Vitest with describe/it/expect. Mock all external network calls using vitest.mock().
Include at least 5 test cases per file. Aim for >80% coverage.
```

---

### PROMPT 17.2 — End-to-End Tests
read CLAUDE.md
```
Write end-to-end tests for SiteNexis using Playwright.

CREATE: /apps/web/e2e/

TEST FILE 1: audit-flow.spec.ts
Test the complete user journey:
1. Visit homepage
2. Enter "example.com" in the domain input
3. Click "Run Full Audit"
4. Assert: redirected to audit progress page
5. Wait for progress stages to complete (mock the SSE stream in tests)
6. Assert: redirected to /audit/example.com
7. Assert: 5 score circles are visible and contain numbers
8. Assert: issues table has at least 1 row
9. Click "Download PDF" button
10. Assert: download was triggered

TEST FILE 2: auth.spec.ts
1. Sign up with test email/password
2. Assert: redirected to dashboard
3. Sign out
4. Assert: redirected to login
5. Sign in again
6. Assert: dashboard loads with correct user name

TEST FILE 3: dashboard.spec.ts
1. Log in as test user
2. Assert: recent audits table is visible
3. Click on an audit domain
4. Assert: navigated to audit results page
5. Click "Schema" tab
6. Assert: schema analysis content loads
7. Click "Link Graph" tab
8. Assert: graph canvas element is present

Setup:
- /e2e/fixtures/auth.ts — reusable authenticated page fixture
- /e2e/mocks/audit.ts — MSW mock for /api/audit/* endpoints
- playwright.config.ts — configured for localhost:3000, Chromium only for CI

Use page.waitForSelector() and expect(locator).toBeVisible() assertions.
```

---

## 18. Deployment
read CLAUDE.md
---

### PROMPT 18.1 — Docker & Production Setup

```
Create the production deployment configuration for SiteNexis.

CREATE:

1. /Dockerfile (multi-stage for Next.js app)
   Stage 1 (deps): install pnpm, install dependencies
   Stage 2 (builder): copy source, run pnpm build
   Stage 3 (runner): minimal Node.js alpine, copy built app, expose port 3000
   Use Next.js standalone output mode.

2. /docker-compose.yml (for local development)
Services:
   - web: the Next.js app (hot reload via volume mount)
   - redis: Redis 7 (for BullMQ job queues)
   - worker: Node.js service running the BullMQ worker (/packages/crawler/src/worker.ts)
Environment variables loaded from .env file.

3. /packages/crawler/src/worker.ts
   - Standalone Node.js process (not Next.js)
   - Connects to Redis, processes crawl jobs from CrawlQueue
   - Imports all analyzer modules
   - On job: run full audit pipeline, save results to DB, emit progress events
   - Graceful shutdown on SIGTERM

4. /.github/workflows/deploy.yml
GitHub Actions CI/CD pipeline:
   - Trigger: push to main branch
   - Steps:
     a. Install dependencies (pnpm)
     b. Run type check (tsc --noEmit)
     c. Run unit tests (vitest run)
     d. Build Docker image
     e. Push to Docker Hub or GitHub Container Registry
     f. Deploy to fly.io via flyctl deploy (or Railway / Render)
   - Require all tests to pass before deploy

5. /fly.toml (if using Fly.io)
   - Configure app name, region, machine size
   - Set PORT=3000
   - Add Redis service via Upstash Redis add-on reference

Include a DEPLOYMENT.md with step-by-step instructions for first-time setup.
```

---

### PROMPT 18.2 — Monitoring & Observability
read CLAUDE.md
```
Set up monitoring and observability for SiteNexis production.

CREATE:

1. /apps/web/lib/logger.ts
   - Structured logger using "pino" library
   - Log levels: debug, info, warn, error
   - Include: timestamp, requestId, userId, domain (where applicable)
   - In production: output JSON to stdout (for log aggregation)
   - In development: pretty-print with pino-pretty

2. /apps/web/lib/telemetry.ts
   - Error tracking using Sentry SDK (@sentry/nextjs)
   - Initialise in both /instrumentation.ts (server) and client layout
   - Capture: unhandled errors, API route errors, crawler failures
   - Set user context when authenticated

3. /apps/web/app/api/health/route.ts
   Health check endpoint returning:
   {
     status: "ok" | "degraded" | "down",
     checks: {
       database: "ok" | "error",
       redis: "ok" | "error",
       anthropicApi: "ok" | "error"
     },
     version: string,
     uptime: number
   }
   Check each dependency with a lightweight probe (DB: SELECT 1, Redis: PING, Anthropic: list models).

4. /packages/crawler/src/metrics.ts
   Track and expose BullMQ queue metrics:
   - Jobs waiting, active, completed, failed (last 24h)
   - Average job duration
   - Failure rate %
   Expose via GET /api/metrics (admin-only, protected by ADMIN_SECRET env var)

5. Add Uptime monitoring instructions:
   - Configure BetterStack (or UptimeRobot) to ping /api/health every 60 seconds
   - Alert on: status !== "ok" for 2+ consecutive checks
   - Include cURL command to test health endpoint

Also: add structured audit logging to UsageLog table for all audit starts, completions, and failures with durations.
```

---

## ⚡ BONUS PROMPTS
read CLAUDE.md
---


### BONUS A — CLI Audit Tool

```
Build a CLI tool at /packages/cli/src/index.ts that allows running SiteNexis audits from the terminal.

Usage:
  sitenexis audit example.com
  sitenexis audit example.com --modules seo,schema
  sitenexis audit example.com --output report.pdf
  sitenexis audit example.com --json > results.json
  sitenexis config set api-key <YOUR_API_KEY>

IMPLEMENTATION:
- Use "commander" for CLI argument parsing
- Use "ora" for loading spinners
- Use "chalk" for coloured terminal output
- Authenticate against the SiteNexis API using a stored API key
- Poll GET /api/audit/[id] until complete
- Display: score summary table in terminal, top 5 issues per module
- --json flag: output raw JSON audit report to stdout
- --output flag: download PDF report to specified path

BUILD:
- Bundle with esbuild to single binary
- Publish as "sitenexis" on npm
- Include README with install + usage instructions

Make the terminal output visually clean: use box-drawing characters for score table, colour-code severities.
```

---

### BONUS B — Chrome Extension

```
Build a Chrome extension for SiteNexis that audits the currently open page.

MANIFEST v3 structure:
- manifest.json: permissions for activeTab, storage, scripting
- Popup (popup.html + popup.tsx): React-based UI
- Background service worker (background.ts)
- Content script (content.ts): extract page data

POPUP UI:
- Shows current page URL
- "Quick Audit This Page" button
- Displays: SEO score, AI Readability score, top 3 issues
- "Full Audit on SiteNexis →" link (opens sitenexis.com with domain pre-filled)

HOW IT WORKS:
1. User clicks extension icon on any page
2. Content script extracts: title, meta description, H1, schema blocks, canonical URL from live DOM
3. Sends extracted data to popup via chrome.runtime.sendMessage
4. Popup sends to SiteNexis API for scoring (/api/quick-audit — new route, single-page scan)
5. Display results in popup within 5 seconds

QUICK AUDIT API ROUTE:
POST /api/quick-audit
Body: { url, title, metaDescription, h1, canonical, schemaBlocks[] }
Returns: { seoScore: number, aiScore: number, topIssues: SEOIssue[] }
Rate limited: 20/hour per IP (no auth required for quick audit)

Build with Vite + React. Include a build script that outputs to /dist ready for Chrome Web Store upload.
```

---

*End of SiteNexis Claude Code Prompts Pack — 40+ prompts across 18 modules*

---

**© 2025 SiteNexis · For internal use only · Do not distribute**
