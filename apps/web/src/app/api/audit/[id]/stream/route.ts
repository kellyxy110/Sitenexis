export const dynamic = 'force-dynamic';
export const maxDuration = 300;
import { type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';

interface Params { params: Promise<{ id: string }> }

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;

function sseMsg(payload: Record<string, unknown>, encoder: TextEncoder): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function GET(req: NextRequest, { params }: Params): Promise<Response> {
  let userId: string;
  try {
    const user = await requireAuth(req);
    userId = user.id;
  } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { id } = await params;
  const signal = req.signal;
  const encoder = new TextEncoder();

  const send = (controller: ReadableStreamDefaultController, payload: Record<string, unknown>) => {
    try { controller.enqueue(sseMsg(payload, encoder)); } catch { /* controller already closed */ }
  };

  const stream = new ReadableStream({
    async start(controller) {
      send(controller, { status: 'partial', stage: 'connecting', timestamp: new Date().toISOString() });

      let lastKeepalive = Date.now();
      let consecutiveErrors = 0;

      try {
        const { getAuditById } = await import('@sitenexis/db');

        const initial = await getAuditById(id);
        if (!initial || initial.userId !== userId) {
          send(controller, { error: 'Audit not found' });
          controller.close();
          return;
        }

        let lastStatus: string = initial.status;
        if (initial.status === 'running' || initial.status === 'queued') {
          send(controller, { status: 'running', stage: 'crawl', timestamp: new Date().toISOString() });
        }

        const deadline = Date.now() + 600_000;

        while (Date.now() < deadline && !signal.aborted) {
          if (Date.now() - lastKeepalive > 25_000) {
            send(controller, { type: 'ping', timestamp: new Date().toISOString() });
            lastKeepalive = Date.now();
          }

          let audit: Awaited<ReturnType<typeof getAuditById>> | null = null;
          try {
            audit = await getAuditById(id);
            consecutiveErrors = 0;
          } catch {
            consecutiveErrors += 1;
            if (consecutiveErrors >= 3) {
              send(controller, {
                status: 'degraded',
                message: 'Audit engine temporarily unavailable — retrying…',
                timestamp: new Date().toISOString(),
              });
            }
            await new Promise<void>((r) => setTimeout(r, 3_000));
            continue;
          }

          if (!audit) break;

          if (audit.status !== lastStatus) {
            lastStatus = audit.status;
            if (audit.status === 'running') {
              send(controller, { status: 'running', stage: 'crawl', timestamp: new Date().toISOString() });
            } else if (audit.status === 'complete') {
              send(controller, { stage: 'report', message: 'Finalising report…', timestamp: new Date().toISOString() });
              await new Promise<void>((r) => setTimeout(r, 300));
              send(controller, { status: 'complete', pagesCount: audit.pageCount ?? 0, timestamp: new Date().toISOString() });
              controller.close();
              return;
            } else if (audit.status === 'failed') {
              send(controller, { status: 'failed', error: 'Audit failed. Please try again.', timestamp: new Date().toISOString() });
              controller.close();
              return;
            }
          }

          await new Promise<void>((r) => setTimeout(r, 2_000));
        }

        if (!signal.aborted) {
          send(controller, { status: 'degraded', error: 'Audit timed out after 10 minutes.' });
        }
        try { controller.close(); } catch { /* already closed */ }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error';
        send(controller, { status: 'degraded', error: msg, timestamp: new Date().toISOString() });
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
