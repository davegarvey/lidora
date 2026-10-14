// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'solid-js/store';
import { render } from 'solid-js/web';
import { ReadingView } from '../src/components/ReadingView';
import type { AppContext, AppState } from '../src/state';
import type { Item } from '../src/db/types';

const contextRef = vi.hoisted(() => ({ value: null as AppContext | null }));
const openItemForReading = vi.hoisted(() => vi.fn());

vi.mock('../src/articles/service', () => ({ openItemForReading }));

vi.mock('../src/state', () => ({
  useApp: () => {
    if (!contextRef.value) throw new Error('test context not set');
    return contextRef.value;
  },
}));

describe('reading view focus-mode navigation', () => {
  let dispose: (() => void) | undefined;
  let originalMatchMedia: typeof window.matchMedia | undefined;

  beforeEach(() => {
    document.body.innerHTML = '';
    originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: false }),
    });

    const [state, setStore] = createStore<AppState>({
      view: 'reading',
      riverScope: null,
      activeTags: [],
      currentItem: null,
      sidebarOpen: false,
      sidebarHiddenDesktop: false,
      articleListWidth: 432,
      articleListWidthCustomized: false,
      focusMode: true,
      focusedIndex: -1,
      starredOnly: false,
    readMode: 'all',
      modal: { kind: 'none' },
      returnToItemId: null,
      settingsPath: null,
    });
    const closeReading = vi.fn(async () => {});
    contextRef.value = {
      state,
      setState: (patch: Partial<AppState>) => setStore(patch),
      feeds: () => [],
      items: () => [],
      closeReading,
      saveSettingsPatch: vi.fn(async () => {}),
    } as unknown as AppContext;
    dispose = render(() => <ReadingView />, document.body);
  });

  afterEach(() => {
    dispose?.();
    contextRef.value = null;
    if (originalMatchMedia) {
      Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia });
    } else {
      delete (window as Partial<Window>).matchMedia;
    }
  });

  it('shows a back action in focus mode that returns to the river', () => {
    const back = document.querySelector<HTMLButtonElement>('.reading-chrome .back');
    expect(back?.getAttribute('aria-label')).toBe('Back');
    expect(document.querySelector<HTMLButtonElement>('.focus-mode-toggle')?.title).toBe('Disable focus mode');

    back?.click();
    expect(contextRef.value?.closeReading).toHaveBeenCalledOnce();
    expect(contextRef.value?.state.focusMode).toBe(true);
  });
});

describe('reading view article body', () => {
  let dispose: (() => void) | undefined;

  afterEach(() => {
    dispose?.();
    contextRef.value = null;
    vi.unstubAllGlobals();
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
  });

  it('renders the body through the sanitiser', async () => {
    vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    HTMLElement.prototype.scrollTo = () => {};
    openItemForReading.mockResolvedValue({
      bodyHtml: '<figure><img src="/img?url=x" onerror="alert(1)" alt="A"><figcaption>Cap</figcaption></figure><script>alert(2)</script>',
      extracted: true,
      extractionFailed: false,
    });
    const item: Item = {
      id: 'f1::g1',
      feedId: 'f1',
      guid: 'g1',
      title: 'Title',
      excerpt: '',
      publishedAt: 1000,
      updatedAt: 1000,
      read: true,
      starred: false,
      createdAt: 1000,
    };
    const [state, setStore] = createStore<AppState>({
      view: 'reading',
      riverScope: null,
      activeTags: [],
      currentItem: item,
      sidebarOpen: false,
      sidebarHiddenDesktop: false,
      articleListWidth: 432,
      articleListWidthCustomized: false,
      focusMode: false,
      focusedIndex: 0,
      starredOnly: false,
      readMode: 'all',
      modal: { kind: 'none' },
      returnToItemId: null,
      settingsPath: null,
    });
    contextRef.value = {
      state,
      setState: (patch: Partial<AppState>) => setStore(patch),
      feeds: () => [],
      items: () => [item],
      closeReading: vi.fn(async () => {}),
      saveSettingsPatch: vi.fn(async () => {}),
    } as unknown as AppContext;
    document.body.innerHTML = '';
    dispose = render(() => <ReadingView />, document.body);

    await vi.waitFor(() => expect(document.querySelector('.reading-content figure')).not.toBeNull());
    const img = document.querySelector('.reading-content figure img')!;
    expect(img.getAttribute('src')).toBe('/img?url=x');
    expect(img.hasAttribute('onerror')).toBe(false);
    expect(document.querySelector('.reading-content figcaption')?.textContent).toBe('Cap');
    expect(document.querySelector('.reading-content script')).toBeNull();
  });
});
