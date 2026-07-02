export const dynamic = 'force-dynamic';
export const maxDuration = 45;

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const Schema = z.object({ domain: z.string().min(3).max(253) });

export type CitationCheckResult = {
  domain: string;
  queriesRun: number;
  citedCount: number;
  citationRate: number;           // 0–1
  queries: CitationQuery[];
  topTopics: string[];
  verdict: string;
  checkedAt: string;
  error?: string;
};

export type CitationQuery = {
  query: string;
  cited: boolean;
  citedUrls: string[];
  excerpt?: string;
};

// ── Query generation from homepage ────────────────────────────────────────────

async function deriveQueries(domain: string): Promise<string[]> {
  // Fetch homepage to extract topic context
  try {
    const res = await fetch(`https://${domain}`, {
      signal: AbortSignal.timeout(8_000),
      headers: { 'User-Agent': 'SiteNexis-CitationCheck/1.0', Accept: 'text/html' },
    });
    if (!res.ok) return fallbackQueries(domain);
    const html = await res.text();
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() ?? '';
    const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1]?.trim() ?? '';
    const context = [title, h1, metaDesc].filter(Boolean).join(' ');
    if (!context) return fallbackQueries(domain);

    // Generate 4 representative queries based on page content
    return [
      `what is ${domain.replace(/^www\./, '')}`,
      title ? `who makes ${title.split(' ').slice(0, 4).join(' ')}` : `${domain} services`,
      metaDesc ? metaDesc.split('.')[0]?.trim() ?? `${domain} review` : `${domain} review`,
      h1 ? `${h1.split(' ').slice(0, 5).join(' ')} tools` : `best alternatives to ${domain}`,
    ].filter(Boolean).slice(0, 4);
  } catch {
    return fallbackQueries(domain);
  }
}

function fallbackQueries(domain: string): string[] {
  const base = domain.replace(/^www\./, '').split('.')[0] ?? domain;
  return [
    `what is ${domain}`,
    `${base} software review`,
    `${base} alternatives`,
    `how to use ${base}`,
  ];
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);
  const rl = await rateLimit('citation-check', ip, { limit: 10, windowSec: 3600 });
  if (!rl.ok) return NextResponse.json({ error: 'Rate limit exceeded. 10 checks per hour.' }, { status: 429 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'domain is required' }, { status: 400 });

  const { domain } = parsed.data;
  const cleanDomain = domain.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    return NextResponse.json({
      domain: cleanDomain, queriesRun: 0, citedCount: 0, citationRate: 0,
      queries: [], topTopics: [],
      verdict: 'Citation check unavailable — OpenAI API key not configured.',
      checkedAt: new Date().toISOString(),
      error: 'OPENAI_API_KEY not configured',
    } satisfies CitationCheckResult);
  }

  const client = new OpenAI({ apiKey });
  const queries = await deriveQueries(cleanDomain);
  const results: CitationQuery[] = [];

  for (const query of queries) {
    try {
      const response = await client.responses.create({
        model: 'gpt-4o-search-preview',
        tools: [{ type: 'web_search_preview' as const }],
        input: query,
      });

      // Extract text content and URL citations from response output
      let text = '';
      const citedUrls: string[] = [];

      for (const item of response.output) {
        if (item.type === 'message') {
          for (const block of item.content) {
            if (block.type === 'output_text') {
              text += block.text;
              // Extract URL annotations
              for (const ann of block.annotations ?? []) {
                if (ann.type === 'url_citation' && ann.url) {
                  citedUrls.push(ann.url);
                }
              }
            }
          }
        }
      }

      const domainCited = citedUrls.some((u) => {
        try { return new URL(u).hostname.includes(cleanDomain.replace(/^www\./, '')); } catch { return false; }
      }) || text.toLowerCase().includes(cleanDomain.replace(/^www\./, ''));

      const excerpt = domainCited
        ? (() => {
            const idx = text.toLowerCase().indexOf(cleanDomain.replace(/^www\./, ''));
            if (idx === -1) return undefined;
            return text.slice(Math.max(0, idx - 80), idx + 120).trim();
          })()
        : undefined;

      results.push({
        query,
        cited: domainCited,
        citedUrls: citedUrls.filter((u) => {
          try { return new URL(u).hostname.includes(cleanDomain.replace(/^www\./, '')); } catch { return false; }
        }),
        ...(excerpt ? { excerpt } : {}),
      });
    } catch (err) {
      logger.warn({ err, query, domain: cleanDomain }, 'Citation check query failed');
      results.push({ query, cited: false, citedUrls: [] });
    }
  }

  const citedCount = results.filter((r) => r.cited).length;
  const citationRate = queries.length > 0 ? citedCount / queries.length : 0;

  const verdict =
    citationRate >= 0.75 ? `${cleanDomain} is actively cited by AI systems across multiple query types.` :
    citationRate >= 0.5  ? `${cleanDomain} is cited for some queries. There are gaps for others.` :
    citationRate > 0     ? `${cleanDomain} appears in AI answers occasionally but is not a consistent citation source.` :
    `${cleanDomain} was not cited in any of the ${queries.length} queries tested. The domain may have low AI visibility.`;

  return NextResponse.json({
    domain: cleanDomain,
    queriesRun: queries.length,
    citedCount,
    citationRate,
    queries: results,
    topTopics: queries,
    verdict,
    checkedAt: new Date().toISOString(),
  } satisfies CitationCheckResult);
}
