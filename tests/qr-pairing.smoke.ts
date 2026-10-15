import { test, expect, type Page } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';

/** Generate a 22-char base64url sync key (same format as src/sync/key.ts). */
function generateKey(): string {
  return Buffer.from(randomBytes(16))
    .toString('base64url');
}

const MOCK_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <description>A test feed for smoke testing QR pairing</description>
    <item>
      <title>First article</title>
      <link>https://example.com/1</link>
      <guid>guid-1</guid>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

/** Prevent the PWA service worker from registering (it triggers a reload). */
async function disableSw(page: Page) {
  await page.route('**/registerSW.js', (route) => route.abort());
  await page.route('**/sw.js', (route) => route.abort());
  await page.route('**/workbox-*.js', (route) => route.abort());
}

async function mockFeedEndpoint(page: Page) {
  await page.route(
    (url) => url.pathname === '/feed',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/rss+xml',
        body: MOCK_RSS,
      });
    },
  );
}

/**
 * Inject a sync key into IndexedDB and reload so bootSync picks it up on
 * the next page load.
 */
async function injectSyncKey(page: Page, key: string): Promise<void> {
  await page.waitForSelector('.sidebar');
  await page.waitForTimeout(1000);
  await page.evaluate(async (k) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('sift');
      req.onupgradeneeded = () => {};
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put({ key: 'settings', value: { syncKey: k, lastSyncAt: null } });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }, key);
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForSelector('.sidebar');
}

test.describe('QR pairing', () => {
  test('pairs a second device and syncs feeds to it', async ({ browser }) => {
    test.setTimeout(90_000);
    const syncKeyA = generateKey();

    // ── Device A (source) ──────────────────────────────────────────────
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await disableSw(pageA);
    await mockFeedEndpoint(pageA);
    await pageA.goto('/');

    // Inject sync key into IDB, then reload so bootSync registers with server.
    await injectSyncKey(pageA, syncKeyA);

    // Add a feed via the UI.
    await pageA.getByRole('button', { name: 'Add feed' }).click();
    await pageA.waitForSelector('.modal.add-feed');
    await pageA.locator('.add-feed input[type="url"]').fill('https://example.com/blog');
    await pageA.getByRole('button', { name: 'Discover' }).click();
    await expect(pageA.locator('.samples')).toContainText('Test Feed');
    await pageA.getByRole('button', { name: 'Subscribe' }).click();
    await pageA.waitForSelector('.modal.add-feed', { state: 'detached' });
    const feedTitleA = pageA.locator('.sidebar .feed .title').filter({ hasText: 'Test Feed' });
    await expect(feedTitleA).toBeVisible();

    // Wait for the push to complete (1s debounce + network).
    await pageA.waitForResponse(
      (res) => res.url().includes('/sync/push'),
      { timeout: 10_000 },
    );

    // Open Devices, verify sync is on, and generate a pairing code.
    await pageA.getByRole('button', { name: 'Settings' }).first().click();
    await pageA.getByRole('link', { name: 'Devices' }).click();
    await expect(pageA.getByRole('button', { name: 'Sync now' })).toBeVisible({ timeout: 15_000 });
    await pageA.getByRole('button', { name: 'Show pairing code' }).click();
    await pageA.waitForSelector('.pair-code__qr svg', { timeout: 5000 });
    const displayCode = await pageA.locator('.pair-code__value').textContent();
    expect(displayCode).toBeTruthy();
    const pairCode = displayCode!.replace('-', '');

    // ── Device B (target) ─────────────────────────────────────────────
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await disableSw(pageB);

    const redeemResponse = pageB.waitForResponse((res) => res.url().includes('/sync/redeem'), { timeout: 15_000 });
    const pullResponse = pageB.waitForResponse((res) => res.url().includes('/sync/pull'), { timeout: 15_000 });
    await pageB.goto('/?pair=' + pairCode);

    const redeemRes = await redeemResponse;
    expect(redeemRes.status()).toBe(200);
    const redeemBody = await redeemRes.json() as { syncKey: string };
    expect(redeemBody.syncKey).toBeTruthy();
    await pullResponse;

    await expect(pageB.getByRole('status')).toHaveText('This device is now syncing', { timeout: 15_000 });
    await expect(pageB).toHaveURL(/\/settings\/devices$/);
    await pageB.goto('/');
    await pageB.waitForSelector('.sidebar');

    // Verify the feed appears on Device B's sidebar (synced via push/pull).
    const feedTitleB = pageB.locator('.sidebar .feed .title').filter({ hasText: 'Test Feed' });
    await expect(feedTitleB).toBeVisible({ timeout: 10_000 });

    await ctxA.close();
    await ctxB.close();
  });
});
