import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  launch: vi.fn(),
}));

vi.mock('puppeteer', () => ({
  default: { launch: h.launch },
}));

const { probeInteractionBlockers } = await import('./interaction-blocker-probe');

function makeBrowser(pageFactory: () => unknown) {
  return {
    newPage: vi.fn(async () => pageFactory()),
    close: vi.fn(async () => undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('probeInteractionBlockers', () => {
  it('never launches a browser when there are no URLs to probe', async () => {
    const results = await probeInteractionBlockers([]);
    expect(results).toEqual([]);
    expect(h.launch).not.toHaveBeenCalled();
  });

  it('caps probing at 5 URLs even when more are supplied', async () => {
    const page = {
      setUserAgent: vi.fn(async () => undefined),
      goto: vi.fn(async () => ({})),
      url: vi.fn(() => 'https://example.com'),
      evaluate: vi.fn(async () => []),
      close: vi.fn(async () => undefined),
    };
    const browser = makeBrowser(() => page);
    h.launch.mockResolvedValue(browser);

    const urls = Array.from({ length: 8 }, (_, i) => `https://example.com/page-${i}`);
    await probeInteractionBlockers(urls);
    expect(browser.newPage).toHaveBeenCalledTimes(5);
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it('reports a timeout status when navigation fails', async () => {
    const page = {
      setUserAgent: vi.fn(async () => undefined),
      goto: vi.fn(async () => null),
      url: vi.fn(() => 'https://example.com'),
      evaluate: vi.fn(async () => []),
      close: vi.fn(async () => undefined),
    };
    h.launch.mockResolvedValue(makeBrowser(() => page));

    const [result] = await probeInteractionBlockers(['https://example.com']);
    expect(result?.probeStatus).toBe('timeout');
    expect(result?.blockers).toEqual([]);
  });

  it('flags a login-wall redirect and a detected CAPTCHA selector', async () => {
    const page = {
      setUserAgent: vi.fn(async () => undefined),
      goto: vi.fn(async () => ({})),
      url: vi.fn(() => 'https://example.com/login'),
      evaluate: vi.fn(async () => [{ kind: 'captcha_challenge', selector: '.cf-turnstile', coverage: 12 }]),
      close: vi.fn(async () => undefined),
    };
    h.launch.mockResolvedValue(makeBrowser(() => page));

    const [result] = await probeInteractionBlockers(['https://example.com/pricing']);
    expect(result?.probeStatus).toBe('ok');
    expect(result?.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'login_wall', selectorMatched: 'redirected-to:https://example.com/login' }),
        expect.objectContaining({ type: 'captcha_challenge', selectorMatched: '.cf-turnstile', viewportCoveragePercent: 12 }),
      ]),
    );
  });

  it('marks the page unreachable when the probe throws', async () => {
    const page = {
      setUserAgent: vi.fn(async () => { throw new Error('boom'); }),
      goto: vi.fn(async () => ({})),
      url: vi.fn(() => 'https://example.com'),
      evaluate: vi.fn(async () => []),
      close: vi.fn(async () => undefined),
    };
    h.launch.mockResolvedValue(makeBrowser(() => page));

    const [result] = await probeInteractionBlockers(['https://example.com']);
    expect(result?.probeStatus).toBe('unreachable');
  });
});
