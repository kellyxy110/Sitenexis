"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getScheduledReports = getScheduledReports;
exports.createScheduledReport = createScheduledReport;
exports.deleteScheduledReport = deleteScheduledReport;
exports.updateScheduledReportSentAt = updateScheduledReportSentAt;
exports.getDueScheduledReports = getDueScheduledReports;
const client_1 = require("../client");
function nextSendDate(frequency, hour, dayOfWeek) {
    const now = new Date();
    const d = new Date(now);
    d.setSeconds(0, 0);
    if (frequency === 'daily') {
        d.setHours(hour, 0, 0, 0);
        if (d <= now)
            d.setDate(d.getDate() + 1);
    }
    else if (frequency === 'weekly') {
        const target = dayOfWeek ?? 1; // Monday default
        const diff = (target - d.getDay() + 7) % 7 || 7;
        d.setDate(d.getDate() + diff);
        d.setHours(hour, 0, 0, 0);
    }
    else {
        // monthly — 1st of next month
        d.setMonth(d.getMonth() + 1, 1);
        d.setHours(hour, 0, 0, 0);
    }
    return d;
}
async function getScheduledReports(userId) {
    return client_1.db.scheduledReport.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
    });
}
async function createScheduledReport(userId, email, frequency, domain, dayOfWeek, hour = 8) {
    const nextSendAt = nextSendDate(frequency, hour, dayOfWeek);
    return client_1.db.scheduledReport.create({
        data: {
            userId,
            email,
            frequency,
            domain: domain ?? null,
            ...(dayOfWeek !== undefined ? { dayOfWeek } : {}),
            hour,
            nextSendAt,
        },
    });
}
async function deleteScheduledReport(userId, id) {
    await client_1.db.scheduledReport.deleteMany({ where: { id, userId } });
}
async function updateScheduledReportSentAt(id) {
    const report = await client_1.db.scheduledReport.findUnique({ where: { id } });
    if (!report)
        return;
    const nextSendAt = nextSendDate(report.frequency, report.hour, report.dayOfWeek);
    await client_1.db.scheduledReport.update({
        where: { id },
        data: { lastSentAt: new Date(), nextSendAt },
    });
}
async function getDueScheduledReports() {
    return client_1.db.scheduledReport.findMany({
        where: { enabled: true, nextSendAt: { lte: new Date() } },
    });
}
//# sourceMappingURL=scheduled-reports.js.map