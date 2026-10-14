import { For, Show, createEffect, createResource, createSignal, on, onCleanup } from 'solid-js';
import { Check, Copy, Pencil, ScanLine, Trash2, X } from 'lucide-solid';
import { useApp } from '../state';
import { isSyncAvailable } from '../sync/capabilities';
import {
  mintAgentConnection,
  listAgentTokens,
  renameAgentToken,
  revokeAgentToken,
  SyncClientError,
  type AgentTokenInfo,
} from '../sync/client';
import { decideApproval, lookupApproval } from '../agents/api';
import {
  AgentApiError,
  accessLabel,
  displayApprovalCode,
  normaliseApprovalCode,
  type AccessView,
} from '../agents/approval';
import { ClientSummary } from '../agents/ClientSummary';
import { agentSetupPrompt } from '../agents/setupPrompt';
import { QrScannerOverlay } from '../components/QrScannerOverlay';
import { expiryLabel, humanRelativeTime } from '../util/time';
import { Section } from './Section';
import { ActionButton, ExpandingPanel, InlineConfirm, InlineMessage, PanelButton, createPanel } from './controls';

const LABEL_MAX = 64;
const SYNC_OFF_NOTE =
  'Agents use the copy of your subscriptions and reading progress stored on this Sift server. Connecting one turns this on.';

const AGENTS_CHANGED_EVENT = 'sift:agents-changed';

function approvalErrorMessage(e: unknown): string {
  if (e instanceof AgentApiError) {
    if (e.status === 404) return 'No request matches that code. Check it and try again.';
    if (e.status === 410) return 'That request has expired. Restart the connection from your agent.';
    if (e.status === 409) return 'That request has already been decided.';
    if (e.status === 429) return 'Too many attempts. Wait a minute and try again.';
    if (e.status === 401) return 'Sift could not confirm your account. Check that sync is on.';
  }
  return 'Could not reach Sift. Try again.';
}

function titleOf(token: AgentTokenInfo): string {
  return token.label || token.client_name || 'Agent';
}

function detailOf(token: AgentTokenInfo): string {
  const parts: string[] = [];
  if (token.label && token.client_name) parts.push(token.client_name);
  if (token.unverified && token.client_host) parts.push(token.client_host);
  if (accessLabel(token.scopes) === 'Read only') parts.push('Read only');
  parts.push(token.last_seen_at === null ? 'Not used yet' : `Last used ${humanRelativeTime(new Date(token.last_seen_at))}`);
  return parts.join(' · ');
}

export function AgentsSection() {
  const [available] = createResource(() => isSyncAvailable());
  return (
    <Section title="Agents">
      <Show when={available()}>
        <AgentsBody />
      </Show>
    </Section>
  );
}

function AgentsBody() {
  return (
    <>
      <p class="settings-summary">Let an AI assistant read and manage your feeds through MCP.</p>
      <ConnectCard />
      <ConnectedAgents />
      <ApprovalCode />
    </>
  );
}

