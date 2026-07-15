/**
 * FRONTEND category — cross-browser compatibility, accessibility (WCAG AA smoke),
 * and end-to-end.
 *
 * Uses Playwright when its browser binaries are installed; otherwise SKIPs each
 * check with the exact install command. The assertion logic is complete, so this
 * runs for real the moment `npx playwright install` has been done on the runner.
 */
import { STATUS, createRecorder } from '../lib/harness.mjs';

async function loadPlaywright() {
  try { return (await import('playwright')); } catch { return null; }
}

export async function run({ baseUrl }) {
  const { checks, record } = createRecorder('frontend');
  const pw = await loadPlaywright();

  if (!pw) {
    record('browser: cross-browser render (Chromium/Firefox/WebKit)', STATUS.SKIP, 'playwright not importable',
      { enableWith: 'pnpm add -D playwright && npx playwright install' });
    record('accessibility: WCAG AA smoke', STATUS.SKIP, 'playwright not importable', { enableWith: 'npx playwright install' });
    record('e2e: existing Playwright specs', STATUS.SKIP, 'runner not invoked here',
      { enableWith: 'pnpm test:e2e (apps/web/e2e/*.spec.ts) against a running server' });
    return { checks };
  }

  const engines = [['chromium', pw.chromium], ['firefox', pw.firefox], ['webkit', pw.webkit]];
  let rendered = 0, attempted = 0;
  let a11yRun = false, a11yIssues = [];

  for (const [name, engine] of engines) {
    let browser;
    try {
      browser = await engine.launch();
    } catch (e) {
      record(`browser: ${name} render`, STATUS.SKIP, `binary not installed (${String(e).slice(0, 60)})`,
        { enableWith: `npx playwright install ${name}` });
      continue;
    }
    attempted++;
    try {
      const page = await browser.newPage();
      // 60s: a cold dev root (auth redirect + hydration) can exceed 30s on first paint;
      // the orchestrator warms '/' and '/login' first, but keep generous headroom.
      const resp = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      const title = await page.title();
      const ok = resp && resp.status() < 400 && title.length > 0;
      if (ok) rendered++;
      record(`browser: ${name} renders the app`, ok ? STATUS.PASS : STATUS.FAIL,
        `http=${resp?.status()} title="${title.slice(0, 40)}"`);

      // WCAG AA smoke — run once on the first working engine.
      if (!a11yRun) {
        a11yRun = true;
        a11yIssues = await page.evaluate(() => {
          const issues = [];
          if (!document.documentElement.getAttribute('lang')) issues.push('missing <html lang>');
          const imgs = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt'));
          if (imgs.length) issues.push(`${imgs.length} <img> without alt`);
          if (!document.querySelector('main, [role=main]')) issues.push('no <main>/role=main landmark');
          const inputs = [...document.querySelectorAll('input,select,textarea')].filter((el) => {
            const id = el.getAttribute('id');
            const labelled = el.getAttribute('aria-label') || (id && document.querySelector(`label[for="${id}"]`));
            return !labelled && el.type !== 'hidden';
          });
          if (inputs.length) issues.push(`${inputs.length} form control(s) without a label`);
          const h1 = document.querySelectorAll('h1').length;
          if (h1 === 0) issues.push('no <h1>');
          return issues;
        });
      }
    } catch (e) {
      record(`browser: ${name} render`, STATUS.FAIL, String(e).slice(0, 80));
    } finally {
      await browser.close().catch(() => {});
    }
  }

  if (attempted > 0) {
    record('browser: app renders across installed engines', rendered === attempted ? STATUS.PASS : STATUS.WARNING,
      `${rendered}/${attempted} engines rendered the app`);
  }
  if (a11yRun) {
    record('accessibility: WCAG AA smoke (lang/alt/landmark/labels/h1)',
      a11yIssues.length === 0 ? STATUS.PASS : STATUS.WARNING,
      a11yIssues.length === 0 ? 'no smoke-level issues' : `issues: ${a11yIssues.join('; ')}`);
    record('accessibility: full WCAG AA (contrast, focus order, ARIA)', STATUS.SKIP,
      'smoke only; full audit needs axe-core',
      { enableWith: 'pnpm add -D @axe-core/playwright; inject axe and assert 0 serious/critical violations' });
  }

  record('e2e: existing Playwright specs', STATUS.SKIP, 'invoked via the dedicated runner, not inline',
    { enableWith: 'pnpm test:e2e against a running server (apps/web/e2e/{auth,audit-flow,dashboard}.spec.ts)' });

  return { checks };
}
