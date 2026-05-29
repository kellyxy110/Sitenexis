# CLAUDE.md — SiteNexis AI Retrieval + Machine Trust Intelligence System
### Project Intelligence & Architectural Specification · Version 3.0

> This file is the operational brain of the SiteNexis codebase.
> Claude Code reads it at the start of every session.
> It contains everything needed to build, extend, and reason about any part of this system.
> Update it whenever architecture, conventions, APIs, agents, or scoring logic changes.
> If code and CLAUDE.md conflict, CLAUDE.md defines intent — fix the code.

---

## PART I — PHILOSOPHY & POSITIONING

---

## 1. Core Philosophy

SiteNexis is not an SEO tool. It is not an audit dashboard. It is not a keyword optimiser.

SiteNexis is a **multi-layer intelligence system that models how AI systems retrieve, interpret, trust, and recommend web content** — a machine perception and trust infrastructure layer for the web.

The platform answers questions no existing tool addresses:

> *"How does an AI system retrieve this page under query pressure — and where does meaning degrade?"*
> *"How is trust formed, maintained, and lost in an AI ecosystem over time?"*
> *"Across which AI recommendation surfaces is this content invisible — and why?"*

This is not observability for humans. This is observability for machines.

**The evolution of SiteNexis:**

| v1 — SEO Infrastructure | v2 — AI Visibility Intelligence | v3 — Machine Trust Intelligence |
|---|---|---|
| Technical audit | AI perception modeling | Retrieval simulation |
| SEO scores | AI Visibility scores | Machine Trust scores |
| On-page checks | Entity + citation analysis | Trust formation + decay modeling |
| Link graphs | Perception graphs | Recommendation surface mapping |
| Schema validation | AI extractability scoring | Synthetic entity detection |

Each version extends the previous. Nothing is replaced. The architecture compounds.

---

## 2. Four-Layer Intelligence Stack

SiteNexis is structured as a four-layer intelligence stack. Each layer depends on the one below it and feeds the one above.

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

Layer 4 (Machine Trust) cannot produce meaningful output without the entity graph, retrieval scores, and semantic signals from Layers 2 and 3. All new Phase 3 systems operate at Layer 4.

---

## 3. AI Systems Interpretation Model

AI systems do not read websites the way humans do. This is foundational to every design decision in this codebase.

### How AI Systems Consume Web Content

```
Raw HTML
  → Text extraction       (strip nav, boilerplate, scripts)
    → Chunking            (split into ~512-token semantic units)
      → Embedding         (convert chunks to vector representations)
        → Entity extraction     (identify named real-world objects)
          → Relationship mapping   (link entities to context)
            → Retrieval scoring  (rank chunks for query relevance)
              → Summarization     (compress retrieved chunks into answer)
                → Citation decision  (select chunks to surface or quote)
                  → Trust filtering   (suppress low-confidence sources)
                    → Recommendation   (include entity in AI-generated answers)
```

Each step is a potential failure point. SiteNexis instruments every layer, including the new trust filtering and summarization degradation stages added in v3.

### What AI Systems Consume

AI systems do not consume pages. They consume:

- **Chunks** — discrete semantic units of approximately 300–600 tokens
- **Entities** — named objects with stable, unambiguous identities
- **Semantic relationships** — typed connections between entities
- **Contextual summaries** — compressed representations of topic clusters
- **Retrievable answers** — content structured to directly satisfy a specific query
- **Citation candidates** — factual claims with sufficient authority signals to quote
- **Structured trust signals** — schema markup, consistent entity data, authorship
- **Topical authority patterns** — coherent, interconnected clusters of domain coverage
- **Temporal trust signals** — recency, update patterns, freshness indicators (v3)
- **Authenticity markers** — signals distinguishing genuine from synthetic authority (v3)

### Provider Behaviour Matrix

| Provider | Primary Retrieval Signal | Trust Mechanism | Citation Behaviour |
|---|---|---|---|
| Google AI Overviews | E-E-A-T, structured data, featured snippet eligibility | Domain authority + schema | Direct answer extraction |
| ChatGPT (browsing/RAG) | Semantic similarity to query embedding | Recency + factual density | Chunk-level quotation |
| Perplexity | Real-time crawl + semantic ranking | Source diversity + answer directness | Inline citation with URL |
| Gemini | Knowledge Graph integration | Entity consistency + schema | Knowledge panel association |
| Claude (web search) | Semantic clarity + factual structure | Authoritativeness + entity clarity | Summarisation with attribution |
| Voice assistants | Answer directness + schema | Structured data + authority | Single-answer extraction |
| Autonomous agents | Entity graph density + trust score | Validation chain depth | Programmatic consumption |
| Future systems | Vector similarity + trust graph | Provider-specific | Evolving |

**The AI behavior layer is provider-agnostic by design.** Provider signals are configurable weights in `/config/provider-weights.json`. New providers are added via the registry without modifying core scoring logic. All provider scores are labelled as estimates in the UI — the system never claims certainty about provider internals.

---

## PART II — CORE ENGINEERING FOUNDATIONS

*(Preserved from v2 — do not modify without updating this header)*

---

## 4. Project Identity

**SiteNexis** is a full-stack SaaS AI Retrieval and Machine Trust Intelligence platform. It audits any domain across twelve dimensions — SEO health, machine readability, AI extractability, entity intelligence, citation readiness, semantic trust, internal link graph, technical performance, retrieval simulation, machine trust, temporal authority, and recommendation surface mapping — from a single domain input.

**Primary deliverable:** A multi-dimensional Machine Trust Report that answers: *"How does an AI system retrieve, interpret, trust, and recommend this website — and where does each process break down?"*

---

## 5. Monorepo Structure

```
sitenexis/
├── apps/
│   └── web/                              # Next.js 16 App Router (frontend + API routes)
│       ├── app/
│       │   ├── (auth)/                   # Login, signup, reset — unauthenticated layout
│       │   ├── (marketing)/              # Landing page, pricing — public layout
│       │   ├── dashboard/                # Authenticated user dashboard
│       │   ├── audit/[domain]/           # Audit results pages
│       │   │   ├── page.tsx              # Overview + score hero
│       │   │   ├── seo/                  # SEO module tab
│       │   │   ├── ai-visibility/        # AI Visibility module tab
│       │   │   ├── entity/               # Entity Intelligence tab
│       │   │   ├── citation/             # Citation Readiness tab
│       │   │   ├── schema/               # Schema analysis tab
│       │   │   ├── links/                # Link graph tab
│       │   │   ├── content/              # Content quality tab
│       │   │   ├── performance/          # Performance tab
│       │   │   ├── retrieval/            # Retrieval Simulation tab (v3)
│       │   │   ├── machine-trust/        # Machine Trust tab (v3)
│       │   │   ├── temporal/             # Temporal Authority tab (v3)
│       │   │   ├── surfaces/             # Recommendation Surface Mapping tab (v3)
│       │   │   └── authenticity/         # Synthetic Entity Detection tab (v3)
│       │   └── api/                      # All API route handlers
│       ├── components/                   # Shared UI components
│       ├── lib/                          # Utilities: env, logger, supabase, stripe
│       └── e2e/                          # Playwright end-to-end tests
├── packages/
│   ├── crawler/                          # Puppeteer/Cheerio crawl engine + BullMQ worker
│   │   └── src/
│   │       ├── crawler.ts                # Core crawl logic
│   │       ├── robots.ts                 # robots.txt parser
│   │       ├── sitemap.ts                # sitemap.xml parser
│   │       ├── extractor.ts              # Semantic extraction: chunks, entities, relationships
│   │       ├── queue.ts                  # BullMQ job queue setup
│   │       └── worker.ts                 # Standalone worker process
│   ├── analyzers/                        # All scoring and analysis modules
│   │   └── src/
│   │       ├── seo/                      # SEO analyzer + scoring
│   │       ├── ai/                       # AI Readability + extractability + visibility
│   │       │   ├── readability.ts        # 4-dimension AI extractability scorer
│   │       │   ├── visibility.ts         # AI Visibility Score + Recommendation Confidence
│   │       │   ├── prompts.ts            # All Claude API prompt templates
│   │       │   └── provider-models/      # Per-provider behavior modeling
│   │       │       ├── registry.ts
│   │       │       └── [provider].ts
│   │       ├── machine-readability/      # Chunk quality, boilerplate ratio, extraction fidelity
│   │       ├── entity/                   # Entity Intelligence Engine
│   │       ├── citation/                 # Citation Probability Engine
│   │       ├── semantic-trust/           # Semantic Trust Layer
│   │       ├── perception-graph/         # AI Perception Graph construction
│   │       ├── schema/                   # Schema detection, validation, generation
│   │       ├── graph/                    # Internal link graph + PageRank
│   │       ├── content/                  # Content quality engine
│   │       ├── performance/              # Lighthouse integration
│   │       ├── competitive/              # Competitive AI Visibility Analysis
│   │       ├── retrieval-simulation/     # Retrieval Simulation Engine (v3)
│   │       │   ├── engine.ts             # Core simulation orchestrator
│   │       │   ├── chunker.ts            # Chunk extraction + boundary modeling
│   │       │   ├── summarizer.ts         # Summarization degradation analysis
│   │       │   ├── ranker.ts             # Retrieval ranking pressure simulator
│   │       │   └── scorer.ts             # Retrieval Quality Score calculator
│   │       ├── machine-trust/            # Machine Trust Layer (v3)
│   │       │   ├── engine.ts             # Trust score orchestrator
│   │       │   ├── credibility.ts        # Entity credibility consistency
│   │       │   ├── contradiction.ts      # Cross-page contradiction detection
│   │       │   ├── validation.ts         # External validation signal analysis
│   │       │   └── decay.ts              # Trust degradation signal modeling
│   │       ├── temporal-authority/       # Temporal Authority Model (v3)
│   │       │   ├── engine.ts             # Authority velocity + stability
│   │       │   ├── drift.ts              # Semantic drift detection
│   │       │   ├── freshness.ts          # Content freshness impact scoring
│   │       │   └── history.ts            # Historical reliability pattern analysis
│   │       ├── recommendation-surface/   # Recommendation Surface Mapping (v3)
│   │       │   ├── engine.ts             # Surface coverage orchestrator
│   │       │   ├── overviews.ts          # AI Overviews inclusion modeling
│   │       │   ├── chat.ts               # Chat-based recommendation modeling
│   │       │   ├── voice.ts              # Voice assistant retrieval modeling
│   │       │   └── agents.ts             # Autonomous agent discovery modeling
│   │       ├── synthetic-entity/         # Synthetic Entity Detection Layer (v3)
│   │       │   ├── engine.ts             # Detection orchestrator
│   │       │   ├── network.ts            # Entity network integrity analysis
│   │       │   ├── patterns.ts           # Schema manipulation pattern detection
│   │       │   └── scorer.ts             # Authenticity confidence scoring
│   │       └── reports/                  # PDF report generator
│   ├── agents/                           # Autonomous agent orchestration layer
│   │   └── src/
│   │       ├── registry.ts               # Agent registry + message bus
│   │       ├── crawl-agent.ts
│   │       ├── seo-agent.ts
│   │       ├── retrieval-agent.ts
│   │       ├── entity-agent.ts
│   │       ├── citation-agent.ts
│   │       ├── semantic-trust-agent.ts
│   │       ├── schema-agent.ts
│   │       ├── reporting-agent.ts
│   │       ├── visualization-agent.ts
│   │       ├── performance-agent.ts
│   │       ├── infrastructure-agent.ts
│   │       ├── retrieval-simulation-agent.ts   # v3
│   │       ├── machine-trust-agent.ts          # v3
│   │       ├── temporal-authority-agent.ts     # v3
│   │       ├── recommendation-mapping-agent.ts # v3
│   │       └── synthetic-entity-agent.ts       # v3
│   ├── db/                               # Prisma schema, Supabase client, query helpers
│   │   ├── schema.prisma
│   │   ├── client.ts
│   │   └── queries/
│   └── shared/                           # TypeScript types across all packages
│       └── types.ts
├── config/
│   ├── provider-weights.json             # AI provider behavior weight configuration
│   ├── citation-weights.json             # Citation probability factor weights
│   ├── trust-decay-model.json            # Trust decay curve parameters (v3)
│   ├── surface-coverage-model.json       # Recommendation surface weight config (v3)
│   └── synthetic-detection-rules.json    # Synthetic entity detection rules (v3)
├── CLAUDE.md                             # This file
├── .env.example
├── turbo.json
└── pnpm-workspace.yaml
```

