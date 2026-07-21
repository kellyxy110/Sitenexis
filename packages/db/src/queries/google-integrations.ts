import type { Prisma, GoogleConnectionStatus, GoogleSyncProvider, GoogleSyncStatus, AiVisibilityInsightType, IssueSeverity } from '../../generated';
import { db } from '../client';

/**
 * AI Visibility Intelligence Center — Google (GA4 + Search Console) query helpers.
 *
 * Tenant boundary: every function below takes `userId` and scopes strictly to it —
 * there is no separate Organization model. Callers MUST pass the authenticated
 * user's own id, never a client-supplied value, or tenant isolation breaks.
 */

// ─── Google Connection ────────────────────────────────────────────────────────

export interface GoogleConnectionRecord {
  id: string;
  userId: string;
  googleAccountEmail: string;
  scopes: string[];
  tokenExpiresAt: Date;
  status: GoogleConnectionStatus;
  lastError: string | null;
  ga4PropertyId: string | null;
  ga4PropertyName: string | null;
  gscSiteUrl: string | null;
  gscSiteName: string | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function toConnectionRecord(row: {
  id: string; userId: string; googleAccountEmail: string; scopes: string[];
  tokenExpiresAt: Date; status: GoogleConnectionStatus; lastError: string | null;
  ga4PropertyId: string | null; ga4PropertyName: string | null;
  gscSiteUrl: string | null; gscSiteName: string | null;
  lastSyncedAt: Date | null; createdAt: Date; updatedAt: Date;
}): GoogleConnectionRecord {
  return row;
}

/** Fetch the caller's own Google connection, or null if never connected / disconnected. */
export async function getGoogleConnection(userId: string): Promise<GoogleConnectionRecord | null> {
  const row = await db.googleConnection.findFirst({ where: { userId, archivedAt: null } });
  return row ? toConnectionRecord(row) : null;
}

/** Same as above but includes encrypted token ciphertext — server-side sync jobs only. Never return this over an API response. */
export async function getGoogleConnectionWithTokens(userId: string): Promise<
  (GoogleConnectionRecord & { accessTokenEncrypted: string; refreshTokenEncrypted: string }) | null
> {
  const row = await db.googleConnection.findFirst({ where: { userId, archivedAt: null } });
  return row ? { ...toConnectionRecord(row), accessTokenEncrypted: row.accessTokenEncrypted, refreshTokenEncrypted: row.refreshTokenEncrypted } : null;
}

/** Create or replace the caller's Google connection after a successful OAuth exchange. One connection per user. */
export async function upsertGoogleConnection(params: {
  userId: string;
  googleAccountEmail: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  scopes: string[];
  tokenExpiresAt: Date;
}): Promise<GoogleConnectionRecord> {
  const row = await db.googleConnection.upsert({
    where: { userId: params.userId },
    create: {
      userId: params.userId,
      googleAccountEmail: params.googleAccountEmail,
      accessTokenEncrypted: params.accessTokenEncrypted,
      refreshTokenEncrypted: params.refreshTokenEncrypted,
      scopes: params.scopes,
      tokenExpiresAt: params.tokenExpiresAt,
      status: 'pending',
    },
    update: {
      googleAccountEmail: params.googleAccountEmail,
      accessTokenEncrypted: params.accessTokenEncrypted,
      refreshTokenEncrypted: params.refreshTokenEncrypted,
      scopes: params.scopes,
      tokenExpiresAt: params.tokenExpiresAt,
      status: 'pending',
      lastError: null,
      archivedAt: null,
    },
  });
  return toConnectionRecord(row);
}

/**
 * Persist the user's chosen GA4 property and/or GSC site, marking the connection live.
 * Merges — a field omitted from `params` (undefined) leaves the existing stored value
 * untouched. Selecting a GA4 property must never blow away an already-saved GSC site,
 * and vice versa, since the picker UI saves each selection independently.
 */
export async function setGoogleConnectionProperties(userId: string, params: {
  ga4PropertyId?: string | null;
  ga4PropertyName?: string | null;
  gscSiteUrl?: string | null;
  gscSiteName?: string | null;
}): Promise<void> {
  const data: Prisma.GoogleConnectionUpdateInput = { status: 'connected' };
  if (params.ga4PropertyId !== undefined) data.ga4PropertyId = params.ga4PropertyId;
  if (params.ga4PropertyName !== undefined) data.ga4PropertyName = params.ga4PropertyName;
  if (params.gscSiteUrl !== undefined) data.gscSiteUrl = params.gscSiteUrl;
  if (params.gscSiteName !== undefined) data.gscSiteName = params.gscSiteName;
  await db.googleConnection.update({ where: { userId }, data });
}

/** Update just the encrypted access token + expiry after a refresh-token exchange. */
export async function refreshGoogleAccessToken(userId: string, params: {
  accessTokenEncrypted: string;
  tokenExpiresAt: Date;
}): Promise<void> {
  await db.googleConnection.update({
    where: { userId },
    data: { accessTokenEncrypted: params.accessTokenEncrypted, tokenExpiresAt: params.tokenExpiresAt, status: 'connected', lastError: null },
  });
}

/** Mark the connection as expired/error — surfaced in the dashboard's connector health state. */
export async function setGoogleConnectionError(userId: string, status: 'expired' | 'error', errorMessage: string): Promise<void> {
  await db.googleConnection.update({
    where: { userId },
    data: { status, lastError: errorMessage.slice(0, 500) },
  });
}

export async function touchGoogleConnectionSynced(userId: string): Promise<void> {
  await db.googleConnection.update({ where: { userId }, data: { lastSyncedAt: new Date() } });
}

/** Soft-delete — disconnect. Tokens remain until overwritten by a future upsert, but the connection is no longer active. */
export async function disconnectGoogleConnection(userId: string): Promise<void> {
  await db.googleConnection.update({ where: { userId }, data: { archivedAt: new Date(), status: 'pending' } });
}

/** All connections ready to sync — status connected AND at least one property selected. Used by the daily cron. */
export async function getAllSyncableGoogleConnections(): Promise<GoogleConnectionRecord[]> {
  const rows = await db.googleConnection.findMany({
    where: {
      status: 'connected',
      archivedAt: null,
      OR: [{ ga4PropertyId: { not: null } }, { gscSiteUrl: { not: null } }],
    },
  });
  return rows.map(toConnectionRecord);
}

// ─── Sync log (connector health + admin operations view) ────────────────────

export async function logGoogleSync(params: {
  connectionId: string;
  userId: string;
  provider: GoogleSyncProvider;
  status: GoogleSyncStatus;
  recordsSynced?: number;
  errorMessage?: string | null;
  startedAt: Date;
  completedAt: Date;
}): Promise<void> {
  await db.googleSyncLog.create({
    data: {
      connectionId: params.connectionId,
      userId: params.userId,
      provider: params.provider,
      status: params.status,
      recordsSynced: params.recordsSynced ?? 0,
      errorMessage: params.errorMessage ?? null,
      durationMs: params.completedAt.getTime() - params.startedAt.getTime(),
      startedAt: params.startedAt,
      completedAt: params.completedAt,
    },
  });
}

export async function getLatestGoogleSyncLogs(userId: string, limit = 10) {
  return db.googleSyncLog.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit });
}

