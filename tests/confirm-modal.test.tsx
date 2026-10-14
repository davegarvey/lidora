import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'solid-js/web';
import { Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { ConfirmModal } from '../src/components/ConfirmModal';
import type { AppContext, AppState } from '../src/state';

const contextRef = vi.hoisted(() => ({ value: null as AppContext | null }));

vi.mock('../src/state', () => ({
  useApp: () => {
    if (!contextRef.value) throw new Error('test context not set');
    return contextRef.value;
  },
}));

type Confirm = Extract<AppState['modal'], { kind: 'confirm' }>;

let dispose: (() => void) | undefined;
let opener: HTMLButtonElement;

function setup(overrides: Partial<Confirm> = {}) {
  const [state, setState] = createStore({ modal: { kind: 'none' } } as unknown as AppState);
  const openModal = vi.fn((modal: AppState['modal']) => setState({ modal }));
  const closeModal = vi.fn(() => setState({ modal: { kind: 'none' } }));
  contextRef.value = { state, openModal, closeModal } as unknown as AppContext;
  const onConfirm = vi.fn(async () => {});
  document.body.innerHTML = '';
  opener = document.createElement('button');
  opener.textContent = 'Open';
  document.body.appendChild(opener);
  opener.focus();
  const host = document.createElement('div');
  document.body.appendChild(host);
  dispose = render(() => (
    <Show when={state.modal.kind === 'confirm'}>
      <ConfirmModal />
    </Show>
  ), host);
  setState({
    modal: { kind: 'confirm', title: 'Delete things', message: 'This removes things.', hint: 'Be careful.', confirmLabel: 'Delete', busyLabel: 'Deleting…', danger: true, onConfirm, ...overrides },
  });
  return { state, openModal, closeModal, onConfirm };
}

const dialog = () => document.querySelector<HTMLDialogElement>('dialog')!;
const button = (label: string) =>
  [...dialog().querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === label)!;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('ConfirmModal', () => {
  it('opens a labelled modal dialog with its title, message and hint', () => {
    setup();
    expect(dialog().hasAttribute('open')).toBe(true);
    expect(document.getElementById(dialog().getAttribute('aria-labelledby')!)?.textContent).toBe('Delete things');
    expect(document.getElementById(dialog().getAttribute('aria-describedby')!)?.textContent).toBe('This removes things.');
    expect(dialog().textContent).toContain('Be careful.');
    expect(button('Delete').classList.contains('danger')).toBe(true);
    expect(document.activeElement).toBe(button('Cancel'));
  });

  it('closes on Cancel and returns focus to the opener', () => {
    const { state, onConfirm } = setup();
    button('Cancel').click();
    expect(state.modal.kind).toBe('none');
    expect(document.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closes on the dialog cancel event (Escape)', () => {
    const { state } = setup();
    dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(state.modal.kind).toBe('none');
    expect(document.activeElement).toBe(opener);
  });

  it('disables both buttons and shows the busy label while the action runs', async () => {
    let finish!: () => void;
    const { state } = setup({ onConfirm: () => new Promise<void>((resolve) => { finish = resolve; }) });
    button('Delete').click();
    await flush();
    expect(button('Deleting…').disabled).toBe(true);
    expect(button('Cancel').disabled).toBe(true);
    const cancel = new Event('cancel', { cancelable: true });
    dialog().dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(state.modal.kind).toBe('confirm');
    finish();
    await vi.waitFor(() => expect(state.modal.kind).toBe('none'));
  });

  it('stays open and shows the error when the action throws, then allows a retry', async () => {
    const onConfirm = vi.fn()
      .mockRejectedValueOnce(new Error("Couldn't do it. Try again."))
      .mockResolvedValueOnce(undefined);
    const { state } = setup({ onConfirm });
    button('Delete').click();
    await vi.waitFor(() => expect(dialog().querySelector('[role="alert"]')?.textContent).toBe("Couldn't do it. Try again."));
    expect(state.modal.kind).toBe('confirm');
    expect(button('Delete').disabled).toBe(false);
    expect(button('Cancel').disabled).toBe(false);
    button('Delete').click();
    await vi.waitFor(() => expect(state.modal.kind).toBe('none'));
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it('reopens the modal named by returnTo on close', () => {
    const { openModal } = setup({ returnTo: { kind: 'agents' } });
    button('Cancel').click();
    expect(openModal).toHaveBeenLastCalledWith({ kind: 'agents' });
  });
});
