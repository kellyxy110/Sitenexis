import { Prisma } from '../../generated';
import { db } from '../client';

export interface CreditBalance {
  balance: number;
  isUnlimited: boolean;
}

export interface CreditTransactionRecord {
  id: string;
  type: string;
  amount: number;
  actionType: string;
  description: string | null;
  createdAt: Date;
}

function toJsonMetadata(metadata?: Record<string, unknown>): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  if (!metadata) return Prisma.JsonNull;
  return metadata as Prisma.InputJsonValue;
}

export async function getUserCredits(userId: string): Promise<CreditBalance> {
  const user = await db.user.findFirst({
    where: { id: userId, archivedAt: null },
    select: { creditBalance: true, isUnlimited: true },
  });
  return {
    balance: user?.creditBalance ?? 0,
    isUnlimited: user?.isUnlimited ?? false,
  };
}

export async function deductCredits(
  userId: string,
  amount: number,
  actionType: string,
  description?: string,
  metadata?: Record<string, unknown>,
): Promise<boolean> {
  try {
    return await db.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId },
        select: { creditBalance: true, isUnlimited: true },
      });
      if (!user) return false;

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

      if (user.creditBalance < amount) return false;

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
  } catch {
    return false;
  }
}

export async function addCredits(
  userId: string,
  amount: number,
  actionType: string,
  description?: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
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

export async function getCreditHistory(userId: string, limit = 20): Promise<CreditTransactionRecord[]> {
  return db.creditTransaction.findMany({
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
