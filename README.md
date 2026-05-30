# SiteNexis — AI Retrieval + Machine Trust Intelligence System

> A digital observatory for the machine-first web.
> Not an SEO tool. Not an audit dashboard. A live intelligence system that models how AI systems retrieve, interpret, trust, and recommend web content.

---

## What SiteNexis Actually Is

Most SEO tools stop at metadata, backlinks, keywords, and Lighthouse scores. SiteNexis operates in a different category entirely. It answers questions no existing tool addresses:

- *Can ChatGPT retrieve this page under query pressure — and where does meaning degrade?*
- *How is trust formed, maintained, and lost across an AI ecosystem over time?*
- *Across which AI recommendation surfaces is this content invisible — and why?*

This is not observability for humans. This is observability for machines.

The platform models the complete chain of decisions an AI system makes — from raw HTML ingestion through chunk extraction, entity resolution, semantic trust formation, retrieval ranking, summarisation, citation eligibility filtering, and final recommendation surface inclusion.

---

## The Core Insight

AI systems do not read websites the way humans do. They consume:

- **Chunks** — discrete semantic units of approximately 300–600 tokens
- **Entities** — named objects with stable, unambiguous identities
- **Semantic relationships** — typed connections between entities and topics
- **Retrievable answers** — content structured to directly satisfy a specific query
- **Trust signals** — schema markup, consistent entity data, authorship markers
- **Topical authority patterns** — coherent, interconnected clusters of domain coverage
- **Temporal signals** — recency, update consistency, content freshness

Every step in that pipeline is a potential failure point. SiteNexis instruments every layer.

---

## The Four-Layer Intelligence Stack

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 4 — MACHINE TRUST LAYER                              │
│  Retrieval simulation · Trust modeling · Recommendation     │
│  Temporal authority · Synthetic entity detection            │
├─────────────────────────────────────────────────────────────┤
│  LAYER 3 — AI VISIBILITY LAYER                              │
│  AI Perception Graph · Citation Probability                 │
│  Retrieval Readiness · Visibility Scoring                   │
├─────────────────────────────────────────────────────────────┤
│  LAYER 2 — SEMANTIC INTELLIGENCE LAYER                      │
│  Entity Intelligence · Schema Analysis                      │
│  Content Quality · Machine Readability                      │
├─────────────────────────────────────────────────────────────┤
│  LAYER 1 — CRAWL & STRUCTURE LAYER                          │
│  Puppeteer crawl · Chunk extraction · Link graph            │
│  SEO signals · Technical performance                        │
└─────────────────────────────────────────────────────────────┘
```

Each layer depends on the one below it and feeds the one above. Layer 4 cannot produce meaningful output without the entity graph, retrieval scores, and semantic signals from Layers 2 and 3.

---

## Deployment Architecture

```
User
 ↓
Vercel (Next.js frontend + API routes)
 ↓  [enqueues job in < 1 second]
Upstash Redis (BullMQ queue — durable, persistent)
 ↓  [worker picks up job]
Railway (BullMQ worker — always-on, long-running)
 ↓  [crawls, analyzes, scores — 3–8 minutes]
Supabase (PostgreSQL — results, scores, issues)
 ↓  [SSE stream / polling]
Vercel frontend (dashboard renders report)
```

**Why this split matters:** Vercel is serverless — functions die after ~30 seconds. Crawling and AI analysis take 3–8 minutes. Railway runs the worker as a persistent process with no timeout constraint. Upstash Redis is the handoff point: jobs survive worker crashes because they remain in the queue until successfully processed.

---

## Module Reference

This section defines what each module *actually does* — the computation behind it, not just the label.

---

### INTELLIGENCE MODULES

---

#### 1. AI Visibility

**What it measures:**
How visible, understandable, and retrievable this site is to AI systems. Not Google ranking. Not keyword density. The question is: can ChatGPT retrieve it? Can Gemini understand it? Can Perplexity cite it? Can Claude extract structured meaning from it?

**Inputs:**
- Content structure (heading hierarchy, paragraph organisation)
- Schema markup completeness and accuracy
- Entity clarity and disambiguation strength
- Semantic chunking quality (do semantic units align with paragraph breaks?)
- Internal linking patterns
- Topical depth and coverage breadth
- Answer formatting (direct answers, FAQ structures, HowTo patterns)
- Crawlability and renderability signals
- Query-answer alignment across six query types: definitional, comparative, procedural, evaluative, factual, navigational

**Computation:**
```
AI Visibility Score =
  Machine Readability Score    × 0.15
  + Entity Confidence Score    × 0.20
  + Retrieval Readiness Score  × 0.20
  + Citation Probability Score × 0.20
  + Semantic Trust Score       × 0.15
  + Schema Completeness Score  × 0.10
