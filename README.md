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

SiteNexis runs audits in two modes, selected automatically based on infrastructure availability:

### Full Pipeline Mode (BullMQ + Worker)
Requires Redis (Upstash) and a running BullMQ worker process. Runs the complete 16-agent pipeline with Puppeteer crawling, all analyzer modules, PDF report generation, and Layer 4 Machine Trust analysis. Supports up to 500 pages per audit.

### Serverless Mode (Vercel-native, no Redis required)
When Redis is unavailable (e.g. Vercel deployment without a Redis URL), audits automatically fall back to serverless execution using Next.js `after()`. This mode uses `fetch()` + HTML parsing to crawl up to 20 pages, runs programmatic SEO and schema analysis, calculates all AI Visibility scores, and saves full results to Supabase — no BullMQ worker or Redis required.

**In both modes:** audits produce real scores from real data. The 503 "service unavailable" error only occurs if the database itself is unreachable.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 App Router (React Server Components) |
| UI | Tailwind CSS, Framer Motion, TanStack Query, TanStack Table |
| Backend | Next.js API routes + BullMQ workers (optional) |
| Database | PostgreSQL via Supabase (Prisma ORM) |
| Auth | Supabase Auth (email/password + Google/GitHub OAuth) |
| AI Engine | Anthropic Claude API + OpenAI fallback |
| Job Queue | BullMQ + Redis — Upstash (optional, falls back to serverless) |
| Storage | Cloudflare R2 (PDF reports) |
| Billing | Stripe Checkout + Customer Portal |
| Email | Resend |
| Error tracking | Sentry |
| Monorepo | pnpm workspaces + Turbo |
| Deploy | Vercel (web) + Railway/Fly.io (BullMQ worker, optional) |

---

## Monorepo Structure

```
sitenexis/
├── apps/
│   └── web/                    # Next.js 15 App Router
│       ├── app/
│       │   ├── (auth)/          # Login, signup, reset
│       │   ├── (marketing)/     # Landing, pricing, blog, about
│       │   ├── dashboard/       # 15 authenticated dashboard pages
│       │   ├── audit/[domain]/  # 12-tab audit results
│       │   └── api/             # All API route handlers
│       └── src/
│           ├── components/
│           └── lib/
│               └── serverless-audit.ts  # Serverless audit runner (no Redis/worker)
├── packages/
│   ├── crawler/                 # Puppeteer/Cheerio crawl engine + BullMQ worker
│   ├── analyzers/               # All 12-dimension scoring modules
│   ├── agents/                  # 16-agent orchestration layer
│   ├── db/                      # Prisma schema + Supabase client + query helpers
│   └── shared/                  # TypeScript types shared across all packages
├── config/
│   ├── provider-weights.json
│   ├── citation-weights.json
│   ├── trust-decay-model.json
│   ├── surface-coverage-model.json
│   └── synthetic-detection-rules.json
└── CLAUDE.md                    # Full architectural specification
```

---

## 16-Agent Pipeline

```
Phase 1:  Crawl Agent
Phase 2:  SEO Agent, Schema Intelligence Agent                     (parallel)
Phase 3:  AI Retrieval Agent, Entity Intelligence Agent,
          Performance Agent                                         (parallel)
Phase 4:  Citation Intelligence Agent, Semantic Trust Agent        (parallel)
Phase 5:  Retrieval Simulation Agent, Machine Trust Agent,
          Temporal Authority Agent, Recommendation Mapping Agent,
          Synthetic Entity Detection Agent                          (parallel, Layer 4)
Phase 6:  Visualization Agent
Phase 7:  Reporting Agent
```

Phase 5 (Layer 4) agents require Pro or higher plan and run only when the full BullMQ pipeline is active.

---

## Scoring System (12 Dimensions)

### Tier 1 — Infrastructure
- SEO Health Score
- Schema Completeness Score
- Internal Link Strength Score
- Technical Performance Score

### Tier 2 — AI Visibility
- AI Visibility Score (composite)
- Machine Readability Score
- Entity Confidence Score
- Retrieval Readiness Score
- Citation Probability Score
- Semantic Trust Score
- Recommendation Confidence Score

### Tier 3 — Machine Trust (Layer 4, Pro+ plans)
- Retrieval Quality Score
- Machine Trust Score
- Authority Velocity Score
- Recommendation Surface Score
- Entity Authenticity Confidence

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- A Supabase project (required)
- Redis — Upstash (optional; audits fall back to serverless mode without it)
- Anthropic API key (optional; programmatic scoring works without it)

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example apps/web/.env.local
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL
# REDIS_URL is optional — omit to use serverless audit mode

# Push schema to database
pnpm db:push

# Start everything
pnpm dev
```

### Key Commands

```bash
pnpm dev              # Start Next.js + worker via Turbo
pnpm build            # Build all packages
pnpm typecheck        # TypeScript check across all packages
pnpm lint             # ESLint across all packages
pnpm test             # Vitest unit tests

