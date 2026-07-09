"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserCredits = getUserCredits;
exports.deductCredits = deductCredits;
exports.addCredits = addCredits;
exports.getCreditHistory = getCreditHistory;
const generated_1 = require("../../generated");
const client_1 = require("../client");
function toJsonMetadata(metadata) {
    if (!metadata)
        return generated_1.Prisma.JsonNull;
    return metadata;
}
async function getUserCredits(userId) {
    const user = await client_1.db.user.findFirst({
        where: { id: userId, archivedAt: null },
        select: { creditBalance: true, isUnlimited: true },
    });
    return {
        balance: user?.creditBalance ?? 0,
        isUnlimited: user?.isUnlimited ?? false,
    };
}
async function deductCredits(userId, amount, actionType, description, metadata) {
    try {
        return await client_1.db.$transaction(async (tx) => {
            const user = await tx.user.findFirst({
                where: { id: userId },
                select: { creditBalance: true, isUnlimited: true },
            });
            if (!user)
                return false;
            // Unlimited users: log usage at 0 cost but always allow
            if (user.isUnlimited) {
                await tx.creditTransaction.create({
                    data: {
                        userId,
                        type: 'debit',
                        amount: 0,
                        actionType,
                        description: description ?? null,
                        metadata: toJsonMetadata(metadata),
                    },
                });
                return true;
            }
            if (user.creditBalance < amount)
                return false;
            await tx.user.update({
                where: { id: userId },
                data: { creditBalance: { decrement: amount } },
            });
            await tx.creditTransaction.create({
                data: {
                    userId,
                    type: 'debit',
                    amount,
                    actionType,
                    description: description ?? null,
                    metadata: toJsonMetadata(metadata),
                },
            });
            return true;
        });
    }
    catch {
        return false;
    }
}
async function addCredits(userId, amount, actionType, description) {
    await client_1.db.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: userId },
            data: { creditBalance: { increment: amount } },
        });
        await tx.creditTransaction.create({
            data: {
                userId,
                type: 'credit',
                amount,
                actionType,
                description: description ?? null,
            },
        });
    });
}
async function getCreditHistory(userId, limit = 20) {
    return client_1.db.creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
            id: true,
            type: true,
            amount: true,
            actionType: true,
            description: true,
            createdAt: true,
        },
    });
}
//# sourceMappingURL=credits.js.map