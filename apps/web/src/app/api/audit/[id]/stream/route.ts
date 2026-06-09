export const dynamic = 'force-dynamic';
export const maxDuration = 300;
import { type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDemoAudit } from '@/lib/demo-store';
import { isFullyConfigured } from '@/lib/mode';

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
  // Soft auth — validates ownership per audit, doesn't block demo streams on auth failure
  let userId: string | null = null;
  try {
    const user = await requireAuth(req);
    userId = user.id;
  } catch { /* unauthenticated — will 404 on real audits, demo proceeds */ }

  const { id } = await params;
  const signal = req.signal;
  const encoder = new TextEncoder();

  const send = (controller: ReadableStreamDefaultController, payload: Record<string, unknown>) => {
    try { controller.enqueue(sseMsg(payload, encoder)); } catch { /* controller already closed */ }
  };

  // ── Demo mode ────────────────────────────────────────────────────────────────
  const demoAudit = getDemoAudit(id);
  if (demoAudit || !isFullyConfigured()) {
    const stream = new ReadableStream({
      async start(controller) {
        if (!demoAudit) {
          send(controller, { error: 'Audit not found' });
          controller.close();
          return;
        }

        let lastPageCount = -1;
        let lastStage = '';
        const deadline = Date.now() + 90_000;

        while (Date.now() < deadline && !signal.aborted) {
          const audit = getDemoAudit(id);
          if (!audit) break;

          const pc = audit.pageCount ?? 0;

          if (audit.status === 'running' && lastPageCount === -1) {
            lastPageCount = 0;
            send(controller, { status: 'running', stage: 'crawl' });
            lastStage = 'crawl';
          }

          if (pc > 0 && pc !== lastPageCount) {
            lastPageCount = pc;
            const stage =
              pc <= 2 ? 'crawl' :
              pc <= 4 ? 'seo' :
              pc <= 6 ? 'ai' :
              pc === 7 ? 'schema' : 'links';

            if (stage !== lastStage) {
              lastStage = stage;
              send(controller, { status: 'running', stage, pagesCount: pc });
            } else {
              send(controller, { pagesCount: pc });
            }
          }

          if (audit.status === 'complete') {
            send(controller, { stage: 'report', message: 'Finalising report…' });
            await new Promise<void>((r) => setTimeout(r, 200));
            send(controller, {
              status: 'complete',
              pagesCount: audit.pageCount ?? 0,
              issuesCount: audit.issues.length,
            });
            controller.close();
            return;
          }

          if (audit.status === 'failed') {
            send(controller, { status: 'failed', error: 'Audit failed. Please try again.' });
            controller.close();
            return;
          }

          await new Promise<void>((r) => setTimeout(r, 250));
        }

        if (!signal.aborted) {
          send(controller, { error: 'Audit stream timed out.' });
        }
        try { controller.close(); } catch { /* already closed */ }
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
  }

  // ── Real mode ─────────────────────────────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { getAuditById } = await import('@sitenexis/db');

        const initial = await getAuditById(id);
        if (!initial || (userId !== null && initial.userId !== userId)) {
          send(controller, { error: 'Audit not found' });
          controller.close();
          return;
        }

        let lastStatus: string = initial.status;
        if (initial.status === 'running' || initial.status === 'queued') {
          send(controller, { status: 'running', stage: 'crawl' });
        }

        const deadline = Date.now() + 600_000;

        while (Date.now() < deadline && !signal.aborted) {
          const audit = await getAuditById(id);
          if (!audit) break;

          if (audit.status !== lastStatus) {
            lastStatus = audit.status;
            if (audit.status === 'running') {
              send(controller, { status: 'running', stage: 'crawl' });
            } else if (audit.status === 'complete') {
              send(controller, { stage: 'report', message: 'Finalising report…' });
              await new Promise<void>((r) => setTimeout(r, 300));
              send(controller, { status: 'complete', pagesCount: audit.pageCount ?? 0 });
              controller.close();
              return;
            } else if (audit.status === 'failed') {
              send(controller, { status: 'failed', error: 'Audit failed. Please try again.' });
              controller.close();
              return;
            }
          }

          await new Promise<void>((r) => setTimeout(r, 2_000));
        }

        if (!signal.aborted) {
          send(controller, { error: 'Audit timed out after 10 minutes.' });
        }
        try { controller.close(); } catch { /* already closed */ }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error';
        send(controller, { error: msg });
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
