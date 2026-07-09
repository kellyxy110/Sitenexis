"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveCrawledPages = saveCrawledPages;
exports.getPageTextsByAudit = getPageTextsByAudit;
exports.getPagesByAudit = getPagesByAudit;
exports.updatePageAIScore = updatePageAIScore;
const client_1 = require("../client");
async function saveCrawledPages(auditId, crawledPages) {
    await client_1.db.page.createMany({
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
async function getPageTextsByAudit(auditId) {
    const rows = await client_1.db.page.findMany({
        where: { auditId, archivedAt: null },
        select: { url: true, bodyText: true },
    });
    const map = new Map();
    for (const row of rows) {
        if (row.bodyText)
            map.set(row.url, row.bodyText);
    }
    return map;
}
async function getPagesByAudit(auditId) {
    return client_1.db.page.findMany({
        where: { auditId, archivedAt: null },
        orderBy: { crawledAt: 'asc' },
    });
}
async function updatePageAIScore(id, score, status) {
    await client_1.db.page.update({
        where: { id },
        data: { aiScore: score, aiStatus: status },
    });
}
//# sourceMappingURL=pages.js.map