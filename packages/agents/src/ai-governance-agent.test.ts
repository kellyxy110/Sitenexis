import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({
  saveAiGovernanceReport: vi.fn(),
  emitAgentEvent: vi.fn(),
}));

vi.mock('@sitenexis/db', () => ({
  saveAiGovernanceReport: h.saveAiGovernanceReport,
}));
vi.mock('./registry', () => ({
  emitAgentEvent: h.emitAgentEvent,
}));

const { runAiGovernanceAgent } = await import('./ai-governance-agent');

const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  h.saveAiGovernanceReport.mockResolvedValue(undefined);
  h.emitAgentEvent.mockResolvedValue(undefined);
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('runAiGovernanceAgent', () => {
  it('fetches robots.txt and probes discovery resources, then persists and returns the report', async () => {
    global.fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/robots.txt')) {
        return new Response('User-agent: *\nContent-Signal: search=yes,ai-train=no,ai-input=yes,use=reference\nAllow: /\n', { status: 200 });
      }
      if (init?.method === 'HEAD') {
        return new Response(null, { status: 404 });
      }
      return new Response('', { status: 404 });
    }) as unknown as typeof fetch;

    const report = await runAiGovernanceAgent('audit-1', 'example.com');

    expect(report.contentSignal?.aiTrain).toBe('no');
    expect(report.hasLlmsTxt).toBe(false);
    expect(h.saveAiGovernanceReport).toHaveBeenCalledWith('audit-1', expect.objectContaining({ version: 'ai-governance-v1' }));
    expect(h.emitAgentEvent).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'ai-governance', event: 'started' }));
    expect(h.emitAgentEvent).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'ai-governance', event: 'completed' }));
  });

  it('never throws when every fetch fails — returns a fallback report and emits a failed event', async () => {
    global.fetch = vi.fn(async () => new Response('', { status: 500 })) as unknown as typeof fetch;
    h.saveAiGovernanceReport.mockRejectedValueOnce(new Error('db down'));

    const report = await runAiGovernanceAgent('audit-1', 'example.com');
    expect(report.version).toBe('ai-governance-v1');
    expect(h.emitAgentEvent).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'ai-governance', event: 'failed' }));
  });
});
