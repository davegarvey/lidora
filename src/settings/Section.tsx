import { Show, createContext, onMount, useContext, type Accessor, type JSX } from 'solid-js';
import { ChevronLeft } from 'lucide-solid';
import { PanelGroup } from './controls';

interface SectionLayout {
  narrow: Accessor<boolean>;
  back: () => void;
}

export const SectionLayoutContext = createContext<SectionLayout>();

export function Section(props: { title: string; children: JSX.Element }) {
  const layout = useContext(SectionLayoutContext);
  let heading: HTMLHeadingElement | undefined;
  onMount(() => heading?.focus({ preventScroll: true }));
  return (
    <PanelGroup>
      <section class="settings-section" aria-labelledby="settings-section-heading">
        <div class="settings-section__head">
          <Show when={layout?.narrow()}>
            <button type="button" class="settings-back" aria-label="Back to settings" onClick={() => layout?.back()}>
              <ChevronLeft size={20} />
            </button>
          </Show>
          <h2 id="settings-section-heading" tabIndex={-1} ref={heading}>{props.title}</h2>
        </div>
        {props.children}
      </section>
    </PanelGroup>
  );
}

export function SettingGroup(props: { title?: string; children: JSX.Element }) {
  return (
    <div class="setting-group" role={props.title ? 'group' : undefined} aria-label={props.title}>
      {props.children}
    </div>
  );
}
