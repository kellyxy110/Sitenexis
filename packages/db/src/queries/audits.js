"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAudit = createAudit;
exports.getAuditById = getAuditById;
exports.getAuditWithResults = getAuditWithResults;
exports.listAuditsByUser = listAuditsByUser;
exports.getAuditsByUser = getAuditsByUser;
exports.updateAuditStatus = updateAuditStatus;
exports.softDeleteAudit = softDeleteAudit;
exports.getPreviousCompletedAuditIdForDomain = getPreviousCompletedAuditIdForDomain;
exports.countAuditsThisMonth = countAuditsThisMonth;
exports.getDemoAudit = getDemoAudit;
exports.listDemoAudits = listDemoAudits;
const client_1 = require("../client");
async function createAudit(userId, domain) {
    return client_1.db.audit.create({
        data: { userId, domain, status: 'queued' },
    });
}
async function getAuditById(id) {
    return client_1.db.audit.findFirst({
        where: { id, archivedAt: null },
    });
}
async function getAuditWithResults(id) {
    return client_1.db.audit.findFirst({
        where: { id, archivedAt: null },
        include: {
            pages: { where: { archivedAt: null } },
            issues: true,
            scores: true,
            aiVisibilityScores: true,
            report: true,
        },
    });
}
async function listAuditsByUser(userId, page, pageSize) {
    const [data, total] = await client_1.db.$transaction([
        client_1.db.audit.findMany({
            where: { userId, archivedAt: null },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: {
                scores: true,
                aiVisibilityScores: true,
                _count: { select: { issues: true } },
            },
        }),
        client_1.db.audit.count({ where: { userId, archivedAt: null } }),
    ]);
    return { data, total };
}
async function getAuditsByUser(userId, limit) {
    return client_1.db.audit.findMany({
        where: { userId, archivedAt: null },
        orderBy: { createdAt: 'desc' },
        ...(limit !== undefined ? { take: limit } : {}),
    });
}
async function updateAuditStatus(id, status, metadata) {
    await client_1.db.audit.update({
        where: { id },
        data: {
            status,
            ...(status === 'running' ? { startedAt: new Date() } : {}),
            ...(status === 'complete' || status === 'failed' ? { completedAt: new Date() } : {}),
            ...(metadata?.errorMessage !== undefined ? { errorMessage: metadata.errorMessage } : {}),
            ...(metadata?.pageCount !== undefined ? { pageCount: metadata.pageCount } : {}),
            ...(metadata?.crawlDurationMs !== undefined ? { crawlDurationMs: metadata.crawlDurationMs } : {}),
        },
    });
}
async function softDeleteAudit(id) {
    await client_1.db.audit.update({
        where: { id },
        data: { archivedAt: new Date() },
    });
}
async function getPreviousCompletedAuditIdForDomain(domain, excludeAuditId) {
    const audit = await client_1.db.audit.findFirst({
        where: { domain, status: 'complete', archivedAt: null, id: { not: excludeAuditId } },
        orderBy: { completedAt: 'desc' },
        select: { id: true },
    });
    return audit?.id ?? null;
}
async function countAuditsThisMonth(userId) {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return client_1.db.audit.count({
        where: { userId, createdAt: { gte: start }, archivedAt: null },
    });
}
async function getDemoAudit(domain) {
    return client_1.db.audit.findFirst({
        where: { domain, isDemo: true, status: 'complete', archivedAt: null },
        include: {
            pages: { where: { archivedAt: null } },
            issues: true,
            scores: true,
            aiVisibilityScores: true,
            report: true,
        },
        orderBy: { completedAt: 'desc' },
    });
}
async function listDemoAudits() {
    return client_1.db.audit.findMany({
        where: { isDemo: true, status: 'complete', archivedAt: null },
        select: { id: true, domain: true, completedAt: true, pageCount: true },
        orderBy: { domain: 'asc' },
    });
}
//# sourceMappingURL=audits.js.map