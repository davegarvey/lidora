import {
  For,
  Show,
  createContext,
  createEffect,
  createSignal,
  createUniqueId,
  onCleanup,
  useContext,
  type Accessor,
  type JSX,
} from 'solid-js';

interface RowContextValue {
  labelId: string;
  descriptionId: string | undefined;
}

const RowContext = createContext<RowContextValue>();

export function SettingRow(props: {
  label: JSX.Element;
  description?: JSX.Element;
  danger?: boolean;
  children?: JSX.Element;
}) {
  const base = createUniqueId();
  const labelId = `${base}-label`;
  const descriptionId = () => (props.description ? `${base}-description` : undefined);
  return (
    <RowContext.Provider value={{ labelId, get descriptionId() { return descriptionId(); } }}>
      <div class="setting-row" classList={{ 'setting-row--danger': props.danger }}>
        <div class="setting-row__text">
          <div class="setting-row__label" id={labelId}>{props.label}</div>
          <Show when={props.description}>
            <div class="setting-row__description" id={descriptionId()}>{props.description}</div>
          </Show>
        </div>
        <Show when={props.children}>
          <div class="setting-row__control">{props.children}</div>
        </Show>
      </div>
    </RowContext.Provider>
  );
}

export function Switch(props: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  const row = useContext(RowContext);
  return (
    <button
      type="button"
      role="switch"
      class="switch"
      classList={{ 'switch--on': props.checked }}
      aria-checked={props.checked}
      aria-label={row ? undefined : props.label}
      aria-labelledby={row?.labelId}
      aria-describedby={row?.descriptionId}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
    >
      <span class="switch__thumb" aria-hidden="true" />
    </button>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>(props: {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (next: T) => void;
  label?: string;
}) {
  const row = useContext(RowContext);
  const buttons: HTMLButtonElement[] = [];

  const move = (from: number, step: number) => {
    const count = props.options.length;
    const next = (from + step + count) % count;
    props.onChange(props.options[next].value);
    buttons[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      move(index, 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(index, -1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      move(0, 0);
    } else if (event.key === 'End') {
      event.preventDefault();
      move(props.options.length - 1, 0);
    }
  };

  return (
    <div
      class="segmented"
      role="radiogroup"
      aria-label={row ? undefined : props.label}
      aria-labelledby={row?.labelId}
      aria-describedby={row?.descriptionId}
    >
      <For each={props.options}>
        {(option, index) => (
          <button
            type="button"
            role="radio"
            class="segmented__option"
            classList={{ 'segmented__option--selected': props.value === option.value }}
            aria-checked={props.value === option.value}
            tabIndex={props.value === option.value ? 0 : -1}
            ref={(el) => { buttons[index()] = el; }}
            onClick={() => props.onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index())}
          >
            {option.label}
          </button>
        )}
      </For>
    </div>
  );
}

export function errorMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export type ButtonVariant = 'default' | 'primary' | 'danger' | 'danger-outline' | 'subtle';

export function ActionButton(props: {
  label: JSX.Element;
  busyLabel: JSX.Element;
  onAction: () => void | Promise<void>;
  onError?: (error: unknown) => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  ariaLabel?: string;
  autofocus?: boolean;
}) {
  const row = useContext(RowContext);
  const [busy, setBusy] = createSignal(false);
  let alive = true;
  onCleanup(() => { alive = false; });

  const run = async () => {
    if (busy() || props.disabled) return;
    setBusy(true);
    try {
      await props.onAction();
    } catch (error) {
      props.onError?.(error);
    } finally {
      if (alive) setBusy(false);
    }
  };

  return (
    <button
      type="button"
      class={`btn${props.variant && props.variant !== 'default' ? ` ${props.variant}` : ''}`}
      aria-label={props.ariaLabel}
      aria-describedby={row?.descriptionId}
      aria-busy={busy()}
      data-autofocus={props.autofocus ? '' : undefined}
      disabled={props.disabled || busy()}
      onClick={() => void run()}
    >
      {busy() ? props.busyLabel : props.label}
    </button>
  );
}

export function InlineMessage(props: { kind: 'error' | 'success' | 'info'; children?: JSX.Element }) {
  return (
    <p
      class="inline-message"
      classList={{
        'inline-message--error': props.kind === 'error',
        'inline-message--success': props.kind === 'success',
      }}
      role={props.kind === 'error' ? 'alert' : 'status'}
    >
      {props.children}
    </p>
  );
}

interface PanelGroupValue {
  current: Accessor<string | null>;
  setCurrent: (id: string | null) => void;
}

const PanelGroupContext = createContext<PanelGroupValue>();

export function PanelGroup(props: { children: JSX.Element }) {
  const [current, setCurrent] = createSignal<string | null>(null);
  return <PanelGroupContext.Provider value={{ current, setCurrent }}>{props.children}</PanelGroupContext.Provider>;
}

export interface PanelHandle {
  id: string;
  expanded: Accessor<boolean>;
  open: () => void;
  close: (restoreFocus?: boolean) => void;
  toggle: () => void;
  triggerRef: (el: HTMLElement) => void;
  panelRef: (el: HTMLElement) => void;
}

export function createPanel(): PanelHandle {
  const id = `panel-${createUniqueId()}`;
  const group = useContext(PanelGroupContext);
  const [local, setLocal] = createSignal(false);
  let trigger: HTMLElement | undefined;
  let panel: HTMLElement | undefined;

  const expanded = () => (group ? group.current() === id : local());

  const open = () => {
    if (group) group.setCurrent(id);
    else setLocal(true);
  };

  const close = (restoreFocus = false) => {
    if (!expanded()) return;
    const hadFocus = Boolean(panel && panel.contains(document.activeElement));
    if (group) group.setCurrent(null);
    else setLocal(false);
    if (restoreFocus || hadFocus) trigger?.focus();
  };

  return {
    id,
    expanded,
    open,
    close,
    toggle: () => (expanded() ? close() : open()),
    triggerRef: (el) => { trigger = el; },
    panelRef: (el) => { panel = el; },
  };
}

const FOCUSABLE = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

function isLayerOpen(): boolean {
  return document.querySelector('dialog[open], .scanner-overlay') !== null;
}

export function ExpandingPanel(props: {
  panel: PanelHandle;
  busy?: boolean;
  class?: string;
  children: JSX.Element;
}) {
  let root: HTMLDivElement | undefined;

  createEffect(() => {
    if (!props.panel.expanded()) return;
    queueMicrotask(() => {
      if (!root) return;
      const target = root.querySelector<HTMLElement>('[data-autofocus]') ?? root.querySelector<HTMLElement>(FOCUSABLE) ?? root;
      target.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isLayerOpen() || props.busy) return;
      event.preventDefault();
      event.stopPropagation();
      props.panel.close(true);
    };
    window.addEventListener('keydown', onKeyDown, true);
    onCleanup(() => window.removeEventListener('keydown', onKeyDown, true));
  });

  return (
    <div
      id={props.panel.id}
      class={`panel${props.class ? ` ${props.class}` : ''}`}
      tabIndex={-1}
      hidden={!props.panel.expanded()}
      ref={(el) => { root = el; props.panel.panelRef(el); }}
    >
      <Show when={props.panel.expanded()}>{props.children}</Show>
    </div>
  );
}

export function PanelButton(props: {
  panel: PanelHandle;
  children: JSX.Element;
  variant?: ButtonVariant;
  openOnly?: boolean;
  disabled?: boolean;
}) {
  const row = useContext(RowContext);
  return (
    <button
      type="button"
      class={`btn${props.variant && props.variant !== 'default' ? ` ${props.variant}` : ''}`}
      ref={props.panel.triggerRef}
      aria-expanded={props.panel.expanded()}
      aria-controls={props.panel.id}
      aria-describedby={row?.descriptionId}
      disabled={props.disabled}
      onClick={() => (props.openOnly ? props.panel.open() : props.panel.toggle())}
    >
      {props.children}
    </button>
  );
}

export function InlineConfirm(props: {
  panel: PanelHandle;
  consequence: JSX.Element;
  confirmLabel: string;
  busyLabel: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let alive = true;
  onCleanup(() => { alive = false; });

  createEffect(() => {
    if (!props.panel.expanded()) setError(null);
  });

  const confirm = async () => {
    if (busy()) return;
    setBusy(true);
    setError(null);
    try {
      await props.onConfirm();
      if (alive) props.panel.close();
    } catch (e) {
      if (alive) setError(errorMessage(e));
    } finally {
      if (alive) setBusy(false);
    }
  };

  return (
    <ExpandingPanel panel={props.panel} busy={busy()} class="panel--confirm">
      <p class="panel__text">{props.consequence}</p>
      <Show when={error()}>
        <InlineMessage kind="error">{error()}</InlineMessage>
      </Show>
      <div class="panel__actions">
        <button
          type="button"
          class="btn danger"
          aria-busy={busy()}
          disabled={busy()}
          onClick={() => void confirm()}
        >
          {busy() ? props.busyLabel : props.confirmLabel}
        </button>
        <button
          type="button"
          class="btn subtle"
          data-autofocus=""
          disabled={busy()}
          onClick={() => props.panel.close(true)}
        >
          {props.cancelLabel ?? 'Cancel'}
        </button>
      </div>
    </ExpandingPanel>
  );
}

export function DangerAction(props: {
  label: string;
  description: JSX.Element;
  buttonLabel: string;
  inline?: {
    consequence: JSX.Element;
    confirmLabel: string;
    busyLabel: string;
    onConfirm: () => void | Promise<void>;
  };
  onActivate?: () => void;
  tone?: 'default' | 'danger';
}) {
  const panel = createPanel();
  const danger = () => props.tone !== 'default';
  return (
    <div class="danger-action">
      <SettingRow label={props.label} description={props.description} danger={danger()}>
        <Show
          when={props.inline}
          fallback={
            <button type="button" class={danger() ? 'btn danger-outline' : 'btn'} onClick={() => props.onActivate?.()}>
              {props.buttonLabel}
            </button>
          }
        >
          <PanelButton panel={panel} variant={danger() ? 'danger-outline' : 'default'} openOnly>{props.buttonLabel}</PanelButton>
        </Show>
      </SettingRow>
      <Show when={props.inline}>
        {(inline) => (
          <InlineConfirm
            panel={panel}
            consequence={inline().consequence}
            confirmLabel={inline().confirmLabel}
            busyLabel={inline().busyLabel}
            onConfirm={inline().onConfirm}
          />
        )}
      </Show>
    </div>
  );
}
