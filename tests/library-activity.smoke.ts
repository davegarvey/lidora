import { test, expect, type Page } from '@playwright/test';

async function seed(page: Page) {
  await page.route('**/registerSW.js', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('.empty-state')).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('sift');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction(['feeds', 'items', 'itemBodies', 'itemFlags'], 'readwrite');
    const now = Date.now();
    tx.objectStore('feeds').put({ id: 'activity', url: 'https://example.com/activity.xml', title: 'Activity feed', lastFetched: now, learnedIntervalMs: 86400000 });
    for (let index = 0; index < 12; index++) {
      const id = `activity::article-${index}`;
      tx.objectStore('items').put({ id, feedId: 'activity', guid: `article-${index}`, title: `Article ${index}`, excerpt: 'A quiet reading list.', publishedAt: now - index * 1000, updatedAt: now, createdAt: now, read: false, starred: false });
      tx.objectStore('itemBodies').put({ id, feedId: 'activity', html: '<p>Article content.</p>' });
      tx.objectStore('itemFlags').put({ id, feedId: 'activity', read: 0, starred: 0 });
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    });
  });
  await page.reload();
  await expect(page.locator('.river-item')).toHaveCount(12);
}

async function expectSingleSpinner(page: Page, container: string) {
  const indicator = page.getByRole('img', { name: 'Updating articles', exact: true });
  await expect(indicator).toHaveCount(1);
  await expect(page.locator(`${container} .library-updating`)).toBeVisible();
  await expect(indicator).toHaveText('');
  await expect(indicator.locator('svg')).toHaveCSS('animation-name', 'library-update-spin');
  await expect(page.locator('.fetching-spinner')).toHaveCount(0);
  for (const icon of await page.locator('button[aria-busy] svg:visible').all()) {
    await expect(icon).toHaveCSS('animation-name', 'none');
  }
}

test('one icon-only activity cue follows the visible header across layouts and respects reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(page);
  let release: (() => void) | undefined;
  const responseReady = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/feed?**', async (route) => {
    await responseReady;
    await route.fulfill({ status: 304 });
  });
  try {
    const immediate = await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>('.heading-action[aria-label="Refresh all feeds"]');
      if (!button) throw new Error('Missing refresh action');
      button.click();
      return { disabled: button.disabled, busy: button.getAttribute('aria-busy') };
    });
    expect(immediate).toEqual({ disabled: true, busy: 'true' });
    await expectSingleSpinner(page, '.sidebar-header');
    const icon = page.locator('.sidebar-header .library-updating svg');
    const before = await icon.evaluate((element) => getComputedStyle(element).transform);
    await expect.poll(() => icon.evaluate((element) => getComputedStyle(element).transform)).not.toBe(before);

    await page.getByRole('button', { name: 'Close sidebar', exact: true }).click();
    await expectSingleSpinner(page, '.collapsed-brand');
    await expect(page.locator('.collapsed-actions-top .library-updating')).toHaveCount(0);
    await page.locator('.collapsed-brand').click();

    for (const width of [320, 390, 768, 769, 819, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expectSingleSpinner(page, width <= 768 ? '.topbar' : '.sidebar-header');
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Open feeds sidebar' }).click();
    await expectSingleSpinner(page, '.topbar');
    await page.getByRole('button', { name: 'Close feeds sidebar' }).click();

    await page.locator('.river-item').first().click();
    await page.setViewportSize({ width: 390, height: 900 });
    await expect(page.locator('.library-updating:visible')).toHaveCount(0);
    await page.setViewportSize({ width: 820, height: 900 });
    await expectSingleSpinner(page, '.collapsed-brand');
    await expect(page.locator('.reading-chrome .library-updating')).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expectSingleSpinner(page, '.sidebar-header');
    await expect(page.locator('.reading-chrome .library-updating')).toHaveCount(0);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const still = page.getByRole('img', { name: 'Updating articles', exact: true });
    await expect(still).toHaveCount(1);
    await expect(still.locator('svg')).toHaveCSS('animation-name', 'none');
    await expect(still).toHaveText('');

    await page.getByRole('button', { name: 'Enable focus mode', exact: true }).click();
    await expect(page.locator('.library-updating:visible')).toHaveCount(0);
  } finally {
    release?.();
  }
  await expect(page.locator('.library-updating:visible')).toHaveCount(0);
});

async function backgroundRefresh(page: Page) {
  await page.evaluate(async () => {
    const feedsPath = '/src/db/feeds.ts';
    const schedulerPath = '/src/feeds/scheduler.ts';
    const idlePath = '/src/util/idle.ts';
    const { getFeed, upsertFeed } = await import(feedsPath) as typeof import('../src/db/feeds');
    const { refreshStaleFeeds } = await import(schedulerPath) as typeof import('../src/feeds/scheduler');
    const { markActive } = await import(idlePath) as typeof import('../src/util/idle');
    const feed = await getFeed('activity');
    if (!feed) throw new Error('Missing test feed');
    await upsertFeed({ ...feed, lastFetched: 0 });
    const now = Date.now;
    Date.now = () => now() + 3600000;
    markActive();
    try {
      await refreshStaleFeeds();
    } finally {
      Date.now = now;
    }
  });
}

test('pending Show sits in the list header while the activity icon stays in the top bar on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await seed(page);
  const entries = ['new', ...Array.from({ length: 12 }, (_, index) => `article-${index}`)];
  const xml = '<rss version="2.0"><channel><title>Activity feed</title><link>https://example.com/</link><description>Fixture</description>' + entries.map((id, index) => `<item><guid>${id}</guid><title>Article ${id}</title><pubDate>${new Date(Date.now() - index * 1000).toUTCString()}</pubDate></item>`).join('') + '</channel></rss>';
  await page.route('**/feed?**', (route) => route.fulfill({ status: 200, contentType: 'application/xml', body: xml }));
  await backgroundRefresh(page);
  const show = page.locator('.river-header').getByRole('button', { name: /Show 1 new/ });
  await expect(show).toBeVisible();
  await expect(page.locator('.topbar .library-update-action')).toHaveCount(0);
  await expect(page.locator('.river-item')).toHaveCount(12);
  let release: (() => void) | undefined;
  const responseReady = new Promise<void>((resolve) => { release = resolve; });
  await page.unroute('**/feed?**');
  await page.route('**/feed?**', async (route) => {
    await responseReady;
    await route.fulfill({ status: 304 });
  });
  const running = backgroundRefresh(page);
  try {
    await expectSingleSpinner(page, '.topbar');
    await expect(show).toBeEnabled();
    await expect(show).toHaveCSS('animation-name', 'none');
    const toggles = page.locator('.river-header-toggles');
    const togglesBounds = await toggles.boundingBox();
    const actionBounds = await show.boundingBox();
    expect(togglesBounds).not.toBeNull();
    expect(actionBounds).not.toBeNull();
    expect(actionBounds!.x + actionBounds!.width).toBeLessThanOrEqual(togglesBounds!.x + 1);
    await show.click();
    await expect(page.locator('.river-item')).toHaveCount(13);
    await expectSingleSpinner(page, '.topbar');
  } finally {
    release?.();
    await running;
  }
  await expect(page.locator('.library-updating:visible')).toHaveCount(0);
});
