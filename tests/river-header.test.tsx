// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'solid-js/store';
import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { RiverHeader } from '../src/components/RiverHeader';
import type { AppContext, AppState } from '../src/state';
import type { Feed } from '../src/db/types';

const contextRef = vi.hoisted(() => ({ value: null as AppContext | null }));

vi.mock('../src/state', () => ({
  useApp: () => {
    if (!contextRef.value) throw new Error('test context not set');
    return contextRef.value;
  },
}));

function makeContext(overrides: Partial<AppState> = {}, feeds: Feed[] = [{ id: 'f1', title: 'Example Feed' } as Feed]) {
  const [state, setStore] = createStore<AppState>({
    view: 'river',
    riverScope: null,
    activeTags: [],
    currentItem: null,
    sidebarOpen: false,
    sidebarHiddenDesktop: false,
    sidebarWidth: 240,
    articleListWidth: 640,
    articleListWidthCustomized: false,
    focusMode: false,
    focusedIndex: -1,
    starredOnly: false,
    readMode: 'all',
    modal: { kind: 'none' },
    returnToItemId: null,
    settingsPath: null,
    pairResult: null,
    ...overrides,
  } as AppState);
  const [order, setOrder] = createSignal<'latest' | 'for-you'>('latest');
  const ctx = {
    state,
    feeds: () => feeds,
    feedMap: () => new Map(feeds.map((feed) => [feed.id, feed])),
    settings: () => ({ articleOrder: order() }),
    toggleStarFilter: () => setStore({ starredOnly: !state.starredOnly }),
    setReadMode: async (mode: 'all' | 'unread') => { setStore({ readMode: mode }); },
    setArticleOrder: async (next: 'latest' | 'for-you') => { setOrder(next); },
  } as unknown as AppContext;
  return { ctx, setStore };
}

const button = (name: string) => document.querySelector<HTMLButtonElement>(`.river-header button[aria-label="${name}"]`);
const title = () => document.querySelector('.river-header-title')?.textContent;
const mount = (ctx: AppContext, scrolled = false) => {
  contextRef.value = ctx;
  return render(() => <RiverHeader scrolled={scrolled} />, document.body);
};

describe('river list header', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    contextRef.value = null;
  });

  it('titles the scope for all, a feed and several tags', () => {
    const all = makeContext();
    let dispose = mount(all.ctx);
    expect(title()).toBe('All');
    dispose();

    dispose = mount(makeContext({ riverScope: 'f1' }).ctx);
    expect(title()).toBe('Example Feed');
    dispose();

    dispose = mount(makeContext({ activeTags: ['news', 'tech'] }).ctx);
    expect(title()).toBe('news, tech');
    dispose();
  });

  it('is absent without feeds', () => {
    mount(makeContext({}, []).ctx);
    expect(document.querySelector('.river-header')).toBeNull();
  });

  it('marks the scrolled state', () => {
    mount(makeContext().ctx, true);
    expect(document.querySelector('.river-header')?.hasAttribute('data-scrolled')).toBe(true);
  });

  it('exposes accessible names and the current order', async () => {
    mount(makeContext().ctx);
    expect(button('Show starred only')?.title).toBe('Show starred only');
    expect(button('Show unread only')?.getAttribute('aria-pressed')).toBe('false');
    const order = button('Article order: Latest');
    expect(order?.getAttribute('aria-pressed')).toBe('false');
    order?.click();
    await Promise.resolve();
    const forYou = button('Article order: For you');
    expect(forYou?.getAttribute('aria-pressed')).toBe('true');
    expect(forYou?.title).toBe('Article order: For you');
  });

  it('disables Unread while Starred is active and composes the toggles', async () => {
    const { ctx } = makeContext();
    mount(ctx);
    button('Show unread only')?.click();
    await Promise.resolve();
    button('Article order: Latest')?.click();
    await Promise.resolve();
    expect(button('Show unread only')?.getAttribute('aria-pressed')).toBe('true');
    expect(button('Show unread only')?.classList.contains('active')).toBe(true);
    expect(button('Article order: For you')?.getAttribute('aria-pressed')).toBe('true');

    button('Show starred only')?.click();
    const unread = button('Show unread only');
    expect(button('Show starred only')?.getAttribute('aria-pressed')).toBe('true');
    expect(unread?.disabled).toBe(true);
    expect(unread?.classList.contains('active')).toBe(false);
    expect(unread?.title).toBe('Unread filter is off while showing starred');
    expect(ctx.state.readMode).toBe('unread');

    button('Show starred only')?.click();
    expect(button('Show unread only')?.disabled).toBe(false);
    expect(button('Show unread only')?.classList.contains('active')).toBe(true);
  });
});
