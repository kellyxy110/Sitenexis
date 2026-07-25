import { describe, it, expect, vi, afterEach } from 'vitest';
import { probeSensitivePaths } from './sensitive-path-probe';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe('probeSensitivePaths', () => {
  it('probes every sensitive path and reports its status code', async () => {
    global.fetch = vi.fn(async (input: string | URL) => {
      const url = String(input);
      return new Response('', { status: url.endsWith('/.env') ? 200 : 404 });
    }) as unknown as typeof fetch;

    const results = await probeSensitivePaths('example.com');
    expect(results.length).toBeGreaterThan(5);
    expect(results.find((r) => r.path === '/.env')?.statusCode).toBe(200);
    expect(results.find((r) => r.path === '/backup.sql')?.statusCode).toBe(404);
  });

  it('records statusCode 0 for unreachable paths without throwing', async () => {
    global.fetch = vi.fn(async () => { throw new Error('network error'); }) as unknown as typeof fetch;
    const results = await probeSensitivePaths('example.com');
    expect(results.every((r) => r.statusCode === 0)).toBe(true);
  });

  it('normalizes a bare domain to an https origin', async () => {
    let capturedUrl = '';
    global.fetch = vi.fn(async (input: string | URL) => {
      capturedUrl = String(input);
      return new Response('', { status: 404 });
    }) as unknown as typeof fetch;

    await probeSensitivePaths('example.com');
    expect(capturedUrl.startsWith('https://example.com')).toBe(true);
  });
});