**Package import names:**

| Folder | Import as |
|---|---|
| `packages/shared` | `@sitenexis/shared` |
| `packages/db` | `@sitenexis/db` |
| `packages/crawler` | `@sitenexis/crawler` |
| `packages/analyzers` | `@sitenexis/analyzers` |
| `packages/agents` | `@sitenexis/agents` |

---

## 6. Architecture Rules

### Imports
- Shared types → always from `@sitenexis/shared` — never redefine locally
- DB access → always from `@sitenexis/db` — never instantiate Prisma directly
- Environment vars → always from `@/lib/env` — never use `process.env` directly
- Max 2 levels of relative imports (`../../`) — use path aliases beyond that

### TypeScript
- **Strict mode is on everywhere.** No `any`. Use `unknown` and narrow with type guards.
- Every exported function must have explicit parameter types and return types.
- Zod for runtime validation of all external input (API request bodies, API responses, crawler output).

### Next.js App Router — Server vs Client
- All components are **Server Components by default.**
- Add `"use client"` only when required: event handlers, `useState`, `useEffect`, browser APIs.
- Never import server-only code (`db`, `env` secrets, Stripe SDK) in client components.
- Use `/app/api/*` route handlers as the bridge between client and server data.
- `NEXT_PUBLIC_*` env vars only for values safe to expose to the browser.

### Data Fetching
- **Server Components:** fetch directly with `async/await` using db query helpers.
- **Client Components:** TanStack Query (`useQuery`, `useMutation`) — never raw `fetch` in `useEffect`.
- Always handle loading and error states explicitly. No silent failures.

### Error Handling
- API routes return `{ error: string }` with correct HTTP status codes (400, 401, 403, 404, 500).
- Never expose stack traces or internal messages to the client.
- Log all errors server-side with the logger from `@/lib/logger` (structured JSON via pino).

---

## 7. Module Responsibilities

**Hard boundaries — do not cross these:**

| Package | Owns | Must NOT |
|---|---|---|
| `/packages/crawler` | Fetching, rendering, parsing, chunking, entity pre-extraction | Call AI APIs, write to DB, run scoring |
| `/packages/analyzers` | All scoring, analysis, recommendations across all dimensions | Crawl pages, call DB, handle HTTP requests |
| `/packages/agents` | Orchestration of multi-step workflows, agent communication | Contain scoring logic, access DB directly, crawl |
| `/packages/db` | DB schema, Prisma client, typed query helpers | Contain business logic or scoring |
| `/apps/web/app/api` | Orchestration, auth, validation, BullMQ job enqueueing | Contain analyzer logic inline |
| `/apps/web/app` (components) | UI rendering, user interaction | Contain scoring, crawl, or DB logic |

**Data flow (v3 — extended):**
```
User submits domain
  → API route validates + checks plan limits + enqueues BullMQ job
    → Crawl Agent: CrawledPage[] with chunks + entities

      LAYER 1 + 2 AGENTS (parallel):
        SEO Agent          → SEOScore + SEOIssue[]
        Schema Agent       → SchemaAnalysis[]
        Entity Agent       → EntityIntelligenceReport + PerceptionGraphSnapshot

      LAYER 3 AGENTS (parallel, depend on Layer 2):
        Retrieval Agent    → AIVisibilityScore + MachineReadabilityScore
        Citation Agent     → CitationAnalysis
        Semantic Trust Agent → SemanticTrustScore + TrustIssue[]
        Performance Agent  → PerformanceResult[]

      LAYER 4 AGENTS (parallel, depend on Layers 2+3):
        Retrieval Simulation Agent  → RetrievalQualityScore + ChunkStabilityIndex
        Machine Trust Agent         → MachineTrustScore + TrustDegradationSignals
        Temporal Authority Agent    → AuthorityVelocityScore + TrustStabilityIndex
        Recommendation Mapping Agent → RecommendationSurfaceScore + CoverageGaps
        Synthetic Entity Agent      → EntityAuthenticityScore + NetworkIntegrityScore

      AGGREGATION:
        Infrastructure Agent aggregates all → AuditReport saved to DB
          Visualization Agent pre-computes graph layouts
            Reporting Agent generates + uploads PDF
              Frontend fetches via API routes → displays dashboard
```

---

## 8. Running the Project

```bash
# Install all dependencies
pnpm install

# Start everything (Next.js + BullMQ worker + agent registry) via Turbo
pnpm dev

# Web app only
pnpm --filter web dev

# BullMQ worker only (runs all agents)
pnpm --filter @sitenexis/crawler dev:worker

# Database operations
pnpm db:push          # Push schema to Supabase (no migration file)
pnpm db:migrate       # Generate + run migration
pnpm db:seed          # Seed test data
pnpm db:studio        # Open Prisma Studio at localhost:5555

# Testing
pnpm test             # Vitest unit tests (all packages)
pnpm test:e2e         # Playwright E2E (requires dev server running)
pnpm test:coverage    # Coverage report

# Quality checks
pnpm typecheck        # tsc --noEmit across all packages
pnpm lint             # ESLint across all packages
pnpm format           # Prettier write

# Build
pnpm build            # Build all packages + Next.js app
```

---

## 9. Environment Variables

All variables validated at startup via `/apps/web/lib/env.ts`. Never access `process.env` directly.

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | Prisma | Supabase pooled connection (port 6543) |
| `DIRECT_URL` | Prisma | Supabase direct connection (port 5432) — migrations only |
| `SUPABASE_URL` | Auth | Supabase project URL |
| `SUPABASE_ANON_KEY` | Auth (client) | Safe for browser — limited permissions |
| `SUPABASE_SERVICE_ROLE_KEY` | Auth (server) | Full access — never expose to client |
| `ANTHROPIC_API_KEY` | AI engine (primary) | Server-side only |
| `OPENAI_API_KEY` | AI engine (fallback) | Optional — server-side only |
| `REDIS_URL` | BullMQ, AI score cache | Local: `redis://localhost:6379` |
| `S3_BUCKET_NAME` | Report storage | Cloudflare R2 or AWS S3 |
| `S3_ACCESS_KEY_ID` | Report storage | Server-side only |
| `S3_SECRET_ACCESS_KEY` | Report storage | Server-side only |
| `S3_ENDPOINT` | Report storage | R2: `https://<id>.r2.cloudflarestorage.com` |
| `STRIPE_SECRET_KEY` | Billing | Server-side only |
| `STRIPE_WEBHOOK_SECRET` | Webhooks | Stripe signature verification |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Billing (client) | Safe for browser |
| `NEXT_PUBLIC_APP_URL` | Links, redirects | e.g. `https://sitenexis.com` |
| `PROVIDER_WEIGHTS_CONFIG` | AI behavior modeling | Path to `/config/provider-weights.json` |
| `TRUST_DECAY_CONFIG` | Temporal authority model | Path to `/config/trust-decay-model.json` |
| `SYNTHETIC_DETECTION_CONFIG` | Synthetic entity detection | Path to `/config/synthetic-detection-rules.json` |

---

## 10. Database Schema

**Key models (v2 tables preserved, v3 additions marked):**

