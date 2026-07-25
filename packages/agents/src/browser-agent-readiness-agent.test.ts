import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  probeInteractionBlockers: vi.fn(),
  saveBrowserAgentProbes: vi.fn(),
  emitAgentEvent: vi.fn(),
}));

vi.mock('@sitenexis/crawler/interaction-blocker-probe', () => ({
  probeInteractionBlockers: h.probeInteractionBlockers,
}));
vi.mock('@sitenexis/db', () => ({
  saveBrowserAgentProbes: h.saveBrowserAgentProbes,
}));
vi.mock('./registry', () => ({
  emitAgentEvent: h.emitAgentEvent,
}));

const { runBrowserAgentReadinessAgent } = await import('./browser-agent-readiness-agent');

const pages = [
  { url: 'https://example.com/' } as never,
  { url: 'https://example.com/about' } as never,
];

beforeEach(() => {
  vi.clearAllMocks();
  h.probeInteractionBlockers.mockResolvedValue([
    { url: 'https://example.com/', blockers: [], probeStatus: 'ok' },
  ]);
  h.saveBrowserAgentProbes.mockResolvedValue(undefined);
  h.emitAgentEvent.mockResolvedValue(undefined);
});

describe('runBrowserAgentReadinessAgent', () => {
  it('probes pages ranked by pageRank when a link graph is supplied', async () => {
    const nodes = [
      { url: 'https://example.com/about', pageRank: 0.2 },
      { url: 'https://example.com/', pageRank: 0.8 },
    ] as never;

    await runBrowserAgentReadinessAgent('audit-1', pages, nodes);

    expect(h.probeInteractionBlockers).toHaveBeenCalledWith(['https://example.com/', 'https://example.com/about']);
    expect(h.saveBrowserAgentProbes).toHaveBeenCalledWith('audit-1', expect.any(Array));
    expect(h.emitAgentEvent).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'browser-agent-readiness', event: 'started' }));
    expect(h.emitAgentEvent).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'browser-agent-readiness', event: 'completed' }));
  });

  it('falls back to crawl order when no link graph is supplied', async () => {
    await runBrowserAgentReadinessAgent('audit-1', pages);
    expect(h.probeInteractionBlockers).toHaveBeenCalledWith(['https://example.com/', 'https://example.com/about']);
  });

  it('never throws when the probe fails — emits a failed event instead', async () => {
    h.probeInteractionBlockers.mockRejectedValue(new Error('chrome crashed'));
    await expect(runBrowserAgentReadinessAgent('audit-1', pages)).resolves.toBeUndefined();
    expect(h.emitAgentEvent).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'browser-agent-readiness', event: 'failed', errorMessage: 'chrome crashed' }));
    expect(h.saveBrowserAgentProbes).not.toHaveBeenCalled();
  });
});
