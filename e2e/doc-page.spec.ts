import { test, expect } from '@playwright/test';

// Doc-page chrome: the page-actions menu (Copy page + Ask providers), the
// "Updated" line placement, and the desktop sidebar behaviour (sticky, pinned
// to the left edge, clamped width, ellipsis on long titles).
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

// Stub window.open so "Ask <provider>" redirects are captured without
// actually opening external sites (keeps CI fast and offline-safe).
async function stubWindowOpen(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    (window as unknown as { __openCalls: string[] }).__openCalls = [];
    window.open = (url?: string | URL) => {
      (window as unknown as { __openCalls: string[] }).__openCalls.push(String(url));
      return null;
    };
  });
}

test.describe('page actions menu', () => {
  test.beforeEach(async ({ page }) => {
    await stubWindowOpen(page);
    await page.goto('/atlas/getting-started?key=atlaspass');
    await expect(page).not.toHaveTitle(/Protected/);
  });

  test('lives next to the heading (not in the topbar)', async ({ page }) => {
    await expect(page.locator('.topbar .page-menu')).toHaveCount(0);
    await expect(page.locator('.doc-header .page-menu')).toHaveCount(1);
    await expect(page.locator('.doc-header h1')).toHaveText('Getting started');
  });

  test('Copy page copies only the current page text', async ({ page }) => {
    await page.locator('.doc-header').getByRole('button', { name: 'Copy' }).click();
    await page.locator('.page-menu-pop button').first().click();
    await page.waitForTimeout(150);

    const clip = await page.evaluate(() => navigator.clipboard.readText());
    const expected = await page.evaluate(() => {
      const h1 = document.querySelector('.content h1')?.textContent?.trim() ?? '';
      const body = (document.querySelector('.content article') as HTMLElement | null)?.innerText?.trim() ?? '';
      return `${h1}\n\n${body}`;
    });
    expect(clip).toBe(expected);
    // Sidebar / other pages never leak in.
    expect(clip).not.toContain('CLI reference');
    expect(clip).toContain('Welcome to Atlas');
  });

  test('shows Copy + Ask providers with working prefilled URLs', async ({ page }) => {
    // On atlas, docs.yaml re-enables Claude (disabled site-wide) and turns
    // Gemini into a fixed link — so Claude/ChatGPT/Perplexity are deep-link
    // buttons with prefilled URLs.
    const expected = {
      Claude: 'https://claude.ai/new?q=',
      ChatGPT: 'https://chatgpt.com?prompt=',
      Perplexity: ['https://www.perplexity.ai/search?q=', 'https://www.perplexity.ai/search/new?q='],
    };

    await page.locator('.doc-header .page-menu-btn').click();
    for (const [provider] of Object.entries(expected)) {
      await expect(page.locator('.page-menu-pop button').filter({ hasText: provider })).toBeVisible();
    }
    // Close the menu so the trigger is unambiguous for the loop below.
    await page.locator('body').click({ position: { x: 5, y: 5 } });

    for (const [provider, url] of Object.entries(expected)) {
      await page.locator('.doc-header .page-menu-btn').click();
      await page.locator('.page-menu-pop button').filter({ hasText: provider }).click();
      const opens = (await page.evaluate(() => (window as unknown as { __openCalls: string[] }).__openCalls)).pop();
      const hosts = Array.isArray(url) ? url : [url];
      expect(hosts.some((h) => (opens ?? '').startsWith(h)), `${provider} -> ${opens}`).toBe(true);
      // Close the menu before the next provider.
      await page.locator('body').click({ position: { x: 5, y: 5 } });
    }
  });
});