| Table | Version | Purpose |
|---|---|---|
| `users` | v1 | Auth users. `plan` field. |
| `audits` | v1 | One per audit job. `status` + `domain`. |
| `pages` | v1 | One per crawled URL. Extracted data, per-page scores. |
| `page_chunks` | v2 | Semantic chunks per page |
| `entities` | v2 | Named entities (normalised, deduplicated) |
| `entity_relationships` | v2 | Typed entity relationships |
| `issues` | v1 | All issues across all modules |
| `audit_scores` | v2 | All module scores + breakdown JSON |
| `ai_visibility_scores` | v2 | AI Visibility, Entity Confidence, Citation, Retrieval, Trust, Recommendation |
| `perception_graph_snapshots` | v2 | Serialised AI Perception Graph |
| `reports` | v1 | S3 PDF URL, expiry date |
| `api_keys` | v1 | Hashed API keys |
| `usage_logs` | v1 | Audit events for billing + analytics |
| `retrieval_simulations` | **v3** | Per-page retrieval simulation results: chunk stability, ranking pressure, summarization loss |
| `machine_trust_scores` | **v3** | Trust score breakdown: credibility, contradiction, validation, decay signals |
| `temporal_authority_records` | **v3** | Authority velocity, trust stability, content freshness per audit |
| `recommendation_surface_maps` | **v3** | Surface coverage scores per provider type |
| `synthetic_entity_flags` | **v3** | Detected synthetic entity signals, network integrity flags |

**Audit status flow — only Infrastructure Agent writes `audit.status`:**
```
queued → running → complete
                 ↘ failed (partial results preserved)
```

**Soft deletes only.** `archivedAt: DateTime?`. Never hard-delete.

**All DB access through `/packages/db/queries/` helpers.** No raw Prisma in routes or components.

---

## 11. API Routes Reference

| Method | Route | Auth | Rate Limit | Purpose |
|---|---|---|---|---|
| POST | `/api/audit/start` | Required | 10/min | Validate domain, check limits, enqueue job |
| GET | `/api/audit/[id]` | Required | — | Fetch full audit result |
| GET | `/api/audit/[id]/stream` | Required | — | SSE real-time progress |
| GET | `/api/audit/[id]/ai-visibility` | Required | — | AI Visibility sub-report |
| GET | `/api/audit/[id]/entities` | Required | — | Entity intelligence report |
| GET | `/api/audit/[id]/citation` | Required | — | Citation probability report |
| GET | `/api/audit/[id]/perception-graph` | Required | — | AI Perception Graph data |
| GET | `/api/audit/[id]/retrieval` | Required | — | Retrieval Simulation results (v3) |
| GET | `/api/audit/[id]/machine-trust` | Required | — | Machine Trust score + signals (v3) |
| GET | `/api/audit/[id]/temporal` | Required | — | Temporal Authority analysis (v3) |
| GET | `/api/audit/[id]/surfaces` | Required | — | Recommendation Surface Map (v3) |
| GET | `/api/audit/[id]/authenticity` | Required | — | Synthetic Entity Detection results (v3) |
| GET | `/api/audits` | Required | — | Paginated audit history |
| DELETE | `/api/audit/[id]` | Required | — | Soft-delete audit |
| POST | `/api/audit/[id]/report` | Required | 5/hr | Trigger PDF generation |
| POST | `/api/quick-audit` | None | 20/hr/IP | Single-page scan |
| GET | `/api/usage` | Required | — | Usage stats + plan limits |
| POST | `/api/billing/checkout` | Required | — | Stripe Checkout Session |
| POST | `/api/billing/portal` | Required | — | Stripe Customer Portal |
| POST | `/api/webhooks/stripe` | Sig verify | — | Billing events |
| GET | `/api/health` | None | — | Service health check |
| GET | `/api/metrics` | Admin | — | BullMQ queue metrics |

---

## PART III — AI VISIBILITY INFRASTRUCTURE

*(Preserved from v2 — do not modify without updating this header)*

---

## 12. Machine Readability Standards

**Implemented in:** `/packages/analyzers/src/machine-readability/`

Machine readability evaluates the extraction fidelity of a page — how much meaning survives the AI retrieval pipeline from raw HTML to usable chunk.

### Extraction Pipeline Stages

```
Stage 1: Rendering fidelity        — Does JS-rendered content appear in the DOM?
Stage 2: Boilerplate ratio         — What % of text is navigation, footers, banners?
Stage 3: Chunk boundary quality    — Do paragraph breaks align with semantic units?
Stage 4: Signal-to-noise ratio     — How much text is substantive vs. filler?
Stage 5: Heading hierarchy         — Does H1→H2→H3 match content depth?
Stage 6: Reading order consistency — Does DOM order match visual reading order?
Stage 7: Link anchor quality       — Are anchor texts descriptive or generic?
```

**Machine Readability Score:** 0–100. Contributes 15% weight to AI Visibility Score.

**Rules:**
- Boilerplate detection uses element-pattern classification — not just element type
- Chunk boundaries split on paragraph + heading tags and semantic breaks, not character count
- Never penalise JS rendering if content is present after render — only if absent entirely

---

## 13. AI Extractability Framework

**Implemented in:** `/packages/analyzers/src/ai/readability.ts`

Measures whether an AI system can derive a clean, accurate understanding within a single chunk or small cluster.

**Dimension 1: Entity Clarity (0–25)** — Named entities explicit, defined in context, consistent with schema.

**Dimension 2: Conversational Readiness (0–25)** — H1/title match query form, direct answers, FAQ structures present.

**Dimension 3: Chunk Extractability (0–25)** — Each chunk semantically self-contained, no dangling references.

**Dimension 4: Summarisability (0–25)** — Clear central claim, logical structure, no internal contradictions.

**All Claude API responses parsed via** `parseAIResponse<T>()`. Prompt templates in `/packages/analyzers/src/ai/prompts.ts` — never inline.

---

## 14. Entity Intelligence Engine

**Implemented in:** `/packages/analyzers/src/entity/`

Entities are the atomic units of AI knowledge. Entity failure = AI invisibility regardless of SEO health.

**Four analysis dimensions:** Entity Detection, Entity Consistency, Entity Coverage, Entity Disambiguation.

```typescript
type EntityIntelligenceReport = {
  entitiesDetected: Entity[]
  primaryEntity: Entity
  entityConsistencyScore: number       // 0–100
  entityCoverageScore: number          // 0–100
  disambiguationScore: number          // 0–100
  entityConfidenceScore: number        // 0–100 composite
  inconsistencies: EntityIssue[]
  missingAttributes: string[]
  recommendations: string[]
}
```

---

## 15. AI Perception Graph

**Implemented in:** `/packages/analyzers/src/perception-graph/`

Models the AI system's internal semantic representation of the website — cognitive structure, not link structure.

```typescript
type PerceptionNode = {
  id: string
  type: 'entity' | 'topic' | 'claim' | 'page'
  label: string
  confidence: number
  citationReadiness: number
  disambiguationStrength: number
  supportingPages: string[]
}

type PerceptionEdge = {
  source: string
  target: string
  relationshipType: 'isA' | 'partOf' | 'relatedTo' | 'contradicts' |
                    'supports' | 'authorOf' | 'locatedIn' | 'offers'
  strength: number
  evidencedBy: string[]
}
```

**Graph analysis outputs:** Topical authority clusters, trust pathways, citation pathways, contextual gaps, contradiction detection, recommendation likelihood.

---

## 16. Citation Probability Engine

**Implemented in:** `/packages/analyzers/src/citation/`

Models the likelihood that an AI system selects this content as a citation source. Not a proxy for backlinks — measures AI-native authority signals.

| Factor | Weight |
|---|---|
| Factual density | 20% |
| Claim specificity | 15% |
| Primary entity authority | 15% |
| Topical authority depth | 15% |
| Structural citation readiness | 15% |
| Temporal freshness | 10% |
| Trust signal density | 10% |

---

## 17. Retrieval Readiness Standards

**Implemented in:** `/packages/analyzers/src/ai/readability.ts` + `machine-readability/`

Retrieval readiness = machine readability + chunk quality + query-answer alignment.

**Four checklist layers:** Crawl layer, Extraction layer, Chunk layer, Query-answer alignment layer.

**Retrieval Readiness Score:** 0–100 composite.

---

## 18. Semantic Trust Layer

**Implemented in:** `/packages/analyzers/src/semantic-trust/`

Models whether an AI system assigns this content sufficient credibility to use in a generated response.

**Four trust signal categories:** Authorship trust, Organisational trust, Content trust, Structural trust.

**Semantic Trust Score:** 0–100 composite. Contradiction detection via Claude API on top 20 pages by PageRank only.

---

## 19. AI Visibility Scoring (v2 scores — preserved)

**Infrastructure Scores:**

| Score | File |
|---|---|
| SEO Health | `/packages/analyzers/src/seo/scoring.ts` |
| Schema Completeness | `/packages/analyzers/src/schema/engine.ts` |
| Internal Link Strength | `/packages/analyzers/src/graph/engine.ts` |
| Technical Performance | `/packages/analyzers/src/performance/engine.ts` |

**AI Visibility Scores (v2):**

| Score | File |
|---|---|
| AI Visibility Score | `/packages/analyzers/src/ai/visibility.ts` |
| Machine Readability Score | `/packages/analyzers/src/machine-readability/` |
| Entity Confidence Score | `/packages/analyzers/src/entity/` |
| Retrieval Readiness Score | `/packages/analyzers/src/ai/readability.ts` |
| Citation Probability Score | `/packages/analyzers/src/citation/` |
| Semantic Trust Score | `/packages/analyzers/src/semantic-trust/` |
| Recommendation Confidence Score | `/packages/analyzers/src/ai/visibility.ts` |

**AI Visibility Score Composition (v2 formula — preserved):**
```
AI Visibility Score =
  Machine Readability Score    × 0.15
  + Entity Confidence Score    × 0.20
  + Retrieval Readiness Score  × 0.20
  + Citation Probability Score × 0.20
  + Semantic Trust Score       × 0.15
  + Schema Completeness Score  × 0.10
```

