import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { useApp } from '../state';
import { InlineMessage, errorMessage } from '../settings/controls';

export function ConfirmModal() {
  const ctx = useApp();
  const modal = ctx.state.modal;
  if (modal.kind !== 'confirm') return null;
  const { title, message, hint, confirmLabel, busyLabel, danger, onConfirm, returnTo } = modal;
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let dialog: HTMLDialogElement | undefined;
  let alive = true;

  const dismiss = () => {
    ctx.closeModal();
    if (returnTo) ctx.openModal(returnTo);
  };

  const confirm = async () => {
    if (busy()) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      console.error('Confirm action failed:', e);
      if (alive) {
        setError(errorMessage(e));
        setBusy(false);
      }
      return;
    }
    if (alive) dismiss();
  };

  onMount(() => {
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  });

  onCleanup(() => {
    alive = false;
    if (dialog?.open) dialog.close();
    if (opener?.isConnected) opener.focus();
  });

  return (
    <dialog
      ref={dialog}
      class="confirm-dialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy()) dismiss();
      }}
      onClick={(event) => {
        if (event.target === dialog && !busy()) dismiss();
      }}
    >
      <div class="modal confirm-dialog__panel">
        <div class="modal-header" id="confirm-title">{title}</div>
        <div class="modal-body">
          <p class="confirm-dialog__message" id="confirm-message">{message}</p>
          <Show when={hint}>
            <p class="confirm-dialog__hint">{hint}</p>
          </Show>
          <Show when={error()}>
            <InlineMessage kind="error">{error()}</InlineMessage>
          </Show>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn subtle" data-autofocus="" disabled={busy()} onClick={dismiss}>
            Cancel
          </button>
          <button
            type="button"
            class={danger ? 'btn danger' : 'btn'}
            aria-busy={busy()}
            disabled={busy()}
            onClick={() => void confirm()}
          >
            {busy() ? (busyLabel ?? 'Working…') : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
