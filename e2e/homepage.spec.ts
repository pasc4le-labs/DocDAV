import { test, expect, type Page } from '@playwright/test';

// Homepage: product cards + search.
test.describe('homepage', () => {
  // The homepage is gated by the site password in sample/site.yaml
  // (site-secret); unlock it with the key first so product cards render.
  const unlocked = async (page: Page) => {
    await page.goto('/?key=site-secret');
    await expect(page).not.toHaveTitle(/Protected/);
  };

  test('lists both product cards with correct titles, counts and links', async ({ page }) => {
    await unlocked(page);
    await expect(page.getByRole('heading', { name: 'Documentation' })).toBeVisible();

    const cards = page.locator('.cards .card');
    await expect(cards).toHaveCount(2);

    // site.yaml order: Atlas then Scorekeeper. Atlas (5 pages) then Scorekeeper (4 pages).
    const atlas = cards.filter({ hasText: 'Atlas' });
    await expect(atlas).toBeVisible();
    await expect(atlas.locator('.name')).toHaveText('Atlas');
    await expect(atlas.locator('.n')).toHaveText('5');
    await expect(atlas.locator('.cover')).toBeVisible();
    await expect(atlas).toHaveAttribute('href', '/atlas');

    const scorekeeper = cards.filter({ hasText: 'Scorekeeper' });
    await expect(scorekeeper.locator('.name')).toHaveText('Scorekeeper');
    await expect(scorekeeper.locator('.n')).toHaveText('4');
    await expect(scorekeeper.locator('.cover')).toBeVisible();
    await expect(scorekeeper).toHaveAttribute('href', '/scorekeeper');
  });

  test('search filters products to the matching one', async ({ page }) => {
    await unlocked(page);
    const search = page.getByLabel('Search projects');
    await expect(page.locator('.cards .card')).toHaveCount(2);

    await search.fill('score');
    await expect(page.locator('.cards .card')).toHaveCount(1);
    await expect(page.locator('.card .name')).toHaveText('Scorekeeper');

    // Clearing the search restores both.
    await page.getByLabel('Clear search').click();
    await expect(search).toHaveValue('');
    await expect(page.locator('.cards .card')).toHaveCount(2);
  });
});