```

**Outputs:**
- AI Visibility Score (0–100)
- Retrieval Readiness Score
- Citation Readiness indicator
- Per-provider visibility estimates (ChatGPT, Gemini, Perplexity, Claude, voice assistants)
- Pages most likely to surface in LLM responses
- Pages invisible to AI systems with root cause analysis
- AI comprehension heatmap (page-level)
- Low-confidence extraction zones

**UI:**
- Radar chart across AI provider dimensions
- Neural heatmap of page-level AI readability
- "Most AI-readable pages" ranked list
- "Low-confidence extraction zones" with specific paragraph callouts
- Provider-by-provider inclusion probability breakdown

---

#### 2. Entity Intelligence

**What it measures:**
The semantic entity graph of the site — what named objects the site defines, how authoritatively it defines them, whether they are consistent, and whether the topical coverage creates genuine domain authority.

**The core concept:**
Entities are the atomic units of AI knowledge. When an AI system processes a page about "digital marketing" but never cleanly defines SEO, SERP, schema markup, or Google Search Console, the engine detects weak semantic authority. Entity failure equals AI invisibility regardless of SEO health.

**What it extracts:**
- People (authors, founders, executives)
- Brands and organisations
- Products and services
- Places and locations
- Concepts and topics
- Categories and industries

**Computation:**
Four analysis dimensions run in sequence:
1. **Entity Detection** — NER across all crawled pages, normalised and deduplicated
2. **Entity Consistency** — same entity described with same attributes across all pages
3. **Entity Coverage** — does the entity graph cover the expected topical territory for this domain?
4. **Entity Disambiguation** — is each entity uniquely identifiable, or does it have naming conflicts?

**Outputs:**
- Entity graph (nodes = entities, edges = relationships with typed connections)
- Entity Confidence Score (0–100 composite)
- Topical authority map — which topic clusters are strong vs. weak
- Missing entity suggestions — what should be defined but isn't
- Entity consistency issues — where the same entity is described differently across pages
- Semantic cluster visualisation

**UI:**
- Interactive force-directed graph (react-force-graph)
- Entity confidence bars per extracted entity
- Semantic cluster map with authority heatmapping
- Knowledge web animation showing entity relationships
- Missing entities panel with impact estimates

---

#### 3. Retrieval Optimization (Retrieval Simulation Engine)

**What it measures:**
Whether an AI system can actually retrieve this content effectively. Not whether it's crawlable. Whether it can be chunked, embedded, ranked, retrieved under query pressure, and survive compression into an AI-generated answer without losing meaning.

**The core insight:**
AI retrieval is not binary pass/fail. It is a probabilistic ranking process under competitive pressure. Content that retrieves well for one query may be suppressed for another. Content that survives retrieval may lose its critical meaning during summarisation.

**Six simulation stages:**

1. **Chunk Extraction Simulation** — Which chunks would be selected for a given query type? Do semantic units hold at extraction? Would a fixed-size tokenizer split this content mid-thought?

2. **Retrieval Ranking Pressure** — Given competitive retrieval from high-authority sources, where does this content rank? What is the estimated embedding cosine similarity range for target query types?

3. **Summarisation Degradation Analysis** — When retrieved chunks are compressed into an AI-generated answer, what meaning is lost? Which facts are likely to be dropped, distorted, or hallucinated?

4. **Context Truncation Modeling** — Which content falls beyond the retrieval context window for long pages? Which critical facts sit in truncation zones?

5. **Answer Formation Probability** — Combining retrieval rank, chunk stability, and summarisation loss: what is the probability this chunk becomes part of an AI-generated answer?

6. **Citation Eligibility Filtering** — Which retrieved chunks pass the AI system's citation eligibility filter? Factors: specificity, authority signal density, factual verifiability.

**Formula:**
```
Retrieval Quality Score =
  Chunk Stability Index           × 25
  + Answer Formation Probability  × 25
  + Summarisation Loss Score      × 25
  + Citation Eligibility Score    × 25
