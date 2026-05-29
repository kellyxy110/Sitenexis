import { test, expect } from '@playwright/test';
import { mockAuditAPIs, MOCK_AUDIT_DOMAIN } from './mocks/audit';

async function mockDashboardAPIs(page: import('@playwright/test').Page) {
  await mockAuditAPIs(page);
  await page.route('**/api/usage**', async (route) => {
    await route.fulfill({
      status:      200,
      contentType: 'application/json',
      body: JSON.stringify({ auditsThisMonth: 3, auditsLimit: 50, plan: 'starter' }),
    });
  });
}

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockDashboardAPIs(page);
    await page.goto('/dashboard');
  });

  test('recent audits table is visible', async ({ page }) => {
    await expect(page.getByText('Recent Audits')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('table').first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(MOCK_AUDIT_DOMAIN)).toBeVisible({ timeout: 5_000 });
  });

  test('click View → navigates to audit results page', async ({ page }) => {
    await expect(page.getByText(MOCK_AUDIT_DOMAIN)).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'View' }).first().click();
    // Next.js App Router uses history.pushState — poll until URL changes (handles Turbopack delay)
    await page.waitForFunction(
      (domain) => window.location.pathname.includes(`/audit/${domain}`),
      MOCK_AUDIT_DOMAIN,
      { timeout: 30_000 }
    );
    await expect(page.getByText('SEO Health').first()).toBeVisible({ timeout: 20_000 });
  });

  test('schema tab shows analysis content', async ({ page }) => {
    // Navigate directly — audit page fetches /api/audits?pageSize=1 then /api/audit/[id]
    await page.goto(`/audit/${MOCK_AUDIT_DOMAIN}`);

    // Wait for scores to render (confirms mock data loaded)
    await expect(page.getByText('SEO Health').first()).toBeVisible({ timeout: 10_000 });

    // Tab buttons have the tab label as their text content
    await page.getByRole('button', { name: 'Schema' }).click();

    // Schema tab renders IssuesTable + detected schema types from mock data
    // Mock pages have schemaData with Organization/WebPage types
    await expect(
      page.getByText(/schema|structured data|organization|webpage/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('link graph tab shows canvas element', async ({ page }) => {
    await page.goto(`/audit/${MOCK_AUDIT_DOMAIN}`);
    await expect(page.getByText('SEO Health').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Link Graph' }).click();

    // react-force-graph-2d renders into a <canvas>
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10_000 });
  });

  test('delete audit removes it from the list', async ({ page }) => {
    await expect(page.getByText(MOCK_AUDIT_DOMAIN)).toBeVisible({ timeout: 8_000 });

    // Override the /api/audits mock to return empty list BEFORE the delete so
    // that when TanStack Query re-fetches after invalidation it gets an empty response.
    await page.route('**/api/audits**', async (route) => {
      await route.fulfill({
        status:      200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], total: 0, page: 1, pageSize: 10, hasMore: false }),
      });
    });

    // Accept the confirm() dialog
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete' }).first().click();

    // After deletion, invalidateQueries fires a refetch → gets empty list
    await expect(page.getByText(MOCK_AUDIT_DOMAIN)).not.toBeVisible({ timeout: 8_000 });
  });
});
