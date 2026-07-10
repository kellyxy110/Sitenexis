export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';

interface Params { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  const { id } = await params;

  try {
    const { getAuditWithResults } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as (Record<string, unknown> & { userId: string }) | null;
    if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json(extractSchemaData(audit));
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

function extractSchemaData(audit: Record<string, unknown>) {
  const scores = (audit['scores'] ?? {}) as Record<string, unknown>;
  const pages = (audit['pages'] ?? []) as Array<Record<string, unknown>>;

  // Collect schema snippets from page analyses
  const snippets: Array<{
    url: string;
    schemaType: string;
    snippet: string;
    isNew: boolean;
  }> = [];

  for (const page of pages) {
    const schemaData = (page['schemaData'] ?? []) as Array<Record<string, unknown>>;
    const url = String(page['url'] ?? '');

    // Detected types
    const detectedTypes = schemaData
      .map((s) => String(s['@type'] ?? s['type'] ?? ''))
      .filter(Boolean);

    // Generated snippets — stored in page breakdown if available
    const breakdown = (page['breakdown'] ?? {}) as Record<string, unknown>;
    const generated = (breakdown['generatedSnippets'] ?? {}) as Record<string, string>;

    for (const [schemaType, snippet] of Object.entries(generated)) {
      if (snippet) {
        snippets.push({ url, schemaType, snippet, isNew: !detectedTypes.includes(schemaType) });
      }
    }

    // Also surface existing detected types without snippets
    for (const t of detectedTypes) {
      if (!snippets.find((s) => s.url === url && s.schemaType === t)) {
        snippets.push({
          url,
          schemaType: t,
          snippet: JSON.stringify({ '@context': 'https://schema.org', '@type': t, name: 'Fill in your data' }, null, 2),
          isNew: false,
        });
      }
    }
  }

  return {
    schemaScore: (scores['schemaScore'] as number | undefined) ?? null,
    coverage:    (scores['schemaCoverage'] as number | undefined) ?? null,
    snippets,
    totalPages: pages.length,
    pagesWithSchema: snippets.map((s) => s.url).filter((v, i, a) => a.indexOf(v) === i).length,
  };
}