```

**Outputs:**
- Retrieval Quality Score (0–100)
- Chunk Stability Index (0–1)
- Answer Formation Probability per query type
- Summarisation Loss Score
- Fragile claims count (facts that distort under compression)
- Truncation zone warnings (facts at risk from context window limits)
- "Likely retrieval excerpts" simulation — what an AI would actually extract
- Embedding friendliness assessment

**UI:**
- Retrieval simulation panel with stage-by-stage breakdown
- Chunk stability visualisation (colour-coded by stability across chunking strategies)
- "AI snippet simulation" — actual preview of what an LLM would extract
- Fragile claims highlighted in context
- Context window truncation map for long pages

---

#### 4. Citation Probability

**What it measures:**
The likelihood that an AI system selects this page as a citation source in a generated response. This is not a proxy for backlinks. It measures AI-native authority signals — the structural and factual properties that make content citation-worthy to an LLM.

**The key distinction:**
Traditional SEO authority = who links to you.
AI citation authority = do you have the right structural and factual properties for an LLM to trust quoting you?

**Factor weights:**
```
Citation Probability Score =
  Factual density          × 0.20
  + Claim specificity      × 0.15
  + Primary entity authority × 0.15
  + Topical authority depth  × 0.15
  + Structural citation readiness × 0.15
  + Temporal freshness     × 0.10
  + Trust signal density   × 0.10
```

**Inputs:**
- Factual claim density (number of specific, verifiable facts per chunk)
- Claim specificity (concrete numbers, dates, named sources vs. vague assertions)
- Entity authority (how clearly and consistently the primary entity is defined)
- Topical authority depth (coverage breadth and coherence within the domain)
- Structural citation readiness (clear headings, structured answers, no dangling references)
- Content freshness and update signals
- Trust signal density (authorship, schema, external validation)

**Outputs:**
- Citation Probability Score (0–100) site-wide
- Per-page citation probability rankings
- "Why AI may avoid citing this page" — specific blockers per page
- Citation pathway analysis — which pages would anchor citations
- Suggested structural improvements ranked by citation impact

**UI:**
- Citation probability meter per page
- "Top citeable pages" ranked list
- Blocker analysis panel per low-scoring page
- Citation pathway visualisation from entity nodes to pages

---

#### 5. Semantic Trust

**What it measures:**
Whether an AI system assigns this content sufficient credibility to include in a generated response. Trust is not the same as visibility. A highly visible but low-trust site is suppressed. Trust is a composite formed from authorship signals, organisational credibility, content consistency, and structural integrity.

**Four trust signal categories:**

1. **Authorship Trust** — Are authors named? Do they have external profiles? Do their credentials align with the content topic?

2. **Organisational Trust** — Is the organisation behind the site consistently defined across pages and schema? Do `sameAs` links resolve to expected entities?

3. **Content Trust** — Are claims internally consistent? Are there factual contradictions between pages? Is the writing structurally sound with no sensational claims or unsupported assertions?

4. **Structural Trust** — Does the schema accurately represent the page content (no over-claiming)? Is the heading hierarchy coherent? Are dates consistent?

**Contradiction detection:**
Claude API is used for semantic contradiction detection on the top 20 pages by PageRank. If two pages on the same domain make conflicting factual claims about the same entity, this is flagged as a trust degradation signal.

**Outputs:**
- Semantic Trust Score (0–100)
- E-E-A-T alignment assessment
- Authority confidence breakdown by trust category
- Trust gap analysis — specific issues lowering trust
- Contradiction report (where found)
- Schema trust alignment (schema claims vs. body text reality)

**UI:**
- Trust breakdown radar across four categories
- Contradiction flagging with specific page pairs and conflicting claims
- Schema alignment checker (claims in schema vs. claims in body)
- Trust gap priority list

---

### ANALYSIS MODULES

---

#### 6. Audits (Central Execution Layer)

**What it is:**
The orchestration hub. Every audit is a multi-agent pipeline that runs in a specific sequence, with each agent consuming the output of the previous layer.

**Pipeline:**
```
Phase 1 (sequential):
  Crawl Agent — fetches, renders, parses, extracts chunks + entities

