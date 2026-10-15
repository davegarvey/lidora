import { expect, test, type Page } from '@playwright/test';

async function disableSw(page: Page): Promise<void> {
  await page.route('**/registerSW.js', (route) => route.abort());
  await page.route('**/sw.js', (route) => route.abort());
  await page.route('**/workbox-*.js', (route) => route.abort());
}

async function openApp(page: Page, origin: string, path = '/'): Promise<void> {
  await disableSw(page);
  await page.goto(`${origin}${path}`);
  await page.locator('.sidebar').waitFor();
}

async function seed(page: Page, databaseName: string, kind: 'source' | 'destination'): Promise<void> {
  await page.evaluate(async ({ databaseName, kind }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const names = ['feeds', 'items', 'itemBodies', 'meta', 'itemFlags', 'feedStats', 'readMarkers'];
    const tx = db.transaction(names, 'readwrite');
    for (const name of names) tx.objectStore(name).clear();
    const source = kind === 'source';
    const feedId = source ? 'feed-one' : 'feed-one';
    const url = source ? 'https://source.example/feed.xml' : 'https://existing.example/feed.xml';
    const itemId = `${feedId}::article-1`;
    tx.objectStore('feeds').put({ id: feedId, url, title: source ? 'Source library' : 'Destination library', titleAt: 10, tags: ['saved'], lastFetched: Date.now(), learnedIntervalMs: 3600000 });
    tx.objectStore('items').put({ id: itemId, feedId, guid: 'article-1', title: source ? 'Moved article' : 'Existing article', publishedAt: 10, updatedAt: 10, excerpt: 'summary', read: false, starred: true, createdAt: 10, lastSeenAt: 10 });
    tx.objectStore('itemBodies').put({ id: itemId, feedId, html: '<article>body</article>', extractedHtml: '<article>saved text</article>' });
    tx.objectStore('itemFlags').put({ id: itemId, feedId, read: 0, starred: 1 });
    tx.objectStore('feedStats').put({ feedId, totalSeen: 9, readOnce: 2, serverReadOnce: 1, title: 'Feed', url });
    tx.objectStore('readMarkers').put({ id: itemId, feedId, acknowledged: 0 });
    tx.objectStore('meta').put({ key: 'settings', value: { theme: source ? 'dark' : 'light', syncKey: source ? 'private-sync-key' : 'destination-sync-key', lastSyncAt: 1700000000, lastItemsCursor: 42 } });
    tx.objectStore('meta').put({ key: 'sync_dirty', value: [{ kind: 'feed-upsert', feedId, ...(source ? { itemId } : {}) }] });
    tx.objectStore('meta').put({ key: source ? 'source-only' : 'destination-only', value: true });
    if (source) {
      for (let index = 0; index < 75; index += 1) tx.objectStore('meta').put({ key: `source-extra-${String(index).padStart(3, '0')}`, value: `state-${index}` });
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  }, { databaseName, kind });
}

test('Settings remains routed and adapts its navigation on narrow screens', async ({ page }) => {
  await openApp(page, 'http://127.0.0.1:8787', '/settings/storage');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Storage', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/storage$/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:8787/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.locator('.settings-nav__item')).toHaveCount(6);
  await page.getByRole('link', { name: 'Storage' }).click();
  await expect(page).toHaveURL(/\/settings\/storage$/);
  await expect(page.getByRole('button', { name: /Back/ })).toBeVisible();
});

test('public pages and the installed-app manifest use Lidora identity', async ({ page, request }) => {
  const about = await request.get('http://127.0.0.1:8787/about');
  expect(about.ok()).toBe(true);
  expect(await about.text()).toContain('Lidora');
  const privacy = await request.get('http://127.0.0.1:8787/privacy');
  expect(privacy.ok()).toBe(true);
  expect(await privacy.text()).toContain('Lidora');
  const terms = await request.get('http://127.0.0.1:8787/terms');
  expect(terms.ok()).toBe(true);
  expect(await terms.text()).toContain('Lidora');

  await page.goto('http://127.0.0.1:8787/');
  await expect(page).toHaveTitle(/Lidora/);
  expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toBe('https://lidora.app/');
  const llms = await request.get('http://127.0.0.1:8787/llms.txt');
  expect(await llms.text()).toContain('`<origin>/mcp`');
});

test('backup recovery rejects invalid files without creating a library, then restores all stores', async ({ page }) => {
  await disableSw(page);
  await page.goto('http://lidora.localhost:8788/migrate.html');
  const invalidChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose backup file' }).click();
  await (await invalidChooser).setFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"wrong"}') });
  await expect(page.getByRole('alert')).toContainText('not a Lidora library backup');
  expect(await page.evaluate(() => indexedDB.databases())).toEqual([]);

  const feedId = 'recovery-feed';
  const itemId = `${feedId}::article-1`;
  const backup = {
    format: 'lidora-library',
    library: {
      schemaVersion: 11,
      feeds: [{ id: feedId, url: 'https://recovery.example/feed.xml', title: 'Recovered feed', lastFetched: 1, learnedIntervalMs: 3600000 }],
      items: [{ id: itemId, feedId, guid: 'article-1', title: 'Recovered article', publishedAt: 1, updatedAt: 1, excerpt: 'summary', read: false, starred: true, createdAt: 1, lastSeenAt: 1 }],
      itemBodies: [{ id: itemId, feedId, html: '<p>recovered body</p>', extractedHtml: '<p>saved extraction</p>' }],
      meta: [{ key: 'settings', value: { theme: 'dark', syncKey: 'recovery-sync-key' } }, { key: 'sync_dirty', value: [{ kind: 'feed-upsert', feedId }] }],
      itemFlags: [{ id: itemId, feedId, read: 0, starred: 1 }],
      feedStats: [{ feedId, totalSeen: 1, readOnce: 0, serverReadOnce: 0, title: 'Recovered feed', url: 'https://recovery.example/feed.xml' }],
      readMarkers: [{ id: itemId, feedId, acknowledged: 0 }],
    },
  };
  const validChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose backup file' }).click();
  await (await validChooser).setFiles({ name: 'lidora-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.locator('#status')).toContainText('1 subscriptions and 1 articles were checked and saved');
  expect(await page.evaluate(async () => (await indexedDB.databases()).map((entry) => entry.name))).toContain('lidora');
});

test('interrupted full-library handoff preserves both copies and can be retried into an existing library', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    if (location.hostname !== 'lidora.localhost' || location.pathname !== '/migrate.html') return;
    const port = MessagePort.prototype;
    const original = port.postMessage;
    Object.defineProperty(port, 'postMessage', {
      configurable: true,
      value: function (this: MessagePort, message: unknown, ...args: unknown[]) {
        const send = () => Reflect.apply(original, this, [message, ...args]);
        if (typeof message === 'object' && message !== null && 'type' in message && (message as { type?: string }).type === 'batch-received') {
          setTimeout(send, 800);
        } else {
          send();
        }
      },
    });
  });
  const source = await context.newPage();
  const target = await context.newPage();
  await openApp(source, 'http://127.0.0.1:8787', '/settings/storage');
  await openApp(target, 'http://lidora.localhost:8788');
  await seed(source, 'sift', 'source');
  await seed(target, 'lidora', 'destination');
  await source.reload();
  await expect(source.getByRole('button', { name: 'Move to Lidora' })).toBeVisible();
  const secondSourceTab = await context.newPage();
  await openApp(secondSourceTab, 'http://127.0.0.1:8787');

  const interruption = source.waitForEvent('popup');
  await source.getByRole('button', { name: 'Move to Lidora' }).click();
  const firstReceiver = await interruption;
  await expect(secondSourceTab.getByRole('heading', { name: 'Moving your library' })).toBeVisible();
  await expect(target.getByRole('heading', { name: 'Moving your library' })).toBeVisible();
  await expect(firstReceiver.locator('#status')).toContainText('Received library section 1');
  await firstReceiver.close();
  await expect(source.getByRole('alert')).toContainText('transfer window was closed');

  const targetAfterInterruption = await target.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('lidora');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction(['feeds', 'items'], 'readonly');
    const feeds = await new Promise<unknown[]>((resolve, reject) => {
      const request = tx.objectStore('feeds').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const items = await new Promise<unknown[]>((resolve, reject) => {
      const request = tx.objectStore('items').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return { feeds, items };
  });
  expect(targetAfterInterruption.feeds).toHaveLength(1);
  expect(targetAfterInterruption.items).toHaveLength(1);

  const retryPopup = source.waitForEvent('popup');
  await source.getByRole('button', { name: 'Move to Lidora' }).click();
  const receiver = await retryPopup;
  await expect(receiver.locator('#status')).toContainText('Your library is on Lidora', { timeout: 20_000 });

  const transferred = await receiver.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('lidora');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const names = ['feeds', 'items', 'itemBodies', 'meta', 'itemFlags', 'feedStats', 'readMarkers'];
    const tx = db.transaction(names, 'readonly');
    const results = await Promise.all(names.map((name) => new Promise<unknown[]>((resolve, reject) => {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    })));
    db.close();
    return Object.fromEntries(names.map((name, index) => [name, results[index]])) as Record<string, Array<Record<string, unknown>>>;
  });
  expect(transferred.feeds).toHaveLength(2);
  expect(transferred.items).toHaveLength(2);
  expect(transferred.itemBodies).toHaveLength(2);
  expect(transferred.itemFlags).toHaveLength(2);
  expect(transferred.feedStats).toHaveLength(2);
  expect(transferred.readMarkers).toHaveLength(2);
  const movedFeed = transferred.feeds.find((feed) => feed.url === 'https://source.example/feed.xml')!;
  expect(movedFeed.id).not.toBe('feed-one');
  const movedItem = transferred.items.find((item) => item.title === 'Moved article')!;
  expect(movedItem.feedId).toBe(movedFeed.id);
  expect(transferred.itemBodies.find((body) => body.id === movedItem.id)?.extractedHtml).toContain('saved text');
  expect(transferred.meta.find((meta) => meta.key === 'settings')?.value).toMatchObject({ syncKey: 'private-sync-key', lastItemsCursor: 42 });
  expect(transferred.meta.find((meta) => meta.key === 'lidora-migration-retained-sync-accounts')?.value).toEqual([
    { syncKey: 'destination-sync-key', lastSyncAt: 1700000000, lastItemsCursor: 42 },
  ]);
  expect(transferred.meta.map((meta) => meta.key)).toContain('destination-only');
  expect(transferred.meta.map((meta) => meta.key)).toContain('source-only');
  const dirty = transferred.meta.find((meta) => meta.key === 'sync_dirty')?.value as Array<Record<string, unknown>>;
  expect(dirty.some((entry) => entry.feedId === movedFeed.id && entry.itemId === movedItem.id)).toBe(true);
  await expect(secondSourceTab.getByRole('heading', { name: 'Your library is on Lidora' })).toBeVisible();

  const sourceRemains = await source.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('sift');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction(['feeds', 'items'], 'readonly');
    const [feeds, items] = await Promise.all(['feeds', 'items'].map((name) => new Promise<unknown[]>((resolve, reject) => {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    })));
    db.close();
    return { feeds, items };
  });
  expect(sourceRemains.feeds).toHaveLength(1);
  expect(sourceRemains.items).toHaveLength(1);
  await context.close();
});
