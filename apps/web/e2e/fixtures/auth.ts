import { test as base, type Page } from '@playwright/test';

export const TEST_EMAIL    = 'test@sitenexis-e2e.example.com';
export const TEST_PASSWORD = 'TestPassword123!';
export const TEST_NAME     = 'E2E Test User';

// Injects a fake Supabase session cookie so pages load as authenticated
// without hitting real Supabase. Works alongside the API mocks in mocks/audit.ts.
async function injectFakeSession(page: Page): Promise<void> {
  // Supabase SSR reads sb-<project>-auth-token from cookies.
  // We inject a minimal JWT-shaped cookie that passes the middleware check.
  // In real tests against a real Supabase project, replace this with a
  // programmatic sign-in via `supabase.auth.signInWithPassword()`.
  await page.context().addCookies([
    {
      name: 'sb-placeholder-auth-token',
      value: JSON.stringify({
        access_token:  'fake-access-token',
        refresh_token: 'fake-refresh-token',
        expires_at:    Math.floor(Date.now() / 1000) + 3600,
        token_type:    'bearer',
        user: {
          id:    'e2e-user-id',
          email: TEST_EMAIL,
          user_metadata: { full_name: TEST_NAME },
        },
      }),
      domain:   'localhost',
      path:     '/',
      httpOnly: true,
      secure:   false,
      sameSite: 'Lax',
    },
  ]);
}

export type AuthFixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await injectFakeSession(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
