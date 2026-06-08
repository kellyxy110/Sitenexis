import { db } from '../client';
import type { ScheduledReport } from '../../generated';

export type { ScheduledReport };

function nextSendDate(frequency: string, hour: number, dayOfWeek?: number | null): Date {
  const now = new Date();
  const d = new Date(now);
  d.setSeconds(0, 0);

  if (frequency === 'daily') {
    d.setHours(hour, 0, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
  } else if (frequency === 'weekly') {
    const target = dayOfWeek ?? 1; // Monday default
    const diff = (target - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    d.setHours(hour, 0, 0, 0);
  } else {
    // monthly — 1st of next month
    d.setMonth(d.getMonth() + 1, 1);
    d.setHours(hour, 0, 0, 0);
  }

  return d;
}

export async function getScheduledReports(userId: string): Promise<ScheduledReport[]> {
  return db.scheduledReport.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createScheduledReport(
  userId: string,
  email: string,
  frequency: string,
  domain?: string,
  dayOfWeek?: number,
  hour = 8,
): Promise<ScheduledReport> {
  const nextSendAt = nextSendDate(frequency, hour, dayOfWeek);
  return db.scheduledReport.create({
    data: {
      userId,
      email,
      frequency,
      domain: domain ?? null,
      ...(dayOfWeek !== undefined ? { dayOfWeek } : {}),
      hour,
      nextSendAt,
    },
  });
}

export async function deleteScheduledReport(userId: string, id: string): Promise<void> {
  await db.scheduledReport.deleteMany({ where: { id, userId } });
}

export async function updateScheduledReportSentAt(id: string): Promise<void> {
  const report = await db.scheduledReport.findUnique({ where: { id } });
  if (!report) return;
  const nextSendAt = nextSendDate(report.frequency, report.hour, report.dayOfWeek);
  await db.scheduledReport.update({
    where: { id },
    data: { lastSentAt: new Date(), nextSendAt },
  });
}

export async function getDueScheduledReports(): Promise<ScheduledReport[]> {
  return db.scheduledReport.findMany({
    where: { enabled: true, nextSendAt: { lte: new Date() } },
  });
}
