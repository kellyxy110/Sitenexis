# SiteNexis — AI Retrieval + Machine Trust Intelligence System

> Not an SEO tool. Not an audit dashboard.
> A live intelligence system that models how AI systems retrieve, interpret, trust, and recommend web content.

**Website:** [sitenexis.com](https://sitenexis.com) &nbsp;|&nbsp; **X:** [@Sitenexis](https://twitter.com/Sitenexis) &nbsp;|&nbsp; **Email:** [sitenexisintel@gmail.com](mailto:sitenexisintel@gmail.com)

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
When Redis is unavailable, audits automatically fall back to serverless execution using Next.js `after()`. Uses `fetch()` + HTML parsing to crawl up to 20 pages, runs all Layers 1–3, and saves full results to Supabase. No BullMQ worker or Redis required. Available on all plans.

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

### Vercel (Web App)

1. Connect your GitHub repo (`kellyxy110/Sitenexis`) to Vercel
2. Set root directory to the monorepo root (not `apps/web`)
3. Framework preset: **Next.js** (auto-detected)
4. Add all environment variables from the table above
5. Vercel auto-deploys on every push to `master`

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

## Common Issues

### "REDIS_URL is not set" on Railway
The variable is either missing or named incorrectly. Go to Railway → your service → Variables. The name must be exactly `REDIS_URL`.

### "REDIS_URL points to localhost"
You've set `redis://localhost:6379` or similar. This never works on Railway. Use your Upstash URL.

### Audits complete instantly with low scores (serverless mode)
Redis is not configured or unreachable. Serverless mode only crawls 20 pages. Set `REDIS_URL` and deploy the Railway worker for full pipeline.

### Build fails: "Cannot find module 'puppeteer'"
The health route imports `@sitenexis/crawler` to check BullMQ stats. If puppeteer is not installed in the Vercel serverless environment, this check fails. This is expected — audits use the serverless fallback and are not affected. The real Redis/BullMQ check uses the worker heartbeat, not the Vercel health check.

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