**Score Thresholds (use consistently across all UI and reports):**

| Range | Label | Colour | Tailwind |
|---|---|---|---|
| 90–100 | Excellent | `#22C55E` | `text-green-500` |
| 70–89 | Good | `#0BCEBC` | `text-teal-400` |
| 50–69 | Needs Work | `#F59E0B` | `text-amber-400` |
| 0–49 | Critical | `#EF4444` | `text-red-500` |

**Issue Severity:**

| Severity | Tailwind | Deduction |
|---|---|---|
| Critical | `bg-red-100 text-red-700` | −8 to −15 pts |
| Warning | `bg-amber-100 text-amber-700` | −2 to −5 pts |
| Info | `bg-blue-100 text-blue-700` | −0.5 to −1 pt |

**Score Explainability is mandatory:** Every deduction maps to a named `Issue` with `description` and `recommendation`. No black boxes.

---

## 20. Competitive AI Visibility Analysis

**Implemented in:** `/packages/analyzers/src/competitive/`

Compares audited domain against up to 5 competitor domains (max 50 pages each). Entity coverage gaps, citation pathway comparison, topical authority gap map, recommendation likelihood ranking. Pro/Agency tier only.

---

## 21. Multi-Provider AI Behavior Modeling

**Implemented in:** `/packages/analyzers/src/ai/provider-models/`

Provider weights in `/config/provider-weights.json` — not hardcoded. New providers via registry only. All provider scores labelled as estimates. Models reviewed quarterly.

---

## PART IV — MACHINE TRUST LAYER

*(Phase 3 — new systems. Operate at Layer 4 of the intelligence stack.)*

---

## 22. Retrieval Simulation Engine

**Implemented in:** `/packages/analyzers/src/retrieval-simulation/`

The Retrieval Simulation Engine models the complete chain of decisions an AI retrieval system makes when processing content from this site — from raw chunk selection through answer formation to citation eligibility filtering. It does not describe how AI systems work. It produces testable, reproducible approximations of retrieval behaviour based on measurable content signals.

### What It Simulates

AI retrieval is not a binary pass/fail. It is a probabilistic ranking process under query pressure. Content that retrieves well for one query may be suppressed for another. SiteNexis models this as a multi-stage simulation:

```
Stage 1: Chunk Extraction Simulation
  → Model which chunks would be selected for a given query type
  → Measure chunk boundary quality (does the semantic unit hold at extraction?)
  → Identify chunks likely to be split mid-thought by fixed-size tokenizers

Stage 2: Retrieval Ranking Pressure Simulation
  → Model competitive retrieval position under pressure from high-authority sources
  → Estimate embedding cosine similarity range for target query types
  → Identify chunks that would be consistently outranked

Stage 3: Summarisation Degradation Analysis
  → Model meaning loss when retrieved chunks are compressed into an AI-generated answer
  → Detect facts that are likely to be dropped, distorted, or hallucinated under compression
  → Identify claims that require multi-chunk context to be accurate (fragile under truncation)

Stage 4: Context Truncation Modeling
  → Model which content falls beyond the retrieval context window for long pages
  → Identify critical facts positioned in truncation zones

Stage 5: Answer Formation Probability
  → Estimate probability that a chunk becomes part of an AI-generated answer
  → Combine: retrieval rank × chunk stability × summarisation loss factor

Stage 6: Citation Eligibility Filtering
  → Model which retrieved chunks pass the AI system's citation eligibility filter
  → Factors: specificity, authority signal density, factual verifiability
```

### Implementation Rules

- All simulation is **deterministic and reproducible** — same content produces the same simulation result
- Simulation parameters are defined in `/config/retrieval-simulation-model.json` — not hardcoded
- No actual AI retrieval calls are made — all simulation is algorithmic, based on measurable content signals
- Simulation runs on a **sample of pages** (top 30 by PageRank) to control compute cost
- Chunk stability index requires at least 3 chunking passes with different boundary strategies to measure variance

### Output Types

```typescript
type RetrievalSimulationResult = {
  pageUrl: string
  retrievalQualityScore: number          // 0–100
  chunkStabilityIndex: number            // 0–1 (1 = perfectly stable across chunking strategies)
  answerFormationProbability: number     // 0–1 per query type modeled
  summarisationLossScore: number         // 0–100 (100 = total meaning preservation)
  citationEligibilityScore: number       // 0–100
  retrievalFailureReasons: RetrievalFailure[]
  truncationZoneWarnings: string[]       // facts at risk from context window limits
  fragileClaimsCount: number             // claims that distort under compression
}

type RetrievalFailure = {
  stage: 'chunk_extraction' | 'ranking_pressure' | 'summarisation' | 'truncation' | 'citation_filter'
  description: string
  severity: 'critical' | 'warning' | 'info'
  affectedChunks: string[]
  recommendation: string
}
```

### Retrieval Quality Score Formula

```
Retrieval Quality Score =
  Chunk Stability Index           × 25
  + Answer Formation Probability  × 25  (averaged across modeled query types)
  + Summarisation Loss Score      × 25
  + Citation Eligibility Score    × 25
```

All four components must be individually explainable. No composite score without a sub-score breakdown.

---

## 23. Machine Trust Layer

**Implemented in:** `/packages/analyzers/src/machine-trust/`

The Machine Trust Layer models the trust state of a website from the perspective of an AI system — not the score assigned by a human reviewer, but the confidence an AI model would have in using this content as a reliable source across multiple interactions over time.

Trust in AI systems is not a single signal. It is a composite formed from cross-source validation, entity consistency, internal coherence, and the absence of contradictory claims. It degrades when signals conflict. It strengthens when signals reinforce each other across independent sources.

### Trust Signal Architecture

**1. Entity Credibility Consistency**
Measures whether the primary entity and its attributes are described consistently:
- Across all pages on this domain
- Across schema markup, body text, and metadata (all three must agree)
- Against externally verifiable facts (where sameAs links exist)
- Consistency score per entity attribute: name, founding date, description, location, category

**2. Schema Trust Alignment**
Measures whether schema markup accurately describes and does not embellish page content:
- Schema claims must be verifiable from body text — no schema-only claims
- Schema type must match page content category
- Nested schema relationships must be internally coherent (e.g., `author.worksFor` must match `Organisation` on site)
- Detect over-claiming: schema attributes not evidenced in body text

**3. External Validation Signals**
Measures the depth and quality of external signals that validate entity claims:
- `sameAs` links present and resolving to expected entities
- External sources (Wikipedia, Wikidata, Companies House, LinkedIn) confirm key attributes
- No external source contradicts any claim made on this domain
- `sameAs` chain depth: direct link (high trust) vs. inferred link (lower trust)

**4. Contradiction Detection**
Programmatic cross-page contradiction analysis:
- Same entity described with conflicting attributes across pages
- Schema `datePublished` vs. visible content date conflicts
- Factual claims in body text that contradict schema data
- Claude API used for semantic contradiction detection on top 20 pages by PageRank only (cost control)

**5. Trust Degradation Signals**
Signals that indicate trust has been formed and then damaged:
- Pages that previously had schema now lack it (detected by comparing audit history)
- Entity attributes that changed between audits without explanation
- External validation sources that previously resolved but now 404
- Sudden entity attribute changes (name, description, category) with no contextual update

### Machine Trust Score Formula

```
Machine Trust Score =
  Entity Credibility Consistency   × 0.30
  + Schema Trust Alignment         × 0.20
  + External Validation Depth      × 0.25
  + Contradiction Absence Score    × 0.15
  + Trust Degradation Resistance   × 0.10
```

### Output Types

```typescript
type MachineTrustScore = {
  overall: number                        // 0–100
  entityCredibilityScore: number         // 0–100
  schemaTrustAlignmentScore: number      // 0–100
  externalValidationScore: number        // 0–100
  contradictionAbsenceScore: number      // 0–100
  trustDegradationResistance: number     // 0–100
  trustIssues: TrustIssue[]
  degradationSignals: TrustDegradationSignal[]
  crossSourceValidationIndex: number     // 0–1 ratio of claims externally validated
}

type TrustDegradationSignal = {
  signalType: 'schema_removal' | 'attribute_change' | 'external_source_loss' | 'contradiction_introduced'
  entity: string
  previousValue: string
  currentValue: string
  detectedAt: Date
  severityImpact: number                 // points removed from trust score
}
```

---

## 24. Temporal Authority Model

**Implemented in:** `/packages/analyzers/src/temporal-authority/`

The Temporal Authority Model introduces time as an active variable in AI visibility analysis. AI systems weight recency, update consistency, and content freshness as trust signals. A site with high authority that stops updating is not stable — it is decaying. A site that updates inconsistently creates semantic drift that degrades AI confidence.

### What Temporal Authority Models

**1. Authority Velocity**
The rate at which a site's AI-visible authority is growing or declining:
- Change in Entity Confidence Score across consecutive audits
- Change in Citation Probability Score across consecutive audits
- Change in external validation signal count across audits
- Velocity is positive (growing), negative (declining), or flat (stable)

**2. Semantic Drift Detection**
Content that changes meaning over time degrades AI confidence:
- Compare body text embeddings across audit snapshots to detect meaning shift
- Flag pages where the topic cluster has shifted without a canonical redirect
- Detect cases where entity attributes have drifted (the page now describes a different version of the entity)
- Semantic drift index: 0 (no drift) to 1 (complete topical pivot)

**3. Trust Decay Modeling**
Trust decays when content ages without update signals:
- Apply a configurable decay curve to each page's trust contribution (parameters in `/config/trust-decay-model.json`)
- Pages without `dateModified` schema receive an accelerated decay rate
- Pages with schema-confirmed update dates receive a decay slowdown
- Trust decay is not a penalty — it is a model of how AI systems naturally down-weight stale content

