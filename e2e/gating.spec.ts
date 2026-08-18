import { test, expect } from '@playwright/test';

// Gated product (atlas): gate behavior, wrong/correct keys, cookie unlock.
test.describe('gated product (atlas)', () => {
  test('without a key the gate is shown, not the docs', async ({ page }) => {
    const resp = await page.goto('/atlas');
    expect(resp?.status()).toBe(401);
    await expect(page).toHaveTitle(/Protected/);
    await expect(page.getByRole('heading', { name: 'Atlas documentation' })).toBeVisible();
    // Gate form present; no docs sidebar.
    await expect(page.getByPlaceholder('Password')).toBeVisible();
    await expect(page.locator('aside.sidebar')).toHaveCount(0);
  });

  test('a wrong key still keeps the gate closed', async ({ page }) => {
    const resp = await page.goto('/atlas?key=wrong');
    expect(resp?.status()).toBe(401);
    await expect(page).toHaveTitle(/Protected/);
    await expect(page.getByRole('heading', { name: 'Atlas documentation' })).toBeVisible();
  });

  test('the correct key unlocks the docs and the sidebar', async ({ page }) => {
    await page.goto('/atlas?key=atlaspass');
    await expect(page).not.toHaveTitle(/Protected/);
    await expect(page.getByRole('heading', { name: 'Atlas' }).first()).toBeVisible();
    await expect(page.locator('aside.sidebar .cat-name')).toHaveText([
      'Overview',
      'Guides',
      'CLI Reference',
      'Reference',
    ]);
  });

  test('after authenticating once, a later request is unlocked via cookie', async ({
    page,
  }) => {
    // First visit with the key sets the auth cookie.
    await page.goto('/atlas?key=atlaspass');
    await expect(page).not.toHaveTitle(/Protected/);
    await expect(page.getByRole('heading', { name: 'Atlas' })).toBeVisible();

    // Subsequent request with no key is unlocked by the cookie.
    await page.goto('/atlas');
    await expect(page).not.toHaveTitle(/Protected/);
    await expect(page.getByRole('heading', { name: 'Atlas' })).toBeVisible();
    await expect(page.locator('aside.sidebar').getByRole('link')).toHaveCount(5);
  });
});
