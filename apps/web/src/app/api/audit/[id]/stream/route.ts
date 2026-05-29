import { type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDemoAudit } from '@/lib/demo-store';
import { isFullyConfigured } from '@/lib/mode';

interface Params {
  params: Promise<{ id: string }>;
}

function stageFromPageCount(pageCount: number): string {
  if (pageCount === 0) return 'crawl';
  if (pageCount < 4)  return 'seo';
  if (pageCount < 6)  return 'ai';
  if (pageCount < 7)  return 'schema';
  return 'links';
}

function statusMessage(status: string, pageCount: number, stage: string): string {
  if (status === 'queued')   return 'Waiting to start...';
  if (status === 'complete') return 'Audit complete — redirecting...';
  if (status === 'failed')   return 'Audit failed.';
  const labels: Record<string, string> = {
    crawl:  `Crawled ${pageCount} pages so far...`,
    seo:    `Analysing SEO signals across ${pageCount} pages...`,
    ai:     `Scoring AI readability — this may take a moment...`,
    schema: `Validating structured data...`,
    links:  `Building internal link graph...`,
    report: `Finalising results...`,
  };
  return labels[stage] ?? 'Processing...';
}

function demoStream(id: string): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>): void => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // already closed
        }
      };

      const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      let pollCount = 0;

      while (pollCount++ < 60) {
        const audit = getDemoAudit(id);
        if (!audit) {
          send({ error: 'Audit not found.' });
          controller.close();
          return;
        }

        const pc    = audit.pageCount ?? 0;
        const stage = audit.status === 'complete' ? 'report' : stageFromPageCount(pc);

        send({
          status:      audit.status,
          stage,
          pagesCount:  pc,
          issuesCount: audit.status === 'complete' ? (audit.issues?.length ?? 0) : 0,
          message:     statusMessage(audit.status, pc, stage),
        });

        if (audit.status === 'complete' || audit.status === 'failed') {
          controller.close();
          return;
        }

        await delay(500);
      }

      send({ status: 'failed', error: 'Audit timed out.' });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-store',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function GET(req: NextRequest, { params }: Params): Promise<Response> {
  try {
    await requireAuth(req);
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await params;

  // Always try demo store first — covers demo mode and fallback from failed real mode
  if (!isFullyConfigured() || getDemoAudit(id)) {
    return demoStream(id);
  }

  // ── Real mode ─────────────────────────────────────────────────────────────
  try {
    const { getAuditById, db } = await import('@sitenexis/db');

    const initial = await getAuditById(id);
    if (!initial) return new Response('Not found', { status: 404 });

    const encoder = new TextEncoder();

    async function countIssues(auditId: string): Promise<number> {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await (db as any).issue.count({ where: { auditId } });
      } catch {
        return 0;
      }
    }

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>): void => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch { /* closed */ }
        };

        const heartbeat = setInterval(() => send({ heartbeat: true }), 15_000);
        let pollCount = 0;

        const poll = async (): Promise<void> => {
          if (pollCount++ > 300) {
            send({ status: 'failed', error: 'Audit timed out.' });
            clearInterval(heartbeat);
            controller.close();
            return;
          }

          const audit = await getAuditById(id);
          if (!audit) {
            send({ error: 'Audit not found.' });
            clearInterval(heartbeat);
            controller.close();
            return;
          }

          const issuesCount = await countIssues(id);
          const pc    = audit.pageCount ?? 0;
          const stage = audit.status === 'running' ? (pc ? 'seo' : 'crawl') : 'report';

          send({
            status:     audit.status,
            stage,
            pagesCount: pc,
            issuesCount,
            message:    statusMessage(audit.status, pc, stage),
            updatedAt:  audit.updatedAt,
          });

          if (audit.status === 'complete' || audit.status === 'failed') {
            clearInterval(heartbeat);
            controller.close();
            return;
          }

          await new Promise<void>((r) => setTimeout(r, 2000));
          await poll();
        };

        try {
          await poll();
        } catch {
          clearInterval(heartbeat);
          try { controller.close(); } catch { /* already closed */ }
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type':      'text/event-stream',
        'Cache-Control':     'no-cache, no-store',
        'Connection':        'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch {
    // DB unreachable — fall back to demo stream (will show "not found" if ID isn't in demo store)
    return demoStream(id);
  }
}
