export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';
import { getDemoAudit } from '@/lib/demo-store';
import { z } from 'zod';

interface Params { params: Promise<{ id: string }> }

const QuerySchema = z.object({
  query: z.string().min(2).max(300).trim(),
});

export interface SimulatedResult {
  rank: number;
  url: string;
  title: string | null;
  retrievalScore: number;
  matchedTerms: string[];
  termCoverage: number;
  excerpt: string;
  reasons: string[];
  chunkStability: 'high' | 'medium' | 'low';
  citationEligible: boolean;
}

export interface QuerySimulateResponse {
  query: string;
  terms: string[];
  results: SimulatedResult[];
  pagesAnalyzed: number;
  simulatedAt: string;
}

// ─── NLP helpers ─────────────────────────────────────────────────────────────

const STOP = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
  'from','is','are','was','were','be','been','being','have','has','had','do',
  'does','did','will','would','could','should','may','might','can','this','that',
  'these','those','it','its','as','if','what','how','which','who','when','where',
  'why','me','my','we','our','you','your','he','she','they','their','us','i',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

function termFrequency(term: string, text: string): number {
  const lower = text.toLowerCase();
  let count = 0;
  let pos = lower.indexOf(term);
  while (pos !== -1) { count++; pos = lower.indexOf(term, pos + 1); }
  return count / Math.max(text.split(/\s+/).length, 1);
}

function extractExcerpt(text: string, terms: string[], maxLen = 220): string {
  if (!text) return '';
  const lower = text.toLowerCase();
  let bestStart = 0;
  let bestScore = -1;

  for (let i = 0; i < Math.max(text.length - maxLen, 1); i += 30) {
    const window = lower.slice(i, i + maxLen);
    const score = terms.reduce((s, t) => s + (window.includes(t) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; bestStart = i; }
  }

  const raw = text.slice(bestStart, bestStart + maxLen).trim();
  return (bestStart > 5 ? '…' : '') + raw + (bestStart + maxLen < text.length ? '…' : '');
}

function scorePageForQuery(
  page: { url: string; title: string | null; bodyText: string | null; pageRank: number; wordCount: number },
  terms: string[],
): { score: number; matchedTerms: string[]; reasons: string[] } {
  const title  = page.title ?? '';
  const body   = page.bodyText ?? '';
  const url    = page.url.toLowerCase();
  const reasons: string[] = [];
  const matchedSet = new Set<string>();

  let raw = 0;

  for (const term of terms) {
    const inTitle = title.toLowerCase().includes(term);
    const inUrl   = url.includes(term);
    const inBody  = body.toLowerCase().includes(term);
    const tf      = inBody ? termFrequency(term, body) : 0;

    if (inTitle) {
      raw += 35;
      matchedSet.add(term);
      reasons.push(`"${term}" in title`);
    }
    if (inUrl) {
      raw += 12;
      matchedSet.add(term);
    }
    if (inBody && tf > 0) {
      raw += Math.min(tf * 600, 25);
      matchedSet.add(term);
    }
  }

  const matchedTerms = [...matchedSet];
  const coverage = matchedTerms.length / Math.max(terms.length, 1);

  // Coverage bonus
  if (coverage >= 0.8) { raw *= 1.35; reasons.push('High term coverage'); }
  else if (coverage >= 0.5) { raw *= 1.15; reasons.push('Moderate term coverage'); }

  // PageRank authority
  const prBoost = 1 + Math.min(page.pageRank * 3, 1.5);
  if (page.pageRank > 0.1) reasons.push('High PageRank');
  raw *= prBoost;

  // Word count — very thin pages penalised
  if (page.wordCount < 100) { raw *= 0.5; reasons.push('Thin content'); }

  const score = Math.min(Math.round(raw), 100);
  return { score, matchedTerms, reasons };
}

function chunkStability(score: number, coverage: number): 'high' | 'medium' | 'low' {
  if (score >= 70 && coverage >= 0.7) return 'high';
  if (score >= 40 && coverage >= 0.4) return 'medium';
  return 'low';
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch {
    return unauthorizedResponse();
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = QuerySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  }

  const { id } = await params;
  const query = parsed.data.query;
  const terms = tokenize(query);
  if (terms.length === 0) {
    return NextResponse.json({ error: 'Query too generic — no meaningful terms extracted' }, { status: 400 });
  }

  // ── Demo mode ──────────────────────────────────────────────────────────────
  if (!isFullyConfigured()) {
    const audit = getDemoAudit(id);
    if (!audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 });

    const mockResults: SimulatedResult[] = audit.pages.slice(0, 5).map((p, i) => ({
      rank: i + 1,
      url: p.url,
      title: p.url.replace(/^https?:\/\//, '').split('/').pop() || p.url,
      retrievalScore: Math.max(10, 90 - i * 15),
      matchedTerms: terms.slice(0, 3 - i),
      termCoverage: Math.max(0.2, 1 - i * 0.2),
      excerpt: `This page covers topics related to ${terms.join(', ')}. Content would appear here as an excerpt…`,
      reasons: i === 0 ? ['High term coverage', 'High PageRank'] : ['Moderate term coverage'],
      chunkStability: i === 0 ? 'high' : i < 3 ? 'medium' : 'low',
      citationEligible: i < 3,
    }));

    return NextResponse.json({
      query,
      terms,
      results: mockResults,
      pagesAnalyzed: audit.pages.length,
      simulatedAt: new Date().toISOString(),
    } satisfies QuerySimulateResponse);
  }

  // ── Real mode ──────────────────────────────────────────────────────────────
  try {
    const { getAuditById, getPagesByAudit } = await import('@sitenexis/db');
    const audit = await getAuditById(id);
    if (!audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
    if ((audit as { userId: string }).userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (audit.status !== 'complete') {
      return NextResponse.json({ error: 'Audit must be complete before running query simulation' }, { status: 409 });
    }

    const pages = await getPagesByAudit(id);
    const scored = pages
      .filter((p) => p.statusCode === 200)
      .map((p) => {
        const { score, matchedTerms, reasons } = scorePageForQuery(
          { url: p.url, title: p.title ?? null, bodyText: p.bodyText ?? null, pageRank: p.pageRank, wordCount: p.wordCount },
          terms,
        );
        const coverage = matchedTerms.length / Math.max(terms.length, 1);
        return {
          url: p.url,
          title: p.title ?? null,
          score,
          matchedTerms,
          termCoverage: coverage,
          reasons,
          excerpt: extractExcerpt(p.bodyText ?? '', terms),
          chunkStability: chunkStability(score, coverage),
          citationEligible: score >= 50 && coverage >= 0.5,
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const results: SimulatedResult[] = scored.map((r, i) => ({
      rank: i + 1,
      url: r.url,
      title: r.title,
      retrievalScore: r.score,
      matchedTerms: r.matchedTerms,
      termCoverage: Math.round(r.termCoverage * 100) / 100,
      excerpt: r.excerpt,
      reasons: r.reasons,
      chunkStability: r.chunkStability,
      citationEligible: r.citationEligible,
    }));

    return NextResponse.json({
      query,
      terms,
      results,
      pagesAnalyzed: pages.length,
      simulatedAt: new Date().toISOString(),
    } satisfies QuerySimulateResponse);
  } catch {
    return NextResponse.json({ error: 'Simulation failed' }, { status: 500 });
  }
}
