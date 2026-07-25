import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  probeSensitivePaths: vi.fn(),
  saveRedLabReport: vi.fn(),
  emitAgentEvent: vi.fn(),
}));

vi.mock('@sitenexis/crawler', () => ({
  probeSensitivePaths: h.probeSensitivePaths,
}));
vi.mock('@sitenexis/db', () => ({
  saveRedLabReport: h.saveRedLabReport,
}));
vi.mock('./registry', () => ({
  emitAgentEvent: h.emitAgentEvent,
}));

const { runRedLabAgent } = await import('./redlab-agent');

const pages = [
  { url: 'https://example.com/', scriptSources: ['https://cdn.example.com/jquery-1.12.4.min.js'] } as never,
  { url: 'https://example.com/about', scriptSources: [] } as never,
];

beforeEach(() => {
  vi.clearAllMocks();
  h.probeSensitivePaths.mockResolvedValue([{ path: '/.env', statusCode: 404 }]);
  h.saveRedLabReport.mockResolvedValue(undefined);
  h.emitAgentEvent.mockResolvedValue(undefined);
});

describe('runRedLabAgent', () => {
  it('probes the domain, aggregates script sources from every page, and persists the report', async () => {
    const report = await runRedLabAgent('audit-1', 'example.com', pages);
    expect(h.probeSensitivePaths).toHaveBeenCalledWith('example.com');
    expect(report.vulnerableLibraries.some((f) => f.library === 'jQuery')).toBe(true);
    expect(h.saveRedLabReport).toHaveBeenCalledWith('audit-1', expect.objectContaining({ version: 'redlab-v1' }));
    expect(h.emitAgentEvent).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'redlab', event: 'completed' }));
  });

  it('never throws when the probe fails — returns a fallback report and emits a failed event', async () => {
    h.probeSensitivePaths.mockRejectedValue(new Error('probe crashed'));
    const report = await runRedLabAgent('audit-1', 'example.com', pages);
    expect(report.version).toBe('redlab-v1');
    expect(h.emitAgentEvent).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'redlab', event: 'failed' }));
    // Even on probe failure, script-source based library detection still runs against already-crawled pages.
    expect(report.vulnerableLibraries.some((f) => f.library === 'jQuery')).toBe(true);
  });
});
