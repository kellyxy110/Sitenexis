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

This is observability for machines — a 16-agent intelligence pipeline that models the complete chain of decisions an AI system makes when encountering a website, from raw HTML ingestion through chunk extraction, entity resolution, semantic trust formation, retrieval ranking, summarisation degradation, citation eligibility filtering, and final recommendation surface inclusion.

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

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 App Router (React Server Components) |
| UI | Tailwind CSS, Framer Motion, TanStack Query, TanStack Table |
| Backend | Next.js API routes + BullMQ workers |
| Database | PostgreSQL via Supabase (Prisma ORM) |
| Auth | Supabase Auth (email/password + OAuth) |
| AI Engine | Groq `llama-3.3-70b-versatile` via `callAI()` wrapper |
| Job Queue | BullMQ + Redis (Upstash) |
| Storage | Cloudflare R2 (PDF reports) |
| Billing | Stripe Checkout + Customer Portal |
| Email | Resend |
| Error tracking | Sentry |
| Monorepo | pnpm workspaces + Turbo |
| Deploy | Vercel (web) + Railway (BullMQ worker) |

---

## Monorepo Structure

```
sitenexis/
├── apps/
│   └── web/                    # Next.js 16 App Router
│       ├── app/
│       │   ├── (auth)/          # Login, signup, reset
│       │   ├── (marketing)/     # Landing, pricing, blog, about
│       │   ├── dashboard/       # 15 authenticated dashboard pages
│       │   ├── audit/[domain]/  # 12-tab audit results
│       │   └── api/             # All API route handlers
│       └── src/
│           ├── components/
│           └── lib/
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
├── vercel.json
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
- A Supabase project
- Redis instance (Upstash recommended)
- Groq API key

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example apps/web/.env.local
# Fill in all values (see Environment Variables section below)

# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push

# Start everything (Next.js + BullMQ worker)
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

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase pooled connection (port 6543) |
| `DIRECT_URL` | Supabase direct connection for migrations (port 5432) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Public anon key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Full access server key (never expose to browser) |
| `ANTHROPIC_API_KEY` | AI engine — used via `callAI()` wrapper |
| `OPENAI_API_KEY` | Optional fallback AI provider |
| `REDIS_URL` | BullMQ + AI score cache |
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

The project is pre-configured for Vercel + Railway deployment.

### Web App (Vercel)

The `vercel.json` at the root configures:
- Build command: `turbo run build --filter=web...`
- Install command: `pnpm install --no-frozen-lockfile`
- Output: `apps/web/.next`

Set all environment variables listed above in your Vercel project settings.

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### BullMQ Worker (Railway)

The worker is a separate process that runs all 16 agents. Deploy `packages/crawler/src/worker.ts` as a Railway service using `railway.json` at the project root.

```bash
# Configure Railway
railway init
railway up
```

---

## Architecture Rules

- **No `any` types** — use `unknown` + type guards
- **No `process.env` directly** — always import from `@/lib/env`
- **No raw Prisma in routes** — use `@sitenexis/db` query helpers
- **No scoring logic in agents** — agents orchestrate; `@sitenexis/analyzers` scores
- **No hardcoded weights** — provider weights, decay curves, detection rules are in `/config/`
- **Soft deletes only** — `archivedAt: DateTime?`, never hard delete
- **Score explainability is mandatory** — every deduction maps to a named `Issue`
- **Retrieval simulation top 30 pages only** — compute cost control
- **Layer 4 gated to Pro+ plans** — `PLAN_LIMITS.layer4Analysis`
- **Synthetic detection shown to domain owner only** — not in competitive analysis

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

Current post count: **34 posts** across 7 categories.

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
