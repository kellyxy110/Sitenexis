"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserById = getUserById;
exports.getUserByEmail = getUserByEmail;
exports.upsertUser = upsertUser;
exports.updateUserPlan = updateUserPlan;
exports.updateStripeCustomerId = updateStripeCustomerId;
const client_1 = require("../client");
async function getUserById(id) {
    return client_1.db.user.findFirst({ where: { id, archivedAt: null } });
}
async function getUserByEmail(email) {
    return client_1.db.user.findFirst({ where: { email, archivedAt: null } });
}
async function upsertUser(id, email) {
    return client_1.db.user.upsert({
        where: { id },
        create: { id, email },
        update: { email },
    });
}
async function updateUserPlan(id, plan) {
    await client_1.db.user.update({ where: { id }, data: { plan } });
}
async function updateStripeCustomerId(id, customerId) {
    await client_1.db.user.update({ where: { id }, data: { stripeCustomerId: customerId } });
}
//# sourceMappingURL=users.js.map