**4. Update Frequency Impact**
Regular updates signal active maintenance, which correlates with higher AI trust:
- Measure update frequency from `dateModified` schema, HTTP last-modified headers, and sitemap change frequency
- Classify: Actively maintained (weekly+), Periodically maintained (monthly), Stale (3m+), Abandoned (6m+)
- Update frequency contributes positively to Temporal Authority Score

**5. Content Freshness Impact Factor**
A per-page freshness signal that weights recency-sensitive claims:
- Claims containing dates, statistics, or version numbers are tagged as time-sensitive
- Time-sensitive claims on stale pages receive a freshness penalty
- Freshness impact is content-type aware (product pages decay faster than evergreen guides)

### Authority Velocity Score Formula

```
Authority Velocity Score =
  ΔEntity Confidence     × 0.30  (change from previous audit, normalised to 0–100)
  + ΔCitation Probability × 0.30
  + ΔExternal Validation  × 0.20
  + Update Frequency Score × 0.20
```

Score interpretation:
- 70–100: Positive velocity — authority growing
- 40–69: Stable — authority holding
- 0–39: Negative velocity — authority declining

### Output Types

```typescript
type TemporalAuthorityResult = {
  authorityVelocityScore: number         // 0–100
  trustStabilityIndex: number            // 0–1 (1 = no decay detected)
  contentFreshnessImpactFactor: number   // 0–1 (1 = fully fresh)
  semanticDriftIndex: number             // 0–1 (0 = no drift)
  updateFrequencyClassification: 'active' | 'periodic' | 'stale' | 'abandoned'
  stalePagesAtRisk: string[]             // URLs where decay is most severe
  driftedPages: SemanticDriftRecord[]
  temporalIssues: TemporalIssue[]
}

type SemanticDriftRecord = {
  pageUrl: string
  driftScore: number                     // 0–1
  previousTopicCluster: string
  currentTopicCluster: string
  detectedAt: Date
}
```

**Implementation constraint:** Temporal analysis requires at least 2 audit snapshots for velocity and drift calculations. On first audit: return baseline values with `velocity: null, status: 'baseline_established'`. Subsequent audits compute delta.

---

## 25. Recommendation Surface Mapping

**Implemented in:** `/packages/analyzers/src/recommendation-surface/`

Recommendation Surface Mapping extends AI visibility analysis beyond retrieval probability into surface presence — where content actually appears across the AI ecosystem, and which surfaces represent unaddressed gaps in the site's recommendation footprint.

AI recommendations do not occur in one place. They occur across multiple surfaces with distinct structural requirements, query patterns, and content consumption behaviours. A site that performs well in chat-based retrieval may be entirely absent from voice assistant responses and AI Overviews. Each surface requires different structural signals.

### Recommendation Surfaces Modeled

**Surface 1: AI Overviews (Search-integrated AI)**
- Trigger conditions: Query must match a topic with sufficient structured signal
- Content requirements: Featured snippet eligibility, FAQ schema, concise factual structure
- Trust requirements: High E-E-A-T signals, schema completeness, no noindex on key pages
- Inclusion probability modeled from: Retrieval Quality Score + Schema Completeness + Citation Probability

**Surface 2: Chat-Based Recommendation (LLM assistants)**
- Trigger conditions: Query intent matches entity or topic cluster on site
- Content requirements: Direct answers to conversational queries, entity clarity, FAQ content
- Trust requirements: Entity Confidence Score, Semantic Trust Score, no contradictions
- Inclusion probability modeled from: AI Extractability + Entity Confidence + Semantic Trust

**Surface 3: Voice Assistant Retrieval**
- Trigger conditions: Short, direct factual query matching a schema-defined claim
- Content requirements: Structured data (especially `speakable` schema), sub-30-word answers, direct factual statements
- Trust requirements: Local business or organisation schema completeness, NAP consistency
- Inclusion probability modeled from: Schema Completeness + `speakable` presence + answer directness score

**Surface 4: Autonomous Agent Discovery**
- Trigger conditions: Agent programmatically queries for entity information or service capabilities
- Content requirements: Machine-readable structured data, API-accessible endpoints or `robots.txt` agent allowances, OpenAPI or `/.well-known/` discovery endpoints
- Trust requirements: Schema completeness + entity disambiguation + external validation
- Inclusion probability modeled from: Entity Confidence + Schema Completeness + External Validation

### Recommendation Surface Score Formula

```
Recommendation Surface Score =
  AI Overviews Inclusion Probability    × 0.30
  + Chat Recommendation Probability    × 0.30
  + Voice Retrieval Probability        × 0.20
  + Agent Discovery Probability        × 0.20
```

### Output Types

```typescript
type RecommendationSurfaceMap = {
  overallSurfaceScore: number              // 0–100
  surfaces: {
    aiOverviews: SurfaceScore
    chatRecommendation: SurfaceScore
    voiceRetrieval: SurfaceScore
    agentDiscovery: SurfaceScore
  }
  coverageGaps: CoverageGap[]
  missingVisibilityChannels: string[]
}

type SurfaceScore = {
  inclusionProbability: number            // 0–100
  status: 'visible' | 'partial' | 'absent'
  blockers: SurfaceBlocker[]
  recommendations: string[]
}

type CoverageGap = {
  surface: string
  missedOpportunity: string
  requiredSignals: string[]
  estimatedImpact: 'high' | 'medium' | 'low'
}
```

**Implementation constraint:** Surface modeling is probabilistic estimation based on measurable content signals — not live API queries to AI systems. Label all surface scores as estimates in the UI.

---

## 26. Synthetic Entity Detection Layer

**Implemented in:** `/packages/analyzers/src/synthetic-entity/`

The Synthetic Entity Detection Layer identifies patterns that indicate entity signals, authority networks, or citation structures may be fabricated rather than organic. This system protects the integrity of the trust ecosystem that SiteNexis models — and provides users with an authenticity confidence rating for their own domains, enabling them to identify and correct inadvertently synthetic-looking signals.

This system is **defensive intelligence**, not adversarial classification. It detects patterns without making definitive accusations.

### What It Detects

**1. Fake Entity Patterns**
Entities that exhibit structural signatures of synthetic creation:
- Entity with no verifiable external presence despite claimed authority
- Entity attributes that appear word-for-word identical across multiple unrelated domains
- Author entities with no external attribution history
- Organisation entities with no business registration signals (for jurisdictions with public registries)
- Biographical information that contradicts verifiable public records

**2. AI-Generated Authority Networks**
Network-level patterns that suggest coordinated synthetic authority construction:
- Unusual clustering of `sameAs` links pointing to recently created external profiles
- Multiple entities sharing the same creation date, description length, or attribute pattern
- Citation networks where sources cite each other with no external validation
- Entity relationship graphs with abnormally high reciprocal link density

**3. Schema Manipulation Patterns**
Schema markup that misrepresents content or exploits structured data:
- Schema claiming aggregate review ratings with no detectable review content on page
- `datePublished` significantly earlier than content metadata suggests
- `author` schema for entities not mentioned in body text
- Schema types mismatched with page content category
- `speakable` schema on pages that contain no concise, retrievable answers

**4. Citation Farming Behaviour**
Patterns consistent with manufacturing citation eligibility:
- Pages that cite only other pages on the same domain for "factual" claims
- Factual claims presented without attribution that cannot be externally verified
- Sudden high-density factual claim insertion (content that gains 50+ specific facts across a single audit cycle)

**5. Unnatural Entity Clustering**
Anomalous entity graph structures that indicate manufactured topology:
- Entity clusters with density far above expected for domain type and size
- All entities on a domain connected through a single hub entity
- Entities with implausibly broad topic coverage relative to their claimed identity

### Synthetic Entity Risk Score Formula

```
Synthetic Entity Risk Score =
  Fake Entity Pattern Score          × 0.25
  + AI Authority Network Score       × 0.25
  + Schema Manipulation Score        × 0.20
  + Citation Farming Score           × 0.15
  + Unnatural Clustering Score       × 0.15
```

Score interpretation (inverted — higher is riskier):
- 0–20: Low risk — no significant synthetic patterns detected
- 21–50: Medium risk — some patterns require investigation
- 51–80: High risk — multiple synthetic patterns present
- 81–100: Critical — strong synthetic authority indicators

**Entity Authenticity Confidence** (inverse of risk, reported to user):
```
Entity Authenticity Confidence = 100 - Synthetic Entity Risk Score
```

### Output Types

```typescript
type SyntheticEntityAnalysis = {
  syntheticRiskScore: number              // 0–100 (higher = more risk)
  entityAuthenticityConfidence: number    // 0–100 (higher = more authentic)
  networkIntegrityScore: number          // 0–100 (higher = more organic)
  detectedPatterns: SyntheticPattern[]
  flaggedEntities: FlaggedEntity[]
  recommendations: string[]
}

type SyntheticPattern = {
  patternType: 'fake_entity' | 'authority_network' | 'schema_manipulation' |
               'citation_farming' | 'unnatural_clustering'
  confidence: number                      // 0–1 detection confidence
  evidence: string[]                      // specific signals that triggered detection
  affectedEntities: string[]
  severity: 'critical' | 'warning' | 'info'
}
```

### Implementation Rules
- Detection is pattern-based and probabilistic — never present as definitive fraud detection
- All findings labelled with detection confidence (0–1) — not binary flags
- Synthetic detection results are shown only to the domain owner (the authenticated user auditing their own domain)
- Never expose synthetic analysis results in competitive analysis view
- Rules are defined in `/config/synthetic-detection-rules.json` — updateable without code deploy

---

## PART V — MACHINE TRUST SCORING SYSTEM

---

## 27. Complete Scoring Architecture (v3)

SiteNexis produces twelve scores across four infrastructure tiers. Every score is 0–100. Every score is fully explainable — every deduction maps to a named, actionable Issue.

### Tier 1 — Infrastructure Scores

