import { Show, createSignal, onMount } from 'solid-js';
import { TriangleAlert } from 'lucide-solid';
import { useApp } from '../state';
import { isSyncAvailable } from '../sync/capabilities';
import { getStorageStatus, requestPersistentStorage, type StorageStatus } from '../db/storage-retention';
import { createLibraryBackup, readLibrarySnapshot } from '../db/library-transfer';
import { moveLibraryToLidora, migrationProgressLabel, type HandoffProgress } from '../migration/handoff';
import { Section, SettingGroup } from './Section';
import { ActionButton, InlineMessage, SettingRow, errorMessage } from './controls';
import { formatBytes, formatCount, storageSummary } from './format';

const LEGACY_HOSTED_ORIGIN = 'https://sift.davegarvey.workers.dev';

function persistenceLabel(persistent: boolean | null): string {
  return persistent ? 'On' : 'Unavailable';
}

const DECLINED_MESSAGE = 'Your browser declined. Browsers usually keep data for installed apps and sites used often, so installing Lidora may help.';

function persistenceRisk(syncOn: boolean, syncAvailable: boolean): string {
  const risk = 'Your browser may clear this library when space runs low.';
  if (syncOn) return `${risk} Your subscriptions and reading state are synced, but articles are kept only on this device, so download a backup to keep them.`;
  if (syncAvailable) return `${risk} Download a backup, or add a device to sync your subscriptions and reading state.`;
  return `${risk} Download a backup to protect it.`;
}

export function StorageSection() {
  const ctx = useApp();
  const [status, setStatus] = createSignal<StorageStatus | null>(null);
  const [syncAvailable, setSyncAvailable] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [declined, setDeclined] = createSignal(false);
  const [backupError, setBackupError] = createSignal<string | null>(null);
  const [transferError, setTransferError] = createSignal<string | null>(null);
  const [progress, setProgress] = createSignal<HandoffProgress | null>(null);
  const refresh = async () => setStatus(await getStorageStatus());
  onMount(() => {
    void isSyncAvailable().then(setSyncAvailable);
    void refresh().catch(() => setError('Could not read storage information. Reload the page and try again.'));
  });

  const keep = async () => {
    setError(null);
    setDeclined(false);
    const granted = await requestPersistentStorage(true);
    await refresh();
    if (granted === false && status()?.persistent === false) setDeclined(true);
  };

  const exportLibrary = async () => {
    const snapshot = await readLibrarySnapshot();
    const url = URL.createObjectURL(createLibraryBackup(snapshot));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lidora-library-backup.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const moveLibrary = async () => {
    setTransferError(null);
    setProgress({ phase: 'snapshot', sent: 0, total: 0 });
    await moveLibraryToLidora(setProgress);
  };

  return (
    <Section title="Storage">
      <Show when={status()} fallback={<p class="settings-summary">Reading storage…</p>}>
        {(s) => (
          <>
            <p class="settings-summary">{storageSummary(s().usage, s().items)}</p>
            <Show when={s().persistent === false}>
              <SettingGroup>
                <SettingRow
                  warning
                  label={<><TriangleAlert size={16} class="setting-row__icon" aria-hidden="true" />Persistent storage is off</>}
                  description={persistenceRisk(Boolean(ctx.syncKey()), syncAvailable())}
                >
                  <ActionButton
                    label="Ask browser to keep data"
                    busyLabel="Asking…"
                    onAction={keep}
                    onError={(e) => setError(errorMessage(e, 'The browser did not respond. Try again.'))}
                  />
                </SettingRow>
              </SettingGroup>
            </Show>
            <Show when={declined()}>
              <InlineMessage kind="info">{DECLINED_MESSAGE}</InlineMessage>
            </Show>
            <Show when={error()}>
              <InlineMessage kind="error">{error()}</InlineMessage>
            </Show>
            <dl class="settings-details">
              <div><dt>Quota</dt><dd>{formatBytes(s().quota)}</dd></div>
              <Show when={s().persistent !== false}>
                <div><dt>Persistent storage</dt><dd>{persistenceLabel(s().persistent)}</dd></div>
              </Show>
              <div><dt>Article records</dt><dd>{formatCount(s().items)}</dd></div>
              <div><dt>Saved article bodies</dt><dd>{formatCount(s().bodies)}</dd></div>
            </dl>
          </>
        )}
      </Show>
      <Show when={!status() && error()}>
        <InlineMessage kind="error">{error()}</InlineMessage>
      </Show>
      <SettingGroup>
        <SettingRow label="Full library backup" description="Download your subscriptions, articles, reading state, preferences and sync settings as one file. It includes private feed addresses and your sync key, so store it securely.">
          <ActionButton
            label="Download backup"
            busyLabel="Preparing…"
            onAction={exportLibrary}
            onError={(cause) => setBackupError(errorMessage(cause, 'Could not create the backup. Try again.'))}
          />
        </SettingRow>
        <Show when={backupError()}><InlineMessage kind="error">{backupError()}</InlineMessage></Show>
        <Show when={window.location.origin === LEGACY_HOSTED_ORIGIN || (import.meta.env.DEV && window.location.port === '8787')}>
          <SettingRow label="Move to Lidora" description="Copy your complete library to Lidora in another browser tab. Your original stays here until the new library is verified.">
            <ActionButton
              label="Move to Lidora"
              busyLabel={progress() ? migrationProgressLabel(progress()!) : 'Moving…'}
              onAction={moveLibrary}
              onError={(cause) => setTransferError(errorMessage(cause, 'The transfer stopped. Your original library is safe; try again.'))}
            />
          </SettingRow>
          <Show when={progress() && progress()!.phase !== 'complete'}>
            <InlineMessage kind="info">{migrationProgressLabel(progress()!)}</InlineMessage>
          </Show>
          <Show when={transferError()}><InlineMessage kind="error">{transferError()}</InlineMessage></Show>
        </Show>
      </SettingGroup>
    </Section>
  );
}
