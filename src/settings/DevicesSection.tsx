import { Show, createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import { useApp } from '../state';
import { fingerprintSyncKey } from '../sync/key';
import { lastPullAt, lastPushAt, pendingCount, lastError, lastErrorAt, keyRejected } from '../sync/status';
import { deleteSyncAccount } from '../sync/client';
import { humanRelativeTime } from '../util/time';
import { isSyncAvailable } from '../sync/capabilities';
import { Section } from './Section';

export function DevicesSection() {
  const [available, setAvailable] = createSignal<boolean | null>(null);
  void isSyncAvailable().then(setAvailable);
  return (
    <Section title="Devices">
      <Show when={available()}>
        <SyncBridge />
      </Show>
    </Section>
  );
}

function SyncBridge() {
  const ctx = useApp();
  const [syncError, setSyncError] = createSignal<string | null>(null);
  const [deleteError, setDeleteError] = createSignal<string | null>(null);
  const [fingerprint, setFingerprint] = createSignal<string | null>(null);
  const [syncing, setSyncing] = createSignal(false);
  const enabled = () => Boolean(ctx.syncKey());

  createEffect(() => {
    const key = ctx.syncKey();
    if (!key) {
      setFingerprint(null);
      return;
    }
    void fingerprintSyncKey(key).then(setFingerprint).catch(() => setFingerprint(null));
  });

  const toggleOn = async () => {
    setSyncError(null);
    setDeleteError(null);
    try {
      await ctx.enableSync();
    } catch (e) {
      console.error('Failed to enable sync:', e);
      setSyncError('Failed to enable sync');
    }
  };

  const toggleOff = () => {
    ctx.openModal({
      kind: 'confirm',
      title: 'Disable sync',
      message: 'This device will stop syncing. Your synced data stays on the server, and devices paired with this key keep syncing. To delete it, cancel and use Delete sync data first. Continue?',
      confirmLabel: 'Disable',
      danger: true,
      onConfirm: async () => {
        setDeleteError(null);
        await ctx.disableSync();
      },
    });
  };

  const deleteData = () => {
    ctx.openModal({
      kind: 'confirm',
      title: 'Delete sync data',
      message: 'This permanently deletes your synced subscriptions, read and starred flags, statistics and agent access from the server. Your other paired devices will stop syncing. Reading data on this device is kept.',
      hint: 'You can turn sync on again later with a new key.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        setDeleteError(null);
        try {
          await deleteSyncAccount();
        } catch (e) {
          console.error('Failed to delete sync data:', e);
          setDeleteError('Failed to delete sync data. Try again.');
          return;
        }
        await ctx.disableSync();
      },
    });
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      await ctx.syncNow();
    } catch {
      // The status store records the failure; nothing else to surface here.
    } finally {
      setSyncing(false);
    }
  };

  const regenerate = () => {
    ctx.openModal({
      kind: 'confirm',
      title: 'Regenerate sync key',
      message: 'Agents will lose access. Other devices will need to pair again.',
      hint: 'If a device was lost or stolen, regenerating the key is the only way to revoke its access.',
      confirmLabel: 'Regenerate',
      danger: true,
      onConfirm: async () => {
        setSyncError(null);
        try {
          await ctx.regenerateSyncKey();
        } catch (e) {
          console.error('Failed to regenerate sync key:', e);
          setSyncError('Failed to regenerate the key');
        }
      },
    });
  };

  // Recompute relative times while the drawer is open.
  const [nowTick, setNowTick] = createSignal(Date.now());
  onMount(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30_000);
    onCleanup(() => clearInterval(t));
  });

  const lastActivity = () => Math.max(lastPullAt() ?? 0, lastPushAt() ?? 0);

  const statusLine = () => {
    void nowTick(); // recompute relative time when the 30s tick fires
    const err = lastError();
    const errAt = lastErrorAt();
    if (err && errAt) {
      return { text: `Sync failed ${humanRelativeTime(new Date(errAt))}`, error: true, detail: err };
    }
    const pending = pendingCount();
    if (pending > 0) {
      return { text: `${pending} change${pending === 1 ? '' : 's'} waiting to sync`, error: false };
    }
    const last = lastActivity();
    if (last === 0) return { text: 'Never synced', error: false };
    return { text: `Synced ${humanRelativeTime(new Date(last))}`, error: false };
  };

  return (
    <div class="settings group">
      <div class="row">
        <label>Enable sync</label>
        <div
          class="toggle"
          classList={{ on: enabled() }}
          onClick={() => void (enabled() ? toggleOff() : toggleOn())}
          role="switch"
          aria-checked={enabled()}
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' || e.key === ' ' ? (e.preventDefault(), void (enabled() ? toggleOff() : toggleOn())) : null}
        />
      </div>
        <Show when={!enabled()}>
          <p style={{ 'font-size': '14px', color: 'var(--subtext)', margin: '0 0 4px', 'line-height': '1.5' }}>
            Sync keeps your subscriptions and reading progress in step across your devices. There is no account. If you lose your key, the data on the server is gone.
          </p>
        </Show>
        <Show when={!enabled()}>
          <div class="row">
            <label>Join an existing sync</label>
            <button class="btn" onClick={() => ctx.openModal({ kind: 'pair-device' })}>Join</button>
          </div>
        </Show>
        <Show when={syncError()}>
          <p class="error">{syncError()}</p>
        </Show>
        <Show when={enabled()}>
          <Show when={keyRejected() && lastError()}>
            <p class="error">{lastError()}</p>
          </Show>
          <div class="row">
            <label classList={{ error: statusLine().error }} title={statusLine().detail ?? undefined}>
              {statusLine().text}
            <Show when={fingerprint()}>
              <span style={{ 'font-size': '13px', color: 'var(--subtext)' }}> · Group {fingerprint()}</span>
            </Show>
          </label>
          <button class="btn" disabled={syncing()} onClick={() => void syncNow()}>
            {syncing() ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
        <div class="row">
          <label>Pair another device</label>
          <button class="btn" onClick={() => ctx.openModal({ kind: 'pair-device' })}>Pair</button>
        </div>
        <div class="row">
          <label>Agent access</label>
          <button class="btn" onClick={() => ctx.openModal({ kind: 'agents' })}>Manage</button>
        </div>
        <div class="row danger">
          <label>Regenerate sync key</label>
          <button class="btn" onClick={regenerate}>Regenerate</button>
        </div>
        <div class="row danger">
          <label>Delete sync data</label>
          <button class="btn" onClick={deleteData}>Delete</button>
        </div>
        <Show when={deleteError()}>
          <p class="error">{deleteError()}</p>
        </Show>
      </Show>
    </div>
  );
}
