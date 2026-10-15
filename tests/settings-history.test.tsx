import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'solid-js/web';
import { AppProvider, useApp, type AppContext } from '../src/state';
import { App } from '../src/App';

vi.mock('../src/sync/capabilities', () => ({
  isSyncAvailable: async () => false,
  getSyncCapabilities: async () => ({ sync: false, stats: false, items: false }),
  isStatsSyncAvailable: async () => false,
  isItemSyncAvailable: async () => false,
  resetSyncCapabilityCache: () => {},
}));

let ctx: AppContext;
let dispose: (() => void) | undefined;

function Probe() {
  ctx = useApp();
  return null;
}

async function mount(path: string, width = 1200) {
  window.innerWidth = width;
  history.replaceState(null, '', path);
  document.body.innerHTML = '';
  dispose = render(() => <AppProvider><Probe /></AppProvider>, document.body);
  await vi.waitFor(() => expect(ctx.hydrated()).toBe(true));
}

const nextPop = () => new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }));

beforeEach(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia;
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })));
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.unstubAllGlobals();
  window.innerWidth = 1024;
});

describe('settings history', () => {
  it('opens the view from a direct request', async () => {
    await mount('/settings/storage');
    expect(ctx.state.view).toBe('settings');
    expect(ctx.state.settingsPath).toBe('storage');
  });

  it('treats an unknown section as the section list', async () => {
    await mount('/settings/nope');
    expect(ctx.state.view).toBe('settings');
    expect(ctx.state.settingsPath).toBeNull();
  });

  it('pushes one entry when opening', async () => {
    await mount('/');
    const before = history.length;
    ctx.openSettings();
    expect(history.length).toBe(before + 1);
    expect(window.location.pathname).toBe('/settings');
    expect(ctx.state.view).toBe('settings');
  });

  it('replaces the entry when switching sections on a wide screen', async () => {
    await mount('/');
    ctx.openSettings();
    const length = history.length;
    ctx.selectSettingsSection('appearance');
    ctx.selectSettingsSection('storage');
    expect(history.length).toBe(length);
    expect(window.location.pathname).toBe('/settings/storage');
    expect(ctx.state.settingsPath).toBe('storage');
  });

  it('pushes an entry when opening a section from the list on a narrow screen, and Back returns to the list', async () => {
    await mount('/', 400);
    ctx.openSettings();
    const length = history.length;
    ctx.selectSettingsSection('storage');
    expect(history.length).toBe(length + 1);
    expect(window.location.pathname).toBe('/settings/storage');
    const popped = nextPop();
    ctx.selectSettingsSection(null);
    await popped;
    expect(window.location.pathname).toBe('/settings');
  });

  it('returns to the list by replacing when a section was loaded directly', async () => {
    await mount('/settings/storage', 400);
    const length = history.length;
    ctx.selectSettingsSection(null);
    expect(history.length).toBe(length);
    expect(window.location.pathname).toBe('/settings');
    expect(ctx.state.settingsPath).toBeNull();
  });

  it('closes with history.back() when opened inside the app', async () => {
    await mount('/');
    ctx.openSettings('about');
    const popped = nextPop();
    ctx.closeSettings();
    await popped;
    expect(window.location.pathname).toBe('/');
  });

  it('closes by replacing with / when opened by a direct request', async () => {
    await mount('/settings/about');
    const length = history.length;
    ctx.closeSettings();
    expect(history.length).toBe(length);
    expect(window.location.pathname).toBe('/');
    expect(ctx.state.view).toBe('river');
  });
});

describe('settings in the app shell', () => {
  async function mountApp(path: string) {
    window.innerWidth = 1200;
    history.replaceState(null, '', path);
    document.body.innerHTML = '';
    dispose = render(() => <App />, document.body);
    await vi.waitFor(() => expect(document.querySelector('.settings-view')).not.toBeNull());
  }

  const key = (target: EventTarget, name: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));

  it('replaces the river with Settings and keeps the sidebar', async () => {
    await mountApp('/settings/appearance');
    expect(document.querySelector('.sidebar')).not.toBeNull();
    expect(document.querySelector('.article-list-pane')).toBeNull();
    const item = [...document.querySelectorAll('.sidebar-action')].find((b) => b.textContent?.includes('Settings'));
    expect(item?.getAttribute('aria-current')).toBe('page');
  });

  it('closes Settings on Escape when nothing is open and no input has focus', async () => {
    await mountApp('/settings/appearance');
    key(document.body, 'Escape');
    await vi.waitFor(() => expect(document.querySelector('.settings-view')).toBeNull());
    expect(window.location.pathname).toBe('/');
  });

  it('collapses an expanded panel first and then closes Settings', async () => {
    await mountApp('/settings/subscriptions');
    await vi.waitFor(() => expect(document.querySelector('input[type="file"]')).not.toBeNull());
    const trigger = document.querySelector<HTMLButtonElement>('.settings-view [aria-expanded]')!;
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [{ text: async () => '<opml><outline xmlUrl="https://e.com/a.xml"/></opml>' }], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    key(document.activeElement ?? document.body, 'Escape');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('.settings-view')).not.toBeNull();
    key(document.body, 'Escape');
    await vi.waitFor(() => expect(document.querySelector('.settings-view')).toBeNull());
  });

  it('does not close Settings from a focused input', async () => {
    await mountApp('/settings/appearance');
    const field = document.createElement('input');
    document.body.appendChild(field);
    field.focus();
    key(field, 'Escape');
    expect(document.querySelector('.settings-view')).not.toBeNull();
    field.remove();
  });

  it('restores the view from the URL on popstate', async () => {
    await mountApp('/settings/appearance');
    history.pushState(null, '', '/settings/storage');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.waitFor(() => expect(document.querySelector('h2')?.textContent).toBe('Storage'));
    history.pushState(null, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.waitFor(() => expect(document.querySelector('.settings-view')).toBeNull());
  });
});
