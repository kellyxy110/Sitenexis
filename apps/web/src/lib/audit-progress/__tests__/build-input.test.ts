import { describe, it, expect } from 'vitest';
import { buildProgressInput } from '../build-input';

describe('buildProgressInput', () => {
  it('defaults to running when the SSE payload has no recognizable status (e.g. a ping)', () => {
    const input = buildProgressInput({
      auditId: 'a1', domain: 'x.com', executionMode: 'serverless',
      signal: {}, startedAtMs: 0, nowMs: 1000,
    });
    expect(input.auditStatus).toBe('running');
    expect(input.completedAtMs).toBeNull();
  });

  it('passes through a real zero page count as 0, not null — 0 pages fetched so far is a genuine signal', () => {
    const input = buildProgressInput({
      auditId: 'a1', domain: 'x.com', executionMode: 'serverless',
      signal: { status: 'running', pagesCount: 0 }, startedAtMs: 0, nowMs: 1000,
    });
    expect(input.pagesFetched).toBe(0);
  });

  it('reports pagesFetched as null when the payload never included a count at all', () => {
    const input = buildProgressInput({
      auditId: 'a1', domain: 'x.com', executionMode: 'serverless',
      signal: { status: 'partial' }, startedAtMs: 0, nowMs: 1000,
    });
    expect(input.pagesFetched).toBeNull();
  });

  it('sets completedAtMs to the observation time once the terminal status arrives', () => {
    const input = buildProgressInput({
      auditId: 'a1', domain: 'x.com', executionMode: 'serverless',
      signal: { status: 'complete', pagesCount: 40 }, startedAtMs: 0, nowMs: 5000,
    });
    expect(input.completedAtMs).toBe(5000);
    expect(input.auditStatus).toBe('complete');
  });

  it('carries the real error message through untouched', () => {
    const input = buildProgressInput({
      auditId: 'a1', domain: 'x.com', executionMode: 'serverless',
      signal: { status: 'failed', error: 'Homepage returned 403' }, startedAtMs: 0, nowMs: 5000,
    });
    expect(input.errorMessage).toBe('Homepage returned 403');
  });
});
