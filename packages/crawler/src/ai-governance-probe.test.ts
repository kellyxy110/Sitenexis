import { describe, it, expect, vi, afterEach } from 'vitest';
import { probeAiGovernance } from './ai-governance-probe';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe('probeAiGovernance', () => {
  it('fetches robots.txt content and reports discovery resource presence', async () => {
    global.fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/robots.txt')) {
        return new Response('User-agent: *\nAllow: /\n', { status: 200 });
      }
      if (init?.method === 'HEAD' && url.endsWith('/llms.txt')) {
        return new Response(null, { status: 200 });
      }
      return new Response(null, { status: 404 });
    }) as unknown as typeof fetch;

    const result = await probeAiGovernance('example.com');
    expect(result.robotsTxtContent).toContain('User-agent: *');
    expect(result.hasLlmsTxt).toBe(true);
    expect(result.hasAiTxt).toBe(false);
    expect(result.hasSecurityTxt).toBe(false);
  });

  it('never throws when every fetch fails — returns empty/false defaults', async () => {
    global.fetch = vi.fn(async () => { throw new Error('network error'); }) as unknown as typeof fetch;

    const result = await probeAiGovernance('example.com');
    expect(result.robotsTxtContent).toBe('');
    expect(result.hasLlmsTxt).toBe(false);
    expect(result.hasAiTxt).toBe(false);
    expect(result.hasSecurityTxt).toBe(false);
  });

  it('normalizes a bare domain to an https origin', async () => {
    let capturedUrl = '';
    global.fetch = vi.fn(async (input: string | URL) => {
      capturedUrl = String(input);
      return new Response('', { status: 404 });
    }) as unknown as typeof fetch;

    await probeAiGovernance('example.com');
    expect(capturedUrl.startsWith('https://example.com')).toBe(true);
  });
});