| Score | Module |
|---|---|
| SEO Health Score | `/packages/analyzers/src/seo/scoring.ts` |
| Schema Completeness Score | `/packages/analyzers/src/schema/engine.ts` |
| Internal Link Strength Score | `/packages/analyzers/src/graph/engine.ts` |
| Technical Performance Score | `/packages/analyzers/src/performance/engine.ts` |

### Tier 2 — AI Visibility Scores (v2)

| Score | Module |
|---|---|
| AI Visibility Score | `/packages/analyzers/src/ai/visibility.ts` |
| Machine Readability Score | `/packages/analyzers/src/machine-readability/` |
| Entity Confidence Score | `/packages/analyzers/src/entity/` |
| Retrieval Readiness Score | `/packages/analyzers/src/ai/readability.ts` |
| Citation Probability Score | `/packages/analyzers/src/citation/` |
| Semantic Trust Score | `/packages/analyzers/src/semantic-trust/` |
| Recommendation Confidence Score | `/packages/analyzers/src/ai/visibility.ts` |

### Tier 3 — Machine Trust Scores (v3)

| Score | Module | Formula Location |
|---|---|---|
| Retrieval Quality Score | `/packages/analyzers/src/retrieval-simulation/scorer.ts` | Section 22 |
| Machine Trust Score | `/packages/analyzers/src/machine-trust/engine.ts` | Section 23 |
| Authority Velocity Score | `/packages/analyzers/src/temporal-authority/engine.ts` | Section 24 |
| Trust Stability Index | `/packages/analyzers/src/temporal-authority/engine.ts` | Section 24 |
| Recommendation Surface Score | `/packages/analyzers/src/recommendation-surface/engine.ts` | Section 25 |
| Entity Authenticity Confidence | `/packages/analyzers/src/synthetic-entity/scorer.ts` | Section 26 |

### Tier 4 — Composite Intelligence Score (v3)

The **Machine Trust Intelligence Score** is the top-level composite for v3:

```
Machine Trust Intelligence Score =
  Retrieval Quality Score          × 0.20
  + Machine Trust Score            × 0.25
  + Authority Velocity Score       × 0.15
  + Recommendation Surface Score   × 0.20
  + Entity Authenticity Confidence × 0.20
```

This score answers the single most important question in the platform: *"How deeply does an AI ecosystem trust, retrieve, and recommend this website?"*

### Universal Explainability Requirements

All twelve scores must satisfy these requirements:

1. **Traceability:** Every point deduction maps to a named `Issue` record with `type`, `severity`, `description`, `recommendation`
2. **Reproducibility:** Same content produces the same score — no stochastic elements without explicit documentation
3. **Decomposability:** Every composite score exposes its sub-score breakdown in the `scoreBreakdown` JSON field
4. **Delta attribution:** Score changes between audit runs map to specific changed issues
5. **No black boxes:** If a scoring method cannot be explained in one sentence, it is not yet ready to ship

---

## PART VI — AUTONOMOUS AGENT ARCHITECTURE

---

## 28. Agent Execution Architecture

SiteNexis uses a 16-agent architecture. All agents are stateless, communicate only via BullMQ message bus, and are registered in `/packages/agents/src/registry.ts`.

### Agent Communication Protocol

```typescript
type AgentMessage = {
  auditId: string
  agentId: string
  event: 'started' | 'progress' | 'completed' | 'failed'
  payload?: Record<string, unknown>
  errorMessage?: string
  retryCount?: number
  timestamp: Date
}
```

### Execution Phases (Infrastructure Agent manages sequencing)

```
Phase 1 (sequential):
  Crawl Agent

Phase 2 (parallel):
  SEO Agent, Schema Agent

Phase 3 (parallel):
  Retrieval Agent, Entity Agent, Performance Agent

Phase 4 (parallel):
  Citation Agent, Semantic Trust Agent

Phase 5 (parallel — Layer 4, depend on Phase 4 output):
  Retrieval Simulation Agent
  Machine Trust Agent
  Temporal Authority Agent
  Recommendation Mapping Agent
  Synthetic Entity Agent

Phase 6 (parallel):
  Visualization Agent

Phase 7 (sequential):
  Reporting Agent
```

---

## 29. Agent Definitions — v2 Agents (Preserved)

### Crawl Agent
**File:** `/packages/agents/src/crawl-agent.ts`
**Owns:** Full-site crawling, rendering, HTML parsing, text extraction, chunk generation, entity pre-extraction
**Input:** `{ auditId, domain, options: CrawlOptions }`
**Output:** `CrawledPage[]` written to DB
**Constraints:** Max 500 pages. Respects robots.txt. Max 5 concurrent renders. 15s timeout per page.
**Must NOT:** Score, analyse, or interpret content.

### Technical SEO Agent
**File:** `/packages/agents/src/seo-agent.ts`
**Owns:** SEO signal analysis — title/meta/canonical/robots, sitemap, broken links
**Input:** `CrawledPage[]`
**Output:** `SEOScore`, `SEOIssue[]`
**Constraints:** Fully programmatic. No AI API calls.
**Must NOT:** Evaluate content quality or AI readability.

### AI Retrieval Agent
**File:** `/packages/agents/src/retrieval-agent.ts`
**Owns:** Machine readability, chunk quality, AI extractability (Claude API), retrieval readiness
**Input:** `CrawledPage[]` with chunks
**Output:** `MachineReadabilityScore`, `AIExtractabilityScore`, `RetrievalReadinessScore`
**Constraints:** Max 5 concurrent Claude API calls. 2000 token cap per page. Cache by content hash (7-day Redis TTL).
**Must NOT:** Detect entities or assess citation probability.

### Entity Intelligence Agent
**File:** `/packages/agents/src/entity-agent.ts`
**Owns:** Entity detection, consistency, coverage, disambiguation, AI Perception Graph
**Input:** `CrawledPage[]` + schema data
**Output:** `EntityIntelligenceReport`, `PerceptionGraphSnapshot`
**Constraints:** Claude API for entity extraction. Deduplicate by normalised name.
**Must NOT:** Score citation probability or semantic trust.

### Citation Intelligence Agent
**File:** `/packages/agents/src/citation-agent.ts`
**Owns:** Citation probability per page and site-wide
**Input:** `CrawledPage[]`, `EntityIntelligenceReport`, `SchemaAnalysis`
**Output:** `CitationAnalysis`
**Constraints:** Weighted formula — no AI API call. Weights in `/config/citation-weights.json`.
**Must NOT:** Evaluate semantic trust.

### Semantic Trust Agent
**File:** `/packages/agents/src/semantic-trust-agent.ts`
**Owns:** Authorship, organisational, content, and structural trust signal analysis
**Input:** `CrawledPage[]`, `SchemaAnalysis`, `EntityIntelligenceReport`
**Output:** `SemanticTrustScore`, `TrustIssue[]`
**Constraints:** Claude API for contradiction detection on top 20 pages by PageRank only.
**Must NOT:** Assess retrieval readiness or citation probability.

### Schema Intelligence Agent
**File:** `/packages/agents/src/schema-agent.ts`
**Owns:** Schema detection, validation, missing field identification, snippet auto-generation
**Input:** `CrawledPage[]`
**Output:** `SchemaAnalysis[]`, generated snippets
**Constraints:** Validation fully programmatic. AI API for complex auto-generation only.
**Must NOT:** Analyse entity relationships or citation signals.

### Reporting Agent
**File:** `/packages/agents/src/reporting-agent.ts`
**Owns:** PDF generation, S3 upload, Report record creation
**Input:** Completed `AuditReport` from DB
**Output:** `Report` record with S3 URL
**Constraints:** Triggered after all agents complete. 60s generation timeout.
**Must NOT:** Perform analysis. Render and store only.

### Visualization Agent
**File:** `/packages/agents/src/visualization-agent.ts`
**Owns:** Pre-computing graph layout data for Perception Graph and Link Graph
**Input:** `PerceptionGraphSnapshot`, `InternalLinkGraph`
**Output:** D3-compatible layout JSON in Redis (TTL: 24h)
**Constraints:** Heavy computation in worker process. Cache aggressively.
**Must NOT:** Modify graph data — layout coordinates only.

### Performance Agent
**File:** `/packages/agents/src/performance-agent.ts`
**Owns:** Lighthouse integration, Core Web Vitals, mobile performance
**Input:** Top 5 pages by PageRank
**Output:** `PerformanceResult[]`
**Constraints:** 60s timeout per page. Fail gracefully (`score: null`). Never all pages.
**Must NOT:** Affect crawl or scoring pipeline. Runs last in Phase 3.

### Infrastructure Agent
**File:** `/packages/agents/src/infrastructure-agent.ts`
**Owns:** Audit job orchestration, agent sequencing, error recovery, status management
**Input:** BullMQ job events from all agents
**Output:** `AuditStatus` updates in DB, retry scheduling
**Constraints:** Only agent that writes `audit.status`. 10-minute overall timeout. Partial results preserved on failure.
**Must NOT:** Perform analysis. Orchestration only.

---

## 30. Agent Definitions — v3 Agents (Phase 3)

### Retrieval Simulation Agent
**File:** `/packages/agents/src/retrieval-simulation-agent.ts`
**Owns:** End-to-end retrieval simulation across 6 stages (chunk extraction → citation eligibility)
**Input:** `CrawledPage[]` with chunks, `EntityIntelligenceReport`, `AIVisibilityScore`
**Output:** `RetrievalSimulationResult[]` (per page sample) written to `retrieval_simulations` table
**Constraints:**
- Runs on top 30 pages by PageRank only (compute cost control)
- Simulation is deterministic — same content always produces same result
- Chunk stability requires 3 independent chunking passes (boundary variance measurement)
- All simulation parameters in `/config/retrieval-simulation-model.json`
- If simulation errors on a page: log, skip, continue — do not fail entire agent
**Failure handling:** On partial failure, mark individual pages as `simulated: false` with reason. Agent completes as long as ≥1 page succeeds.
**Must NOT:** Make live queries to AI retrieval systems. All simulation is algorithmic.
**Communication:** Emits `agent:progress` events per page batch (5 pages per batch). Emits `agent:completed` when all pages processed.

