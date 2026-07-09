"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveIGEResult = saveIGEResult;
exports.getIGEResult = getIGEResult;
const client_1 = require("../client");
async function saveIGEResult(auditId, result) {
    await client_1.db.informationGainResult.upsert({
        where: { auditId },
        create: {
            auditId,
            keyword: result.keyword,
            targetUrl: result.targetUrl,
            cohortSize: result.cohortSize,
            overallScore: result.informationGainScore,
            confidence: result.confidence,
            state: result.state,
            cohortPagesJson: result.factLayer.sourcedFromUrls,
            resultJson: result,
        },
        update: {
            keyword: result.keyword,
            targetUrl: result.targetUrl,
            cohortSize: result.cohortSize,
            overallScore: result.informationGainScore,
            confidence: result.confidence,
            state: result.state,
            cohortPagesJson: result.factLayer.sourcedFromUrls,
            resultJson: result,
        },
    });
}
async function getIGEResult(auditId) {
    const record = await client_1.db.informationGainResult.findUnique({ where: { auditId } });
    if (!record)
        return null;
    return record.resultJson;
}
//# sourceMappingURL=ige.js.map