import type { TelegramConnectionStatus, TelegramConnectionEventType, Prisma } from '../../generated';
import { db } from '../client';

/**
 * SiteNexis Telegram User Assistant — identity & account-linking queries.
 *
 * Fully separate from the admin Ops console (TELEGRAM_ADMIN_CHAT_ID), which
 * has no row-level identity at all. Every function here is scoped by either
 * telegramUserId or siteNexisUserId — never by chatId alone, since chatId is
 * only a delivery address, not an identity.
 */

export interface TelegramConnectionRecord {
  id: string;
  telegramUserId: string;
  telegramChatId: string;
  siteNexisUserId: string;
  status: TelegramConnectionStatus;
  activeDomain: string | null;
  linkedAt: Date;
  lastInteractionAt: Date | null;
}

export async function getConnectionByTelegramUserId(telegramUserId: string): Promise<TelegramConnectionRecord | null> {
  return db.telegramConnection.findUnique({ where: { telegramUserId } });
}

export async function getConnectionBySiteNexisUserId(siteNexisUserId: string): Promise<TelegramConnectionRecord | null> {
  return db.telegramConnection.findUnique({ where: { siteNexisUserId } });
}

export async function createLinkToken(params: {
  tokenHash: string;
  telegramUserId: string;
  telegramChatId: string;
  expiresAt: Date;
}): Promise<{ id: string }> {
  const row = await db.telegramLinkToken.create({
    data: {
      tokenHash: params.tokenHash,
      telegramUserId: params.telegramUserId,
      telegramChatId: params.telegramChatId,
      expiresAt: params.expiresAt,
    },
    select: { id: true },
  });
  await db.telegramConnectionEvent.create({
    data: { telegramUserId: params.telegramUserId, eventType: 'LINK_CREATED' },
  });
  return row;
}

export type ConfirmLinkFailureReason =
  | 'invalid_or_expired'
  | 'already_consumed'
  | 'telegram_already_linked'
  | 'sitenexis_already_linked';

export interface ConfirmLinkResult {
  success: boolean;
  reason?: ConfirmLinkFailureReason;
  connectionId?: string;
}

/**
 * Atomic, single-use consumption of a link token. Every check re-reads
 * fresh state inside the transaction — no decision is made from data read
 * before the transaction started — so two concurrent confirmation attempts
 * for the same token can never both succeed (the token's own unique
 * `tokenHash` plus the row-level update inside the transaction is the
 * concurrency guard; the DB-level unique constraints on telegramUserId and
 * siteNexisUserId are the second, defense-in-depth guard against a race
 * producing two connections for the same identity).
 */
export async function confirmLinkToken(tokenHash: string, siteNexisUserId: string): Promise<ConfirmLinkResult> {
  try {
    return await db.$transaction(async (tx) => {
      const token = await tx.telegramLinkToken.findUnique({ where: { tokenHash } });
      if (!token) return { success: false, reason: 'invalid_or_expired' as const };
      if (token.consumedAt) return { success: false, reason: 'already_consumed' as const };
      if (token.expiresAt.getTime() < Date.now()) return { success: false, reason: 'invalid_or_expired' as const };

      const existingByTelegram = await tx.telegramConnection.findUnique({ where: { telegramUserId: token.telegramUserId } });
      if (existingByTelegram && existingByTelegram.siteNexisUserId !== siteNexisUserId) {
        return { success: false, reason: 'telegram_already_linked' as const };
      }

      const existingBySiteNexis = await tx.telegramConnection.findUnique({ where: { siteNexisUserId } });
      if (existingBySiteNexis && existingBySiteNexis.telegramUserId !== token.telegramUserId) {
        return { success: false, reason: 'sitenexis_already_linked' as const };
      }

      const now = new Date();
      const connection = existingByTelegram
        ? await tx.telegramConnection.update({
            where: { id: existingByTelegram.id },
            data: { status: 'linked', telegramChatId: token.telegramChatId, linkedAt: now },
          })
        : await tx.telegramConnection.create({
            data: {
              telegramUserId: token.telegramUserId,
              telegramChatId: token.telegramChatId,
              siteNexisUserId,
              status: 'linked',
              linkedAt: now,
              notificationPref: { create: {} },
            },
          });

      await tx.telegramLinkToken.update({
        where: { id: token.id },
        data: { consumedAt: now, telegramConnectionId: connection.id },
      });

      await tx.telegramConnectionEvent.create({
        data: {
          telegramConnectionId: connection.id,
          siteNexisUserId,
          telegramUserId: token.telegramUserId,
          eventType: 'LINK_CONFIRMED',
        },
      });

      return { success: true, connectionId: connection.id };
    });
  } catch (err) {
    // P2002 = unique constraint violation — the defense-in-depth net for a
    // genuine race between two concurrent confirmations.
    if (err instanceof Object && 'code' in err && (err as { code?: string }).code === 'P2002') {
      return { success: false, reason: 'telegram_already_linked' };
    }
    throw err;
  }
}

