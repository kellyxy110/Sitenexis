import { PLAN_LIMITS } from '@sitenexis/shared';
import { getUserById, countAuditsThisMonth } from '@sitenexis/db';

export async function checkAuditLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const user = await getUserById(userId);
  if (!user) return { allowed: false, reason: 'User not found' };

  const limits = PLAN_LIMITS[user.plan];
  if (limits.auditsPerMonth === -1) return { allowed: true };

  const used = await countAuditsThisMonth(userId);
  if (used >= limits.auditsPerMonth) {
    return {
      allowed: false,
      reason: `You have used ${used}/${limits.auditsPerMonth} audits this month. Upgrade to run more.`,
    };
  }

  return { allowed: true };
}

export async function checkLayer4Access(userId: string): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) return false;
  return PLAN_LIMITS[user.plan].layer4Analysis;
}

export async function checkCompetitiveAccess(userId: string): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) return false;
  return PLAN_LIMITS[user.plan].competitiveAnalysis;
}
