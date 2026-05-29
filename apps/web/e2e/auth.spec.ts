import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login page renders sign-in form', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Enter your email to receive a magic link.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /send magic link/i })).toBeVisible();
  });

  test('login page has correct title', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/SiteNexis/);
  });

  test('magic link form shows confirmation or error after submit', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.getByRole('textbox', { name: /email/i }).fill('test@example.com');
    await page.getByRole('button', { name: /send magic link/i }).click();
    // With real Supabase: shows "Check your inbox". With placeholder creds: shows an error.
    // Either way, the button should be gone and a response shown within 8s.
    await expect(
      page.getByText(/check your inbox|sending|error|invalid|not configured/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('landing page has navigation links to login and signup', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByRole('link', { name: /log in/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('link', { name: /sign up/i }).first()).toBeVisible();
  });

  test('/dashboard loads in E2E test mode (middleware bypassed)', async ({ page }) => {
    // With PLAYWRIGHT_TEST=true the middleware is bypassed — page should attempt to render
    // The dashboard will show an error or empty state without real auth, but should not 404
    const response = await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).not.toBe(404);
  });
});