function ConnectCard() {
  const ctx = useApp();
  const [connectUrl, setConnectUrl] = createSignal<string | null>(null);
  const [expiresAt, setExpiresAt] = createSignal<number | null>(null);
  const [now, setNow] = createSignal(Date.now());
  const [copiedUrl, setCopiedUrl] = createSignal(false);
  const [copiedPrompt, setCopiedPrompt] = createSignal(false);
  const [autoCopied, setAutoCopied] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const timer = setInterval(() => setNow(Date.now()), 1000);
  onCleanup(() => clearInterval(timer));

  const expired = () => expiresAt() !== null && now() >= expiresAt()!;
  const live = () => connectUrl() !== null && !expired();

  const connect = async () => {
    setError(null);
    setAutoCopied(false);
    if (!ctx.syncKey()) {
      try {
        await ctx.enableSync();
        window.dispatchEvent(new Event(AGENTS_CHANGED_EVENT));
      } catch (e) {
        console.error('Failed to enable sync:', e);
        setError("Couldn't turn on sync");
        return;
      }
    }
    try {
      const res = await mintAgentConnection();
      setConnectUrl(res.url);
      setExpiresAt(res.expiresAt);
      setNow(Date.now());
      try {
        await navigator.clipboard.writeText(agentSetupPrompt(res.url));
        setAutoCopied(true);
      } catch {
        setAutoCopied(false);
      }
    } catch (e) {
      console.error('Failed to create a connection link:', e);
      setError(
        e instanceof SyncClientError && e.status === 429
          ? 'Too many links created recently. Try again shortly.'
          : 'Could not create a connection link. Try again.',
      );
    }
  };

  const copy = async (text: string, flag: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      flag(true);
      setTimeout(() => flag(false), 2000);
    } catch {
      setError('Could not copy. Select the text and copy it by hand.');
    }
  };

  return (
    <div class="agent-connect">
      <Show when={!ctx.syncKey()}>
        <p class="agent-note">{SYNC_OFF_NOTE}</p>
      </Show>
      <Show
        when={live()}
        fallback={
          <>
            <Show when={connectUrl()}>
              <p class="agent-note">This link has expired</p>
            </Show>
            <div>
              <ActionButton
                variant="primary"
                label={connectUrl() ? 'Create a new link' : 'Connect an agent'}
                busyLabel={connectUrl() ? 'Creating…' : 'Connecting…'}
                onAction={connect}
              />
            </div>
          </>
        }
      >
        <div class="agent-link">
          <code class="agent-link__url">{connectUrl()}</code>
          <button
            type="button"
            class="agent-link__copy"
            onClick={() => void copy(connectUrl()!, setCopiedUrl)}
            aria-label="Copy connection link"
          >
            {copiedUrl() ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        <Show when={autoCopied()}>
          <p class="inline-message inline-message--success agent-status" role="status">
            <Check size={14} aria-hidden="true" />
            Setup instructions copied
          </p>
        </Show>
        <p class="agent-note">
          {`Paste the setup instructions into your agent's chat, or the link into its connector settings, then tap Allow. Expires in ${expiryLabel(expiresAt()!)}.`}
        </p>
        <div>
          <button type="button" class="btn" onClick={() => void copy(agentSetupPrompt(connectUrl()!), setCopiedPrompt)}>
            {copiedPrompt() ? <Check size={14} /> : <Copy size={14} />}
            {copiedPrompt() ? 'Copied' : 'Copy setup instructions'}
          </button>
        </div>
      </Show>
      <Show when={error()}>
        <InlineMessage kind="error">{error()}</InlineMessage>
      </Show>
    </div>
  );
}

type ListState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; tokens: AgentTokenInfo[] };


function ConnectedAgents() {
  const ctx = useApp();
  const [list, setList] = createSignal<ListState>({ kind: 'loading' });
  const [actionError, setActionError] = createSignal<string | null>(null);
  let alive = true;
  let generation = 0;
  onCleanup(() => { alive = false; });

  const load = async (showLoading: boolean) => {
    const mine = ++generation;
    if (!ctx.syncKey()) {
      setList({ kind: 'ready', tokens: [] });
      return;
    }
    if (showLoading) setList({ kind: 'loading' });
    try {
      const tokens = await listAgentTokens();
      if (alive && mine === generation) setList({ kind: 'ready', tokens });
    } catch (e) {
      console.error('Failed to list agents:', e);
      if (alive && mine === generation) setList({ kind: 'error' });
    }
  };

  const reload = () => load(false);
  createEffect(on(() => ctx.syncKey(), (key, previous) => {
    if (previous === undefined || !key) void load(list().kind !== 'ready');
  }));
  window.addEventListener(AGENTS_CHANGED_EVENT, reload);
  onCleanup(() => window.removeEventListener(AGENTS_CHANGED_EVENT, reload));

  const current = () => {
    const state = list();
    return state.kind === 'ready' ? state.tokens : [];
  };

  return (
    <div class="agent-list-block">
      <h3 class="agent-heading">Connected agents</h3>
      <Show when={list().kind === 'loading'}>
        <p class="agent-note" role="status">Loading agents…</p>
      </Show>
      <Show when={list().kind === 'error'}>
        <div class="agent-error">
          <InlineMessage kind="error">Could not load your connected agents.</InlineMessage>
          <button type="button" class="btn" onClick={() => void load(true)}>Retry</button>
        </div>
      </Show>
      <Show when={list().kind === 'ready'}>
        <Show when={current().length > 0} fallback={<p class="agent-note">No agents connected</p>}>
          <div class="agent-list">
            <For each={current()}>
              {(token) => <AgentRow token={token} reload={reload} onError={setActionError} />}
            </For>
          </div>
        </Show>
      </Show>
      <Show when={actionError()}>
        <InlineMessage kind="error">{actionError()}</InlineMessage>
      </Show>
    </div>
  );
}

