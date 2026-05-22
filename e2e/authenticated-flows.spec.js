// @ts-check
import { test, expect } from '@playwright/test';
import path from 'node:path';

const email = process.env.PLAYWRIGHT_TEST_EMAIL;
const password = process.env.PLAYWRIGHT_TEST_PASSWORD;

const fixtureZip = path.join(process.cwd(), 'e2e/fixtures/minimal-saved-posts.zip');

async function signIn(page) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  const error = page.getByRole('alert');
  await Promise.race([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45_000 }),
    error.waitFor({ state: 'visible', timeout: 45_000 }).then(async () => {
      const msg = await error.textContent();
      throw new Error(`Login failed: ${msg || 'unknown error'}`);
    }),
  ]);
}

test.describe('SaveAtlas authenticated flows', () => {
  test.skip(!email || !password, 'Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD');

  test.describe.configure({ mode: 'serial' });

  test('sign in lands on import page', async ({ page }) => {
    await signIn(page);
    await expect(page).toHaveURL(/\/import/);
    await expect(page.getByText(/upload your instagram export/i)).toBeVisible();
  });

  test('dashboard loads search and sidebar for real user', async ({ page }) => {
    await signIn(page);
    await page.goto('/dashboard');
    await expect(page.getByPlaceholder(/search library/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(email)).toBeVisible({ timeout: 15_000 });
  });

  test('login honors next=/import when already used from protected route', async ({ page }) => {
    await page.goto('/import');
    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toMatch(/next=/);

    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/import/);
  });

  test('ZIP import accepts minimal fixture and completes', async ({ page }) => {
    await signIn(page);
    await page.goto('/import');

    await page.locator('input[type="file"]').setInputFiles(fixtureZip);
    await expect(page.getByText(/ready to import/i)).toBeVisible();

    await page.getByRole('button', { name: /import .*\.zip/i }).click();

    await expect(page.getByText(/import complete!/i)).toBeVisible({ timeout: 90_000 });
  });
});