// ─── GA4 — daily traffic ──────────────────────────────────────────────────────

export interface DailyTrafficRow {
  date: Date;
  sessions: number;
  activeUsers: number;
  newUsers: number;
  engagedSessions: number;
  avgEngagementTimeSec: number;
  keyEvents: number;
  deviceBreakdown: Record<string, number>;
  countryBreakdown: Record<string, number>;
}

export async function upsertDailyTrafficMetrics(userId: string, rows: DailyTrafficRow[]): Promise<void> {
  if (rows.length === 0) return;
  await db.$transaction(
    rows.map((r) =>
      db.dailyTrafficMetric.upsert({
        where: { userId_date: { userId, date: r.date } },
        create: { userId, ...r, deviceBreakdown: r.deviceBreakdown as Prisma.InputJsonValue, countryBreakdown: r.countryBreakdown as Prisma.InputJsonValue },
        update: { ...r, deviceBreakdown: r.deviceBreakdown as Prisma.InputJsonValue, countryBreakdown: r.countryBreakdown as Prisma.InputJsonValue },
      }),
    ),
  );
}

export async function getDailyTrafficMetrics(userId: string, from: Date, to: Date) {
  return db.dailyTrafficMetric.findMany({ where: { userId, date: { gte: from, lte: to } }, orderBy: { date: 'asc' } });
}

