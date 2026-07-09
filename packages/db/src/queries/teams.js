"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeamMembers = getTeamMembers;
exports.addTeamMember = addTeamMember;
exports.removeTeamMember = removeTeamMember;
exports.getTeamInvites = getTeamInvites;
exports.createTeamInvite = createTeamInvite;
exports.acceptTeamInvite = acceptTeamInvite;
exports.isTeamMemberOf = isTeamMemberOf;
const client_1 = require("../client");
async function getTeamMembers(ownerId) {
    return client_1.db.teamMember.findMany({
        where: { ownerId },
        include: { member: { select: { id: true, email: true, name: true } } },
        orderBy: { joinedAt: 'asc' },
    });
}
async function addTeamMember(ownerId, userId, role) {
    return client_1.db.teamMember.upsert({
        where: { ownerId_userId: { ownerId, userId } },
        create: { ownerId, userId, role },
        update: { role },
    });
}
async function removeTeamMember(ownerId, memberId) {
    await client_1.db.teamMember.deleteMany({ where: { ownerId, id: memberId } });
}
async function getTeamInvites(ownerId) {
    return client_1.db.teamInvite.findMany({
        where: { ownerId, accepted: false, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
    });
}
async function createTeamInvite(ownerId, email, role) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    return client_1.db.teamInvite.create({ data: { ownerId, email, role, expiresAt } });
}
async function acceptTeamInvite(token) {
    const invite = await client_1.db.teamInvite.findUnique({ where: { token } });
    if (!invite || invite.accepted || invite.expiresAt < new Date())
        return null;
    return client_1.db.teamInvite.update({ where: { token }, data: { accepted: true } });
}
async function isTeamMemberOf(ownerId, userId) {
    const m = await client_1.db.teamMember.findUnique({
        where: { ownerId_userId: { ownerId, userId } },
    });
    return m !== null;
}
//# sourceMappingURL=teams.js.map