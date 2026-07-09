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
export declare function getUserCredits(userId: string): Promise<CreditBalance>;
export declare function deductCredits(userId: string, amount: number, actionType: string, description?: string, metadata?: Record<string, unknown>): Promise<boolean>;
export declare function addCredits(userId: string, amount: number, actionType: string, description?: string): Promise<void>;
export declare function getCreditHistory(userId: string, limit?: number): Promise<CreditTransactionRecord[]>;
//# sourceMappingURL=credits.d.ts.map