import { Show, createEffect, createResource, createSignal } from 'solid-js';
import { useApp } from '../state';
import { deleteSyncAccount, listAgentTokens } from '../sync/client';
import { fingerprintSyncKey } from '../sync/key';
import { Section, SettingGroup } from './Section';
import { DangerAction, InlineMessage, SettingRow } from './controls';

const STOP_CONSEQUENCE =
  'This device keeps its data and stops syncing. The data stays on the server, and your other devices and agents are unaffected. To remove the server copy, use Delete data from the server.';
const STOP_AGENTS = ' Agents will only see changes made on other devices.';

export function ServerDataSection() {
  const ctx = useApp();
  const [fingerprint, setFingerprint] = createSignal<string | null>(null);
  const [notice, setNotice] = createSignal<string | null>(null);
  const [agents] = createResource(async () => {
    try {
      return (await listAgentTokens()).length > 0;
    } catch {
      return false;
    }
  });

  createEffect(() => {
    const key = ctx.syncKey();
    if (!key) {
      setFingerprint(null);
      return;
    }
    void fingerprintSyncKey(key).then(setFingerprint).catch(() => setFingerprint(null));
  });

  const stop = async () => {
    ctx.selectSettingsSection('devices');
    await ctx.disableSync();
  };

  const rotate = () => {
    ctx.openModal({
      kind: 'confirm',
      title: 'Sign out other devices and agents',
      message: 'This replaces the sync key on this device. Your other devices stop syncing until you add them again, and agents lose access until you reconnect them.',
      hint: 'If a device was lost or stolen, this is the only way to remove its access.',
      confirmLabel: 'Sign out',
      busyLabel: 'Signing out…',
      danger: true,
      onConfirm: async () => {
        setNotice(null);
        try {
          await ctx.regenerateSyncKey();
        } catch {
          throw new Error("Couldn't sign out other devices and agents. The server did not accept the new key, so this device cannot sync until you join again from another device.");
        }
        setNotice('Other devices and agents have been signed out.');
      },
    });
  };

  const remove = () => {
    ctx.openModal({
      kind: 'confirm',
      title: 'Delete data from the server',
      message: 'This permanently deletes your synced subscriptions, read and starred flags, statistics and agent access from the server. Your other devices will stop syncing. Reading data on this device is kept.',
      hint: 'You can turn sync on again later with a new key.',
      confirmLabel: 'Delete',
      busyLabel: 'Deleting…',
      danger: true,
      onConfirm: async () => {
        setNotice(null);
        try {
          await deleteSyncAccount();
        } catch (e) {
          console.error('Failed to delete sync data:', e);
          throw new Error("Couldn't delete the data from the server. Try again.");
        }
        ctx.selectSettingsSection('devices');
        await ctx.disableSync();
      },
    });
  };

  return (
    <Section title="Server data">
      <Show when={ctx.syncKey()}>
        <p class="settings-summary">
          The server holds your subscriptions, read and starred state, statistics and agent access.
        </p>
        <SettingGroup>
          <SettingRow label="Key ID" description="Matches on every device in the same sync">
            <code class="setting-value setting-value--code">{fingerprint() ?? '…'}</code>
          </SettingRow>
        </SettingGroup>
        <SettingGroup>
          <DangerAction
            tone="default"
            label="Stop syncing on this device"
            description="This device keeps its data but stops syncing. Your other devices and agents are unaffected."
            buttonLabel="Stop syncing"
            inline={{
              consequence: STOP_CONSEQUENCE + (agents() ? STOP_AGENTS : ''),
              confirmLabel: 'Yes, stop syncing',
              busyLabel: 'Stopping…',
              onConfirm: stop,
            }}
          />
          <DangerAction
            tone="default"
            label="Sign out other devices and agents"
            description="Use this if a device is lost or an agent should no longer have access. Your other devices will need to be added again and agents reconnected."
            buttonLabel="Sign out"
            onActivate={rotate}
          />
          <DangerAction
            label="Delete data from the server"
            description="Removes everything Sift stores on the server for your devices and agents. Data on this device is kept."
            buttonLabel="Delete"
            onActivate={remove}
          />
        </SettingGroup>
        <Show when={notice()}>
          <InlineMessage kind="success">{notice()}</InlineMessage>
        </Show>
      </Show>
    </Section>
  );
}
