// @ts-check
import { test, expect } from '@playwright/test';

test.describe('SaveAtlas public flows', () => {
  test('landing page loads with ZIP-first CTAs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /sign in to import saves/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /explore demo/i }).first()).toHaveAttribute(
      'href',
      /dashboard\?demo=true/,
    );
  });

  test('/import redirects unauthenticated users to login with next param', async ({ page }) => {
    await page.goto('/import');
    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toMatch(/next=%2Fimport|next=\/import/);
  });

  test('login forgot link goes to forgot password page', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot?' }).click();
    await expect(page).toHaveURL(/\/auth\/forgot/);
  });

  test('forgot password page has working back link', async ({ page }) => {
    await page.goto('/auth/forgot');
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
    await page.getByRole('link', { name: /back to sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('demo dashboard renders library without auth', async ({ page }) => {
    await page.goto('/dashboard?demo=true');
    await expect(page.getByPlaceholder(/search library/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /all saves/i })).toBeVisible();
  });

  test('protected APIs reject anonymous requests', async ({ request }) => {
    const stats = await request.get('/api/stats');
    expect(stats.status()).toBe(401);

    const imp = await request.post('/api/import', {
      data: { saves: [] },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(imp.status()).toBe(400);

    const sync = await request.post('/api/saves/sync', {
      data: { saves: [{ instagram_id: '1', permalink: 'https://instagram.com/p/a/' }] },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(sync.status()).toBe(401);
  });
});
