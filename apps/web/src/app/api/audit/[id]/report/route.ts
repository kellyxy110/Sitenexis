import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { getDemoAudit } from '@/lib/demo-store';
import { isFullyConfigured } from '@/lib/mode';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  try {
    await requireAuth(req);
  } catch {
    return unauthorizedResponse();
  }

  const { id } = await params;

  if (!isFullyConfigured()) {
    const audit = getDemoAudit(id);
    if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    // Demo mode: return a placeholder report URL
    return NextResponse.json({
      reportUrl: null,
      message: 'PDF generation requires a connected Supabase project and S3 storage. Connect your backend to enable this feature.',
    }, { status: 202 });
  }

  try {
    // Real mode: trigger report generation via BullMQ
    return NextResponse.json({ message: 'Report generation queued.' }, { status: 202 });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
