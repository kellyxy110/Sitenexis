"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveIssues = saveIssues;
exports.getIssuesByAudit = getIssuesByAudit;
exports.getIssuesBySeverity = getIssuesBySeverity;
exports.getIssueById = getIssueById;
exports.saveFix = saveFix;
exports.getIssuesWithFixes = getIssuesWithFixes;
const client_1 = require("../client");
async function saveIssues(auditId, issues) {
    await client_1.db.issue.createMany({
        data: issues.map((issue) => ({ auditId, ...issue })),
    });
}
async function getIssuesByAudit(auditId) {
    return client_1.db.issue.findMany({
        where: { auditId },
        orderBy: [
            { severity: 'asc' },
            { module: 'asc' },
        ],
    });
}
async function getIssuesBySeverity(auditId, severity) {
    return client_1.db.issue.findMany({ where: { auditId, severity } });
}
async function getIssueById(id) {
    return client_1.db.issue.findUnique({ where: { id } });
}
async function saveFix(issueId, fix) {
    await client_1.db.issue.update({
        where: { id: issueId },
        data: {
            problem: fix.problem,
            solution: fix.solution,
            fixCode: fix.fixCode,
            fixLanguage: fix.fixLanguage,
        },
    });
}
async function getIssuesWithFixes(auditId) {
    return client_1.db.issue.findMany({
        where: { auditId, NOT: { fixCode: null } },
        orderBy: [{ severity: 'asc' }, { module: 'asc' }],
    });
}
//# sourceMappingURL=issues.js.map