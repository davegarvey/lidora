import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'solid-js/web';
import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { getDb } from '../src/db/open';
import { SettingsView } from '../src/settings/SettingsView';
import type { AppContext, AppState } from '../src/state';
import type { AppSettings, Feed } from '../src/db/types';
import type { SettingsSection } from '../src/routing';

const contextRef = vi.hoisted(() => ({ value: null as AppContext | null }));
const syncRef = vi.hoisted(() => ({ available: true }));

vi.mock('../src/state', () => ({
  useApp: () => {
    if (!contextRef.value) throw new Error('test context not set');
    return contextRef.value;
  },
}));

vi.mock('../src/sync/capabilities', () => ({
  isSyncAvailable: async () => syncRef.available,
  getSyncCapabilities: async () => ({ sync: syncRef.available, stats: false, items: false }),
}));

let dispose: (() => void) | undefined;

function makeContext(section: SettingsSection | null, options: { feeds?: Feed[]; narrow?: boolean } = {}) {
  window.innerWidth = options.narrow ? 400 : 1200;
  const [state, setState] = createStore<AppState>({
    view: 'settings',
    settingsPath: section,
    riverScope: null,
    activeTags: [],
    currentItem: null,
    sidebarOpen: false,
    articleListWidth: 720,
    articleListWidthCustomized: true,
    focusMode: false,
    focusedIndex: -1,
    starredOnly: false,
    readMode: 'all',
    modal: { kind: 'none' },
    returnToItemId: null,
  } as unknown as AppState);
  const [settings, setSettings] = createSignal<AppSettings>({
    theme: 'system',
    highContrast: false,
    lastRefreshRunAt: null,
    lastFeedUrl: null,
  } as AppSettings);
  const [feeds] = createSignal<Feed[]>(options.feeds ?? []);
  const selectSettingsSection = vi.fn((next: SettingsSection | null) => setState({ settingsPath: next }));
  const closeSettings = vi.fn();
  const openModal = vi.fn();
  const saveSettingsPatch = vi.fn(async (patch: Partial<AppSettings>) => { setSettings({ ...settings(), ...patch }); });
  contextRef.value = {
    state,
    setState,
    settings,
    feeds,
    hydrated: () => true,
    syncKey: () => null,
    selectSettingsSection,
    closeSettings,
    openModal,
    saveSettingsPatch,
    reloadFeeds: async () => feeds(),
    refreshFeeds: async () => {},
  } as unknown as AppContext;
  return { selectSettingsSection, closeSettings, openModal, saveSettingsPatch, state };
}

function mount() {
  document.body.innerHTML = '';
  dispose = render(() => <SettingsView />, document.body);
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(async () => {
  syncRef.available = true;
  const db = await getDb();
  await db.clear('feeds');
  await db.clear('items');
  await db.clear('itemBodies');
  history.replaceState(null, '', '/settings');
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = '';
  window.innerWidth = 1024;
});

const navItems = () => [...document.querySelectorAll<HTMLAnchorElement>('.settings-nav__item')];

describe('SettingsView wide layout', () => {
  it('has one h1, a labelled nav and shows Appearance by default', async () => {
    makeContext(null);
    mount();
    await flush();
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(document.querySelector('h1')?.textContent).toBe('Settings');
    expect(document.querySelector('nav[aria-label="Settings sections"]')).not.toBeNull();
    expect(document.querySelectorAll('h2')).toHaveLength(1);
    expect(document.querySelector('h2')?.textContent).toBe('Appearance');
    expect(navItems().map((a) => a.textContent)).toEqual(['Appearance', 'Subscriptions', 'Devices', 'Agents', 'Storage', 'About']);
    expect(navItems().filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.textContent)).toEqual(['Appearance']);
  });

  it('closes from the close button', async () => {
    const { closeSettings } = makeContext(null);
    mount();
    document.querySelector<HTMLButtonElement>('.settings-close')!.click();
    expect(closeSettings).toHaveBeenCalledTimes(1);
  });

  it('selects a section from the navigation and focuses its heading', async () => {
    const { selectSettingsSection } = makeContext('appearance');
    mount();
    navItems().find((a) => a.textContent === 'Storage')!.click();
    expect(selectSettingsSection).toHaveBeenCalledWith('storage');
    await flush();
    const heading = document.querySelector('h2')!;
    expect(heading.textContent).toBe('Storage');
    expect(document.activeElement).toBe(heading);
    expect(navItems().find((a) => a.getAttribute('aria-current') === 'page')?.textContent).toBe('Storage');
  });

  it('hides sync sections when sync is unavailable and falls back to /settings', async () => {
    syncRef.available = false;
    const { state } = makeContext('devices');
    history.replaceState(null, '', '/settings/devices');
    mount();
    await flush();
    expect(navItems().map((a) => a.textContent)).toEqual(['Appearance', 'Subscriptions', 'Storage', 'About']);
    expect(state.settingsPath).toBeNull();
    expect(window.location.pathname).toBe('/settings');
    expect(document.querySelector('h2')?.textContent).toBe('Appearance');
  });

  it('does not show a sync section before capabilities are known', async () => {
    makeContext('agents');
    mount();
    expect(document.querySelector('h2')).toBeNull();
    await flush();
    expect(document.querySelector('h2')?.textContent).toBe('Agents');
  });
});

