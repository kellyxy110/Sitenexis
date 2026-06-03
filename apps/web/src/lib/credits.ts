import type { CreditAction } from './credits-config';
export { CREDIT_COSTS, CREDIT_ACTION_LABELS, CREDIT_PACKS } from './credits-config';
export type { CreditAction } from './credits-config';

// ── Server-only: credit checking + deduction ────────────────────────────────

export async function checkAndDeductCredits(
  userId: string,
  action: CreditAction,
  metadata?: Record<string, unknown>,
): Promise<{ allowed: boolean; reason?: string }> {
  const { getUserCredits, deductCredits } = await import('@sitenexis/db');

  const { balance, isUnlimited } = await getUserCredits(userId);
  const cost = CREDIT_COSTS[action];

  if (!isUnlimited && balance < cost) {
    return {
      allowed: false,
      reason: `Insufficient credits. This action costs ${cost} credit${cost !== 1 ? 's' : ''}. You have ${balance} credit${balance !== 1 ? 's' : ''} remaining. Purchase more credits to continue.`,
    };
  }

  const success = await deductCredits(
    userId,
    cost,
    action,
    CREDIT_ACTION_LABELS[action],
    metadata,
  );

  if (!success) {
    return { allowed: false, reason: 'Credit deduction failed. Please try again.' };
  }

  return { allowed: true };
}
