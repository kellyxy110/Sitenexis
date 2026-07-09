import { type User, type Plan } from '../../generated';
export type { User };
export declare function getUserById(id: string): Promise<User | null>;
export declare function getUserByEmail(email: string): Promise<User | null>;
export declare function upsertUser(id: string, email: string): Promise<User>;
export declare function updateUserPlan(id: string, plan: Plan): Promise<void>;
export declare function updateStripeCustomerId(id: string, customerId: string): Promise<void>;
//# sourceMappingURL=users.d.ts.map