Phase 2 (parallel):
  SEO Agent — title/meta/canonical/robots/sitemap/broken links
  Schema Agent — detection, validation, auto-generation

Phase 3 (parallel):
  Retrieval Agent — machine readability, chunk quality, AI extractability
  Entity Agent — entity detection, consistency, coverage, disambiguation
  Performance Agent — Lighthouse, Core Web Vitals (top 5 pages by PageRank)

Phase 4 (parallel):
  Citation Agent — citation probability weighted formula
  Semantic Trust Agent — trust signal analysis + contradiction detection

Phase 5 (parallel — Layer 4):
  Retrieval Simulation Agent
  Machine Trust Agent
  Temporal Authority Agent
  Recommendation Mapping Agent
  Synthetic Entity Detection Agent

Phase 6:
  Visualization Agent — pre-computes graph layouts
  Infrastructure Agent — aggregates all results, writes final audit record
  Reporting Agent — generates PDF, uploads to R2
```

**Audit status flow:**
```
queued → running → complete
                 ↘ failed (partial results preserved)
```

**Key constraints:**
- Max 500 pages per crawl
- Respects robots.txt
- Lighthouse runs on top 5 pages by PageRank only
- Retrieval simulation runs on top 30 pages by PageRank only
- Layer 4 agents gated to Pro+ plans

---

#### 7. Live Audit

**What it feels like:**
A terminal + AI intelligence dashboard hybrid. Like Vercel deployment logs mixed with a cyber-intelligence console. The user watches the audit happen in real time.

**What streams:**
- Crawl progress (pages discovered, pages crawled)
- Agent activation events (SEO agent started, Entity agent completed...)
- Issues discovered as they're found
- Score updates as each agent completes
- Graph construction events
- Final score reveal

**Technical implementation:**
Server-Sent Events (SSE) from `/api/audit/[id]/stream`. The Infrastructure Agent emits progress events to BullMQ; the SSE route translates those into the live stream.

**UI:**
- Live crawl counter and progress bar
- Agent pipeline visualisation showing which phase is active
- Real-time issue discovery feed
- Score meters that fill as agents complete
- "Pages discovered" and "entities found" counters updating live

---

#### 8. Audit History

**What it does:**
A searchable, filterable timeline of all audits with score trend analytics and comparison mode.

**Features:**
- Audit timeline with score deltas between runs
- Side-by-side comparison of two audit runs
- Score trend charts across dimensions (SEO, AI Visibility, Trust...)
- "What changed" analysis between consecutive audits
- Issue resolution tracking (issues that appeared, disappeared, or worsened)
- Domain-level authority velocity tracking (is the site improving?)

**UI:**
- Timeline view with score indicators per audit
- Comparison drawer with delta highlighting
- Trend sparklines per score dimension

---

#### 9. Bulk Audits (Agency Feature)

**What it does:**
Allows Pro/Agency users to audit multiple domains simultaneously.

**Features:**
- CSV upload for domain lists
- Concurrent audit queue management with priority controls
- Cross-domain comparison tables
- Aggregate reporting across a portfolio of domains
- Export centre (bulk PDF/CSV export)
- Team collaboration (share results with workspace members)

**Plan gating:** Agency and Enterprise only.

---

### SYSTEMS MODULES

---

#### 10. Perception Graph

**The signature SiteNexis feature.**

**What it visualises:**
Not link structure. Not site architecture. The AI system's *cognitive map* of this website — how it perceives the entities, topics, relationships, and authority zones across the site.

**This is the intersection of:**
- Knowledge graph (entity nodes + typed relationship edges)
- Internal link graph (structural PageRank pathways)
- Semantic topic network (topical clusters and their coherence)
- AI retrieval pathways (which nodes are entry points for AI queries)
- Trust pathways (which authority signals flow from where to where)

**Node types:**
- Entity nodes (people, brands, products, concepts)
- Topic cluster nodes (thematic groupings)
- Claim nodes (specific factual assertions)
- Page nodes (source documents)

**Edge types:**
- `isA` — entity type relationships
- `partOf` — containment relationships
- `relatedTo` — semantic proximity
- `contradicts` — flagged inconsistencies
- `supports` — evidential relationships
- `authorOf` — authorship chains
- `locatedIn` — geographical relationships
- `offers` — service/product relationships

**What the graph reveals:**
- Topical authority clusters (dense, well-connected = strong authority)
- Trust pathways (how credibility flows from anchoring entities)
- Citation pathways (which nodes are most likely AI citation candidates)
- Contextual gaps (topics expected but absent from the graph)
- Contradiction chains (conflicting claims connected to the same entity)
- Recommendation likelihood (nodes with highest AI surface coverage)

**UI:**
- Interactive canvas using react-force-graph
- Zoom, pan, click-to-inspect nodes
- Colour coding by node type and authority strength
- Filtering by relationship type
- "AI entry points" highlighted (top retrieval candidates)
- Animation showing how an AI system would traverse the graph

---

#### 11. Competitive Analysis (Pro/Agency)

**What it does:**
Compares the audited domain against up to 5 competitor domains across AI-era dimensions — not traditional SEO metrics.

**Comparison dimensions:**
- AI Visibility Score vs. competitors
- Entity authority and coverage gaps
- Citation pathway comparison
- Topical authority gap map (topics where competitors dominate)
- Schema quality comparison
- Retrieval structure comparison
- Recommendation surface presence comparison

**Strategic output:**
- "Where competitors have AI authority you lack"
- Entity gaps — entities they define that you don't
- Topical white space — topics neither of you own (opportunity)
- Citation pathway analysis — why AI systems cite them instead of you

**Plan gating:** Pro and Agency only.

---

#### 12. Issues Centre

**What it is:**
The centralised intelligence hub that aggregates every issue found across all modules into a single actionable view.

**Issue types covered:**
- SEO issues (technical, on-page, structural)
- AI issues (extractability, chunk quality, entity clarity)
- Trust issues (authorship, schema misrepresentation, contradictions)
- Schema problems (missing fields, invalid types, over-claiming)
- Content weaknesses (factual density, answer structure, topical gaps)
- Retrieval failures (truncation zones, fragile claims, ranking pressure)
- Temporal issues (stale content, decay signals)

**Issue anatomy:**
Every issue has:
- Module origin
- Severity (Critical / Warning / Info)
- Affected page(s)
- Precise description of what is wrong
- Actionable recommendation
- Estimated score impact if fixed

**Severity deduction:**
- Critical: −8 to −15 points
- Warning: −2 to −5 points
- Info: −0.5 to −1 point

**UI:**
- Filterable by module, severity, page, score impact
- Priority queue (highest-impact fixes first)
- Fix progress tracking (mark issues as resolved)
- "Fix this" deep links directly to affected content

---

#### 13. Reports

**What it produces:**

1. **Executive Summary Report** — high-level score overview, top 5 issues, strategic recommendations. Non-technical. For stakeholders.

2. **Technical Intelligence Report** — complete audit findings, all scores with sub-breakdowns, every issue, full entity graph export, retrieval simulation results.

3. **AI Visibility Action Plan** — prioritised fix list with estimated impact per fix, targeted at content and technical teams.

4. **White-label Reports** — Agency/Enterprise: remove SiteNexis branding, add client logo.

**Generation:**
Reports are generated by the Reporting Agent after all other agents complete. PDFs are stored in Cloudflare R2 with a signed URL. Reports expire after 30 days and can be regenerated.

---

### SETTINGS MODULES

---

#### 14. API Keys

**What it enables:**
Programmatic access to SiteNexis for:
- CLI tools
- CI/CD pipeline integration (audit on deploy)
- Agency workflow automation
- Custom integrations

**Features:**
- Named API keys with custom labels
- Key-level rate limiting
- Audit via API (same pipeline, different entry point)
- Webhook support for audit completion events

**Plan gating:** Agency and Enterprise only.

---

#### 15. Billing

**What it manages:**
- Stripe Checkout for plan upgrades
- Stripe Customer Portal for subscription management
- Real-time usage tracking (audits used / audits allowed this month)
- Plan enforcement before every audit job enqueue

**Plan structure:**

| Plan | Monthly Audits | Layer 4 | Competitive | API | Bulk |
|---|---|---|---|---|---|
| Free | 1 | No | No | No | No |
| Starter | 50 | No | No | No | No |
| Pro | Unlimited | Yes | Yes | No | No |
| Agency | Unlimited | Yes | Yes | Yes | Yes |
| Enterprise | Unlimited | Yes | Yes | Yes | Yes + White-label |

Layer 4 = Retrieval Simulation, Machine Trust, Temporal Authority, Recommendation Surface Mapping, Synthetic Entity Detection.

---

#### 16. Team (Agency/Enterprise)

**What it enables:**
- Invite team members to a shared workspace
- Role-based permissions (Admin, Analyst, Viewer)
- Shared audit history across workspace
- Collaborative report access
- Audit attribution tracking

---

#### 17. Integrations (Roadmap)

**Planned integrations:**

| Integration | Purpose |
|---|---|
| Google Search Console | Correlate AI visibility with actual search performance |
| GA4 | Map AI-readable pages against real traffic data |
| Ahrefs / Semrush | Enrich entity data with traditional SEO signals |
| Vercel | Trigger audits on deployment via webhook |
| Cloudflare | Access edge performance data |
| Slack | Audit completion notifications, issue alerts |
| Notion | Export reports and issue lists to Notion |
| CMS systems | Direct content editing suggestions from issues |

---

## Scoring Architecture

### Twelve Scores Across Four Tiers

**Tier 1 — Infrastructure Scores:**
- SEO Health Score
- Schema Completeness Score
- Internal Link Strength Score
- Technical Performance Score

**Tier 2 — AI Visibility Scores:**
- AI Visibility Score (composite of Tier 1 + 2 signals)
- Machine Readability Score
- Entity Confidence Score
- Retrieval Readiness Score
- Citation Probability Score
- Semantic Trust Score
- Recommendation Confidence Score

**Tier 3 — Machine Trust Scores:**
- Retrieval Quality Score
- Machine Trust Score
- Authority Velocity Score
- Trust Stability Index
- Recommendation Surface Score
- Entity Authenticity Confidence

**Tier 4 — Master Intelligence Score:**
```
Machine Trust Intelligence Score =
  Retrieval Quality Score          × 0.20
  + Machine Trust Score            × 0.25
  + Authority Velocity Score       × 0.15
  + Recommendation Surface Score   × 0.20
  + Entity Authenticity Confidence × 0.20
