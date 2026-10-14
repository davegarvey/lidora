import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'solid-js/web';
import { createSignal } from 'solid-js';
import {
  ActionButton,
  DangerAction,
  ExpandingPanel,
  InlineConfirm,
  InlineMessage,
  PanelButton,
  PanelGroup,
  SegmentedControl,
  SettingRow,
  Switch,
  createPanel,
} from '../src/settings/controls';

let dispose: (() => void) | undefined;

function mount(view: () => import('solid-js').JSX.Element): HTMLElement {
  document.body.innerHTML = '';
  const host = document.createElement('div');
  document.body.appendChild(host);
  dispose = render(view, host);
  return host;
}

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = '';
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Switch', () => {
  it('is a labelled switch that reports its state', () => {
    const onChange = vi.fn();
    mount(() => (
      <SettingRow label="High contrast" description="Stronger borders.">
        <Switch checked={false} onChange={onChange} />
      </SettingRow>
    ));
    const el = document.querySelector<HTMLButtonElement>('[role="switch"]')!;
    expect(el.tagName).toBe('BUTTON');
    expect(el.getAttribute('aria-checked')).toBe('false');
    const labelId = el.getAttribute('aria-labelledby')!;
    expect(document.getElementById(labelId)?.textContent).toBe('High contrast');
    expect(document.getElementById(el.getAttribute('aria-describedby')!)?.textContent).toBe('Stronger borders.');
    el.click();
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('reflects checked state with the on style', () => {
    const [checked, setChecked] = createSignal(false);
    mount(() => <Switch label="Thing" checked={checked()} onChange={setChecked} />);
    const el = document.querySelector<HTMLButtonElement>('[role="switch"]')!;
    expect(el.getAttribute('aria-label')).toBe('Thing');
    el.click();
    expect(el.getAttribute('aria-checked')).toBe('true');
    expect(el.classList.contains('switch--on')).toBe(true);
  });
});

