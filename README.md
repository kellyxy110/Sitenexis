# SiteNexis

SiteNexis is an Advertising Intelligence Platform and a Machine Trust Intelligence Platform.

- SiteNexis helps teams measure how machines find, read, trust, and cite a website.
- AdNexis helps teams analyze, compare, and improve advertising creative.

Production sites:

- SiteNexis: <https://sitenexis.vercel.app>
- AdNexis: <https://adnexis-ai.vercel.app>

Contact: [sitenexisintel@gmail.com](mailto:sitenexisintel@gmail.com)

## Products

### SiteNexis

SiteNexis audits a website. It crawls the site and measures technical SEO, content, entities, schema, links, retrieval, citation readiness, and machine trust.

Each audit explains:

1. What the system found.
2. Why the finding matters.
3. What action to take next.

### AdNexis

AdNexis is the advertising product. It stores ads, analyzes creative structure, compares campaigns, and generates new creative.

Main areas:

- Swipe Vault
- Analyze Ad
- Campaign Intelligence
- Generate
- Dashboard

AdNexis does not claim to know actual campaign results unless the user provides campaign data. Scores from ad analysis are estimates based on the supplied creative.

## SiteNexis features

- Website crawling and page extraction
- Technical SEO checks
- Schema checks and schema suggestions
- Internal link graph and PageRank analysis
- Content quality analysis
- Entity extraction and entity confidence
- AI visibility analysis
- Citation readiness analysis
- Retrieval simulation
- Machine trust analysis
- Temporal authority analysis
- Recommendation surface analysis
- Synthetic entity checks
- Competitive position analysis
- Information gain analysis
- Audit narrative reports
- PDF report generation
- Google Analytics and Search Console connectors

## AdNexis features

- Save ads by platform, niche, and tags
- Search saved ads across transcript, hook, audience, niche, and tags
- Analyze hooks, emotions, funnel stage, CTA, audience, structure, and platform fit
- View an Advertising MRI report
- Compare two or more ads with Campaign Intelligence
- Generate platform-specific ad variations
- Store analysis and generation history

## Audit execution

SiteNexis supports two audit modes.

### Worker mode

Worker mode uses BullMQ and Redis. A Railway worker runs the full crawl and analysis pipeline.

This mode supports large audits and Layer 4 analysis.

### Serverless mode

Serverless mode runs on Vercel. It uses Next.js server functions and `after()`.

This mode does not need Redis or a worker. It crawls a smaller page set and stores results in PostgreSQL.

Redis failure does not cause an audit to fail when serverless execution is available. A database failure can cause a `503` response.

## Technology

| Area | Technology |
|---|---|
| Web apps | Next.js 15, React 19, TypeScript |
| Styling | Tailwind CSS, Framer Motion |
| Database | PostgreSQL, Supabase, Prisma |
| Authentication | Supabase Auth and NextAuth where required |
| AI routing | OpenRouter with Groq fallback |
| Queue | BullMQ and Redis |
| Storage | Cloudflare R2 or S3-compatible storage |
| Billing | Stripe |
| Email | Resend |
| Monorepo | pnpm workspaces and Turbo |
| Deployment | Vercel and optional Railway worker |

## Repository structure

```text
apps/
  web/       SiteNexis web application
  adnexis/   AdNexis web application

packages/
  analyzers/ Advertising and website analysis engines
  agents/    SiteNexis agent orchestration
  crawler/   Crawl and queue services
  db/        Prisma schema and database queries
  shared/    Shared TypeScript types

config/      Scoring and provider configuration
docs/        Architecture and operations documentation
scripts/     Validation scripts
```

## Requirements

Install these tools before local development:

- Node.js 20 or later
- pnpm 9 or later
- A Supabase PostgreSQL database
- A Supabase project for authentication
- A Groq API key for AdNexis analysis and fallback AI calls

Optional services:

- OpenRouter for multi-model routing
- Redis for worker mode
- Stripe for billing
- Cloudflare R2 or S3 for report storage
- Resend for email
- Serper for search result analysis

## Local setup

From the repository root:

```bash
pnpm install
```

Copy the environment template.

```bash
cp .env.example .env.local
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env.local
```

Set the required values in `.env.local`. Do not commit this file.

Generate the Prisma client:

```bash
pnpm db:generate
```

Apply the schema only to a development database:

```bash
pnpm db:push
```

Start the development stack:

```bash
pnpm dev
```

Start one app:

```bash
pnpm --filter web dev
pnpm --filter adnexis dev
```

## Environment variables

Use `.env.example` as the complete variable list.

Core variables include:

- `DATABASE_URL`: pooled PostgreSQL URL
- `DIRECT_URL`: direct PostgreSQL URL for Prisma operations
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `GROQ_API_KEY`

Optional variables include OpenRouter, Redis, Stripe, Google, R2, Serper, Resend, and provider-specific keys.

Security rules:

- Keep secret keys on the server.
- Do not expose service role keys in browser code.
- Do not commit `.env`, `.env.local`, or downloaded provider credentials.
- Use strong production secrets.
- Use separate development and production databases.

## Common commands

```bash
# Build all packages and applications
pnpm build

# Check TypeScript
pnpm typecheck

# Run ESLint
pnpm lint

# Run tests
pnpm test

# Run foundation validation
pnpm validate:foundation

# Validate public production endpoints
node scripts/validate-public-endpoints.mjs https://sitenexis.vercel.app

# Open Prisma Studio
pnpm db:studio
```