// ─── GA4 — acquisition channels ───────────────────────────────────────────────

export interface AcquisitionChannelRow {
  date: Date;
  channelGroup: string;
  source: string;
  sessions: number;
  activeUsers: number;
  isAiReferral: boolean;
}

export async function upsertAcquisitionChannelMetrics(userId: string, rows: AcquisitionChannelRow[]): Promise<void> {
  if (rows.length === 0) return;
  await db.$transaction(
    rows.map((r) =>
      db.acquisitionChannelMetric.upsert({
        where: { userId_date_channelGroup_source: { userId, date: r.date, channelGroup: r.channelGroup, source: r.source } },
        create: { userId, ...r },
        update: { sessions: r.sessions, activeUsers: r.activeUsers, isAiReferral: r.isAiReferral },
      }),
    ),
  );
}

export async function getAcquisitionChannelMetrics(userId: string, from: Date, to: Date) {
  return db.acquisitionChannelMetric.findMany({ where: { userId, date: { gte: from, lte: to } }, orderBy: { date: 'asc' } });
}

export async function getAiReferralMetrics(userId: string, from: Date, to: Date) {
  return db.acquisitionChannelMetric.findMany({ where: { userId, isAiReferral: true, date: { gte: from, lte: to } }, orderBy: { date: 'asc' } });
}

// ─── GA4 — landing pages ──────────────────────────────────────────────────────

export interface LandingPageRow {
  date: Date;
  pagePath: string;
  sessions: number;
  activeUsers: number;
  avgEngagementTimeSec: number;
  keyEvents: number;
}

export async function upsertLandingPageMetrics(userId: string, rows: LandingPageRow[]): Promise<void> {
  if (rows.length === 0) return;
  await db.$transaction(
    rows.map((r) =>
      db.landingPageMetric.upsert({
        where: { userId_date_pagePath: { userId, date: r.date, pagePath: r.pagePath } },
        create: { userId, ...r },
        update: { sessions: r.sessions, activeUsers: r.activeUsers, avgEngagementTimeSec: r.avgEngagementTimeSec, keyEvents: r.keyEvents },
      }),
    ),
  );
}

export async function getLandingPageMetrics(userId: string, from: Date, to: Date) {
  return db.landingPageMetric.findMany({ where: { userId, date: { gte: from, lte: to } }, orderBy: { sessions: 'desc' } });
}

// ─── GSC — search visibility ──────────────────────────────────────────────────

export interface SearchVisibilityRow {
  date: Date;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
}

export async function upsertSearchVisibilityMetrics(userId: string, rows: SearchVisibilityRow[]): Promise<void> {
  if (rows.length === 0) return;
  await db.$transaction(
    rows.map((r) =>
      db.searchVisibilityMetric.upsert({
        where: { userId_date: { userId, date: r.date } },
        create: { userId, ...r },
        update: { clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, avgPosition: r.avgPosition },
      }),
    ),
  );
}

export async function getSearchVisibilityMetrics(userId: string, from: Date, to: Date) {
  return db.searchVisibilityMetric.findMany({ where: { userId, date: { gte: from, lte: to } }, orderBy: { date: 'asc' } });
}

// ─── GSC — top queries ─────────────────────────────────────────────────────────

export interface SearchQueryRow {
  date: Date;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
}