describe('SegmentedControl', () => {
  const options = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ] as const;

  function setup() {
    const [value, setValue] = createSignal<'system' | 'light' | 'dark'>('system');
    mount(() => (
      <SettingRow label="Theme">
        <SegmentedControl value={value()} options={options} onChange={setValue} />
      </SettingRow>
    ));
    return value;
  }

  it('is a labelled radio group with a single tab stop', () => {
    setup();
    const group = document.querySelector('[role="radiogroup"]')!;
    expect(document.getElementById(group.getAttribute('aria-labelledby')!)?.textContent).toBe('Theme');
    const radios = [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
  });

  it('moves selection and focus with the arrow keys', () => {
    const value = setup();
    const radios = [...document.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    radios[0].focus();
    radios[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(value()).toBe('light');
    expect(document.activeElement).toBe(radios[1]);
    radios[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    radios[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(value()).toBe('dark');
    expect(document.activeElement).toBe(radios[2]);
  });
});

describe('ActionButton', () => {
  it('shows the busy label and disables itself while the action runs', async () => {
    let finish: () => void = () => {};
    const onAction = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    mount(() => <ActionButton label="Sync now" busyLabel="Syncing…" onAction={onAction} />);
    const button = document.querySelector<HTMLButtonElement>('button')!;
    button.click();
    button.click();
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe('Syncing…');
    finish();
    await flush();
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe('Sync now');
  });

  it('reports a failure and recovers', async () => {
    const onError = vi.fn();
    mount(() => (
      <ActionButton
        label="Go"
        busyLabel="Going…"
        onAction={async () => { throw new Error('nope'); }}
        onError={onError}
      />
    ));
    const button = document.querySelector<HTMLButtonElement>('button')!;
    button.click();
    await flush();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(false);
  });
});

describe('InlineMessage', () => {
  it('uses alert for errors and status otherwise', () => {
    mount(() => (
      <>
        <InlineMessage kind="error">Broke</InlineMessage>
        <InlineMessage kind="success">Done</InlineMessage>
      </>
    ));
    expect(document.querySelector('[role="alert"]')?.textContent).toBe('Broke');
    expect(document.querySelector('[role="status"]')?.textContent).toBe('Done');
  });
});

function PanelDemo(props: { label: string; id?: string }) {
  const panel = createPanel();
  return (
    <div>
      <PanelButton panel={panel}>{props.label}</PanelButton>
      <ExpandingPanel panel={panel}>
        <input aria-label={`${props.label} input`} />
        <button type="button" onClick={() => panel.close(true)}>Cancel {props.label}</button>
      </ExpandingPanel>
    </div>
  );
}

describe('ExpandingPanel', () => {
  it('links the trigger to the panel and moves focus to its first control', async () => {
    mount(() => <PanelDemo label="One" />);
    const trigger = document.querySelector<HTMLButtonElement>('[aria-expanded]')!;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    const panel = document.getElementById(trigger.getAttribute('aria-controls')!)!;
    expect(panel.hidden).toBe(true);
    trigger.click();
    await flush();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hidden).toBe(false);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('One input');
  });

  it('collapses on Escape and returns focus to the trigger', async () => {
    mount(() => <PanelDemo label="One" />);
    const trigger = document.querySelector<HTMLButtonElement>('[aria-expanded]')!;
    trigger.click();
    await flush();
    const bubbled = vi.fn();
    window.addEventListener('keydown', bubbled);
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    window.removeEventListener('keydown', bubbled);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
    expect(bubbled).not.toHaveBeenCalled();
  });

  it('collapses with Cancel and returns focus', async () => {
    mount(() => <PanelDemo label="One" />);
    const trigger = document.querySelector<HTMLButtonElement>('[aria-expanded]')!;
    trigger.click();
    await flush();
    [...document.querySelectorAll('button')].find((b) => b.textContent === 'Cancel One')!.click();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps one panel open per group', async () => {
    mount(() => (
      <PanelGroup>
        <PanelDemo label="One" />
        <PanelDemo label="Two" />
      </PanelGroup>
    ));
    const [one, two] = [...document.querySelectorAll<HTMLButtonElement>('[aria-expanded]')];
    one.click();
    await flush();
    two.click();
    await flush();
    expect(one.getAttribute('aria-expanded')).toBe('false');
    expect(two.getAttribute('aria-expanded')).toBe('true');
  });

  it('collapses when its group is unmounted and mounted again', async () => {
    const [shown, setShown] = createSignal(true);
    mount(() => (
      <>{shown() ? <PanelGroup><PanelDemo label="One" /></PanelGroup> : null}</>
    ));
    document.querySelector<HTMLButtonElement>('[aria-expanded]')!.click();
    setShown(false);
    setShown(true);
    expect(document.querySelector('[aria-expanded]')!.getAttribute('aria-expanded')).toBe('false');
  });

  it('ignores Escape while a dialog is open', async () => {
    mount(() => <PanelDemo label="One" />);
    const trigger = document.querySelector<HTMLButtonElement>('[aria-expanded]')!;
    trigger.click();
    await flush();
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.appendChild(dialog);
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('InlineConfirm', () => {
  function setup(onConfirm: () => Promise<void>) {
    mount(() => {
      const panel = createPanel();
      return (
        <>
          <PanelButton panel={panel} openOnly>Revoke</PanelButton>
          <InlineConfirm
            panel={panel}
            consequence="It loses access immediately."
            confirmLabel="Revoke access"
            busyLabel="Revoking…"
            onConfirm={onConfirm}
          />
        </>
      );
    });
    const trigger = document.querySelector<HTMLButtonElement>('[aria-expanded]')!;
    return trigger;
  }

  const confirmButton = () => [...document.querySelectorAll<HTMLButtonElement>('.panel button')].find((b) => b.classList.contains('danger'))!;
  const cancelButton = () => [...document.querySelectorAll<HTMLButtonElement>('.panel button')].find((b) => b.textContent === 'Cancel')!;

  it('opening does not run the action, even on double activation, and focuses Cancel', async () => {
    const onConfirm = vi.fn(async () => {});
    const trigger = setup(onConfirm);
    trigger.click();
    trigger.click();
    await flush();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(cancelButton());
  });

  it('disables both buttons while running and closes on success', async () => {
    let finish: () => void = () => {};
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const trigger = setup(onConfirm);
    trigger.click();
    await flush();
    confirmButton().click();
    await flush();
    expect(confirmButton().textContent).toBe('Revoking…');
    expect(confirmButton().disabled).toBe(true);
    expect(cancelButton().disabled).toBe(true);
    finish();
    await flush();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('stays open with the error when the action fails, and can retry', async () => {
    const onConfirm = vi.fn()
      .mockRejectedValueOnce(new Error('Could not revoke. Try again.'))
      .mockResolvedValueOnce(undefined);
    const trigger = setup(onConfirm);
    trigger.click();
    await flush();
    confirmButton().click();
    await flush();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('[role="alert"]')?.textContent).toBe('Could not revoke. Try again.');
    expect(confirmButton().disabled).toBe(false);
    confirmButton().click();
    await flush();
    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('DangerAction', () => {
  it('opens an inline confirmation without running the action', async () => {
    const onConfirm = vi.fn(async () => {});
    mount(() => (
      <DangerAction
        label="Stop syncing on this device"
        description="This device keeps its data."
        buttonLabel="Stop syncing"
        inline={{ consequence: 'You can rejoin later.', confirmLabel: 'Stop syncing', busyLabel: 'Stopping…', onConfirm }}
      />
    ));
    const trigger = document.querySelector<HTMLButtonElement>('[aria-expanded]')!;
    expect(trigger.classList.contains('danger-outline')).toBe(true);
    trigger.click();
    trigger.click();
    await flush();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('calls onActivate for dialog-backed actions', () => {
    const onActivate = vi.fn();
    mount(() => (
      <DangerAction label="Delete" description="Gone." buttonLabel="Delete data" onActivate={onActivate} />
    ));
    document.querySelector<HTMLButtonElement>('button')!.click();
    expect(onActivate).toHaveBeenCalledTimes(1);
  });
});
