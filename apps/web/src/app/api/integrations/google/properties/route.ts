export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { z } from 'zod';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { getValidAccessToken, GoogleTokenError } from '@/lib/google/token-manager';
import { clientWithAccessToken } from '@/lib/google/oauth-client';

/** GET — list the connected Google account's available GA4 properties + Search Console sites to choose from. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(user.id);
  } catch (err) {
    if (err instanceof GoogleTokenError) {
      return NextResponse.json({ error: 'Google is not connected, or the connection has expired. Reconnect from Integrations.' }, { status: 409 });
    }
    throw err;
  }

  const auth = clientWithAccessToken(accessToken);

  const [ga4Properties, gscSites] = await Promise.all([
    listGa4Properties(auth).catch((err: unknown) => {
      logger.warn({ userId: user.id, err: err instanceof Error ? err.message : String(err) }, 'Listing GA4 properties failed');
      return [];
    }),
    listGscSites(auth).catch((err: unknown) => {
      logger.warn({ userId: user.id, err: err instanceof Error ? err.message : String(err) }, 'Listing Search Console sites failed');
      return [];
    }),
  ]);

  return NextResponse.json({ ga4Properties, gscSites });
}

async function listGa4Properties(auth: ReturnType<typeof clientWithAccessToken>) {
  const analyticsAdmin = google.analyticsadmin({ version: 'v1beta', auth });
  const { data } = await analyticsAdmin.accountSummaries.list({ pageSize: 200 });
  const properties: Array<{ propertyId: string; propertyName: string; accountName: string }> = [];
  for (const account of data.accountSummaries ?? []) {
    for (const prop of account.propertySummaries ?? []) {
      if (!prop.property || !prop.displayName) continue;
      properties.push({
        propertyId: prop.property.replace(/^properties\//, ''),
        propertyName: prop.displayName,
        accountName: account.displayName ?? 'Unknown account',
      });
    }
  }
  return properties;
}

async function listGscSites(auth: ReturnType<typeof clientWithAccessToken>) {
  const searchConsole = google.searchconsole({ version: 'v1', auth });
  const { data } = await searchConsole.sites.list();
  return (data.siteEntry ?? [])
    .filter((s) => s.siteUrl && s.permissionLevel !== 'siteUnverifiedUser')
    .map((s) => ({ siteUrl: s.siteUrl!, permissionLevel: s.permissionLevel ?? 'unknown' }));
}

const SelectPropertiesSchema = z.object({
  ga4PropertyId: z.string().min(1).optional(),
  ga4PropertyName: z.string().min(1).optional(),
  gscSiteUrl: z.string().min(1).optional(),
  gscSiteName: z.string().min(1).optional(),
});

/** POST — save the user's chosen GA4 property + Search Console site. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = SelectPropertiesSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Only forward fields actually present in this request — each picker selection
  // (GA4 property, GSC site) saves independently, and must not null out whichever
  // property wasn't part of this particular click.
  const { setGoogleConnectionProperties } = await import('@sitenexis/db');
  await setGoogleConnectionProperties(user.id, {
    ...(parsed.data.ga4PropertyId !== undefined && { ga4PropertyId: parsed.data.ga4PropertyId }),
    ...(parsed.data.ga4PropertyName !== undefined && { ga4PropertyName: parsed.data.ga4PropertyName }),
    ...(parsed.data.gscSiteUrl !== undefined && { gscSiteUrl: parsed.data.gscSiteUrl }),
    ...(parsed.data.gscSiteName !== undefined && { gscSiteName: parsed.data.gscSiteName }),
  });

  return NextResponse.json({ ok: true });
}