## Deployment

### SiteNexis on Vercel

The Vercel project is `sitenexis`.

- Root directory: repository root
- Framework: Next.js
- Output directory: `apps/web/.next`
- Install command: `pnpm install --no-frozen-lockfile`
- Configuration file: `sitenexis.vercel.json`

The production URL is:

```text
https://sitenexis.vercel.app
```

### AdNexis on Vercel

The Vercel project is `adnexis-ai`.

- Root directory: repository root
- Framework: Next.js
- Output directory: `apps/adnexis/.next`
- Install command: `pnpm install --no-frozen-lockfile`
- Configuration file: `adnexis.vercel.json`

The production URL is:

```text
https://adnexis-ai.vercel.app
```

### Railway worker

The optional worker uses `railway.json`.

The worker needs:

- `REDIS_URL`
- `DATABASE_URL`
- `DIRECT_URL`
- `GROQ_API_KEY`

The worker uses the exact variable name `REDIS_URL`.

## Public SiteNexis API routes

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/audit/start` | Start an audit |
| `GET` | `/api/audits` | List audits |
| `GET` | `/api/audit/[id]` | Read an audit |
| `GET` | `/api/audit/[id]/stream` | Read audit progress |
| `GET` | `/api/audit/[id]/citation` | Read citation analysis |
| `GET` | `/api/audit/[id]/entities` | Read entity analysis |
| `GET` | `/api/audit/[id]/retrieval` | Read retrieval analysis |
| `GET` | `/api/audit/[id]/machine-trust` | Read machine trust analysis |
| `POST` | `/api/audit/[id]/export` | Export audit data |
| `GET` | `/api/health` | Read service health |

Authenticated routes require a valid user session or API key, as defined by the route.

## Public machine-readable resources

SiteNexis publishes these resources:

- `/robots.txt`
- `/sitemap.xml`
- `/llms.txt`
- `/ai.txt`
- `/.well-known/security.txt`
- `/humans.txt`
- `/rss.xml`
- `/manifest.webmanifest`
- `/favicon.svg`
- `/og-image`

These resources help people, search systems, and AI systems understand the site. They do not guarantee rankings, citations, or recommendations.

## Design and engineering rules

- Use TypeScript types instead of `any`.
- Use `unknown` and type guards for untrusted data.
- Validate all request bodies with Zod.
- Keep database queries in `packages/db`.
- Keep scoring logic in analyzer packages.
- Keep agent code focused on orchestration.
- Store model weights in `config` files.
- Use soft deletes for user data.
- Check user ownership before returning private data.
- Map each score deduction to evidence.
- Return partial or unavailable states when data is missing.
- Do not turn missing data into a zero score.
- Do not claim that an estimate is a measured result.

## Testing and release checks

Run these checks before a release:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm validate:foundation
node scripts/validate-public-endpoints.mjs https://sitenexis.vercel.app
```

Review these production systems after deployment:

- Vercel build status and runtime logs
- Database connection and migration status
- Supabase authentication
- Stripe webhooks
- Google OAuth callback and token refresh
- Google Analytics synchronization
- Search Console synchronization
- Redis worker health
- Scheduled jobs

See [docs/PRODUCTION_INTEGRATIONS_VERIFICATION.md](docs/PRODUCTION_INTEGRATIONS_VERIFICATION.md) for the latest production audit.

## Documentation

- [Production integration verification](docs/PRODUCTION_INTEGRATIONS_VERIFICATION.md)
- [Enterprise foundation audit](docs/ENTERPRISE_FOUNDATION_AUDIT.md)
- [Final implementation report](docs/FINAL_IMPLEMENTATION_REPORT.md)
- [Google setup](docs/intelligence-center/GOOGLE_SETUP.md)
- [Project instructions](CLAUDE.md)

## Contribution rules

Use a clear branch name:

```text
feat/short-description
fix/short-description
docs/short-description
test/short-description
```

Before you open a pull request, run the release checks. Explain any failed check in the pull request.

## License and contact

The repository does not currently declare a public open-source license. Ask the project owner before you reuse code.

- SiteNexis: <https://sitenexis.vercel.app>
- AdNexis: <https://adnexis-ai.vercel.app>
- Email: [sitenexisintel@gmail.com](mailto:sitenexisintel@gmail.com)

## Page accuracy

SiteNexis stores evidence for each crawled URL.

For each page, the audit keeps:

- the requested URL
- the normalized page identity
- the final URL after redirects
- the declared canonical URL
- the title and description
- all H1 and H2 values in document order
- the visible content hash
- the extraction mode and confidence

A canonical URL is evidence. It is not the database identity of the page. A missing canonical remains missing. A retry replaces old page values instead of keeping stale values.

Run the page accuracy tests:

```bash
pnpm --filter @sitenexis/adapters typecheck
pnpm --filter @sitenexis/db typecheck
pnpm --filter @sitenexis/db db:generate
pnpm --filter @sitenexis/adapters test
```

Apply the additive database fields before production use:

```bash
pnpm --filter @sitenexis/db db:push
```

See [the page accuracy audit](docs/audits/HEADING-CANONICAL-ACCURACY-AUDIT.md) and [the decision log](docs/DECISION_LOG.md).