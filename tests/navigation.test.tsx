import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemo, createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { render } from 'solid-js/web';
import { Sidebar } from '../src/components/Sidebar';
import type { AppContext, AppState } from '../src/state';
import type { Feed } from '../src/db/types';

const contextRef = vi.hoisted(() => ({ value: null as AppContext | null }));

vi.mock('../src/state', () => ({
  useApp: () => {
    if (!contextRef.value) throw new Error('test context not set');
    return contextRef.value;
  },
}));

function makeContext(collapsed = false, view: 'river' | 'reading' | 'settings' = 'river') {
  const [state] = createStore<AppState>({
    view,
    riverScope: view === 'reading' ? 'f1' : null,
    activeTags: [],
    currentItem: null,
    sidebarOpen: false,
    sidebarHiddenDesktop: collapsed,
    articleListWidth: 720,
    articleListWidthCustomized: true,
    focusMode: false,
    focusedIndex: -1,
    starredOnly: false,
    readMode: 'all',
    modal: { kind: 'none' },
    returnToItemId: null,
    settingsPath: null,
  });
  const [feeds] = createSignal<Feed[]>([{
    id: 'f1',
    url: 'https://example.com/feed',
    title: 'Example feed',
    lastFetched: null,
    learnedIntervalMs: 3_600_000,
  }]);
  const openStats = vi.fn();
  const openSettings = vi.fn();
  const setRiverScope = vi.fn();
  const ctx = {
    state,
    feeds,
    feedMap: createMemo(() => new Map()),
    allTags: () => [],
    activeTagSet: () => new Set<string>(),
    settings: () => ({ theme: 'system', highContrast: false, lastRefreshRunAt: null, lastFeedUrl: null }),
    fetching: () => 0,
    feedErrors: () => ({}),
    fetchingFeeds: () => new Set<string>(),
    hydrated: () => true,
    clearTags: vi.fn(),
    setRiverScope,
    reloadItems: async () => {},
    saveSettingsPatch: async () => {},
    toggleStarFilter: vi.fn(),
    refreshSelected: async () => {},
    openModal: vi.fn(),
    toggleSidebarDesktop: vi.fn(),
    openStats,
    openSettings,
  } as unknown as AppContext;
  return { ctx, openStats, openSettings, setRiverScope };
}

describe('stats navigation', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    contextRef.value = null;
  });

  it('exposes Stats as a labeled bottom-sidebar CTA', () => {
    const { ctx, openStats } = makeContext();
    contextRef.value = ctx;
    const dispose = render(() => <Sidebar />, document.body);
    const button = [...document.querySelectorAll<HTMLButtonElement>('.sidebar-actions-bottom .sidebar-action')]
      .find((candidate) => candidate.textContent?.includes('Stats'));
    expect(button).toBeDefined();
    button?.click();
    expect(openStats).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('keeps a Stats icon action in the collapsed rail', () => {
    const { ctx } = makeContext(true);
    contextRef.value = ctx;
    const dispose = render(() => <Sidebar />, document.body);
    const button = document.querySelector<HTMLButtonElement>('.collapsed-action[title="Reading statistics"]');
    expect(button).not.toBeNull();
    dispose();
  });

  it('keeps feed scope visible and selectable while reading', () => {
    const { ctx, setRiverScope } = makeContext(false, 'reading');
    contextRef.value = ctx;
    const dispose = render(() => <Sidebar />, document.body);
    const feed = document.querySelector<HTMLElement>('.feed');
    expect(feed?.classList.contains('active')).toBe(true);
    feed?.click();
    expect(setRiverScope).toHaveBeenCalledWith('f1');
    dispose();
  });

  it('opens Settings from the sidebar and marks it as the current page', () => {
    const { ctx, openSettings } = makeContext(false, 'settings');
    contextRef.value = ctx;
    const dispose = render(() => <Sidebar />, document.body);
    const button = [...document.querySelectorAll<HTMLButtonElement>('.sidebar-actions-bottom .sidebar-action')]
      .find((candidate) => candidate.textContent?.includes('Settings'));
    expect(button?.getAttribute('aria-current')).toBe('page');
    expect(button?.classList.contains('active')).toBe(true);
    button?.click();
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.feed')?.classList.contains('active')).toBe(false);
    dispose();
  });

  it('marks the collapsed rail Settings action as current', () => {
    const { ctx, openSettings } = makeContext(true, 'settings');
    contextRef.value = ctx;
    const dispose = render(() => <Sidebar />, document.body);
    const button = document.querySelector<HTMLButtonElement>('.collapsed-action[title="Settings"]');
    expect(button?.getAttribute('aria-current')).toBe('page');
    button?.click();
    expect(openSettings).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('does not mark Settings as current elsewhere', () => {
    const { ctx } = makeContext();
    contextRef.value = ctx;
    const dispose = render(() => <Sidebar />, document.body);
    const button = [...document.querySelectorAll<HTMLButtonElement>('.sidebar-actions-bottom .sidebar-action')]
      .find((candidate) => candidate.textContent?.includes('Settings'));
    expect(button?.hasAttribute('aria-current')).toBe(false);
    dispose();
  });
});
