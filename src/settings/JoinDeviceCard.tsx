import { Show, createSignal, createUniqueId, onMount } from 'solid-js';
import { ChevronRight, ScanLine } from 'lucide-solid';
import { useApp } from '../state';
import { redeemCode } from '../sync/client';
import { pairingErrorMessage, parsePairingInput } from '../sync/pairing';
import { QrScannerOverlay } from '../components/QrScannerOverlay';
import { InlineMessage } from './controls';

export interface JoinFormProps {
  initialValue?: string;
  initialError?: string | null;
  leavingSync?: boolean;
  onJoined: () => void;
  onBusyChange: (busy: boolean) => void;
}

export function JoinDeviceCard(props: JoinFormProps) {
  return (
    <div class="device-card">
      <h3 class="device-card__title">Join from another device</h3>
      <JoinForm {...props} />
    </div>
  );
}

export function JoinForm(props: JoinFormProps) {
  const ctx = useApp();
  const inputId = createUniqueId();
  const errorId = `${inputId}-error`;
  const [value, setValue] = createSignal(props.initialValue ?? '');
  const [error, setError] = createSignal<string | null>(props.initialError ?? null);
  const [busy, setBusy] = createSignal(false);
  const [scanning, setScanning] = createSignal(false);
  const [camera, setCamera] = createSignal<boolean | null>(null);

  onMount(() => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setCamera(false);
      return;
    }
    void navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => setCamera(devices.some((device) => device.kind === 'videoinput')))
      .catch(() => setCamera(false));
  });

  const submit = async () => {
    if (busy()) return;
    const parsed = parsePairingInput(value());
    if (parsed.kind === 'empty') return;
    if (parsed.kind === 'invalid') {
      setError(parsed.message);
      return;
    }
    if (parsed.kind === 'key' && parsed.key === ctx.syncKey()) {
      setError('Already paired with this key');
      return;
    }
    setBusy(true);
    props.onBusyChange(true);
    setError(null);
    try {
      const key = parsed.kind === 'code' ? await redeemCode(parsed.code) : parsed.key;
      await ctx.pairSyncWithKey(key);
      props.onJoined();
    } catch (e) {
      setError(pairingErrorMessage(e));
    } finally {
      setBusy(false);
      props.onBusyChange(false);
    }
  };

  const openScanner = () => {
    props.onBusyChange(true);
    setScanning(true);
  };

  const closeScanner = (paired?: boolean) => {
    setScanning(false);
    if (paired) props.onJoined();
    props.onBusyChange(false);
  };

  return (
    <>
      <Show when={props.leavingSync}>
        <p class="device-card__text">
          Joining another sync means this device leaves its current one. Your other devices stay in it.
        </p>
      </Show>
      <form
        class="join-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label class="join-form__label" for={inputId}>Pairing code</label>
        <div class="join-form__row">
          <input
            id={inputId}
            class="text-input join-form__input"
            type="text"
            value={value()}
            onInput={(event) => setValue(event.currentTarget.value)}
            placeholder="abcd-efgh"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck={false}
            disabled={busy()}
            aria-invalid={error() ? 'true' : undefined}
            aria-describedby={error() ? errorId : undefined}
          />
          <button type="submit" class="btn primary" disabled={busy() || !value().trim()}>
            {busy() ? 'Pairing…' : 'Pair'}
          </button>
          <button
            type="button"
            class="btn btn--icon"
            aria-label="Scan a QR code"
            disabled={busy() || camera() === false}
            onClick={openScanner}
          >
            <ScanLine size={18} />
          </button>
        </div>
        <Show when={camera() === false}>
          <p class="join-form__note">No camera found</p>
        </Show>
        <Show when={error()}>
          <div id={errorId}>
            <InlineMessage kind="error">{error()}</InlineMessage>
          </div>
        </Show>
        <details class="join-form__key">
          <summary><ChevronRight size={14} aria-hidden="true" />Use a sync key instead</summary>
          <p>Enter a 22-character sync key in the same field. Keys are case-sensitive.</p>
        </details>
      </form>
      <Show when={scanning()}>
        <QrScannerOverlay onClose={closeScanner} />
      </Show>
    </>
  );
}
