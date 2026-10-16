import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { Check, Copy } from 'lucide-solid';
import { useApp } from '../state';
import { issueOtp, KEY_REJECTED_MESSAGE, SyncClientError } from '../sync/client';
import { renderSyncKeyQr } from '../sync/qr';
import { countdownLabel } from '../util/time';
import { ExpandingPanel, InlineMessage, PanelButton, createPanel } from './controls';

const CODE_LIFETIME_MS = 5 * 60 * 1000;
const LOW_MS = 30_000;
const RING_RADIUS = 10;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function issueErrorMessage(error: unknown): string {
  if (error instanceof SyncClientError) {
    if (error.status === 429) return 'Too many codes issued recently. Try again in a few minutes.';
    if (error.status === 401 || error.status === 403) return KEY_REJECTED_MESSAGE;
    return 'Could not get a new code. Try again.';
  }
  return 'Cannot reach the server. Check your connection and try again.';
}

export function AddDeviceCard() {
  const panel = createPanel();
  return (
    <div class="device-card">
      <h3 class="device-card__title">Add a device</h3>
      <p class="device-card__text">
        Pair another phone or computer with a code. Sync keeps your subscriptions and reading progress on this Lidora server so your devices can stay in step.
      </p>
      <div>
        <PanelButton panel={panel}>{panel.expanded() ? 'Hide code' : 'Show pairing code'}</PanelButton>
      </div>
      <ExpandingPanel panel={panel} class="panel--flush">
        <PairingCode />
      </ExpandingPanel>
    </div>
  );
}

function PairingCode() {
  const ctx = useApp();
  const [enabling, setEnabling] = createSignal(false);
  const [enableError, setEnableError] = createSignal<string | null>(null);
  const [code, setCode] = createSignal<{ code: string; expiresAt: number } | null>(null);
  const [issueError, setIssueError] = createSignal<string | null>(null);
  const [now, setNow] = createSignal(Date.now());
  const [copied, setCopied] = createSignal(false);
  const [copyFailed, setCopyFailed] = createSignal(false);
  let alive = true;
  let issuing = false;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let tickTimer: ReturnType<typeof setInterval> | undefined;
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  const issue = async () => {
    if (issuing) return;
    issuing = true;
    clearTimeout(refreshTimer);
    setIssueError(null);
    try {
      const res = await issueOtp();
      if (!alive) return;
      setCode(res);
      setNow(Date.now());
      refreshTimer = setTimeout(() => void issue(), Math.max(res.expiresAt - Date.now(), 1000));
    } catch (e) {
      if (alive) setIssueError(issueErrorMessage(e));
    } finally {
      issuing = false;
    }
  };

  const start = async () => {
    setEnableError(null);
    if (!ctx.syncKey()) {
      setEnabling(true);
      try {
        await ctx.enableSync();
      } catch (e) {
        console.error('Failed to enable sync:', e);
        if (alive) setEnableError("Couldn't turn on sync");
        return;
      } finally {
        if (alive) setEnabling(false);
      }
      if (!alive) return;
    }
    await issue();
  };

  onMount(() => {
    tickTimer = setInterval(() => setNow(Date.now()), 1000);
    void start();
  });

  onCleanup(() => {
    alive = false;
    clearTimeout(refreshTimer);
    clearTimeout(copiedTimer);
    clearInterval(tickTimer);
  });

  const remaining = () => {
    const current = code();
    return current ? Math.max(0, current.expiresAt - now()) : 0;
  };
  const display = (value: string) => `${value.slice(0, 4)}-${value.slice(4)}`;

  const copy = async () => {
    const current = code();
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.code);
    } catch {
      setCopyFailed(true);
      return;
    }
    setCopyFailed(false);
    setCopied(true);
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => setCopied(false), 2000);
  };

  const announcement = () => {
    if (copied()) return 'Pairing code copied';
    if (enabling()) return 'Turning on sync';
    const current = code();
    if (current) return `Pairing code ${display(current.code)}`;
    if (!enableError() && !issueError()) return 'Getting a code';
    return '';
  };

  return (
    <div class="pair-code">
      <p class="visually-hidden" role="status">{announcement()}</p>
      <Show when={enabling()}>
        <p class="panel__text">Turning on sync…</p>
      </Show>
      <Show when={enableError()}>
        <InlineMessage kind="error">{enableError()}</InlineMessage>
        <button type="button" class="btn" onClick={() => void start()}>Retry</button>
      </Show>
      <Show when={!code() && !enabling() && !enableError() && !issueError()}>
        <p class="panel__text">Getting a code…</p>
      </Show>
      <Show when={code()}>
        {(current) => (
          <>
            <p class="panel__text">Enter this code on your other device, or scan the QR code with its camera.</p>
            <div class="pair-code__row">
              <span class="pair-code__value">{display(current().code)}</span>
              <button type="button" class="btn" aria-label="Copy pairing code" onClick={() => void copy()}>
                <Show when={copied()} fallback={<Copy size={14} />}><Check size={14} /></Show>
                <span>{copied() ? 'Copied' : 'Copy'}</span>
              </button>
              <div class="pair-code__expiry">
                <svg class="code-timer" classList={{ 'code-timer--low': remaining() <= LOW_MS }} viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="code-timer__bg" cx="12" cy="12" r={RING_RADIUS} />
                  <circle
                    class="code-timer__progress"
                    cx="12"
                    cy="12"
                    r={RING_RADIUS}
                    stroke-dasharray={String(RING_LENGTH)}
                    stroke-dashoffset={String(RING_LENGTH * (1 - Math.min(1, remaining() / CODE_LIFETIME_MS)))}
                  />
                </svg>
                <span>Expires in {countdownLabel(remaining())}</span>
              </div>
            </div>
            <div
              class="pair-code__qr"
              role="img"
              aria-label="QR code that pairs another device"
              innerHTML={renderSyncKeyQr(`${window.location.origin}/?pair=${current().code}`)}
            />
            <Show when={copyFailed()}>
              <InlineMessage kind="error">Couldn't copy the code. Select it and copy it yourself.</InlineMessage>
            </Show>
            <p class="pair-code__waiting">Waiting for another device to pair…</p>
          </>
        )}
      </Show>
      <Show when={issueError()}>
        <InlineMessage kind="error">{issueError()}</InlineMessage>
        <button type="button" class="btn" onClick={() => void issue()}>Retry</button>
      </Show>
    </div>
  );
}
