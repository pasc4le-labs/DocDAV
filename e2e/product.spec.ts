import { test, expect } from '@playwright/test';

// Ungated product: landing, rendered docs, lazy-loading of page sources.
test.describe('ungated product (scorekeeper)', () => {
  test('landing renders a sidebar grouped by category with links', async ({ page }) => {
    await page.goto('/scorekeeper');
    await expect(page.getByRole('heading', { name: 'Scorekeeper' })).toBeVisible();

    // Sidebar (aside.sidebar) grouped by category.
    const sidebar = page.locator('aside.sidebar');
    await expect(sidebar.locator('.cat-name')).toHaveText(['Overview', 'Concepts', 'Operations']);

    // Links present and point at the right doc ids.
    await expect(
      sidebar.getByRole('link', { name: 'Scorekeeper — Overview' }),
    ).toHaveAttribute('href', '/scorekeeper/index');
    await expect(sidebar.getByRole('link', { name: 'Deployment' })).toHaveAttribute(
      'href',
      '/scorekeeper/deployment',
    );
    await expect(sidebar.getByRole('link', { name: 'Troubleshooting' })).toHaveAttribute(
      'href',
      '/scorekeeper/troubleshooting',
    );

    // Landing lists each category as a section with links too.
    await expect(page.locator('main section')).toHaveCount(3);
  });

  test('a normal doc page renders the rendered markdown', async ({ page }) => {
    await page.goto('/scorekeeper/deployment');
    // Both the page h1 and rendered markdown contain an <h1>Deployment</h1>.
    await expect(page.getByRole('heading', { name: 'Deployment' }).first()).toBeVisible();
    // Rendered from markdown: heading inside article + body content.
    await expect(page.locator('article h2', { hasText: 'Environment' })).toBeVisible();
    const body = await page.locator('article').innerText();
    expect(body).toContain('Scorekeeper deploys to Vercel');
  });

  test('a doc page is served live from the WebDAV share', async ({ page, request }) => {
    // The app is backed by the live rclone WebDAV server: confirm the source is
    // actually served there (not baked into the build), then that it renders.
    const src = await request.get('http://127.0.0.1:8090/scorekeeper/deployment.md', {
      headers: {
        Authorization: 'Basic ' + Buffer.from('demo:secret').toString('base64'),
      },
    });
    expect(src.status()).toBe(200);
    // Raw markdown source served from the share.
    expect(await src.text()).toContain('Scorekeeper deploys to **Vercel**');

    // And the page itself renders live from that content.
    await page.goto('/scorekeeper/deployment');
    await expect(page.getByRole('heading', { name: 'Deployment' }).first()).toBeVisible();
    const body = await page.locator('article').innerText();
    expect(body).toContain('Scorekeeper deploys to Vercel');
  });
});
