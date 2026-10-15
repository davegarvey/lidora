import { Show, createResource, createSignal, onCleanup, onMount } from 'solid-js';
import { useApp } from '../state';
import { settingsUrl } from '../routing';
import { getSyncCapabilities } from '../sync/capabilities';
import { lastPullAt, lastPushAt, pendingCount, lastError, lastErrorAt, keyRejected } from '../sync/status';
import { humanRelativeTime } from '../util/time';
import { Section, SettingGroup } from './Section';
import { AddDeviceCard } from './AddDeviceCard';
import { JoinDeviceCard, JoinForm } from './JoinDeviceCard';
import {
  ActionButton,
  ExpandingPanel,
  InlineMessage,
  PanelButton,
  SettingRow,
  createPanel,
} from './controls';

const JOINED_MESSAGE = 'This device is now syncing';

export function DevicesSection() {
  const [capabilities] = createResource(() => getSyncCapabilities());
  return (
    <Section title="Devices">
      <Show when={capabilities()?.sync}>
        <DevicesBody items={capabilities()?.items === true} />
      </Show>
    </Section>
  );
}

function DevicesBody(props: { items: boolean }) {
  const ctx = useApp();
  const joinPanel = createPanel();
  const pairResult = ctx.state.pairResult;
  if (pairResult) ctx.setState({ pairResult: null });
  const [notice, setNotice] = createSignal<string | null>(pairResult?.kind === 'success' ? JOINED_MESSAGE : null);
  const [frozen, setFrozen] = createSignal<boolean | null>(null);
  const [joinSeed, setJoinSeed] = createSignal<{ code: string; error: string } | null>(
    pairResult?.kind === 'failure' ? { code: pairResult.code, error: pairResult.message } : null,
  );
  const [collectError, setCollectError] = createSignal<string | null>(null);
  if (pairResult?.kind === 'failure') joinPanel.open();

  const enabled = () => frozen() ?? Boolean(ctx.syncKey());

  const onBusyChange = (busy: boolean) => setFrozen(busy ? Boolean(ctx.syncKey()) : null);
  const onJoined = () => {
    setJoinSeed(null);
    setNotice(JOINED_MESSAGE);
    joinPanel.close();
  };

  const collect = async () => {
    setCollectError(null);
    try {
      await ctx.enableSync();
    } catch (e) {
      console.error('Failed to enable sync:', e);
      setCollectError("Couldn't turn on sync");
    }
  };

  return (
    <>
      <Show
        when={enabled()}
        fallback={
          <p class="settings-summary">
            Keep your subscriptions and reading progress in step across your devices. There is no account; your devices share a private key.
          </p>
        }
      >
        <StatusCard notice={notice()} />
      </Show>
      <div class="device-cards" classList={{ 'device-cards--pair': !enabled() }}>
        <AddDeviceCard />
        <Show when={!enabled()}>
          <JoinDeviceCard
            initialValue={joinSeed()?.code}
            initialError={joinSeed()?.error}
            onJoined={onJoined}
            onBusyChange={onBusyChange}
          />
        </Show>
      </div>
      <Show when={enabled()}>
        <div class="device-join-different">
          <PanelButton panel={joinPanel} variant="subtle">Join a different sync instead</PanelButton>
          <ExpandingPanel panel={joinPanel} class="device-card">
            <h3 class="device-card__title">Join from another device</h3>
            <JoinForm
              leavingSync
              initialValue={joinSeed()?.code}
              initialError={joinSeed()?.error}
              onJoined={onJoined}
              onBusyChange={onBusyChange}
            />
          </ExpandingPanel>
        </div>
      </Show>
      <Show when={!enabled() && props.items}>
        <SettingGroup>
          <SettingRow
            label="Collect new posts while Lidora is closed"
            description="Turns on sync for this device alone. This stores your subscriptions on this Lidora server so it can fetch new posts in the background."
          >
            <ActionButton
              label={collectError() ? 'Retry' : 'Turn on'}
              busyLabel="Turning on…"
              onAction={collect}
            />
          </SettingRow>
          <Show when={collectError()}>
            <InlineMessage kind="error">{collectError()}</InlineMessage>
          </Show>
        </SettingGroup>
      </Show>
    </>
  );
}

function StatusCard(props: { notice: string | null }) {
  const ctx = useApp();
  const [nowTick, setNowTick] = createSignal(Date.now());
  onMount(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30_000);
    onCleanup(() => clearInterval(timer));
  });

  const status = () => {
    void nowTick();
    const error = lastError();
    const errorAt = lastErrorAt();
    if (error && errorAt) {
      return { text: `Sync failed ${humanRelativeTime(new Date(errorAt))}`, error };
    }
    const pending = pendingCount();
    if (pending > 0) return { text: `${pending} change${pending === 1 ? '' : 's'} waiting to sync`, error: null };
    const last = Math.max(lastPullAt() ?? 0, lastPushAt() ?? 0);
    if (last === 0) return { text: 'Never synced', error: null };
    return { text: `Synced ${humanRelativeTime(new Date(last))}`, error: null };
  };

  const openServerData = (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    ctx.selectSettingsSection('server-data');
  };

  return (
    <div class="device-card device-status">
      <SettingRow label={status().text}>
        <ActionButton
          label="Sync now"
          busyLabel="Syncing…"
          onAction={() => ctx.syncNow().catch(() => undefined)}
        />
      </SettingRow>
      <Show when={status().error}>
        {(error) => (
          <>
            <InlineMessage kind="error">{error()}</InlineMessage>
            <Show when={keyRejected()}>
              <a class="setting-link" href={settingsUrl('server-data')} onClick={openServerData}>
                Open Server data
              </a>
            </Show>
          </>
        )}
      </Show>
      <Show when={props.notice}>
        <InlineMessage kind="success">{props.notice}</InlineMessage>
      </Show>
    </div>
  );
}
