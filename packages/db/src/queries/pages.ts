import { type Page } from '../../generated';
import { type CrawledPage } from '@sitenexis/shared';
import { db } from '../client';

export type { Page };

export async function saveCrawledPages(
  auditId: string,
  crawledPages: CrawledPage[]
): Promise<void> {
  await db.page.createMany({
    data: crawledPages.map((p) => ({
      auditId,
      url: p.url,
      statusCode: p.statusCode,
      title: p.title,
      metaDescription: p.metaDescription,
      h1: p.h1,
      wordCount: p.wordCount,
      internalLinks: p.internalLinks.length,
      externalLinks: p.externalLinks.length,
      bodyText: p.bodyText ?? null,
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
