import type { ScheduledReport } from '../../generated';
export type { ScheduledReport };
export declare function getScheduledReports(userId: string): Promise<ScheduledReport[]>;
export declare function createScheduledReport(userId: string, email: string, frequency: string, domain?: string, dayOfWeek?: number, hour?: number): Promise<ScheduledReport>;
export declare function deleteScheduledReport(userId: string, id: string): Promise<void>;
export declare function updateScheduledReportSentAt(id: string): Promise<void>;
export declare function getDueScheduledReports(): Promise<ScheduledReport[]>;
//# sourceMappingURL=scheduled-reports.d.ts.map