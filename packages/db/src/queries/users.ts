import { type User, type Plan } from '../../generated';
import { db } from '../client';

export type { User };

export async function getUserById(id: string): Promise<User | null> {
  return db.user.findFirst({ where: { id, archivedAt: null } });
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return db.user.findFirst({ where: { email, archivedAt: null } });
}

export async function upsertUser(id: string, email: string): Promise<User> {
  return db.user.upsert({
    where: { id },
    create: { id, email },
    update: { email },
  });
}

export async function updateUserPlan(id: string, plan: Plan): Promise<void> {
  await db.user.update({ where: { id }, data: { plan } });
}

export async function updateStripeCustomerId(id: string, customerId: string): Promise<void> {
  await db.user.update({ where: { id }, data: { stripeCustomerId: customerId } });
}
