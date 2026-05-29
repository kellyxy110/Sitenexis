import { test, expect } from '@playwright/test';
import { mockAuditAPIs, MOCK_AUDIT_ID, MOCK_AUDIT_DOMAIN } from './mocks/audit';

test.describe('Audit flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuditAPIs(page);
  });

  test('complete audit journey from homepage to results', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page).toHaveTitle(/SiteNexis/);

    // 2. Enter domain
    const input = page.getByLabel('Domain').first();
    await input.waitFor({ state: 'visible' });
    await input.click();
    await input.fill(MOCK_AUDIT_DOMAIN);
    await expect(input).toHaveValue(MOCK_AUDIT_DOMAIN);

    // 3. Click "Run Audit →"
    const submitBtn = page.getByRole('button', { name: /run audit/i }).first();
    await submitBtn.click();

    // 4. Homepage handleAuditSubmit calls router.push('/audit/[domain]').
    //    Next.js App Router client-side navigation — use waitForFunction to poll URL
    //    since soft navigation doesn't fire a traditional page load event.
    await page.waitForFunction(
      (domain) => window.location.pathname.includes(`/audit/${domain}`),
      MOCK_AUDIT_DOMAIN,
      { timeout: 30_000 }
    );

    // 5. The audit page (no auditId param) fetches /api/audits?pageSize=1 then /api/audit/[id]
    //    and renders score gauges with labels like "SEO Health".
    await expect(page.getByText(/SEO Health/i).first()).toBeVisible({ timeout: 20_000 });

    // 6. Score gauges show values from mock data (78, 65, 55, 82, 71)
    await expect(page.getByText(/78|65|55|82|71/).first()).toBeVisible({ timeout: 8_000 });

    // 7. PDF download button exists
    const pdfBtn = page.getByRole('button', { name: /pdf|download|report/i }).first();
    await expect(pdfBtn).toBeVisible({ timeout: 5_000 });

    // 8. Clicking PDF button fires POST /api/audit/[id]/report
    const [reportReq] = await Promise.all([
      page.waitForRequest(`**/api/audit/${MOCK_AUDIT_ID}/report`),
      pdfBtn.click(),
    ]);
    expect(reportReq.method()).toBe('POST');
  });

  test('domain input cleans protocol and trailing slash on blur', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const input = page.getByLabel('Domain').first();
    await input.waitFor({ state: 'visible' });
    await input.click();
    await input.fill('https://www.EXAMPLE.COM/path');
    // Tab away to trigger onBlur reliably
    await page.keyboard.press('Tab');
    await expect(input).toHaveValue('example.com', { timeout: 3_000 });
  });

  test('domain input shows error for invalid domain', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const input = page.getByLabel('Domain').first();
    await input.waitFor({ state: 'visible' });
    await input.click();
    await input.fill('not a domain!!');
    await page.getByRole('button', { name: /run audit/i }).first().click();
    // Use #domain-error id to avoid matching the Next.js route announcer (also role="alert")
    const errorEl = page.locator('#domain-error');
    await expect(errorEl).toBeVisible({ timeout: 3_000 });
    await expect(errorEl).toContainText(/valid domain/i);
  });
});
