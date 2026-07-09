import { type Page } from '../../generated';
import { type CrawledPage } from '@sitenexis/shared';
export type { Page };
export declare function saveCrawledPages(auditId: string, crawledPages: CrawledPage[]): Promise<void>;
export declare function getPageTextsByAudit(auditId: string): Promise<Map<string, string>>;
export declare function getPagesByAudit(auditId: string): Promise<Page[]>;
export declare function updatePageAIScore(id: string, score: number | null, status: 'pending' | 'scored' | 'failed'): Promise<void>;
//# sourceMappingURL=pages.d.ts.map