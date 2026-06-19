# The Nexis Intelligence Suite

> AI Retrieval + Machine Trust Intelligence · AI Creative Intelligence

**SiteNexis:** [sitenexis.vercel.app](https://sitenexis.vercel.app) &nbsp;|&nbsp; **AdNexis:** [adnexis-eight.vercel.app](https://adnexis-eight.vercel.app) &nbsp;|&nbsp; **X:** [@Sitenexis](https://twitter.com/Sitenexis) &nbsp;|&nbsp; **Email:** [sitenexisintel@gmail.com](mailto:sitenexisintel@gmail.com)

A two-product intelligence suite built for the machine-first web. SiteNexis tells AI systems how to find and trust your brand. AdNexis tells you what creative converts once they do. Together they close the full loop.

---

## Products

### SiteNexis — Machine Trust Intelligence Platform

Not an SEO tool. Not an audit dashboard. A live intelligence system that models how AI systems retrieve, interpret, trust, and recommend web content.

### AdNexis — AI Creative Intelligence Platform

Analyses ad creatives, scores them across conversion dimensions using AI, and generates high-performance variants. Built for teams that want to know not just who sees their content — but what makes them act.

**Five modules:** Vault · Analyze · Generate · Dashboard · Hooks (automation)

### SiteNexis Dashboard Pages

| Page | Path | Description |
|---|---|---|
| Overview | `/dashboard` | Score summary + audit stream |
| SEO | `/audit/[domain]/seo` | Title, meta, canonical, sitemap |
| AI Visibility | `/audit/[domain]/ai-visibility` | AI Visibility composite score |
| Entity Intelligence | `/audit/[domain]/entity` | Entity extraction + confidence |
| Citation | `/audit/[domain]/citation` | Citation probability breakdown |
| Schema | `/audit/[domain]/schema` | Schema completeness + generated snippets |
| Links | `/audit/[domain]/links` | Internal link graph + PageRank |
| Content | `/audit/[domain]/content` | Content quality signals |
| Performance | `/audit/[domain]/performance` | Core Web Vitals |
| Retrieval | `/audit/[domain]/retrieval` | Retrieval simulation (Layer 4, Pro+) |
| Machine Trust | `/audit/[domain]/machine-trust` | Trust score breakdown (Layer 4, Pro+) |
| Temporal | `/audit/[domain]/temporal` | Authority velocity + drift (Layer 4, Pro+) |
| Surfaces | `/audit/[domain]/surfaces` | Recommendation surface map (Layer 4, Pro+) |
| Authenticity | `/audit/[domain]/authenticity` | Synthetic entity detection (Layer 4, Pro+) |
| Information Gain | `/dashboard/information-gain` | SERP cohort comparison via Serper API |
| Portfolio | `/dashboard/portfolio` | All audited domains — score grid with trend badges |
| Query Simulation | `/dashboard/query-test` | Algorithmic TF-IDF retrieval test against any completed audit |

---

## What SiteNexis Is

SiteNexis answers questions no existing tool addresses:

- *Can an AI system retrieve this page under query pressure — and where does meaning degrade?*
- *How is machine trust formed, maintained, and lost across an AI ecosystem over time?*
- *Across which AI recommendation surfaces is this content invisible — and why?*

This is observability for machines — a 16-agent intelligence pipeline that models the complete chain of decisions an AI system makes when encountering a website: raw HTML ingestion → chunk extraction → entity resolution → semantic trust formation → retrieval ranking → summarisation degradation → citation eligibility filtering → recommendation surface inclusion.

---

## Four-Layer Intelligence Stack

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

---

## Audit Execution Modes

SiteNexis runs audits in two modes, selected automatically:

### Full Pipeline Mode (BullMQ + Worker)
Requires Redis (Upstash) and a running BullMQ worker process (Railway). Runs the complete 16-agent pipeline with Puppeteer crawling, all analyzer modules, PDF report generation, and Layer 4 Machine Trust analysis. Supports up to 500 pages per audit. Requires Pro+ plan for Layer 4.

### Serverless Mode (Vercel-native, no Redis required)
When Redis is unavailable, audits automatically fall back to serverless execution using Next.js `after()`. Uses `fetch()` + HTML parsing to crawl up to 20 pages. AI scoring is powered by a multi-model architecture routed through OpenRouter (Hermes 3, DeepSeek V4 Flash, Kimi K2.6, Gemma 4, Qwen3-Next, Llama 3.3) with Groq `llama-3.3-70b-versatile` as the fast fallback. Saves full results to Supabase. No BullMQ worker or Redis required. Available on all plans.

**In both modes:** audits produce real scores from real data. The only case that returns a 503 is if the Supabase database itself is unreachable.

---

## Multi-Model AI Architecture

SiteNexis uses a task-routed multi-model architecture via OpenRouter with Groq as the fast fallback. Each task type is assigned to the model best suited for it:

| Task Type | Primary Model | Fallback |
|---|---|---|
| Structured scoring, entity extraction | Hermes 3 405B | Qwen3-Next → DeepSeek |
| Full-site analysis, contradiction detection | DeepSeek V4 Flash (1M context) | Qwen3-Next |
| Code generation, schema generation | Kimi K2.6 | Hermes 3 |
| Visual page/ad analysis | Gemma 4 31B | — |
| RAG simulation, high throughput | Qwen3-Next | — |
| Multilingual analysis | Llama 3.3 70B | — |
| v4 Narrative Report | DeepSeek V4 Flash | Groq llama-3.3-70b |

Model routing is handled by `packages/analyzers/src/ai/model-router.ts`. The caller never needs to know which model ran — the interface is identical. If no OpenRouter model is configured, all tasks fall through to Groq.

---

## v4 Decision Intelligence Layer

The v4 layer sits above the scoring system and transforms scores into competitive market intelligence:

### Decision Orchestrator
Transforms a ranked issue list into an optimally sequenced action roadmap using the **Sequencing Value Score (SVS)**:
```
SVS = (ImpactTotal × UnlockMultiplier × CriticalPathBonus) / EffortHours
```
Dependency-constrained greedy topological sort. O(n log n). Guaranteed termination.

### Competitive Reality Simulation Engine
Models AI citation selection as a competitive allocation process (softmax distribution). Score improvements only translate to outcomes when they represent relative improvement within the competitive set.

### v4 Narrative Report
A full 12-section AI-generated audit narrative produced by the `hybridAuditReportPrompt` and served via `GET /api/audit/[id]/narrative-report`. Covers: executive header, 6 overall scores with bands, score breakdown, technical SEO audit, semantic structure, entity & trust, retrieval simulation, AI visibility explanation, critical issues, fix recommendations, strategy layer, and final verdict.

### v4 Data Model (8 new Prisma models)
`V4IntelligenceScore`, `CompetitivePosition`, `QueryCluster`, `TrajectoryScenario`, `DisplacementRecord`, `UncertaintyDecomposition`, `ScoreDelta`, `CompetitiveSetMember` — supporting competitive intelligence, temporal deltas, velocity tracking, and uncertainty decomposition.

---

## Credit Economy

SiteNexis uses a credit-based billing model instead of monthly audit limits.

| Action | Credit Cost |
|---|---|
| AI Visibility Audit (Layers 1–3) | 2 credits |
| AI Swarm Audit (Layer 4, Pro+) | 5 credits |
| Competitor Analysis | 2 credits |
| Fix Generation | 1 credit |
| AI Search Simulation | 3 credits |
| Video Report | 10 credits |

New accounts receive **10 free starter credits**. Additional credits are purchased in packs (Starter 20cr, Growth 60cr, Pro 150cr, Agency 500cr). Credit balance and transaction history are accessible in the dashboard billing page.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15.3.9 App Router (React 19, Server Components) |
| UI | Tailwind CSS, Framer Motion, TanStack Query, TanStack Table |
| Backend | Next.js API routes + BullMQ workers |
| Database | PostgreSQL via Supabase (Prisma ORM v5) |
| Auth | Supabase Auth (email/password + Google/GitHub OAuth) |
| AI Engine | OpenRouter multi-model (primary) + Groq (fallback) |
| Models | Hermes 3 405B, DeepSeek V4 Flash, Kimi K2.6, Gemma 4 31B, Qwen3-Next, Llama 3.3 70B |
| Job Queue | BullMQ + Upstash Redis (optional, falls back to serverless) |
| Storage | Cloudflare R2 (PDF reports) |
| Billing | Stripe Checkout + Customer Portal |
| Email | Resend |
| Monorepo | pnpm workspaces + Turbo |
| Deploy | Vercel (web app) + Railway (BullMQ worker, optional) |

---

## Monorepo Structure

```
sitenexis/
├── apps/
│   ├── web/                         # SiteNexis — Next.js 15 App Router
│   └── adnexis/                     # AdNexis — Next.js 15 App Router
│       └── src/
│           ├── app/
│           │   ├── (auth)/           # Login, signup
│           │   ├── (dashboard)/      # Vault, Analyze, Generate, Dashboard
│           │   └── api/              # Ads, generate, auth, health, hooks
│           └── lib/
│               └── supabase/         # SSR Supabase client + server helpers
├── apps/
│   └── web/                         # Next.js 15 App Router
│       └── src/
│           ├── app/
│           │   ├── (auth)/           # Login, signup, reset-password
│           │   ├── (marketing)/      # Landing, pricing, blog, content-map, tools
│           │   ├── dashboard/        # 15+ authenticated dashboard pages
│           │   ├── audit/[domain]/   # 12-tab audit results
│           │   └── api/              # All API route handlers
│           └── lib/
│               ├── credits-config.ts # Client-safe credit constants
│               ├── credits.ts        # Server-only credit deduction logic
│               └── serverless-audit.ts  # Fallback audit runner (no Redis/worker)
├── packages/
│   ├── crawler/                      # Puppeteer/Cheerio crawl + BullMQ worker + watchdog
│   │   └── src/
│   │       ├── queue.ts              # Redis client factory, BullMQ queue, validation
│   │       ├── worker.ts             # BullMQ worker process (Railway)
│   │       └── watchdog.ts          # Worker process manager with heartbeat monitor
│   ├── analyzers/                    # All scoring + analysis modules (30+)
│   │   └── src/
│   │       ├── ai/                   # Multi-model router, prompts, client
│   │       │   ├── client.ts         # callAI (Groq fallback)
│   │       │   ├── model-router.ts   # OpenRouter task-based routing
│   │       │   ├── openrouter.ts     # OpenRouter client + model registry
│   │       │   └── prompts.ts        # All prompt templates inc. v4 narrative
│   │       ├── seo/                  # SEO analyzer + scoring
│   │       ├── machine-readability/  # 7-stage extraction pipeline
│   │       ├── entity/               # Entity intelligence engine
│   │       ├── citation/             # Citation probability engine
│   │       ├── semantic-trust/       # Semantic trust layer
│   │       ├── perception-graph/     # AI Perception Graph
│   │       ├── schema/               # Schema detection + generation
│   │       ├── graph/                # Internal link graph + PageRank
│   │       ├── content/              # Content quality engine
│   │       ├── performance/          # Lighthouse integration
│   │       ├── retrieval-simulation/ # 6-stage retrieval simulation
│   │       ├── machine-trust/        # Machine trust layer
│   │       ├── temporal-authority/   # Temporal authority model
│   │       ├── recommendation-surface/ # 4-surface recommendation mapping
│   │       ├── synthetic-entity/     # Synthetic entity detection
│   │       ├── information-gain/     # SERP cohort information gain
│   │       ├── intent/               # Scout intent engine
│   │       ├── fix-plan/             # Global Fix Plan (P0/P1/P2)
│   │       ├── health-score/         # Self-audit health score
│   │       ├── sii/                  # SiteNexis Intelligence Index
│   │       ├── visual-analysis/      # Gemma 4 multimodal page analysis
│   │       ├── multilingual/         # Llama 3.3 language detection
│   │       ├── topical-authority/    # Topical authority scoring
│   │       ├── semantic-density/     # Semantic density scoring
│   │       ├── ai-crawlability/      # AI crawlability scoring
│   │       ├── geo/                  # Geo scoring
│   │       ├── sns/                  # SiteNexis Scoring Engine
│   │       ├── discovery/            # AI Discovery Intelligence
│   │       ├── authority-stability/  # Authority stability analysis
│   │       ├── core-update-simulation/ # Core update scenario modeling
│   │       ├── self-audit/           # Self-audit benchmark layer
│   │       ├── verification/         # Source-grounded verification
│   │       ├── fixes/                # AI-generated fix code
│   │       └── competitive/          # Competitive AI visibility
│   ├── agents/                       # 16-agent orchestration layer
│   ├── db/                           # Prisma schema + Supabase client + query helpers
│   │   └── src/queries/
│   │       ├── audits.ts             # Audit CRUD
│   │       ├── issues.ts             # Issue storage + fixes
│   │       ├── scores.ts             # Score persistence
│   │       ├── v3.ts                 # Layer 4 data (retrieval sim, trust, temporal, surfaces)
│   │       ├── v4.ts                 # v4 intelligence scores, competitive position, deltas
│   │       ├── ige.ts                # Information gain
│   │       ├── scout.ts              # Scout intent data
│   │       └── ...                   # credits, users, teams, graph, ads, etc.
│   └── shared/                       # TypeScript types shared across all packages
├── config/
│   ├── provider-weights.json
│   ├── citation-weights.json
│   ├── trust-decay-model.json
│   ├── surface-coverage-model.json
│   ├── synthetic-detection-rules.json
│   └── retrieval-simulation-model.json
├── adnexis.vercel.json               # AdNexis Vercel deployment config
├── sitenexis.vercel.json             # SiteNexis Vercel deployment config
├── railway.json                      # Railway worker deployment config
├── CLAUDE.md                         # Full architectural specification (v4.0)
└── README.md                         # This file
```

---

## 16-Agent Pipeline

```
Phase 1:  Crawl Agent
Phase 2:  SEO Agent, Schema Intelligence Agent                      (parallel)
Phase 3:  AI Retrieval Agent, Entity Intelligence Agent,
          Performance Agent                                          (parallel)
Phase 4:  Citation Intelligence Agent, Semantic Trust Agent         (parallel)
Phase 5:  Retrieval Simulation Agent, Machine Trust Agent,
          Temporal Authority Agent, Recommendation Mapping Agent,
          Synthetic Entity Detection Agent          (parallel, Layer 4, Pro+ only)
Phase 6:  Visualization Agent
Phase 7:  Reporting Agent
```

---

## Scoring System (12 Dimensions)

### Tier 1 — Infrastructure
| Score | Range |
|---|---|
| SEO Health Score | 0–100 |
| Schema Completeness Score | 0–100 |
| Internal Link Strength Score | 0–100 |
| Technical Performance Score | 0–100 |

### Tier 2 — AI Visibility
| Score | Range |
|---|---|
| AI Visibility Score (composite) | 0–100 |
| Machine Readability Score | 0–100 |
| Entity Confidence Score | 0–100 |
| Retrieval Readiness Score | 0–100 |
| Citation Probability Score | 0–100 |
| Semantic Trust Score | 0–100 |
| Recommendation Confidence Score | 0–100 |

### Tier 3 — Machine Trust (Layer 4, Pro+ plans)
| Score | Range |
|---|---|
| Retrieval Quality Score | 0–100 |
| Machine Trust Score | 0–100 |
| Authority Velocity Score | 0–100 |
| Recommendation Surface Score | 0–100 |
| Entity Authenticity Confidence | 0–100 |

### Tier 4 — v4 Decision Intelligence
| Score | Range |
|---|---|
| AI Visibility Index | 0–100 |
| Citation Probability Score | 0–100 |
| Semantic Clarity Score | 0–100 |
| Entity Authority Score | 0–100 |
| Trust Credibility Score | 0–100 |
| Content Depth Score | 0–100 |
| Competitive Differentiation Score | 0–100 |
| Retrieval Surface Optimization | 0–100 |
| Market Position Strength | 0–100 |
| Composite Intelligence Score | 0–100 |

**Score thresholds (consistent across all UI surfaces):**
- 90–100: Excellent (green)
- 70–89: Good (teal)
- 50–69: Needs Work (amber)
- 0–49: Critical (red)

---

## API Routes

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/audit/start` | Required | Validate domain, check limits, enqueue job |
| GET | `/api/audit/[id]` | Required | Fetch full audit result |
| GET | `/api/audit/[id]/stream` | Required | SSE real-time progress |
| GET | `/api/audit/[id]/ai-visibility` | Required | AI Visibility sub-report |
| GET | `/api/audit/[id]/entities` | Required | Entity intelligence report |
| GET | `/api/audit/[id]/citation` | Required | Citation probability report |
| GET | `/api/audit/[id]/perception-graph` | Required | AI Perception Graph data |
| GET | `/api/audit/[id]/retrieval` | Required | Retrieval Simulation results |
| GET | `/api/audit/[id]/machine-trust` | Required | Machine Trust score + signals |
| GET | `/api/audit/[id]/temporal` | Required | Temporal Authority analysis |
| GET | `/api/audit/[id]/surfaces` | Required | Recommendation Surface Map |
| GET | `/api/audit/[id]/authenticity` | Required | Synthetic Entity Detection |
| GET | `/api/audit/[id]/narrative-report` | Required | v4 Hybrid Audit Narrative Report |
| GET | `/api/audit/[id]/fix-plan` | Required | Global Fix Plan (P0/P1/P2) |
| GET | `/api/audit/[id]/fix-plan/roadmap` | Required | Decision Orchestrator roadmap |
| GET | `/api/audit/[id]/sii` | Required | SiteNexis Intelligence Index |
| GET | `/api/audit/[id]/information-gain` | Required | Information Gain Engine results |
| POST | `/api/audit/[id]/query-simulate` | Required | Query retrieval simulation |
| POST | `/api/audit/[id]/export` | Required | Export audit data |
| DELETE | `/api/audit/[id]` | Required | Soft-delete audit |
| POST | `/api/audit/[id]/report` | Required | Trigger PDF generation |
| GET | `/api/audits` | Required | Paginated audit history |
| POST | `/api/quick-audit` | None | Single-page scan |
| GET | `/api/usage` | Required | Usage stats + plan limits |
| POST | `/api/billing/checkout` | Required | Stripe Checkout Session |
| POST | `/api/billing/portal` | Required | Stripe Customer Portal |
| POST | `/api/webhooks/stripe` | Sig verify | Billing events |
| GET | `/api/health` | None | Service health check |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase project (required — DB + Auth)
- Groq API key (required for AI scoring)
- OpenRouter API key (optional — enables multi-model routing)
- Upstash Redis (optional — audits fall back to serverless mode without it)
- Stripe account (optional — required only for billing)

### Local Setup

```bash
# 1. Install all dependencies
pnpm install

# 2. Copy environment template
cp .env.example apps/web/.env.local

# 3. Fill in required variables (see Environment Variables section below)
#    Minimum required: DATABASE_URL, SUPABASE_*, GROQ_API_KEY

# 4. Push Prisma schema to Supabase
pnpm db:push

# 5. Generate Prisma client
pnpm db:generate

# 6. Start the full dev stack
pnpm dev

# OR: web app only (no worker)
pnpm --filter web dev
```

### Key Commands

```bash
# Development
pnpm dev              # Start Next.js + worker via Turbo
pnpm --filter web dev # Web app only

# Build
pnpm build            # Build all packages + Next.js

# Quality checks
pnpm typecheck        # TypeScript check across all packages
pnpm lint             # ESLint across all packages
pnpm test             # Vitest unit tests

# Database
pnpm db:push          # Push Prisma schema to Supabase (no migration file)
pnpm db:migrate       # Generate + run migration
pnpm db:studio        # Open Prisma Studio at localhost:5555
pnpm db:generate      # Regenerate Prisma client after schema changes
pnpm db:seed          # Seed test data

# Worker (BullMQ)
pnpm --filter @sitenexis/crawler dev:worker    # Start worker (tsx, hot-reload)
pnpm --filter @sitenexis/crawler dev:watchdog  # Start watchdog (manages worker)
```

---

## Environment Variables

### Vercel (Web App) — Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase pooled URL — port **6543**, append `?pgbouncer=true` |
| `DIRECT_URL` | Supabase direct URL — port **5432**, for migrations only |
| `SUPABASE_URL` | Your Supabase project URL (`https://<ref>.supabase.co`) |
| `SUPABASE_ANON_KEY` | Public anon key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Full-access key — **server-side only, never expose** |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as `SUPABASE_URL` — required by client components |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as `SUPABASE_ANON_KEY` — required by client |
| `NEXT_PUBLIC_APP_URL` | Your deployment URL (e.g. `https://sitenexis.com`) |
| `GROQ_API_KEY` | Groq API key for AI scoring (`gsk_...`) |

### Vercel (Web App) — Optional

| Variable | Description |
|---|---|
| `OPENROUTER_API_KEY` | OpenRouter API key — enables multi-model routing (Hermes, DeepSeek, Kimi, etc.) |
| `REDIS_URL` | Upstash Redis URL (`rediss://...`). Without this, audits run in serverless mode. |
| `STRIPE_SECRET_KEY` | Stripe secret key for billing (`sk_live_...` or `sk_test_...`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_live_...` or `pk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `SERPER_API_KEY` | Serper API key — required for Information Gain Engine SERP data |
| `S3_BUCKET_NAME` | Cloudflare R2 bucket name for PDF reports |
| `S3_ACCESS_KEY_ID` | R2 / S3 access key |
| `S3_SECRET_ACCESS_KEY` | R2 / S3 secret key |
| `S3_ENDPOINT` | R2 endpoint: `https://<id>.r2.cloudflarestorage.com` |

### Railway (BullMQ Worker) — Required

| Variable | Description |
|---|---|
| `REDIS_URL` | **Must be exactly `REDIS_URL`.** Upstash `rediss://default:<token>@<host>.upstash.io:6379` |
| `DATABASE_URL` | Same Supabase pooled URL as Vercel |
| `DIRECT_URL` | Same Supabase direct URL as Vercel |
| `GROQ_API_KEY` | Same Groq key as Vercel |

> **Critical:** The variable name on Railway must be `REDIS_URL` exactly — not `Sitenexis`, not `REDIS`, not `redis_url`. The worker calls `process.env['REDIS_URL']` and exits immediately if the variable is missing or points to localhost.

---

## Deployment

### Vercel — SiteNexis

1. Connect GitHub repo (`kellyxy110/Sitenexis`) to Vercel — project `sitenexis`
2. Root directory: monorepo root (not `apps/web`)
3. Framework: **Next.js** (auto-detected)
4. Add all environment variables
5. Auto-deploys on every push to `master`

Project build settings (set via API or dashboard):
- **Build command:** `pnpm --filter @sitenexis/db exec prisma generate --schema=./schema.prisma && turbo run build --filter=web...`
- **Output directory:** `apps/web/.next`
- **Install command:** `pnpm install --no-frozen-lockfile`

### Vercel — AdNexis

Deploy manually from the monorepo root (CLI must be authenticated as kellyxy110).

### Railway (BullMQ Worker)

The worker handles full pipeline audits. It is a long-lived process — not a serverless function.

**Railway `railway.json` is already configured:**
```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm install --no-frozen-lockfile && pnpm turbo run build --filter=@sitenexis/agents..."
  },
  "deploy": {
    "startCommand": "pnpm --filter @sitenexis/crawler start:watchdog",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Health Check

Visit `/api/health` for a full system diagnostic:

```bash
vercel curl https://sitenexis-kellyxys-projects.vercel.app/api/health
```

---

## Architecture Rules

- **No `any` types** — use `unknown` + type guards
- **No `process.env` directly** — always import from `@/lib/env`
- **No raw Prisma in routes** — use `@sitenexis/db` query helpers
- **No scoring logic in agents** — agents orchestrate; `@sitenexis/analyzers` scores
- **No hardcoded weights** — all model parameters in `/config/`
- **Soft deletes only** — `archivedAt: DateTime?`, never hard-delete
- **Score explainability is mandatory** — every deduction maps to a named `Issue`
- **Retrieval simulation top 30 pages only** — compute cost control
- **Layer 4 gated to Pro+ plans** — `PLAN_LIMITS.layer4Analysis`
- **503 only on DB failure** — Redis unavailability triggers serverless fallback
- **Credits validated atomically** — `$transaction` prevents race conditions
- **Stripe keys server-side only** — never expose `STRIPE_SECRET_KEY` to client bundle
- **Probability intervals, not point estimates** — v4 uses InfluenceRange (lower/central/upper)
- **Uncertainty always decomposed** — named sources with reducible/irreducible classification

---

## Plan Limits

| Plan | Credits/month | Layer 4 | Competitive | API | Bulk |
|---|---|---|---|---|---|
| Free | 10 starter credits | — | — | — | — |
| Starter | 50/mo | — | — | — | — |
| Pro | Unlimited | ✓ | ✓ | — | — |
| Agency | Unlimited | ✓ | ✓ | ✓ | ✓ |
| Enterprise | Unlimited | ✓ | ✓ | ✓ | ✓ |

---

## Public API (v1)

Agency and Enterprise plan users can access SiteNexis programmatically via the Public API.

**Authentication:** `Authorization: Bearer <api_key>` header. API keys are created in the dashboard → Settings → API Keys and stored as SHA-256 hashes in the `api_keys` table.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/audits` | List your audits (paginated, `?page=1&limit=20`) |
| `POST` | `/api/v1/audits` | Start a new audit (`{ "domain": "example.com" }`) |
| `GET` | `/api/v1/audits/:id` | Fetch a completed audit result |
| `GET` | `/api/v1/audits/:id/scores` | Fetch score breakdown only |

Rate limit: 30 requests/min. All endpoints return JSON. HTTP status codes follow REST conventions (200, 201, 400, 401, 402, 403, 404, 429, 500).

---

## Security

### HTTP Security Headers
Both apps include production-hardened security headers on every response: `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`.

### Rate Limiting
All sensitive routes are protected by a Redis-backed sliding-window rate limiter with an in-process `Map` fallback when Redis is unavailable.

### IDOR Protection
Every API route that accepts an audit ID verifies `audit.userId === authenticatedUser.id` before returning data. A mismatched ownership check returns 403.

### SSRF Protection
The `/api/orchestrate` and `/api/audit/start` routes block all private IP ranges before passing URLs to the crawler.

### XSS Prevention
All user-controlled data embedded in server-generated HTML is passed through `escHtml()` before insertion.

### Timing-Safe Secret Comparison
Webhook secret verification uses `crypto.timingSafeEqual` on SHA-256 digests.

---

## Content & Tools

### Blog (`/blog`)
64 posts across 7 categories: AI Visibility, Machine Trust, Entity SEO, Technical SEO, Strategy, AI Agents.

### Knowledge Graph (`/content-map`)
Semantic content map with full JSON-LD structured data.

### Citation Checklist (`/tools/citation-checklist`)
Interactive 7-factor Citation Probability checklist.

### AI Instructions (`/ai-instructions`)
Structured entity definition page for AI systems.

### Methodology (`/methodology`)
Full transparent methodology covering all 4 layers, Graph Truth Discipline, Graceful Truth Layer, composite score formulas, and explainability requirements.

---

## What Has Been Built (Cumulative)

### Phase 1 — Foundation (v1)
- Monorepo scaffold (pnpm workspaces + Turbo)
- All 5 packages: `crawler`, `analyzers`, `agents`, `db`, `shared`
- Prisma schema + Supabase integration
- Next.js App Router with auth (email/password + Google/GitHub OAuth)
- BullMQ worker pipeline with Puppeteer crawling
- Core SEO analyzer + scoring
- Schema detection + validation + auto-generation
- Internal link graph + PageRank
- Performance (Lighthouse on top 5 pages)
- Content quality engine

### Phase 2 — AI Visibility (v2)
- Machine readability engine (7-stage extraction pipeline)
- Entity intelligence engine (detection, consistency, coverage, disambiguation)
- Citation probability engine (7-factor weighted formula)
- Semantic trust layer (authorship, organisational, content, structural trust)
- AI Perception Graph construction (entity→topic→claim→page)
- AI Visibility Score composite formula
- 6 new dashboard pages with real data
- All TypeScript errors resolved, build passing

### Phase 3 — Blog + Auth + UI
- 64 blog posts across 7 categories
- Glowing card UI design system
- Hero cinematic animation
- Auth rewrite from OTP to email/password + OAuth
- Marketing pages: landing, pricing, methodology, about, founder, docs, changelog, status

### Phase 4 — Full Dashboard (v3)
- All 15 real-data dashboard pages built
- Layer 4 agents: Retrieval Simulation, Machine Trust, Temporal Authority, Recommendation Surface Mapping, Synthetic Entity Detection
- Tier 1 agent fixes (SEO, Schema, Entity, Citation, Semantic Trust)
- Portfolio page with score grid + trend badges
- Query simulation tool
- Perception Graph via Groq
- PDF report generation working
- MAX_PAGES=50 for serverless mode

### Phase 5 — Intelligence Modules
- Information Gain Engine (SERP cohort comparison via Serper API)
- Scout Intent Engine (page intent classification)
- Global Fix Plan (P0/P1/P2 priority queue with cross-module dependencies)
- SiteNexis Intelligence Index (SII composite)
- Visual analysis (Gemma 4 multimodal)
- Multilingual detection (Llama 3.3 70B)
- Authority stability analysis
- Core update simulation engine
- Self-audit benchmark layer
- Source-grounded verification layer
- AI-generated fix code
- Topical authority, semantic density, AI crawlability, geo scoring

### Phase 6 — AdNexis
- Second product built in `apps/adnexis/`
- 5 MVP modules: Vault, Analyze, Generate, Dashboard, Hooks
- Separate Vercel deployment
- Typecheck clean

### Phase 7 — Multi-Model AI + v4 (Current)
- OpenRouter multi-model architecture (7 models, task-routed)
- CLAUDE.md v4.0 with Decision Intelligence Layer (sections 42–45)
- v4 data model (8 new Prisma models for competitive intelligence)
- v4 Hybrid Audit Narrative Report (prompt + API route)
- ScoreDelta temporal intelligence (velocity tracking between audits)
- Competitive position simulation types
- Uncertainty decomposition framework
- All v4 types in `@sitenexis/shared`

---

## Contributing

Branch naming:
```
feat/[feature]         # new features
fix/[description]      # bug fixes
agent/[name]           # new or modified agents
score/[name]           # scoring logic changes
trust/[system]         # machine trust layer changes
sim/[name]             # retrieval simulation changes
docs/[what]            # documentation only
```

All PRs must pass: `pnpm typecheck` + `pnpm lint` + `pnpm test`. Main branch is protected.

---

## Contact

- **X / Twitter:** [@Sitenexis](https://twitter.com/Sitenexis)
- **Email:** [sitenexisintel@gmail.com](mailto:sitenexisintel@gmail.com)

---

*Built for the machine-first web.*
