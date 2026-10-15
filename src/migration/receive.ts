import { createLibraryBackup, libraryDigest, parseLibraryBackup, restoreLibraryBackup, writeMergedLibrary, type LibraryRecord, type LibraryStore } from '../db/library-transfer';
import { setMigrationState } from './source-lock';

const SOURCE_ORIGIN = 'https://sift.davegarvey.workers.dev';
const stores = ['feeds', 'items', 'itemBodies', 'meta', 'itemFlags', 'feedStats', 'readMarkers'] as const satisfies readonly LibraryStore[];
const status = document.querySelector<HTMLElement>('#status');
const error = document.querySelector<HTMLElement>('#error');
const openApp = document.querySelector<HTMLAnchorElement>('#open-app');
const recoveryInput = document.querySelector<HTMLInputElement>('#backup-file');
const chooseBackup = document.querySelector<HTMLButtonElement>('#choose-backup');

function allowedSource(origin: string): boolean {
  if (import.meta.env.DEV) {
    try {
      const source = new URL(origin);
      return source.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(source.hostname);
    } catch {
      return false;
    }
  }
  return origin === SOURCE_ORIGIN;
}

function showError(message: string): void {
  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
  if (status) status.textContent = 'The existing library is still safe. Try the transfer again from the previous page or restore a backup.';
}

function showComplete(counts: Record<string, number>): void {
  if (status) {
    const feedCount = counts.feeds ?? 0;
    const itemCount = counts.items ?? 0;
    status.textContent = `Your library is on Lidora. ${feedCount} subscriptions and ${itemCount} articles were checked and saved.`;
  }
  if (openApp) openApp.hidden = false;
  if (recoveryInput) recoveryInput.disabled = true;
}

async function restoreFile(file: File): Promise<void> {
  if (status) status.textContent = 'Checking the backup…';
  try {
    const backup: unknown = JSON.parse(await file.text());
    const snapshot = parseLibraryBackup(backup);
    const counts = Object.fromEntries(stores.map((store) => [store, snapshot[store].length]));
    setMigrationState('transferring');
    await restoreLibraryBackup(backup);
    setMigrationState('idle');
    showComplete(counts);
  } catch (cause) {
    setMigrationState('idle');
    showError(cause instanceof Error ? cause.message : 'The backup could not be read. The destination was not changed.');
  }
}

recoveryInput?.addEventListener('change', () => {
  const file = recoveryInput.files?.[0];
  recoveryInput.value = '';
  if (file) void restoreFile(file);
});
chooseBackup?.addEventListener('click', () => recoveryInput?.click());

type TransferState = {
  port: MessagePort;
  sourceNonce: string;
  digest: string | null;
  batches: number;
  expectedIndex: number;
  stores: Record<LibraryStore, LibraryRecord[]>;
  expectedCounts: Record<LibraryStore, number> | null;
  committed: boolean;
};

let transfer: TransferState | null = null;
let readyNonce: string | null = null;
let sourceVerificationTimer: ReturnType<typeof setTimeout> | null = null;
let openerClosedCheck: ReturnType<typeof setInterval> | null = null;

function stopSourceVerificationWatch(): void {
  if (sourceVerificationTimer) clearTimeout(sourceVerificationTimer);
  if (openerClosedCheck) clearInterval(openerClosedCheck);
  sourceVerificationTimer = null;
  openerClosedCheck = null;
}

function post(port: MessagePort, value: Record<string, unknown>): void {
  port.postMessage(value);
}