```

### Score Thresholds (Consistent Across All UI)

| Range | Label | Colour |
|---|---|---|
| 90–100 | Excellent | `#22C55E` (green-500) |
| 70–89 | Good | `#0BCEBC` (teal-400) |
| 50–69 | Needs Work | `#F59E0B` (amber-400) |
| 0–49 | Critical | `#EF4444` (red-500) |

### Universal Explainability Rule

Every point deduction maps to a named `Issue` with:
1. A `type` and `severity`
2. A human-readable `description` of what is wrong
3. An actionable `recommendation`
4. A `scoreBreakdown` JSON showing the sub-score calculation

No black boxes. No composite score without a full decomposition.

---

## Data Flow (End-to-End)

```
1. User submits domain
   → Vercel API validates, checks plan limits, creates Audit record in Supabase
   → Enqueues CrawlJob in Upstash via BullMQ
   → Returns 202 { auditId }

2. Railway worker picks up job
   → Crawl Agent: Puppeteer renders pages, extracts text, chunks, entities
   → Layer 1+2 agents run in parallel (SEO, Schema, Entity)
   → Layer 3 agents run in parallel (Retrieval, Citation, Trust, Performance)
   → Layer 4 agents run in parallel (Simulation, Machine Trust, Temporal, Surfaces, Synthetic)
   → Infrastructure Agent aggregates all results → writes to Supabase
   → Visualization Agent pre-computes graph layouts → writes to Redis (24h TTL)
   → Reporting Agent generates PDF → uploads to Cloudflare R2

3. Frontend streams progress via SSE
   → /api/audit/[id]/stream relays BullMQ progress events
   → Dashboard updates score meters and issue list in real time

4. Audit complete
   → Supabase holds all scores, issues, entities, pages, graph snapshot
   → Dashboard renders full report from Supabase via API routes
   → PDF available for download from R2 signed URL
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 App Router (React Server Components) |
| Auth | Supabase Auth (email/password + Google, GitHub, Twitter, Discord OAuth) |
| Database | Supabase PostgreSQL (Prisma ORM) |
| Job Queue | BullMQ on Upstash Redis (TLS) |
| Worker Host | Railway (persistent Node.js process) |
| Crawling | Puppeteer + Cheerio |
| AI Engine | Anthropic Claude (primary), OpenAI (fallback) |
| Graph Visualisation | react-force-graph (canvas) |
| PDF Generation | Reporting Agent → Cloudflare R2 |
| Client Data Fetching | TanStack Query |
| Data Tables | TanStack Table |
| Animations | Framer Motion |
| E2E Testing | Playwright |
| Unit Testing | Vitest |
| Monorepo | Turborepo + pnpm workspaces |
| Deployment | Vercel (frontend) + Railway (worker) |

---

## Monorepo Structure

```
sitenexis/
├── apps/
│   └── web/                     # Next.js frontend + API routes
├── packages/
│   ├── shared/                  # Shared TypeScript types
│   ├── db/                      # Prisma schema, client, query helpers
│   │   └── generated/           # Generated Prisma client + engine binary
│   ├── crawler/                 # Puppeteer crawler + BullMQ worker + watchdog
│   ├── analyzers/               # All scoring engines across all 12 modules
│   └── agents/                  # Orchestration agents for each pipeline phase
├── config/
│   ├── provider-weights.json    # AI provider behavior weights
│   ├── citation-weights.json    # Citation probability factor weights
│   ├── trust-decay-model.json   # Trust decay curve parameters
│   ├── surface-coverage-model.json
│   └── synthetic-detection-rules.json
├── railway.json                 # Railway worker deployment config
├── CLAUDE.md                    # Full architectural specification (source of truth)
└── README.md                    # This file
```

---

## Design Language

**Aesthetic:** Dark intelligence console. A website MRI scanner with reasoning layers. Think radar, not dashboard.

**Colour tokens:**
```css
--navy:      #0A1628   /* Primary bg, headings */
--cyan:      #00C8FF   /* Primary accent, CTAs */
--teal:      #0BCEBC   /* Secondary accent, success */
--amber:     #F59E0B   /* Warnings */
--red:       #EF4444   /* Critical issues, errors */
--light-bg:  #EBF8FF   /* Card backgrounds */
--text-dark: #1A2C42   /* Body text */
--text-mid:  #4A6280   /* Labels, secondary */
```

**Typography:** Display: Georgia · UI: Calibri / system-ui · Code: JetBrains Mono

**Design principles:**
- Every score has a visual decomposition — no number without context
- Every issue has a fix — no problem without an action
- Every graph is interactive — no static visualisation where exploration is possible
- Every AI estimate is labelled as an estimate — no false certainty about AI system internals

---

## What "Done" Looks Like

A fully operational SiteNexis audit produces:

1. A live crawl of up to 500 pages with real-time progress streaming
2. Twelve scores across four tiers, every one explainable to the deduction level
3. A complete entity graph with typed relationships and authority scores
4. A retrieval simulation showing exactly which content survives AI processing
5. A citation probability ranking across all pages
6. A semantic trust analysis with contradiction detection
7. A perception graph — the AI's cognitive map of the site
8. An interactive force-directed visualisation of the entity network
9. A prioritised issues list across all modules with impact estimates
10. A PDF intelligence report (executive + technical versions)
11. All results persisted in Supabase for trend analysis across future audits

The user submits a domain, watches the machine think, and receives a complete picture of how AI systems see, interpret, trust, and recommend their content.

That is what SiteNexis is.

---

*CLAUDE.md is the engineering source of truth. README.md is the human understanding layer. When in doubt: CLAUDE.md wins.*
