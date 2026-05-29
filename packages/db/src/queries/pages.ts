import { type Page } from '@prisma/client';
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
      crawledAt: p.crawledAt,
    })),
  });
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