async function receiveMessage(event: MessageEvent<unknown>): Promise<void> {
  const current = transfer;
  if (!current || typeof event.data !== 'object' || event.data === null) return;
  const message = event.data as Record<string, unknown>;
  if (message.type === 'begin') {
    if (message.schemaVersion !== 11 || typeof message.digest !== 'string' || !/^[a-f0-9]{64}$/.test(message.digest)) {
      post(current.port, { type: 'error', message: 'This library version cannot be moved by this release.' });
      return;
    }
    if (!Number.isSafeInteger(message.batches) || Number(message.batches) < 0 || Number(message.batches) > 1_000_000 || typeof message.stores !== 'object' || message.stores === null) {
      post(current.port, { type: 'error', message: 'The transfer details are invalid.' });
      return;
    }
    const counts = message.stores as Record<string, unknown>;
    const expectedCounts = {} as Record<LibraryStore, number>;
    for (const store of stores) {
      const count = counts[store];
      if (!Number.isSafeInteger(count) || Number(count) < 0 || Number(count) > 10_000_000) {
        post(current.port, { type: 'error', message: 'The transfer details are invalid.' });
        return;
      }
      expectedCounts[store] = Number(count);
    }
    current.digest = message.digest;
    current.batches = Number(message.batches);
    current.expectedCounts = expectedCounts;
    post(current.port, { type: 'ready-for-data' });
    if (status) status.textContent = 'Receiving your library in private, verified sections…';
    return;
  }
  if (message.type === 'batch') {
    if (!current.expectedCounts || message.index !== current.expectedIndex || !stores.includes(message.store as LibraryStore) || !Array.isArray(message.rows)) {
      post(current.port, { type: 'error', message: 'A library section arrived out of order. The destination was not changed.' });
      return;
    }
    const store = message.store as LibraryStore;
    if (!message.rows.every((row) => typeof row === 'object' && row !== null && !Array.isArray(row))) {
      post(current.port, { type: 'error', message: 'A library section was invalid. The destination was not changed.' });
      return;
    }
    current.stores[store].push(...message.rows as LibraryRecord[]);
    current.expectedIndex += 1;
    if (status) status.textContent = `Received library section ${current.expectedIndex} of ${current.batches}…`;
    post(current.port, { type: 'batch-received', index: message.index });
    return;
  }
  if (message.type === 'source-verified') {
    if (!current.committed || message.digest !== current.digest || !current.expectedCounts) {
      post(current.port, { type: 'error', message: 'The source library could not be verified. The original is still safe; retry the transfer.' });
      return;
    }
    stopSourceVerificationWatch();
    showComplete(current.expectedCounts);
    setMigrationState('idle');
    post(current.port, { type: 'complete', digest: current.digest });
    current.port.close();
    transfer = null;
    return;
  }
  if (message.type === 'abort' && current.committed) {
    stopSourceVerificationWatch();
    setMigrationState('idle');
    const messageText = 'The source changed during transfer. Its library is safe; run Move to Lidora again to finish.';
    showError(messageText);
    post(current.port, { type: 'error', message: messageText });
    current.port.close();
    transfer = null;
    return;
  }
  if (message.type === 'finish') {
    if (!current.expectedCounts || current.expectedIndex !== current.batches) {
      post(current.port, { type: 'error', message: 'The transfer ended before every library section arrived. The destination was not changed.' });
      return;
    }
    try {
      for (const store of stores) {
        if (current.stores[store].length !== current.expectedCounts[store]) throw new Error('A library section was incomplete. The destination was not changed.');
      }
      const snapshot = { schemaVersion: 11, ...current.stores };
      if (await libraryDigest(snapshot) !== current.digest) throw new Error('The library failed its integrity check. The destination was not changed.');
      if (status) status.textContent = 'Checking the library and saving it to this browser…';
      setMigrationState('transferring');
      await writeMergedLibrary(snapshot);
      current.committed = true;
      if (status) status.textContent = 'Library saved. Checking the original is up to date…';
      sourceVerificationTimer = setTimeout(() => {
        if (transfer !== current) return;
        setMigrationState('idle');
        showError('The source page stopped responding. Your original library is safe; retry the transfer to finish.');
        post(current.port, { type: 'error', message: 'The source page stopped responding. Your original library is safe; retry the transfer to finish.' });
        current.port.close();
        transfer = null;
      }, 120_000);
      openerClosedCheck = setInterval(() => {
        if (!window.opener?.closed || transfer !== current) return;
        stopSourceVerificationWatch();
        setMigrationState('idle');
        const messageText = 'The source page closed. Your original library is safe; retry the transfer to finish.';
        showError(messageText);
        post(current.port, { type: 'error', message: messageText });
        current.port.close();
        transfer = null;
      }, 500);
      post(current.port, { type: 'committed', digest: current.digest });
    } catch (cause) {
      const messageText = cause instanceof Error ? cause.message : 'The library could not be saved.';
      setMigrationState('idle');
      showError(messageText);
      post(current.port, { type: 'error', message: messageText });
      current.port.close();
      transfer = null;
    }
  }
}

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (!window.opener || event.source !== window.opener || !allowedSource(event.origin) || typeof event.data !== 'object' || event.data === null) return;
  const message = event.data as { type?: unknown; nonce?: unknown; sourceNonce?: unknown };
  if (message.type !== 'lidora-migration-start' || typeof message.nonce !== 'string' || message.nonce !== readyNonce || typeof message.sourceNonce !== 'string' || event.ports.length !== 1 || transfer) return;
  readyNonce = null;
  const port = event.ports[0];
  transfer = {
    port,
    sourceNonce: message.sourceNonce,
    digest: null,
    batches: 0,
    expectedIndex: 0,
    stores: { feeds: [], items: [], itemBodies: [], meta: [], itemFlags: [], feedStats: [], readMarkers: [] },
    expectedCounts: null,
    committed: false,
  };
  setMigrationState('transferring');
  port.addEventListener('message', (portEvent: MessageEvent<unknown>) => void receiveMessage(portEvent));
  port.start();
  post(port, { type: 'ready', sourceNonce: transfer.sourceNonce });
});

window.addEventListener('beforeunload', () => {
  stopSourceVerificationWatch();
  if (transfer) setMigrationState('idle');
});

if (window.opener) {
  readyNonce = crypto.randomUUID();
  const oldOrigin = import.meta.env.DEV
    ? (() => { try { return new URL(document.referrer).origin; } catch { return ''; } })()
    : SOURCE_ORIGIN;
  if (allowedSource(oldOrigin)) window.opener.postMessage({ type: 'lidora-migration-ready', nonce: readyNonce }, oldOrigin);
}
