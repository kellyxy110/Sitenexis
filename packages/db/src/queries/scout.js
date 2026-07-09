"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveScoutAnalysis = saveScoutAnalysis;
exports.getScoutAnalysis = getScoutAnalysis;
const client_1 = require("../client");
async function saveScoutAnalysis(auditId, domain, result) {
    await client_1.db.scoutAnalysis.upsert({
        where: { auditId },
        create: {
            auditId,
            domain,
            state: result.state,
            resultJson: result,
        },
        update: {
            state: result.state,
            resultJson: result,
        },
    });
}
async function getScoutAnalysis(auditId) {
    const record = await client_1.db.scoutAnalysis.findUnique({ where: { auditId } });
    if (!record)
        return null;
    return record.resultJson;
}
//# sourceMappingURL=scout.js.map