// The "Ask <provider>" menu is driven by a `copy:` map in content, not env:
// site.yaml provides the site-wide default, and a product's docs.yaml overrides it.
test.describe('copy config (site.yaml + docs.yaml)', () => {
  test('site default: disabled provider hidden, fixed link renders as an anchor', async ({ page }) => {
    // scorekeeper has no docs.yaml `copy`, so it inherits site.yaml: Claude is
    // disabled, Gemini points at the site-wide link, the rest stay enabled.
    await page.goto('/scorekeeper/deployment');
    await page.locator('.doc-header .page-menu-btn').click();

    await expect(page.locator('.page-menu-pop a.pm-item').filter({ hasText: 'Gemini' })).toHaveAttribute(
      'href',
      'https://gemini.example.test/site-custom',
    );
    await expect(page.locator('.page-menu-pop button').filter({ hasText: 'Claude' })).toHaveCount(0);
    await expect(page.locator('.page-menu-pop button').filter({ hasText: 'ChatGPT' })).toBeVisible();
    await expect(page.locator('.page-menu-pop button').filter({ hasText: 'Perplexity' })).toBeVisible();
  });

  test('docs.yaml copy overrides site.yaml per product', async ({ page }) => {
    // atlas re-enables Claude (disabled site-wide) and overrides Gemini's href.
    await page.goto('/atlas/getting-started?key=atlaspass');
    await page.locator('.doc-header .page-menu-btn').click();

    await expect(page.locator('.page-menu-pop button').filter({ hasText: 'Claude' })).toBeVisible();
    await expect(page.locator('.page-menu-pop a.pm-item').filter({ hasText: 'Gemini' })).toHaveAttribute(
      'href',
      'https://gemini.example.test/atlas-custom',
    );
  });
});

test.describe('doc page layout', () => {
  test('the Updated line sits below the article body', async ({ page }) => {
    await page.goto('/atlas/getting-started?key=atlaspass');
    const article = page.locator('article');
    const updated = page.locator('.content p.doc-meta').filter({ hasText: 'Updated' });
    await expect(updated).toBeVisible();
    const after = await page.evaluate(() => {
      const a = document.querySelector('article');
      const u = [...document.querySelectorAll('.content p')].find((p) =>
        p.textContent?.includes('Updated'),
      );
      return Boolean(a && u && (a.compareDocumentPosition(u) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    expect(after).toBe(true);
  });
});

test.describe('desktop sidebar', () => {
  test('is pinned to the screen left edge with a clamped width', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/atlas/getting-started?key=atlaspass');
    const sidebar = page.locator('aside.sidebar');
    const r = await sidebar.evaluate((el) => {
      const b = el.getBoundingClientRect();
      return { left: Math.round(b.left), width: Math.round(b.width) };
    });
    expect(r.left).toBe(0); // no left inset from a centered shell
    expect(r.width).toBeGreaterThanOrEqual(240);
    expect(r.width).toBeLessThanOrEqual(340);
  });

  test('stays fixed while the page content scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto('/atlas/getting-started?key=atlaspass');
    const sidebar = page.locator('aside.sidebar');
    const topBefore = await sidebar.evaluate((el) => Math.round(el.getBoundingClientRect().top));

    // Make content genuinely tall, then scroll.
    await page.evaluate(() => {
      const spacer = document.createElement('div');
      spacer.style.height = '2400px';
      document.querySelector('article')?.append(spacer);
    });
    await page.evaluate(() => window.scrollBy(0, 900));
    await page.waitForTimeout(150);

    const topAfter = await sidebar.evaluate((el) => Math.round(el.getBoundingClientRect().top));
    expect(topBefore).toBe(50);
    expect(Math.abs(topAfter - topBefore)).toBeLessThanOrEqual(1);
  });

  test('truncates long titles with an ellipsis', async ({ page }) => {
    await page.goto('/scorekeeper/deployment');
    const cs = await page.evaluate(() => {
      const span = document.querySelector('.sidebar .cat a .link-text') as HTMLElement | null;
      if (!span) return null;
      span.textContent = 'A very long documentation title that cannot possibly fit';
      const s = getComputedStyle(span);
      return {
        overflow: s.overflow,
        textOverflow: s.textOverflow,
        nowrap: s.whiteSpace,
        scrollW: span.scrollWidth,
        clientW: span.clientWidth,
      };
    });
    expect(cs).not.toBeNull();
    expect(cs!.overflow).toBe('hidden');
    expect(cs!.textOverflow).toBe('ellipsis');
    expect(cs!.nowrap).toBe('nowrap');
    expect(cs!.scrollW).toBeGreaterThan(cs!.clientW);
  });

  test('is a slide-in drawer on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 800 });
    await page.goto('/scorekeeper/deployment');
    const pos = await page.locator('aside.sidebar').evaluate((el) => getComputedStyle(el).position);
    expect(pos).toBe('fixed');
  });
});