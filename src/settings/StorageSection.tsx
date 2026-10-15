import { Show, createSignal, onMount } from 'solid-js';
import { getStorageStatus, requestPersistentStorage, type StorageStatus } from '../db/storage-retention';
import { createLibraryBackup, readLibrarySnapshot } from '../db/library-transfer';
import { moveLibraryToLidora, migrationProgressLabel, type HandoffProgress } from '../migration/handoff';
import { Section, SettingGroup } from './Section';
import { ActionButton, InlineMessage, SettingRow, errorMessage } from './controls';
import { formatBytes, formatCount, storageSummary } from './format';

const LEGACY_HOSTED_ORIGIN = 'https://sift.davegarvey.workers.dev';

function persistenceLabel(persistent: boolean | null): string {
  if (persistent === null) return 'Unavailable';
  return persistent ? 'On' : 'Off';
}

export function StorageSection() {
  const [status, setStatus] = createSignal<StorageStatus | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [backupError, setBackupError] = createSignal<string | null>(null);
  const [transferError, setTransferError] = createSignal<string | null>(null);
  const [progress, setProgress] = createSignal<HandoffProgress | null>(null);
  const refresh = async () => setStatus(await getStorageStatus());
  onMount(() => {
    void refresh().catch(() => setError('Could not read storage information. Reload the page and try again.'));
  });

  const keep = async () => {
    setError(null);
    await requestPersistentStorage(true);
    await refresh();
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
                  label="Your browser may clear Lidora's data when space runs low"
                  description="Ask the browser to keep Lidora's data until you clear it yourself."
                >
                  <ActionButton
                    label="Keep data on this device"
                    busyLabel="Requesting…"
                    onAction={keep}
                    onError={(e) => setError(errorMessage(e, 'The browser did not respond. Try again.'))}
                  />
                </SettingRow>
              </SettingGroup>
            </Show>
            <Show when={error()}>
              <InlineMessage kind="error">{error()}</InlineMessage>
            </Show>
            <dl class="settings-details">
              <div><dt>Quota</dt><dd>{formatBytes(s().quota)}</dd></div>
              <div><dt>Persistent storage</dt><dd>{persistenceLabel(s().persistent)}</dd></div>
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
        <SettingRow label="Full library backup" description="Save subscriptions, articles, saved article text, reading state, preferences, sync credentials and pending sync changes to a file.">
          <ActionButton
            label="Download backup"
            busyLabel="Preparing…"
            onAction={exportLibrary}
            onError={(cause) => setBackupError(errorMessage(cause, 'Could not create the backup. Try again.'))}
          />
        </SettingRow>
        <p class="settings-summary">A backup can contain private feed addresses and sync keys. Keep it somewhere private.</p>
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
