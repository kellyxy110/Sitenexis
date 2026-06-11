import { type NextRequest } from 'next/server';

export const dynamic = 'force-static';

export function GET(_req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://sitenexis.vercel.app';

  const content = `# SiteNexis

> AI Retrieval & Machine Trust Intelligence Platform

SiteNexis models how AI systems — including ChatGPT, Gemini, Perplexity, and Claude — retrieve, interpret, trust, and recommend web content. It runs 16 intelligence agents across a four-layer stack and produces a 12-dimensional audit report.

## What SiteNexis does

SiteNexis audits any domain and answers:
- How does an AI system chunk, retrieve, and rank this content?
- Where does meaning degrade between raw content and an AI-generated answer?
- How is machine trust formed, maintained, and lost over time?
- Across which AI recommendation surfaces is this content invisible — and why?

## Core scores

- AI Visibility Score: composite of Machine Readability, Entity Confidence, Retrieval Readiness, Citation Probability, Semantic Trust, Schema Completeness
- Machine Trust Score: entity credibility consistency, schema trust alignment, external validation depth, contradiction absence, trust degradation resistance
- Retrieval Quality Score: chunk stability, answer formation probability, summarisation loss, citation eligibility
- Recommendation Surface Score: AI Overviews, chat recommendation, voice retrieval, autonomous agent discovery
- Authority Velocity Score: delta in entity confidence and citation probability across audit snapshots
- Entity Authenticity Confidence: synthetic entity detection across fake entity patterns, authority networks, schema manipulation

## Platform pages

- [Home](${base}): Domain audit entry point and platform overview
- [Platform](${base}/platform): Four-layer intelligence stack documentation
- [Pricing](${base}/pricing): Plan comparison — Free, Starter, Pro, Agency, Enterprise
- [Methodology](${base}/methodology): Scoring methodology and algorithm documentation
- [Docs](${base}/docs): API documentation and integration guide
- [Blog](${base}/blog): AI visibility research, entity SEO guides, machine trust engineering

## Blog highlights

- [Why AI Systems Ignore 70% of Your Content](${base}/blog/why-ai-systems-ignore-70-percent-of-your-content)
- [Entity Optimization: The Signal AI Systems Weight Most](${base}/blog/entity-optimization-the-signal-ai-systems-weight-most)
- [Schema Markup as AI Trust Signals in 2025](${base}/blog/schema-markup-ai-trust-signals-2025)

## API

REST API available on Agency and Enterprise plans.
Base URL: ${base}/api
Documentation: ${base}/docs

## Contact

Email: sitenexisintel@gmail.com
X: https://x.com/Sitenexis
`;

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