### Machine Trust Agent
**File:** `/packages/agents/src/machine-trust-agent.ts`
**Owns:** Full trust signal analysis — entity credibility, schema alignment, external validation, contradiction detection, degradation signals
**Input:** `CrawledPage[]`, `EntityIntelligenceReport`, `SchemaAnalysis[]`, previous `AuditReport` (for degradation delta)
**Output:** `MachineTrustScore` written to `machine_trust_scores` table
**Constraints:**
- External validation signal analysis uses HEAD requests to sameAs URLs (10s timeout, 5 concurrent max)
- Claude API for semantic contradiction detection: top 20 pages by PageRank only
- Trust degradation analysis requires previous audit — skip degradation sub-score on first audit
- Schema trust alignment is fully programmatic (no AI API)
- Contradiction detection results cached in Redis for 48h (same content hash = same result)
**Failure handling:** If Claude API fails on contradiction detection: log warning, set `contradictionAbsenceScore: null`, continue with remaining sub-scores. Never block on a single sub-score.
**Must NOT:** Evaluate retrieval quality or temporal patterns (separate agents).
**Communication:** Emits `agent:progress` after each sub-score calculation.

### Temporal Authority Agent
**File:** `/packages/agents/src/temporal-authority-agent.ts`
**Owns:** Authority velocity tracking, semantic drift detection, trust decay modeling, update frequency analysis, freshness impact scoring
**Input:** `CrawledPage[]`, current `EntityIntelligenceReport`, `CitationAnalysis`, previous audit's `TemporalAuthorityResult` (if exists)
**Output:** `TemporalAuthorityResult` written to `temporal_authority_records` table
**Constraints:**
- Authority velocity calculation requires minimum 2 audit snapshots — returns `{ status: 'baseline_established', velocity: null }` on first audit
- Semantic drift detection uses embedding cosine similarity between current and previous audit body text snapshots — embeddings stored in `page_chunks.embedding` column
- Trust decay model parameters loaded from `/config/trust-decay-model.json` at agent startup
- Semantic drift analysis limited to top 50 pages by PageRank (compute cost)
- Content freshness impact factor is content-type aware: load type classification from page schema or URL pattern
**Failure handling:** If embedding comparison fails (no previous snapshot): skip drift analysis, continue with freshness and velocity. If decay model config missing: use default linear decay curve, log warning.
**Must NOT:** Analyse entity authenticity or recommendation surfaces.
**Communication:** Emits `agent:progress` with `{ stage: 'velocity' | 'drift' | 'decay' | 'freshness' }` events.

### Recommendation Mapping Agent
**File:** `/packages/agents/src/recommendation-mapping-agent.ts`
**Owns:** Surface coverage analysis across 4 AI recommendation surfaces: AI Overviews, chat recommendation, voice retrieval, autonomous agent discovery
**Input:** `CrawledPage[]`, `SchemaAnalysis[]`, `RetrievalQualityScore`, `EntityConfidenceScore`, `SemanticTrustScore`, `CitationProbabilityScore`
**Output:** `RecommendationSurfaceMap` written to `recommendation_surface_maps` table
**Constraints:**
- All surface probabilities are modeled estimates — never presented as measured data
- Surface modeling parameters in `/config/surface-coverage-model.json`
- Voice retrieval modeling checks for `speakable` schema presence (fully programmatic)
- Agent discovery modeling checks for `/.well-known/` paths, `robots.txt` agent directives, OpenAPI endpoint availability (HEAD requests, 5s timeout)
- All UI labels must read: "Estimated [surface] inclusion probability"
**Failure handling:** If an external probe (HEAD request for agent discovery) fails: mark surface as `probeStatus: 'unreachable'`, use conservative estimate (0.2 base probability). Log but do not fail agent.
**Must NOT:** Make live queries to actual AI recommendation systems. Probabilistic modeling only.
**Communication:** Emits `agent:progress` per surface analyzed.

### Synthetic Entity Detection Agent
**File:** `/packages/agents/src/synthetic-entity-agent.ts`
**Owns:** Detection of fake entity patterns, AI authority networks, schema manipulation, citation farming, unnatural clustering
**Input:** `CrawledPage[]`, `EntityIntelligenceReport`, `SchemaAnalysis[]`, `PerceptionGraphSnapshot`
**Output:** `SyntheticEntityAnalysis` written to `synthetic_entity_flags` table
**Constraints:**
- Detection rules loaded from `/config/synthetic-detection-rules.json` — not hardcoded
- All findings labelled with detection confidence (0–1) — never binary "is fake" classification
- Results shown only to the audited domain's owner — never in competitive analysis
- External presence checks (resolving entity profile URLs): 10s timeout, 3 concurrent max
- Claude API may be used for semantic pattern detection in claimed author bios (top 10 pages only, optional — graceful skip if API unavailable)
- Never store or transmit: specific conclusions implying legal liability (fraud, defamation)
**Failure handling:** If rule evaluation throws for any pattern type: log, skip that pattern, continue. Partial results are acceptable. Never block on a single detection rule.
**Must NOT:** Make definitive authenticity claims. Pattern detection with confidence scores only.
**Communication:** Emits `agent:progress` per pattern category evaluated.

---

## PART VII — OPERATIONAL STANDARDS

---

## 31. Recommendation Intelligence Layer

**Implemented in:** `/packages/analyzers/src/ai/visibility.ts`

Recommendation Confidence models the probability that an AI system — generating a response on a relevant topic — recommends or references this site unprompted.

**What drives recommendation:** Topical authority depth, entity authority, recency, factual precision, structural citation signals, competitive uniqueness.

**Common recommendation blockers:** Generic content with no retrieval differentiation, entity inconsistency, missing primary entity definition, thin topical coverage, absent schema.

---

## 32. Conversational Retrieval Modeling

**Implemented in:** `/packages/analyzers/src/ai/readability.ts`

Models how a page performs for natural language queries across six query types:

| Query Type | Example | Optimisation Target |
|---|---|---|
| Definitional | "What is [entity]?" | Entity definition, About page, Organisation schema |
| Comparative | "Is [A] better than [B]?" | Structured comparison, feature tables |
| Procedural | "How do I [task]?" | HowTo schema, numbered steps |
| Evaluative | "Is [product] good?" | Review schema, testimonials, case studies |
| Factual | "When was [entity] founded?" | Organisation schema, factual bylines |
| Navigational | "Find [service] in [location]" | LocalBusiness schema, geo data |

---

## 33. Anti-Manipulation Principles

This is an architectural commitment, not a policy statement.

**SiteNexis will never enable:**
- AI spam engineering — volume content without substantive value
- Synthetic authority manipulation — fabricated entity signals or manufactured `sameAs` links
- Retrieval poisoning — corrupting AI retrieval results to displace legitimate sources
- Deceptive schema abuse — schema misrepresenting page content
- Exploitative prompt injection — hidden text designed to alter AI processing behaviour
- Fake recommendation engineering — circular citation networks or manufactured trust signals

**SiteNexis always delivers:**
- Semantic integrity — genuine content clarity for accurate AI understanding
- Trustworthy structure — schema that accurately describes page content
- Contextual clarity — direct, complete answers to real user queries
- Machine interpretability — removing technical barriers to legitimate content access
- Retrieval accessibility — ensuring content that deserves discovery can be discovered

Any implementation approach that serves manipulation over quality is rejected regardless of commercial pressure.

---

## 34. Plan Limits

```typescript
const PLAN_LIMITS = {
  free: {
    auditsPerMonth: 1,    apiAccess: false, bulkDomains: false,
    whiteLabel: false,    competitiveAnalysis: false, layer4Analysis: false
  },
  starter: {
    auditsPerMonth: 50,   apiAccess: false, bulkDomains: false,
    whiteLabel: false,    competitiveAnalysis: false, layer4Analysis: false
  },
  pro: {
    auditsPerMonth: -1,   apiAccess: false, bulkDomains: false,
    whiteLabel: false,    competitiveAnalysis: true,  layer4Analysis: true
  },
  agency: {
    auditsPerMonth: -1,   apiAccess: true,  bulkDomains: true,
    whiteLabel: false,    competitiveAnalysis: true,  layer4Analysis: true
  },
  enterprise: {
    auditsPerMonth: -1,   apiAccess: true,  bulkDomains: true,
    whiteLabel: true,     competitiveAnalysis: true,  layer4Analysis: true
  },
}
// layer4Analysis gates: Retrieval Simulation, Machine Trust, Temporal Authority,
//                       Recommendation Surface Mapping, Synthetic Entity Detection
```

Check via `checkAuditLimit(userId)` in `/apps/web/lib/plans.ts` before every job enqueue. Return 402 with descriptive message.

---

## 35. Brand & Design Tokens

```css
--navy:      #0A1628;   /* Primary bg, headings */
--cyan:      #00C8FF;   /* Primary accent, CTAs */
--teal:      #0BCEBC;   /* Secondary accent, success */
--amber:     #F59E0B;   /* Warnings */
--red:       #EF4444;   /* Critical issues, errors */
--light-bg:  #EBF8FF;   /* Card backgrounds, callouts */
--text-dark: #1A2C42;   /* Body text */
--text-mid:  #4A6280;   /* Secondary text, labels */
```

**Typography:** Display: `Georgia` · UI: `Calibri`/`system-ui` · Code: `JetBrains Mono`

Do not use: Inter, Roboto, Arial, purple gradients, generic SaaS patterns.

---

## 36. Common Tasks — Quick Reference