function AgentRow(props: { token: AgentTokenInfo; reload: () => Promise<void>; onError: (message: string | null) => void }) {
  const panel = createPanel();
  const [renaming, setRenaming] = createSignal(false);
  const [renameValue, setRenameValue] = createSignal('');

  const startRename = () => {
    props.onError(null);
    setRenameValue(props.token.label ?? '');
    setRenaming(true);
  };

  const saveRename = async () => {
    props.onError(null);
    try {
      await renameAgentToken(props.token.token_id, renameValue().trim());
      setRenaming(false);
      await props.reload();
    } catch (e) {
      console.error('Failed to rename agent:', e);
      props.onError('Could not rename. Try again.');
    }
  };

  const revoke = async () => {
    props.onError(null);
    try {
      await revokeAgentToken(props.token.token_id);
    } catch (e) {
      console.error('Failed to revoke agent:', e);
      throw new Error('Could not revoke this agent. Try again.');
    }
    await props.reload();
  };

  return (
    <div class="agent-row">
      <div class="agent-row__line">
        <div class="agent-row__main">
          <Show
            when={renaming()}
            fallback={
              <div class="agent-row__title">
                <span>{titleOf(props.token)}</span>
                <Show when={props.token.unverified}><span class="unverified-mark">unverified</span></Show>
              </div>
            }
          >
            <form class="agent-form" onSubmit={(e) => { e.preventDefault(); void saveRename(); }}>
              <input
                class="text-input agent-form__input"
                type="text"
                maxLength={LABEL_MAX}
                value={renameValue()}
                placeholder={props.token.client_name ?? 'Agent'}
                aria-label="Agent name"
                onInput={(e) => setRenameValue(e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setRenaming(false); } }}
                ref={(el) => queueMicrotask(() => el.focus())}
              />
              <button class="btn" type="submit" aria-label="Save name"><Check size={14} /></button>
              <button class="btn subtle" type="button" aria-label="Cancel rename" onClick={() => setRenaming(false)}><X size={14} /></button>
            </form>
          </Show>
          <div class="agent-row__detail">{detailOf(props.token)}</div>
        </div>
        <div class="agent-row__actions">
          <button type="button" class="btn subtle" aria-label={`Rename ${titleOf(props.token)}`} onClick={startRename}>
            <Pencil size={14} />
          </button>
          <PanelButton panel={panel} variant="subtle" openOnly ariaLabel={`Revoke ${titleOf(props.token)}`}>
            <Trash2 size={14} />
          </PanelButton>
        </div>
      </div>
      <InlineConfirm
        panel={panel}
        consequence={`Revoke access for ${titleOf(props.token)}? It loses access immediately and can be connected again later.`}
        confirmLabel="Yes, revoke"
        busyLabel="Revoking…"
        onConfirm={revoke}
      />
    </div>
  );
}

