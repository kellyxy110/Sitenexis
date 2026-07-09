"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveSseScore = saveSseScore;
exports.getSseScore = getSseScore;
const client_1 = require("../client");
async function saveSseScore(auditId, data) {
    return client_1.db.sseScore.upsert({
        where: { auditId },
        create: { auditId, ...data },
        update: { ...data },
    });
}
async function getSseScore(auditId) {
    return client_1.db.sseScore.findUnique({ where: { auditId } });
}
//# sourceMappingURL=sse.js.map