### Add a new v3 score check
1. Identify owning analyzer module (Sections 22–26)
2. Add check function to the correct module file
3. Add `Issue` type variant to `/packages/shared/types.ts`
4. Wire into the score formula in the module's `scorer.ts`
5. Add explainability entry to score breakdown serialiser
6. Write unit test with at least 3 test cases (pass, fail, edge case)

### Add a new agent (v3 pattern)
1. Create `/packages/agents/src/[name]-agent.ts` implementing `Agent` interface
2. Define input types from `@sitenexis/shared` — no local type definitions
3. All DB reads via `@sitenexis/db` query helpers only
4. Emit `agent:progress` events at logical checkpoints
5. Implement graceful partial failure: never fail entirely if sub-tasks can continue
6. Register in `/packages/agents/src/registry.ts`
7. Add execution phase in Infrastructure Agent sequencing
8. Write unit tests with mocked BullMQ bus and mocked DB queries

### Add a new API route
1. Create `/apps/web/app/api/[path]/route.ts`
2. `const user = await requireAuth(req)` → 401 if unauthenticated
3. Validate with Zod
4. DB queries from `@sitenexis/db` only
5. Return typed response + correct HTTP status
6. Update API Routes table (Section 11)

### Add a new AI prompt
1. Write template in `/packages/analyzers/src/ai/prompts.ts`
2. End with: `"Return ONLY valid JSON. No explanation. No markdown."`
3. Include example output in system prompt
4. Parse with `parseAIResponse<T>()` — never raw `JSON.parse`
5. Add Redis cache key for content-hash caching

### Add a new provider model
1. Add entry to `/config/provider-weights.json`
2. Register in `/packages/analyzers/src/ai/provider-models/registry.ts`
3. Add column to `ai_visibility_scores` table
4. Label as estimate in all UI surfaces

### Add a new detection rule (Synthetic Entity)
1. Add rule definition to `/config/synthetic-detection-rules.json`
2. Implement rule evaluator in `/packages/analyzers/src/synthetic-entity/patterns.ts`
3. Wire into `engine.ts` aggregation
4. Write test with synthetic fixture data (known-good vs. known-suspicious patterns)
5. Document confidence calibration rationale in rule definition

---

## 37. What NOT To Do

```
✗ Use `any` type                               → use `unknown`, narrow with type guards
✗ Use `console.log` in production              → use logger from @/lib/logger
✗ Call Anthropic API outside /ai/             → all AI calls in /packages/analyzers/src/ai/
✗ Write raw Prisma in API routes               → use /packages/db/queries/ helpers
✗ Use process.env directly                     → import from @/lib/env
✗ Invent new brand colours                     → use tokens from Section 35
✗ Run crawler in API route                     → always enqueue BullMQ job
✗ Block Next.js server with heavy compute      → offload to worker process
✗ Set audit.status: complete in API            → only Infrastructure Agent does this
✗ Hard-delete records                          → soft delete with archivedAt
✗ Expose Stripe/Anthropic keys to client       → server-side only, behind API routes
✗ Commit .env files                            → .env is in .gitignore
✗ Raw JSON.parse on Claude response            → use parseAIResponse<T>() helper
✗ Agents calling other agents directly         → BullMQ bus only
✗ Hardcode provider weights                    → /config/provider-weights.json
✗ Claim certainty about AI system internals    → label all estimates as estimates
✗ Enable manipulation over semantic quality    → see Anti-Manipulation Principles (Section 33)
✗ Run Lighthouse on all pages                  → top 5 by PageRank only
✗ Skip explainability on any score             → every deduction maps to a named Issue
✗ Mix competitive data with primary audit      → stored in separate DB records
✗ Run Layer 4 agents on free/starter plans     → gate via PLAN_LIMITS.layer4Analysis
✗ Run retrieval simulation on all pages        → top 30 by PageRank only
✗ Fail entire agent on sub-task error          → log, skip sub-task, continue
✗ Present synthetic detection as definitive    → always show confidence (0–1) not binary flags
✗ Show synthetic analysis in competitive view  → domain owner only
✗ Hardcode detection rules                     → /config/synthetic-detection-rules.json
✗ Present surface scores as measured data      → all surface scores are probabilistic estimates
✗ Skip temporal baseline on first audit        → return baseline record, velocity: null
```

---

## 38. Third-Party Services

| Service | Purpose | Docs |
|---|---|---|
| Supabase | Auth + PostgreSQL DB | https://supabase.com/docs |
| Prisma | ORM | https://prisma.io/docs |
| BullMQ | Job queues + agent bus | https://docs.bullmq.io |
| Anthropic Claude | AI scoring (primary) | https://docs.anthropic.com |
| OpenAI | AI scoring (fallback) | https://platform.openai.com/docs |
| Stripe | Billing + subscriptions | https://stripe.com/docs |
| Cloudflare R2 | PDF report storage | https://developers.cloudflare.com/r2 |
| Upstash Redis | Cache + BullMQ backend | https://docs.upstash.com/redis |
| Sentry | Error tracking | https://docs.sentry.io/platforms/javascript/guides/nextjs |
| Resend | Transactional email | https://resend.com/docs |
| react-force-graph | Graph visualization (canvas) | https://github.com/vasturiano/react-force-graph |
| TanStack Query | Client data fetching | https://tanstack.com/query/latest |
| TanStack Table | Data tables | https://tanstack.com/table/latest |
| Playwright | E2E testing | https://playwright.dev/docs/intro |
| Vitest | Unit testing | https://vitest.dev/guide |

---

## 39. Git Workflow

```
feat/[feature-name]      # new features
fix/[bug-description]    # bug fixes
chore/[task]             # maintenance, deps, config
docs/[what]              # documentation only
agent/[agent-name]       # new or modified agent
score/[score-name]       # new or modified scoring logic
trust/[trust-system]     # machine trust layer changes (v3)
sim/[simulation-name]    # retrieval simulation changes (v3)
```

**Commits (Conventional Commits):**
```
feat: add retrieval simulation engine
fix: handle missing baseline in temporal authority agent
agent: implement synthetic entity detection agent
score: calibrate machine trust score weights
trust: add schema manipulation detection pattern
sim: implement chunk stability index measurement
docs: update CLAUDE.md with v3 agent definitions
```

PRs must pass: `typecheck` + `lint` + `pnpm test`. Main branch protected.

---

## 40. Project Health Checklist

```
[ ] All analyzer modules have unit tests (>80% coverage)
[ ] All agents have unit tests with mocked BullMQ bus
[ ] All v3 agents implement graceful partial failure
[ ] All API routes have Zod input validation
[ ] All API routes return correct HTTP status codes
[ ] All pages have loading and error states
[ ] All scores have full explainability entries in breakdown serialiser
[ ] All v3 scores have formula documentation in CLAUDE.md
[ ] All analyzer modules handle empty CrawledPage[] gracefully
[ ] Claude API calls have content-hash caching + failure fallbacks
[ ] Plan limits enforced on audit-triggering routes (incl. layer4Analysis gate)
[ ] Competitive analysis gated behind Pro/Agency plan check
[ ] Synthetic detection results gated to domain owner only
[ ] All surface scores labelled as estimates in UI
[ ] All synthetic detection findings labelled with confidence score
[ ] Temporal authority agent returns baseline record on first audit
[ ] Retrieval simulation limited to top 30 pages by PageRank
[ ] Anti-manipulation checks in place for schema auto-generation
[ ] Provider behavior model scores labelled as estimates in UI
[ ] No console.log statements in production code
[ ] No hardcoded detection rules, provider weights, or decay parameters
[ ] CLAUDE.md up to date with all new modules, agents, and routes
[ ] .env.example includes all variables used in env.ts
[ ] pnpm typecheck passes with 0 errors
[ ] pnpm lint passes with 0 errors
[ ] E2E tests pass against staging environment
```

---

## 41. Key Decisions & Rationale

| Decision | Rationale |
|---|---|
| Four-layer intelligence stack | Enforces architectural dependency order; Layer 4 systems cannot produce meaningful output without Layers 2+3 |
| Retrieval simulation as algorithmic (not live) | Live AI retrieval queries are not reproducible, not auditable, and expose privacy risks; algorithmic simulation is deterministic |
| Machine Trust as a separate score tier | Trust is not visibility; a highly visible but low-trust site is a different problem than a low-visibility, high-trust one |
| Temporal authority requires multiple audits | Velocity and drift are inherently comparative — a single snapshot is a baseline, not a trend |
| Synthetic detection with confidence, not binary | Binary "is fake" flags create liability; confidence scores enable useful insight without definitive claims |
| Recommendation surface as probabilistic | Live queries to AI systems are not feasible at scale; probabilistic estimation from content signals is implementable |
| Layer 4 gated to Pro+ plans | Layer 4 analysis is computationally expensive (16 agents, Claude API calls, external probes); requires revenue to sustain |
| Config-driven rules for trust decay and detection | Trust models and detection rules evolve; config updates allow iteration without code deploys or re-tests |
| Partial failure design for all v3 agents | Layer 4 analysis takes 3–8 minutes; a single sub-task failure should not void 7 minutes of work |
| Synthetic detection shown to domain owner only | Competitive exposure of authenticity concerns creates unfair harm without full context |
| pnpm workspaces + Turbo | Monorepo keeps types shared across all packages without publishing |
| BullMQ over simple async | 16 agents, 500 pages, Layer 4 analysis — total audit time 3–8 minutes; must be background jobs |
| Anti-manipulation as architecture | Manipulation produces brittle, short-lived visibility; semantic quality produces durable machine trust |
| Explainability as a hard requirement | Trust in the platform requires transparency in every score; no deduction without a named, actionable reason |

---

*Version 3.0 — AI Retrieval + Machine Trust Intelligence System*
*Last updated: May 2025*
*Maintainer: update this file whenever architecture, agents, scoring logic, config, or API routes change.*
*This document is the source of truth. If code and CLAUDE.md conflict, CLAUDE.md defines intent — fix the code.*
