import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError, unauthorizedResponse } from '@/lib/auth';
import { getAdById, softDeleteAd } from '@sitenexis/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const ad = await getAdById(id);

    if (!ad) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (ad.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    return NextResponse.json(ad);
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse();
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const ad = await getAdById(id);

    if (!ad) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (ad.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await softDeleteAd(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse();
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
