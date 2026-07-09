"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.db = void 0;
var client_1 = require("./client");
Object.defineProperty(exports, "db", { enumerable: true, get: function () { return client_1.db; } });
Object.defineProperty(exports, "prisma", { enumerable: true, get: function () { return client_1.prisma; } });
__exportStar(require("./queries/audits"), exports);
__exportStar(require("./queries/credits"), exports);
__exportStar(require("./queries/issues"), exports);
__exportStar(require("./queries/pages"), exports);
__exportStar(require("./queries/scores"), exports);
__exportStar(require("./queries/users"), exports);
__exportStar(require("./queries/v3"), exports);
__exportStar(require("./queries/self-audit"), exports);
__exportStar(require("./queries/teams"), exports);
__exportStar(require("./queries/scheduled-reports"), exports);
__exportStar(require("./queries/ads"), exports);
__exportStar(require("./queries/sse"), exports);
__exportStar(require("./queries/graph"), exports);
__exportStar(require("./queries/ige"), exports);
__exportStar(require("./queries/scout"), exports);
__exportStar(require("./queries/v4"), exports);
//# sourceMappingURL=index.js.map