export async function disconnectConnection(siteNexisUserId: string): Promise<boolean> {
  const existing = await db.telegramConnection.findUnique({ where: { siteNexisUserId } });
  if (!existing || existing.status === 'disconnected') return false;

  await db.telegramConnection.update({ where: { id: existing.id }, data: { status: 'disconnected' } });
  await db.telegramConnectionEvent.create({
    data: {
      telegramConnectionId: existing.id,
      siteNexisUserId,
      telegramUserId: existing.telegramUserId,
      eventType: 'DISCONNECTED',
    },
  });
  return true;
}

export async function setActiveDomain(telegramUserId: string, domain: string): Promise<boolean> {
  const existing = await db.telegramConnection.findUnique({ where: { telegramUserId } });
  if (!existing || existing.status !== 'linked') return false;

  await db.telegramConnection.update({ where: { id: existing.id }, data: { activeDomain: domain } });
  await db.telegramConnectionEvent.create({
    data: {
      telegramConnectionId: existing.id,
      siteNexisUserId: existing.siteNexisUserId,
      telegramUserId,
      eventType: 'ACTIVE_DOMAIN_CHANGED',
      metadata: { domain } as Prisma.InputJsonValue,
    },
  });
  return true;
}

export async function touchLastInteraction(telegramUserId: string): Promise<void> {
  await db.telegramConnection.updateMany({ where: { telegramUserId }, data: { lastInteractionAt: new Date() } });
}

export interface TelegramNotificationPreferenceRecord {
  notifyOnComplete: boolean;
  notifyOnPartial: boolean;
  notifyOnFailed: boolean;
  notifyOnStalled: boolean;
}

export async function getNotificationPreference(connectionId: string): Promise<TelegramNotificationPreferenceRecord | null> {
  return db.telegramNotificationPreference.findUnique({
    where: { telegramConnectionId: connectionId },
    select: { notifyOnComplete: true, notifyOnPartial: true, notifyOnFailed: true, notifyOnStalled: true },
  });
}

export async function updateNotificationPreference(
  connectionId: string,
  input: Partial<TelegramNotificationPreferenceRecord>,
): Promise<void> {
  await db.telegramNotificationPreference.upsert({
    where: { telegramConnectionId: connectionId },
    create: { telegramConnectionId: connectionId, ...input },
    update: input,
  });
}

export interface UserWebsiteSummary {
  domain: string;
  latestAuditId: string;
  latestStatus: string;
  latestAt: Date;
}

/**
 * A user's "websites" are implicit — whatever domains appear in their own
 * audit history. Always scoped to userId; there is no cross-user domain
 * lookup path anywhere in this function. De-duplicated to the most recent
 * audit per domain.
 */
export async function getUserWebsiteDomains(userId: string): Promise<UserWebsiteSummary[]> {
  const audits = await db.audit.findMany({
    where: { userId, archivedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, domain: true, status: true, createdAt: true },
  });

  const byDomain = new Map<string, UserWebsiteSummary>();
  for (const audit of audits) {
    if (byDomain.has(audit.domain)) continue;
    byDomain.set(audit.domain, { domain: audit.domain, latestAuditId: audit.id, latestStatus: audit.status, latestAt: audit.createdAt });
  }
  return [...byDomain.values()];
}

export type { TelegramConnectionEventType };
