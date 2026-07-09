"use strict";
// ─── GTL (Graceful Truth Layer) ───────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_LIMITS = void 0;
exports.getScoreLabel = getScoreLabel;
exports.getScoreTailwindClass = getScoreTailwindClass;
function getScoreLabel(score) {
    if (score >= 90)
        return 'Excellent';
    if (score >= 70)
        return 'Good';
    if (score >= 50)
        return 'Needs Work';
    return 'Critical';
}
function getScoreTailwindClass(score) {
    if (score >= 90)
        return 'text-green-500';
    if (score >= 70)
        return 'text-teal-400';
    if (score >= 50)
        return 'text-amber-400';
    return 'text-red-500';
}
// ─── Plan limits (v3 — includes layer4Analysis + competitiveAnalysis) ────────
exports.PLAN_LIMITS = {
    free: {
        auditsPerMonth: 1,
        apiAccess: false,
        bulkDomains: false,
        whiteLabel: false,
        competitiveAnalysis: false,
        layer4Analysis: false,
    },
    starter: {
        auditsPerMonth: 50,
        apiAccess: false,
        bulkDomains: false,
        whiteLabel: false,
        competitiveAnalysis: false,
        layer4Analysis: false,
    },
    pro: {
        auditsPerMonth: -1,
        apiAccess: false,
        bulkDomains: false,
        whiteLabel: false,
        competitiveAnalysis: true,
        layer4Analysis: true,
    },
    agency: {
        auditsPerMonth: -1,
        apiAccess: true,
        bulkDomains: true,
        whiteLabel: false,
        competitiveAnalysis: true,
        layer4Analysis: true,
    },
    enterprise: {
        auditsPerMonth: -1,
        apiAccess: true,
        bulkDomains: true,
        whiteLabel: true,
        competitiveAnalysis: true,
        layer4Analysis: true,
    },
};
//# sourceMappingURL=types.js.map