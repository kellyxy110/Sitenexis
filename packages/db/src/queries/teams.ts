import { db } from '../client';
import type { TeamMember, TeamInvite } from '../../generated';

export type { TeamMember, TeamInvite };

export interface TeamMemberWithUser extends TeamMember {
  member: { id: string; email: string; name: string | null };
}

export async function getTeamMembers(ownerId: string): Promise<TeamMemberWithUser[]> {
  return db.teamMember.findMany({
    where: { ownerId },
    include: { member: { select: { id: true, email: true, name: true } } },
    orderBy: { joinedAt: 'asc' },
  });
}

export async function addTeamMember(ownerId: string, userId: string, role: string): Promise<TeamMember> {
  return db.teamMember.upsert({
    where: { ownerId_userId: { ownerId, userId } },
    create: { ownerId, userId, role },
    update: { role },
  });
}

export async function removeTeamMember(ownerId: string, memberId: string): Promise<void> {
  await db.teamMember.deleteMany({ where: { ownerId, id: memberId } });
}

export async function getTeamInvites(ownerId: string): Promise<TeamInvite[]> {
  return db.teamInvite.findMany({
    where: { ownerId, accepted: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createTeamInvite(
  ownerId: string,
  email: string,
  role: string,
): Promise<TeamInvite> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  return db.teamInvite.create({ data: { ownerId, email, role, expiresAt } });
}

export async function acceptTeamInvite(token: string): Promise<TeamInvite | null> {
  const invite = await db.teamInvite.findUnique({ where: { token } });
  if (!invite || invite.accepted || invite.expiresAt < new Date()) return null;
  return db.teamInvite.update({ where: { token }, data: { accepted: true } });
}

export async function isTeamMemberOf(ownerId: string, userId: string): Promise<boolean> {
  const m = await db.teamMember.findUnique({
    where: { ownerId_userId: { ownerId, userId } },
  });
  return m !== null;
}