describe('SettingsView narrow layout', () => {
  it('shows only the section list at /settings', async () => {
    const { closeSettings } = makeContext(null, { narrow: true });
    mount();
    await flush();
    expect(navItems()).toHaveLength(6);
    expect(document.querySelector('h2')).toBeNull();
    expect(navItems().every((a) => !a.hasAttribute('aria-current'))).toBe(true);
    document.querySelector<HTMLButtonElement>('.settings-back')!.click();
    expect(closeSettings).toHaveBeenCalledTimes(1);
  });

  it('shows a section with a back button that returns to the list', async () => {
    const { selectSettingsSection } = makeContext('storage', { narrow: true });
    mount();
    await flush();
    expect(document.querySelector('nav')).toBeNull();
    expect(document.querySelector('h2')?.textContent).toBe('Storage');
    document.querySelector<HTMLButtonElement>('.settings-back')!.click();
    expect(selectSettingsSection).toHaveBeenCalledWith(null);
  });
});

describe('Appearance', () => {
  it('applies theme and high contrast immediately', async () => {
    const { saveSettingsPatch } = makeContext('appearance');
    mount();
    const dark = [...document.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((b) => b.textContent === 'Dark')!;
    dark.click();
    expect(saveSettingsPatch).toHaveBeenCalledWith({ theme: 'dark' });
    const toggle = document.querySelector<HTMLButtonElement>('[role="switch"]')!;
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    toggle.click();
    expect(saveSettingsPatch).toHaveBeenCalledWith({ highContrast: true });
    await flush();
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(document.getElementById(toggle.getAttribute('aria-labelledby')!)?.textContent).toBe('High contrast');
  });
});

describe('Subscriptions', () => {
  const feed = (n: number): Feed => ({ id: `f${n}`, url: `https://example.com/${n}.xml`, title: `Feed ${n}`, lastFetched: null, learnedIntervalMs: 3_600_000 });

  it('disables export with no feeds', async () => {
    makeContext('subscriptions');
    mount();
    expect(document.querySelector('.settings-summary')?.textContent).toBe('0 feeds');
    const exportButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Export')!;
    expect(exportButton.disabled).toBe(true);
  });

  it('counts feeds and enables export', async () => {
    makeContext('subscriptions', { feeds: [feed(1), feed(2)] });
    mount();
    expect(document.querySelector('.settings-summary')?.textContent).toBe('2 feeds');
    const exportButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Export')!;
    expect(exportButton.disabled).toBe(false);
  });

  async function chooseFile(content: string) {
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = { text: async () => content } as unknown as File;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
    await flush();
  }

  const opml = (urls: string[]) => `<opml><body>${urls.map((u) => `<outline text="x" xmlUrl="${u}"/>`).join('')}</body></opml>`;

  it('previews new and existing feeds before importing', async () => {
    const db = await getDb();
    await db.put('feeds', feed(1));
    makeContext('subscriptions', { feeds: [feed(1)] });
    mount();
    await chooseFile(opml(['https://example.com/1.xml', 'https://example.com/9.xml', 'https://example.com/10.xml']));
    const panel = document.querySelector('.panel')!;
    expect(panel.textContent).toContain('2 feeds will be added. 1 already subscribed.');
    expect([...panel.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Import', 'Cancel']);
    expect(await db.count('feeds')).toBe(1);
  });

  it('cancels the preview without adding anything', async () => {
    const db = await getDb();
    makeContext('subscriptions');
    mount();
    await chooseFile(opml(['https://example.com/9.xml']));
    const trigger = document.querySelector<HTMLButtonElement>('[aria-expanded]')!;
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    [...document.querySelectorAll<HTMLButtonElement>('.panel button')].find((b) => b.textContent === 'Cancel')!.click();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
    expect(await db.count('feeds')).toBe(0);
  });

  it('imports and refreshes on confirmation', async () => {
    const db = await getDb();
    const ctx = makeContext('subscriptions');
    const refresh = vi.fn(async () => {});
    contextRef.value!.refreshFeeds = refresh;
    mount();
    await chooseFile(opml(['https://example.com/9.xml']));
    [...document.querySelectorAll<HTMLButtonElement>('.panel button')].find((b) => b.textContent === 'Import')!.click();
    await vi.waitFor(() => expect(document.querySelector('[role="status"]')?.textContent).toBe('Imported 1 feed.'));
    expect(await db.count('feeds')).toBe(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(ctx.state.view).toBe('settings');
  });

  it('shows an inline error for a file with no feeds', async () => {
    makeContext('subscriptions');
    mount();
    await chooseFile('<opml><body></body></opml>');
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('does not contain any feeds');
    expect(document.querySelector('[aria-expanded]')!.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows an inline error for an unreadable file', async () => {
    makeContext('subscriptions');
    mount();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = { text: async () => { throw new Error('read failed'); } } as unknown as File;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('could not be read as OPML');
  });
});

describe('Storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a one-line summary, details and the persistence action', async () => {
    const db = await getDb();
    await db.put('items', { id: 'a', feedId: 'f', guid: 'a', title: 'A', publishedAt: 1, read: false, starred: false } as never);
    vi.stubGlobal('navigator', {
      storage: {
        estimate: async () => ({ usage: 73_728, quota: 5 * 1024 * 1024 * 1024 }),
        persisted: async () => false,
        persist: async () => true,
      },
    });
    makeContext('storage');
    mount();
    await vi.waitFor(() => expect(document.querySelector('.settings-summary')?.textContent).toBe('72 KB used · 1 article'));
    const details = [...document.querySelectorAll('.settings-details > div')].map((d) => d.textContent);
    expect(details).toEqual(['Quota5.0 GB', 'Persistent storageOff', 'Article records1', 'Saved article bodies0']);
    const keep = [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Keep data on this device');
    expect(keep).toBeDefined();
    expect(document.body.textContent).toContain("Your browser may clear Sift's data when space runs low");
  });

  it('says Unavailable where the browser reports nothing', async () => {
    vi.stubGlobal('navigator', {});
    makeContext('storage');
    mount();
    await vi.waitFor(() => expect(document.querySelector('.settings-details')).not.toBeNull());
    const details = [...document.querySelectorAll('.settings-details > div')].map((d) => d.textContent);
    expect(details[0]).toBe('QuotaUnavailable');
    expect(details[1]).toBe('Persistent storageUnavailable');
    expect(document.querySelector('.settings-summary')?.textContent).toMatch(/^\d+ articles?$/);
  });
});

describe('About', () => {
  it('shows version, source link, shortcuts action and public pages', async () => {
    const { openModal } = makeContext('about');
    mount();
    expect(document.body.textContent).toMatch(/v\d+\.\d+\.\d+/);
    expect(document.querySelector<HTMLAnchorElement>('a[href="https://github.com/davegarvey/sift"]')).not.toBeNull();
    expect([...document.querySelectorAll('nav[aria-label="About Sift"] a')].map((a) => a.getAttribute('href'))).toEqual(['/about', '/privacy', '/terms']);
    [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Show shortcuts')!.click();
    expect(openModal).toHaveBeenCalledWith({ kind: 'shortcuts' });
  });
});
