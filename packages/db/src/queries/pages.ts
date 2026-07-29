import { type Page } from '../../generated';
import { type CrawledPage } from '@sitenexis/shared';
import { db } from '../client';

export type { Page };

function normalizePageIdentity(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    u.hostname = u.hostname.toLowerCase();
    if ((u.protocol === 'https:' && u.port === '443') || (u.protocol === 'http:' && u.port === '80')) u.port = '';
    u.pathname = u.pathname.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    return u.href;
  } catch { return rawUrl; }
}


export async function saveCrawledPages(
  auditId: string,
  crawledPages: CrawledPage[]
): Promise<void> {
  const uniquePages = [...new Map(crawledPages.map((p) => [normalizePageIdentity(p.url), p])).values()];
  await db.page.createMany({
    data: uniquePages.map((p) => ({
      auditId,
      normalizedUrl: normalizePageIdentity(p.url),
      requestedUrl: p.requestedUrl ?? p.url,
      finalUrl: p.finalUrl ?? p.url,
      url: p.url,
      statusCode: p.statusCode,
      title: p.title,
      metaDescription: p.metaDescription,
      h1: p.h1,
      h2: (p.headings ?? []).filter((h) => h.level === 2).map((h) => h.text),
      headingEvidence: p.headingEvidence ?? p.headings,
      canonicalUrl: p.canonicalUrl,
      rawCanonical: p.rawCanonical ?? null,
      resolvedCanonical: p.resolvedCanonical ?? null,
      canonicalRawValues: p.canonicalRawValues ?? [],
      resolvedCanonicalValues: p.resolvedCanonicalValues ?? [],
      canonicalCount: p.canonicalCount ?? 0,
      canonicalSource: p.canonicalSource ?? 'none',
      canonicalValidity: p.canonicalValidity ?? 'missing',
      isSelfReferencing: p.isSelfReferencing ?? null,
      wordCount: p.wordCount,
      internalLinks: p.internalLinks.length,
      externalLinks: p.externalLinks.length,
      bodyText: p.bodyText ?? null,
      contentHash: p.contentHash ?? null,
      extractionMode: p.extractionMode ?? 'static-html',
      extractionConfidence: p.extractionConfidence ?? 1,
      crawledAt: p.crawledAt,
    })),
  });
}

export async function getPageTextsByAudit(auditId: string): Promise<Map<string, string>> {
  const rows = await db.page.findMany({
    where: { auditId, archivedAt: null },
    select: { url: true, bodyText: true },
  });
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.bodyText) map.set(row.url, row.bodyText);
  }
  return map;
}

export async function getPageById(id: string): Promise<Page | null> {
  return db.page.findUnique({ where: { id } });
}

export async function getPagesByAudit(auditId: string): Promise<Page[]> {
  return db.page.findMany({
    where: { auditId, archivedAt: null },
    orderBy: { crawledAt: 'asc' },
  });
}

export async function updatePageAIScore(
  id: string,
  score: number | null,
  status: 'pending' | 'scored' | 'failed'
): Promise<void> {
  await db.page.update({
    where: { id },
    data: { aiScore: score, aiStatus: status },
  });
}
