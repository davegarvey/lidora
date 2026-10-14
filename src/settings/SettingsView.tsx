import { For, Match, Show, Switch, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { ChevronRight, X, ChevronLeft } from 'lucide-solid';
import { useApp } from '../state';
import { isNarrowViewport } from '../desktopLayout';
import { availableSettingsSections, settingsSectionAvailable, settingsUrl, type SettingsSection } from '../routing';
import { isSyncAvailable } from '../sync/capabilities';
import { SectionLayoutContext } from './Section';
import { AppearanceSection } from './AppearanceSection';
import { SubscriptionsSection } from './SubscriptionsSection';
import { DevicesSection } from './DevicesSection';
import { AgentsSection } from './AgentsSection';
import { StorageSection } from './StorageSection';
import { AboutSection } from './AboutSection';
import { ServerDataSection } from './ServerDataSection';

const TITLES: Record<SettingsSection, string> = {
  appearance: 'Appearance',
  subscriptions: 'Subscriptions',
  devices: 'Devices',
  agents: 'Agents',
  storage: 'Storage',
  'server-data': 'Server data',
  about: 'About',
};

export function SettingsView() {
  const ctx = useApp();
  const [sync, setSync] = createSignal<boolean | null>(null);
  void isSyncAvailable().then(setSync);
  const [narrow, setNarrow] = createSignal(isNarrowViewport());
  const onResize = () => setNarrow(isNarrowViewport());
  window.addEventListener('resize', onResize);
  onCleanup(() => window.removeEventListener('resize', onResize));

  const sections = createMemo(() =>
    availableSettingsSections({ sync: sync() === true, syncKey: Boolean(ctx.syncKey()) }),
  );

  const requested = () => ctx.state.settingsPath;
  const pending = () => {
    const section = requested();
    if (!section || sync() !== null) return false;
    return !settingsSectionAvailable(section, { sync: false, syncKey: false });
  };
  const current = (): SettingsSection | null => {
    const section = requested();
    return section && sections().includes(section) ? section : null;
  };
  const shown = (): SettingsSection | null => (narrow() ? current() : current() ?? 'appearance');

  createEffect(() => {
    const section = requested();
    if (!section || sync() === null || !ctx.hydrated()) return;
    if (!sections().includes(section)) {
      history.replaceState(history.state, '', settingsUrl(null));
      ctx.setState({ settingsPath: null });
    }
  });

  const choose = (event: MouseEvent, section: SettingsSection) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    ctx.selectSettingsSection(section);
  };

  const layout = { narrow, back: () => ctx.selectSettingsSection(null) };
  const showList = () => narrow() && current() === null && !pending();

  return (
    <SectionLayoutContext.Provider value={layout}>
      <div class="settings-view" data-narrow={String(narrow())}>
        <Show
          when={narrow() && !showList()}
          fallback={
            <header class="settings-header">
              <Show when={narrow()}>
                <button type="button" class="settings-back" aria-label="Close settings" onClick={() => ctx.closeSettings()}>
                  <ChevronLeft size={20} />
                </button>
              </Show>
              <h1>Settings</h1>
              <Show when={!narrow()}>
                <button type="button" class="settings-close" aria-label="Close settings" onClick={() => ctx.closeSettings()}>
                  <X size={18} />
                </button>
              </Show>
            </header>
          }
        >
          <h1 class="visually-hidden">Settings</h1>
        </Show>
        <div class="settings-body">
          <Show when={!narrow() || showList()}>
            <nav class="settings-nav" aria-label="Settings sections">
              <ul>
                <For each={sections()}>
                  {(section) => (
                    <li>
                      <a
                        href={settingsUrl(section)}
                        class="settings-nav__item"
                        classList={{ 'settings-nav__item--current': !narrow() && shown() === section }}
                        aria-current={!narrow() && shown() === section ? 'page' : undefined}
                        onClick={(event) => choose(event, section)}
                      >
                        <span>{TITLES[section]}</span>
                        <Show when={narrow()}>
                          <ChevronRight size={18} />
                        </Show>
                      </a>
                    </li>
                  )}
                </For>
              </ul>
            </nav>
          </Show>
          <Show when={!pending() && shown()} keyed>
            {(section) => (
              <div class="settings-content">
                <Switch>
                  <Match when={section === 'appearance'}><AppearanceSection /></Match>
                  <Match when={section === 'subscriptions'}><SubscriptionsSection /></Match>
                  <Match when={section === 'devices'}><DevicesSection /></Match>
                  <Match when={section === 'agents'}><AgentsSection /></Match>
                  <Match when={section === 'storage'}><StorageSection /></Match>
                  <Match when={section === 'server-data'}><ServerDataSection /></Match>
                  <Match when={section === 'about'}><AboutSection /></Match>
                </Switch>
              </div>
            )}
          </Show>
        </div>
      </div>
    </SectionLayoutContext.Provider>
  );
}
