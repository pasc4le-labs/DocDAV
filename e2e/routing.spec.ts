import { test, expect } from '@playwright/test';

// 404 routing, binary (xlsx) rendering, and responsive sidebar.
test.describe('routing & formats', () => {
  test('unknown product returns a 404 page', async ({ page }) => {
    const resp = await page.goto('/does-not-exist');
    expect(resp?.status()).toBe(404);
    await expect(page.getByText(/not found|404/i).first()).toBeVisible();
  });

  test('unknown page in an ungated product returns 404', async ({ page }) => {
    const resp = await page.goto('/scorekeeper/nope');
    expect(resp?.status()).toBe(404);
  });

  test('unknown page in a gated product (after auth) returns 404', async ({ page }) => {
    const resp = await page.goto('/atlas/nope?key=atlaspass');
    expect(resp?.status()).toBe(404);
  });

  test('binary xlsx page renders a table with cell text', async ({ page }) => {
    await page.goto('/atlas/pricing?key=atlaspass');
    await expect(page).not.toHaveTitle(/Protected/);
    const article = page.locator('article');
    await expect(article.locator('table')).toBeVisible();
    const text = await article.innerText();
    expect(text).toContain('Tier');
    expect(text).toContain('Starter');
    expect(text).toContain('Unlimited');
  });

  test('sidebar drawer toggles on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 800 });
    await page.goto('/scorekeeper/deployment');

    const sidebar = page.locator('aside.sidebar');
    // Closed initially on mobile.
    await expect(sidebar).not.toHaveClass(/open/);

    await page.getByLabel('Toggle sidebar').click();
    await expect(sidebar).toHaveClass(/open/);

    await page.getByLabel('Toggle sidebar').click();
    await expect(sidebar).not.toHaveClass(/open/);
  });
});