function ApprovalCode() {
  const ctx = useApp();
  const panel = createPanel();
  const [codeInput, setCodeInput] = createSignal('');
  const [lookup, setLookup] = createSignal<{ code: string; view: AccessView } | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [message, setMessage] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [scanning, setScanning] = createSignal(false);

  const ensureSync = async (): Promise<boolean> => {
    if (ctx.syncKey()) return true;
    try {
      await ctx.enableSync();
      window.dispatchEvent(new Event(AGENTS_CHANGED_EVENT));
      return true;
    } catch (e) {
      console.error('Failed to enable sync:', e);
      setError("Couldn't turn on sync");
      return false;
    }
  };

  const findRequest = async (raw: string) => {
    setMessage(null);
    setError(null);
    setLookup(null);
    const code = normaliseApprovalCode(raw);
    if (!code) {
      setError('Enter the 8-character code shown on the connection page.');
      return;
    }
    setBusy(true);
    try {
      if (!(await ensureSync())) return;
      const view = await lookupApproval(code);
      if (view.status === 'expired') setError('That request has expired. Restart the connection from your agent.');
      else if (view.status !== 'pending') setError('That request has already been decided.');
      else setLookup({ code, view });
    } catch (e) {
      setError(approvalErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const decide = async (decision: 'approve' | 'deny') => {
    const current = lookup();
    if (!current || busy()) return;
    setBusy(true);
    setError(null);
    try {
      if (decision === 'approve' && !(await ensureSync())) return;
      await decideApproval(current.code, decision);
      setMessage(decision === 'approve' ? `${current.view.clientName} is now connected.` : `Denied ${current.view.clientName}.`);
      setLookup(null);
      setCodeInput('');
      if (decision === 'approve') window.dispatchEvent(new Event(AGENTS_CHANGED_EVENT));
    } catch (e) {
      setError(approvalErrorMessage(e));
      if (e instanceof AgentApiError && (e.status === 409 || e.status === 410)) setLookup(null);
    } finally {
      setBusy(false);
    }
  };

  const onScanned = (text: string): boolean => {
    const code = normaliseApprovalCode(text);
    if (!code) return false;
    setScanning(false);
    setCodeInput(displayApprovalCode(code));
    void findRequest(code);
    return true;
  };

  return (
    <div class="agent-approval">
      <div>
        <PanelButton panel={panel} variant="subtle">Have an approval code?</PanelButton>
      </div>
      <ExpandingPanel panel={panel}>
        <form class="agent-form" onSubmit={(e) => { e.preventDefault(); void findRequest(codeInput()); }}>
          <input
            class="text-input agent-form__input agent-form__input--code"
            type="text"
            value={codeInput()}
            onInput={(e) => setCodeInput(e.currentTarget.value)}
            placeholder="Approval code"
            aria-label="Approval code"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck={false}
            disabled={busy()}
            data-autofocus=""
          />
          <button type="submit" class="btn" disabled={busy() || !codeInput().trim()}>Look up</button>
          <button type="button" class="btn btn--icon" aria-label="Scan a QR code" disabled={busy()} onClick={() => setScanning(true)}>
            <ScanLine size={18} />
          </button>
        </form>
        <Show when={error()}>
          <InlineMessage kind="error">{error()}</InlineMessage>
        </Show>
        <Show when={message()}>
          <InlineMessage kind="success">{message()}</InlineMessage>
        </Show>
        <Show when={lookup()}>
          {(found) => (
            <>
              <ClientSummary view={found().view} />
              <div class="panel__actions">
                <button type="button" class="btn primary" disabled={busy()} onClick={() => void decide('approve')}>Approve</button>
                <button type="button" class="btn subtle" disabled={busy()} onClick={() => void decide('deny')}>Deny</button>
              </div>
            </>
          )}
        </Show>
      </ExpandingPanel>
      <Show when={scanning()}>
        <QrScannerOverlay onClose={() => setScanning(false)} onText={onScanned} />
      </Show>
    </div>
  );
}
