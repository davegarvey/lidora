import { Show, createSignal, onMount } from 'solid-js';
import { getStorageStatus, requestPersistentStorage, type StorageStatus } from '../db/storage-retention';
import { Section, SettingGroup } from './Section';
import { ActionButton, InlineMessage, SettingRow, errorMessage } from './controls';
import { formatBytes, formatCount, storageSummary } from './format';

function persistenceLabel(persistent: boolean | null): string {
  if (persistent === null) return 'Unavailable';
  return persistent ? 'On' : 'Off';
}

export function StorageSection() {
  const [status, setStatus] = createSignal<StorageStatus | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const refresh = async () => setStatus(await getStorageStatus());
  onMount(() => {
    void refresh().catch(() => setError('Could not read storage information. Reload the page and try again.'));
  });

  const keep = async () => {
    setError(null);
    await requestPersistentStorage(true);
    await refresh();
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
                  label="Your browser may clear Sift's data when space runs low"
                  description="Ask the browser to keep Sift's data until you clear it yourself."
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
    </Section>
  );
}
