/// <reference lib="dom" />
// The reference above only affects type-checking of the page.evaluate() callback
// below, which executes inside the browser page, not in this Node process.
import puppeteer, { type Browser } from 'puppeteer';
import type {
  DetectedInteractionBlocker,
  InteractionBlockerType,
  PageInteractionBlockerProbe,
} from '@sitenexis/shared';

// Puppeteer loads at module level here — this file must NEVER be imported by
// Vercel serverless routes. It is only ever called from the BullMQ worker
// process (see @sitenexis/agents/browser-agent-readiness-agent), same rule
// that already applies to ./crawler.

const USER_AGENT = 'SiteNexis-Bot/1.0 (+https://sitenexis.com/bot)';
const PROBE_TIMEOUT_MS = 15_000;
const MAX_PROBED_PAGES = 5;

const CAPTCHA_SELECTORS = [
  'iframe[src*="recaptcha"]',
  'iframe[src*="hcaptcha"]',
  '.cf-turnstile',
  'div[id*="turnstile"]',
  'script[src*="recaptcha"]',
];

const CONSENT_SELECTORS = [
  '#onetrust-banner-sdk',
  '#CybotCookiebotDialog',
  '.qc-cmp2-container',
  '#truste-consent-track',
  'div[class*="cookie-consent"]',
  'div[id*="cookie-banner"]',
];

const LOGIN_WALL_PATTERNS = [/\/login\b/i, /\/signin\b/i, /\/sign-in\b/i, /\/wall\b/i, /\/paywall\b/i];

/**
 * Probes the rendered page in a real browser session for elements that would
 * block an autonomous browser-driven agent from reaching page content — a
 * distinct concern from prompt injection (see machine-trust-security engine).
 *
 * Deterministic: known selector/redirect signatures only, no heuristic ML.
 * Capped at MAX_PROBED_PAGES (matches the Performance Agent's top-5 convention)
 * because each probe is a real headless-Chrome navigation.
 */
export async function probeInteractionBlockers(
  urls: string[],
): Promise<PageInteractionBlockerProbe[]> {
  const targets = urls.slice(0, MAX_PROBED_PAGES);
  if (targets.length === 0) return [];

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  try {
    const results = await Promise.all(targets.map((url) => probeOne(browser, url)));
    return results;
  } finally {
    await browser.close();
  }
}

async function probeOne(browser: Browser, url: string): Promise<PageInteractionBlockerProbe> {
  const page = await browser.newPage();

  try {
    await page.setUserAgent(USER_AGENT);

    const response = await page
      .goto(url, { waitUntil: 'networkidle2', timeout: PROBE_TIMEOUT_MS })
      .catch(() => null);

    if (!response) return { url, blockers: [], probeStatus: 'timeout' };

    const blockers: DetectedInteractionBlocker[] = [];
    const finalUrl = page.url();
    const requestedIsLoginLike = LOGIN_WALL_PATTERNS.some((p) => p.test(url));
    const landedOnLoginLike = LOGIN_WALL_PATTERNS.some((p) => p.test(finalUrl));
    if (landedOnLoginLike && !requestedIsLoginLike) {
      blockers.push({ type: 'login_wall', selectorMatched: `redirected-to:${finalUrl}`, viewportCoveragePercent: null });
    }

    const detected = await page.evaluate(
      (captchaSelectors: string[], consentSelectors: string[]) => {
        const found: { kind: 'captcha_challenge' | 'cookie_consent_wall'; selector: string; coverage: number | null }[] = [];
        const viewportArea = window.innerWidth * window.innerHeight;

        const coverageOf = (el: Element): number | null => {
          if (viewportArea === 0) return null;
          const rect = el.getBoundingClientRect();
          return Math.round(((rect.width * rect.height) / viewportArea) * 100);
        };

        for (const selector of captchaSelectors) {
          const el = document.querySelector(selector);
          if (el) found.push({ kind: 'captcha_challenge', selector, coverage: coverageOf(el) });
        }
        for (const selector of consentSelectors) {
          const el = document.querySelector(selector);
          if (el) found.push({ kind: 'cookie_consent_wall', selector, coverage: coverageOf(el) });
        }
        return found;
      },
      CAPTCHA_SELECTORS,
      CONSENT_SELECTORS,
    );

    for (const d of detected) {
      blockers.push({
        type: d.kind as InteractionBlockerType,
        selectorMatched: d.selector,
        viewportCoveragePercent: d.coverage,
      });
    }

    return { url, blockers, probeStatus: 'ok' };
  } catch {
    return { url, blockers: [], probeStatus: 'unreachable' };
  } finally {
    await page.close();
  }
}