export async function upsertSearchQueryMetrics(userId: string, rows: SearchQueryRow[]): Promise<void> {
  if (rows.length === 0) return;
  await db.$transaction(
    rows.map((r) =>
      db.searchQueryMetric.upsert({
        where: { userId_date_query: { userId, date: r.date, query: r.query } },
        create: { userId, ...r },
        update: { clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, avgPosition: r.avgPosition },
      }),
    ),
  );
}

export async function getTopSearchQueries(userId: string, from: Date, to: Date, limit = 20) {
  return db.searchQueryMetric.findMany({ where: { userId, date: { gte: from, lte: to } }, orderBy: { clicks: 'desc' }, take: limit });
}

// ─── GSC — top pages ───────────────────────────────────────────────────────────

export interface SearchPageRow {
  date: Date;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
}

export async function upsertSearchPageMetrics(userId: string, rows: SearchPageRow[]): Promise<void> {
  if (rows.length === 0) return;
  await db.$transaction(
    rows.map((r) =>
      db.searchPageMetric.upsert({
        where: { userId_date_page: { userId, date: r.date, page: r.page } },
        create: { userId, ...r },
        update: { clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, avgPosition: r.avgPosition },
      }),
    ),
  );
}

export async function getTopSearchPages(userId: string, from: Date, to: Date, limit = 20) {
  return db.searchPageMetric.findMany({ where: { userId, date: { gte: from, lte: to } }, orderBy: { clicks: 'desc' }, take: limit });
}

/** Sums clicks/impressions per unique page across a date range — used to compute visibility gains/losses between two periods. */
export async function getAggregatedSearchPageMetrics(userId: string, from: Date, to: Date) {
  const rows = await db.searchPageMetric.groupBy({
    by: ['page'],
    where: { userId, date: { gte: from, lte: to } },
    _sum: { clicks: true, impressions: true },
  });
  return rows.map((r) => ({ page: r.page, clicks: r._sum.clicks ?? 0, impressions: r._sum.impressions ?? 0 }));
}

// ─── Deterministic insights ────────────────────────────────────────────────────

export interface AiVisibilityInsightInput {
  auditId?: string | null;
  type: AiVisibilityInsightType;
  affectedPage: string;
  evidence: Record<string, unknown>;
  confidence: number;
  recommendedAction: string;
  verificationMethod: string;
  severity?: IssueSeverity;
}

export async function saveAiVisibilityInsights(userId: string, insights: AiVisibilityInsightInput[]): Promise<void> {
  if (insights.length === 0) return;
  await db.aiVisibilityInsight.createMany({
    data: insights.map((i) => ({
      userId,
      auditId: i.auditId ?? null,
      type: i.type,
      affectedPage: i.affectedPage,
      evidence: i.evidence as Prisma.InputJsonValue,
      confidence: i.confidence,
      recommendedAction: i.recommendedAction,
      verificationMethod: i.verificationMethod,
      severity: i.severity ?? 'info',
    })),
  });
}

export async function getAiVisibilityInsights(userId: string, limit = 50) {
  return db.aiVisibilityInsight.findMany({ where: { userId, archivedAt: null }, orderBy: { createdAt: 'desc' }, take: limit });
}

/** Replace all non-archived insights for a user — sync jobs recompute the full set each run rather than diffing. */
export async function replaceAiVisibilityInsights(userId: string, insights: AiVisibilityInsightInput[]): Promise<void> {
  await db.$transaction([
    db.aiVisibilityInsight.updateMany({ where: { userId, archivedAt: null }, data: { archivedAt: new Date() } }),
    ...(insights.length > 0
      ? [
          db.aiVisibilityInsight.createMany({
            data: insights.map((i) => ({
              userId,
              auditId: i.auditId ?? null,
              type: i.type,
              affectedPage: i.affectedPage,
              evidence: i.evidence as Prisma.InputJsonValue,
              confidence: i.confidence,
              recommendedAction: i.recommendedAction,
              verificationMethod: i.verificationMethod,
              severity: i.severity ?? 'info',
            })),
          }),
        ]
      : []),
  ]);
}
