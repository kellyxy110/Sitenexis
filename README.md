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
When Redis is unavailable, audits automatically fall back to serverless execution using Next.js `after()`. Uses `fetch()` + HTML parsing to crawl up to 20 pages. AI scoring (entity confidence, retrieval readiness, citation probability, semantic trust) is powered by Groq `llama-3.3-70b-versatile` — the same model used in the full pipeline — via direct API call. Falls back to heuristic scoring if `GROQ_API_KEY` is unavailable. Saves full results to Supabase. No BullMQ worker or Redis required. Available on all plans.

**In both modes:** audits produce real scores from real data. The only case that returns a 503 is if the Supabase database itself is unreachable.

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
| AI Engine | Groq API (primary) — fast inference for scoring + entity extraction |
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
│           │   ├── dashboard/        # 15 authenticated dashboard pages
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
│   ├── analyzers/                    # All 12-dimension scoring modules
│   ├── agents/                       # 16-agent orchestration layer
│   ├── db/                           # Prisma schema + Supabase client + query helpers
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
├── CLAUDE.md                         # Full architectural specification
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

**Score thresholds (consistent across all UI surfaces):**
- 90–100: Excellent (green)
- 70–89: Good (teal)
- 50–69: Needs Work (amber)
- 0–49: Critical (red)

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase project (required — DB + Auth)
- Groq API key (required for AI scoring)
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
| `REDIS_URL` | Upstash Redis URL (`rediss://...`). Without this, audits run in serverless mode. |
| `STRIPE_SECRET_KEY` | Stripe secret key for billing (`sk_live_...` or `sk_test_...`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_live_...` or `pk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
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

## Redis Architecture

SiteNexis uses **Upstash Redis exclusively**. No local Redis. No Railway-provisioned Redis plugin.

### Why Upstash

- Serverless-compatible (works from both Vercel and Railway)
- TLS-native (`rediss://`) — required for cloud deployments
- Free tier sufficient for development
- Single `REDIS_URL` across all services

### Connection Strategy

`packages/crawler/src/queue.ts` is the single source of truth for all Redis connections:

```
createRedisClient(isBullMq: boolean) → IORedis
  - isBullMq=true  → maxRetriesPerRequest: null (required by BullMQ)
  - isBullMq=false → maxRetriesPerRequest: 3
  - TLS: automatic for rediss:// URLs
  - Retry: exponential backoff 500ms → 10s (logs every 5th attempt only)
```

**Per-process connection count:**
| Service | Connections | Purpose |
|---|---|---|
| Watchdog | 1 | Heartbeat key reads |
| Worker | 2 | BullMQ processing (1) + heartbeat writes (1) |
| Vercel API (queue) | 1 | Job enqueue via probeRedis() + Queue singleton |
| Vercel API (health) | 1 | BullMQ stats check |

**Total: 5 connections maximum** — well within Upstash free tier (20 concurrent connections).

### Startup Validation

Both `worker.ts` and `watchdog.ts` call `validateRedisUrl()` before creating any connections. This function:
- Exits with exit code 1 if `REDIS_URL` is not set
- Exits with exit code 1 if `REDIS_URL` points to localhost
- Prints the masked URL on success: `rediss://***@capable-minnow-xxx.upstash.io:6379`

Expected startup log on Railway:
```
[redis] REDIS_URL validated: rediss://***@capable-minnow-xxx.upstash.io:6379
[watchdog] TLS: enabled
[watchdog] Watchdog Redis connected
[watchdog] Watchdog Redis ready
[watchdog] Spawning worker (restart #0)
[worker] REDIS_URL validated: rediss://***@capable-minnow-xxx.upstash.io:6379
[worker] BullMQ Redis connected
[worker] BullMQ Redis ready
[worker] Heartbeat Redis connected
[worker] Heartbeat started
[worker] BullMQ worker started
```

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

Deploy manually from the monorepo root (CLI must be authenticated as kellyxy110):

```bash
# Create vercel.adnexis.json at repo root (see below), then:
VERCEL_ORG_ID=team_NuC1Fkg65uNAiysfEHuvF4rc \
VERCEL_PROJECT_ID=prj_twPstETvnNURV3Xa2zEeJ8H2GlM3 \
vercel --prod --yes --local-config vercel.adnexis.json
```

`vercel.adnexis.json` contents (create at monorepo root, do NOT commit):
```json
{
  "buildCommand": "pnpm --filter @sitenexis/shared build && pnpm --filter @sitenexis/db build && pnpm --filter @sitenexis/analyzers build && pnpm --filter adnexis build",
  "outputDirectory": "apps/adnexis/.next",
  "installCommand": "pnpm install --no-frozen-lockfile",
  "framework": "nextjs"
}
```

Project build settings (locked via API):
- **Build command:** `pnpm --filter adnexis build` (full chain including shared packages)
- **Output directory:** `apps/adnexis/.next`
- **Root directory:** monorepo root

**Important:** The root `vercel.json` was renamed to `sitenexis.vercel.json` to prevent AdNexis deployments from picking up SiteNexis build settings. Both projects use their own named config files.

**Minimum required for a working Vercel deployment:**
```
DATABASE_URL
DIRECT_URL
SUPABASE_URL
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GROQ_API_KEY
NEXT_PUBLIC_APP_URL
```

Without `REDIS_URL`: audits run in serverless mode (20 pages, Layers 1–3).
With `REDIS_URL` + worker running: full 16-agent pipeline (500 pages, all layers).

### Railway (BullMQ Worker)

The worker handles full pipeline audits. It is a long-lived process — not a serverless function.

#### Step-by-step Railway setup:

```bash
# 1. Install Railway CLI (if not already installed)
npm i -g @railway/cli

# 2. Login
railway login

# 3. Link to your Railway project
railway link

# 4. Deploy (uses railway.json automatically)
railway up
```

**Railway environment variables to set (Variables tab):**

| Name | Value |
|---|---|
| `REDIS_URL` | `rediss://default:<token>@capable-minnow-138196.upstash.io:6379` |
| `DATABASE_URL` | Your Supabase pooled URL |
| `DIRECT_URL` | Your Supabase direct URL |
| `GROQ_API_KEY` | Your Groq API key |

> **Do NOT add a Railway Redis plugin** — use Upstash only. Do NOT name the variable anything other than `REDIS_URL`.

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

#### Verifying Railway deployment:

After Railway deploys, check logs for this sequence:
```
✓ REDIS_URL validated: rediss://***@...
✓ Watchdog Redis connected
✓ Worker spawned
✓ BullMQ Redis connected
✓ Heartbeat started
```

If you see `FATAL: REDIS_URL environment variable is not set` — the variable name in Railway is wrong.
If you see `FATAL: REDIS_URL points to localhost` — you've set the wrong value.

### Health Check

Visit `/api/health` (or use `vercel curl` to bypass deployment protection) for a full system diagnostic:

```bash
# Using Vercel CLI (bypasses deployment protection)
vercel curl https://sitenexis-kellyxys-projects.vercel.app/api/health

# Expected healthy response:
{
  "status": "ok",
  "stages": [
    { "stage": "env_vars",        "status": "ok" },
    { "stage": "prisma_engine",   "status": "ok" },
    { "stage": "db_connectivity", "status": "ok", "latency_ms": 580 },
    { "stage": "db_schema",       "status": "ok", "latency_ms": 570 },
    { "stage": "redis_ping",      "status": "ok" },
    { "stage": "bullmq_queue",    "status": "ok" },
    { "stage": "worker_heartbeat","status": "ok" }
  ]
}
```

**Health check in serverless mode (no worker):**
- `env_vars`, `prisma_engine`, `db_connectivity`, `db_schema` → all `ok`
- `redis_ping`, `bullmq_queue`, `worker_heartbeat` → `error` (expected — no worker deployed)
- Audits still work in serverless mode despite these errors

---

## Production Checklist

### Vercel
- [ ] `DATABASE_URL` set (port 6543, `?pgbouncer=true`)
- [ ] `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` set
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` set
- [ ] `GROQ_API_KEY` set (variable name is `GROQ_API_KEY`, value starts with `gsk_`)
- [ ] `NEXT_PUBLIC_APP_URL` set to production URL
- [ ] `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` set
- [ ] Build passes without TypeScript errors
- [ ] `/api/health` shows `env_vars: ok`, `db_connectivity: ok`

### Railway (Worker)
- [ ] `REDIS_URL` set — variable name is exactly `REDIS_URL`
- [ ] Value is `rediss://default:<token>@<host>.upstash.io:6379` (note: `rediss://` not `redis://`)
- [ ] `DATABASE_URL` set (same as Vercel)
- [ ] `GROQ_API_KEY` set
- [ ] Railway logs show `REDIS_URL validated` and `BullMQ Redis ready`
- [ ] Railway logs show `Heartbeat started` and worker is `alive`

### Upstash Redis
- [ ] Database created at `console.upstash.com`
- [ ] URL format: `rediss://default:<token>@<host>.upstash.io:6379`
- [ ] Same URL used in both Vercel (`REDIS_URL`) and Railway (`REDIS_URL`)
- [ ] No Railway Redis plugin installed (Upstash only)

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

## Content & Tools

### Blog (`/blog`)
64 posts across 7 categories: AI Visibility, Machine Trust, Entity SEO, Technical SEO, Strategy, AI Agents. Posts are defined as structured content blocks in `apps/web/src/lib/blog-posts.ts` — no CMS required.

### Knowledge Graph (`/content-map`)
Semantic content map with full JSON-LD structured data (`ItemList` + `Article` schema). Five knowledge clusters: AI Discovery, Citation Mechanics, Authority Systems, Volatility Modeling, Machine Trust Intelligence. Machine-readable by AI crawlers.

### Citation Checklist (`/tools/citation-checklist`)
Interactive 7-factor Citation Probability checklist. Scores content against the same formula used in every SiteNexis audit. Factors: Factual Density (20%), Claim Specificity (15%), Entity Authority (15%), Topical Authority (15%), Structural Readiness (15%), Temporal Freshness (10%), Trust Signal Density (10%).

### AI Instructions (`/ai-instructions`)
Structured entity definition page for AI systems. Provides canonical citation guidance for SiteNexis as an entity.

---

## Google OAuth Setup

Google OAuth requires three configuration steps — none are in code. Complete these once after deploying.

### Step 1 — Enable Google Provider in Supabase

1. Go to **Supabase Dashboard → Authentication → Providers → Google**
2. Toggle **Enable Sign in with Google** → ON
3. Enter your **Google Client ID** and **Google Client Secret** (obtained in Step 2)
4. Save

### Step 2 — Create OAuth Credentials in Google Cloud Console

1. Go to [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Create a new project (or use an existing one)
3. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client IDs**
4. Application type: **Web application**
5. Under **Authorized redirect URIs**, add:
   ```
   https://<your-supabase-ref>.supabase.co/auth/v1/callback
   ```
   (Find this exact URL in Supabase → Authentication → Providers → Google → "Redirect URL")
6. Copy the **Client ID** and **Client Secret** → paste into Supabase (Step 1)

### Step 3 — Whitelist redirect URLs in Supabase

1. Go to **Supabase Dashboard → Authentication → URL Configuration**
2. Set **Site URL** to your production URL:
   ```
   https://sitenexis.vercel.app
   ```
3. Under **Redirect URLs**, add all allowed callback destinations:
   ```
   https://sitenexis.vercel.app/auth/callback
   https://adnexis-eight.vercel.app/api/auth/callback
   http://localhost:3000/auth/callback
   http://localhost:3001/api/auth/callback
   ```
4. Save

> If OAuth redirects to a blank page or shows "Error: redirect_uri_mismatch", the URL you added in Step 3 does not exactly match the URL Supabase is sending. Check that you added the `/auth/callback` path (not just the domain).

---

## Security

### HTTP Security Headers

Both apps include production-hardened security headers on every response:

- `X-Frame-Options: SAMEORIGIN` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `Strict-Transport-Security` — enforces HTTPS (2-year max-age)
- `Content-Security-Policy` — restricts script/style/connect origins
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — disables camera, microphone, geolocation

### Rate Limiting

All sensitive routes are protected by a Redis-backed sliding-window rate limiter (`apps/web/src/lib/rate-limit.ts`) with an in-process `Map` fallback when Redis is unavailable.

| Route | Limit |
|---|---|
| `POST /api/audit/start` | 10 req/min per user |
| `POST /api/v1/audits` (Public API) | 30 req/min per user |
| AdNexis analyze | 20 req/min per user |
| AdNexis generate | 10 req/min per user |
| AdNexis hooks | 15 req/min per user |
| AdNexis billing/checkout | 5 req/min per user |

### IDOR Protection

Every API route that accepts an audit ID verifies `audit.userId === authenticatedUser.id` before returning data. A mismatched ownership check returns 403, not 404, to avoid leaking record existence.

### SSRF Protection

The `/api/orchestrate` and `/api/audit/start` routes block all private IP ranges before passing URLs to the crawler:

```
localhost, 127.x, 10.x, 192.168.x, 172.16–31.x, 169.254.x, 0.0.0.0, ::1, fc00:, fe80:, file:
```

### XSS Prevention

All user-controlled data embedded in server-generated HTML (e.g., PDF report templates) is passed through `escHtml()` before insertion. No raw string interpolation with external data.

### Timing-Safe Secret Comparison

Webhook secret verification (Stripe, Vercel deploy hooks) uses `crypto.timingSafeEqual` on SHA-256 digests of both sides — never direct string comparison.

### Auth Bypass Production Guard

`PLAYWRIGHT_TEST` and `DEMO_MODE` middleware bypass flags are disabled in production (`VERCEL_ENV === 'production' || NODE_ENV === 'production'`). They only take effect in non-production environments.

### Input Length Limits

All Zod schemas on AI-bound routes enforce `.max()` on text fields to prevent cost abuse:
- Ad transcripts: 50,000 chars
- Source ads for generation: 10,000 chars
- Hook fields (offer, audience, pain point): 500 chars each

---

## Common Issues

### "REDIS_URL is not set" on Railway
The variable is either missing or named incorrectly. Go to Railway → your service → Variables. The name must be exactly `REDIS_URL`.

### "REDIS_URL points to localhost"
You've set `redis://localhost:6379` or similar. This never works on Railway. Use your Upstash URL.

### Audits complete instantly with low scores (serverless mode)
Redis is not configured or unreachable. Serverless mode only crawls 20 pages. Set `REDIS_URL` and deploy the Railway worker for full pipeline.

### Build fails: TypeScript errors on credit types
`credits.ts` re-exports types from `credits-config.ts`. If you see `Cannot find name 'CreditAction'` or similar, ensure `credits.ts` imports (not just re-exports) the types it uses internally.

### Stripe test key warning in Vercel build logs
Vercel's secret scanner detected a Stripe key in the deployment bundle. This is a warning, not a build error. Ensure `STRIPE_SECRET_KEY` is only used server-side (in API routes) and never imported in client components.

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