pnpm db:push          # Push Prisma schema to Supabase
pnpm db:migrate       # Generate + run migration
pnpm db:studio        # Open Prisma Studio at localhost:5555
pnpm db:generate      # Regenerate Prisma client after schema changes
```

---

## Environment Variables

All variables validated at startup via `apps/web/src/lib/env.ts`. Copy `.env.example` to `apps/web/.env.local`.

### Required

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase pooled connection (port 6543, `?pgbouncer=true`) |
| `DIRECT_URL` | Supabase direct connection for migrations (port 5432, session-mode pooler) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Public anon key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Full access server key (never expose to browser) |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as SUPABASE_URL — needed by client components |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as SUPABASE_ANON_KEY — needed by client components |

### Optional (enables full pipeline mode)

| Variable | Purpose |
|---|---|
| `REDIS_URL` | BullMQ job queue — Upstash `rediss://` URL. Audits work without this (serverless mode). |
| `ANTHROPIC_API_KEY` | AI scoring via Claude API |
| `OPENAI_API_KEY` | Optional fallback AI provider |
| `S3_BUCKET_NAME` | PDF report storage (Cloudflare R2 or S3) |
| `S3_ACCESS_KEY_ID` | Storage access key |
| `S3_SECRET_ACCESS_KEY` | Storage secret key |
| `S3_ENDPOINT` | R2: `https://<id>.r2.cloudflarestorage.com` |
| `STRIPE_SECRET_KEY` | Billing — server-side only |
| `STRIPE_WEBHOOK_SECRET` | Stripe signature verification |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Billing — browser-safe |
| `NEXT_PUBLIC_APP_URL` | Your deployment URL |

---

## Deployment

### Vercel (Web App)

1. Connect your GitHub repo to Vercel
2. Set the environment variables listed above in Vercel project settings
3. Vercel auto-deploys on every push to `main`

**Minimum required env vars for a working Vercel deployment:**
```
DATABASE_URL
DIRECT_URL
SUPABASE_URL
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Without `REDIS_URL`, audits run in serverless mode (no worker required). With `REDIS_URL` set, audits use the full BullMQ pipeline and require a separate worker process.

### BullMQ Worker (Railway / Fly.io) — Optional

The worker process handles full 16-agent pipeline audits. Deploy `packages/crawler/src/worker.ts` as a separate long-lived service. Required env vars: `DATABASE_URL`, `REDIS_URL`, `ANTHROPIC_API_KEY`.

```bash
# Railway
railway up

# Fly.io
fly launch
```

### Health Check

Visit `/api/health` for a full system diagnostic showing status of env vars, Prisma engine, DB connectivity, Redis, BullMQ queue, and worker heartbeat.

---

## Architecture Rules

- **No `any` types** — use `unknown` + type guards
- **No `process.env` directly** — always import from `@/lib/env`
- **No raw Prisma in routes** — use `@sitenexis/db` query helpers
- **No scoring logic in agents** — agents orchestrate; `@sitenexis/analyzers` scores
- **No hardcoded weights** — provider weights, decay curves, detection rules in `/config/`
- **Soft deletes only** — `archivedAt: DateTime?`, never hard delete
- **Score explainability is mandatory** — every deduction maps to a named `Issue`
- **Retrieval simulation top 30 pages only** — compute cost control
- **Layer 4 gated to Pro+ plans** — `PLAN_LIMITS.layer4Analysis`
- **Synthetic detection shown to domain owner only** — not in competitive analysis
- **503 only on DB failure** — Redis unavailability triggers serverless fallback, not error

---

## Plan Limits

| Plan | Audits/mo | Layer 4 | Competitive | API | Bulk |
|---|---|---|---|---|---|
| Free | 1 | — | — | — | — |
| Starter | 50 | — | — | — | — |
| Pro | Unlimited | ✓ | ✓ | — | — |
| Agency | Unlimited | ✓ | ✓ | ✓ | ✓ |
| Enterprise | Unlimited | ✓ | ✓ | ✓ | ✓ |

---

## Blog

The blog at `/blog` covers AI visibility, machine trust, entity SEO, AI agents, and semantic web strategy. Posts are defined in `apps/web/src/lib/blog-posts.ts` as structured content blocks — no CMS required.

Current post count: **49 posts** across 7 categories.

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
```

All PRs must pass: `pnpm typecheck` + `pnpm lint` + `pnpm test`.

---

## Contact

- **X / Twitter:** [@Sitenexis](https://twitter.com/Sitenexis)
- **Email:** [sitenexisintel@gmail.com](mailto:sitenexisintel@gmail.com)

---

*Built for the machine-first web.*
*See `CLAUDE.md` for the full architectural specification.*
