import { libraryDigest, readLibrarySnapshot, type LibraryRecord, type LibraryStore } from '../db/library-transfer';
import { setMigrationState } from './source-lock';

export type HandoffProgress = { phase: 'snapshot' | 'sending' | 'verifying' | 'complete'; sent: number; total: number };

const TARGET_ORIGIN = 'https://lidora.app';
const MESSAGE_TIMEOUT_MS = 60_000;
const MAX_CHUNK_BYTES = 192 * 1024;
const MAX_CHUNK_ROWS = 64;

function targetOrigin(): string {
  if (import.meta.env.DEV && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    const configured = import.meta.env.VITE_LIDORA_MIGRATION_TARGET_ORIGIN;
    return configured || `${location.protocol}//${location.hostname}:8788`;
  }
  return TARGET_ORIGIN;
}

function waitForPortMessage(port: MessagePort, popup: Window): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      clearInterval(closedCheck);
      port.removeEventListener('message', onMessage);
      reject(new Error('The transfer window stopped responding. Keep this library and try again.'));
    }, MESSAGE_TIMEOUT_MS);
    const closedCheck = setInterval(() => {
      if (!popup.closed) return;
      clearTimeout(timer);
      clearInterval(closedCheck);
      port.removeEventListener('message', onMessage);
      reject(new Error('The transfer window was closed. Your original library is safe; open it again to retry.'));
    }, 250);
    const onMessage = (event: MessageEvent<unknown>) => {
      clearTimeout(timer);
      clearInterval(closedCheck);
      port.removeEventListener('message', onMessage);
      if (typeof event.data !== 'object' || event.data === null) {
        reject(new Error('The transfer window sent an invalid response. Your library is still safe.'));
      } else {
        resolve(event.data as Record<string, unknown>);
      }
    };
    port.addEventListener('message', onMessage);
    port.start();
  });
}

function chunkRows(rows: LibraryRecord[]): LibraryRecord[][] {
  const chunks: LibraryRecord[][] = [];
  let chunk: LibraryRecord[] = [];
  let bytes = 2;
  for (const row of rows) {
    const rowBytes = new TextEncoder().encode(JSON.stringify(row)).length + 1;
    if (chunk.length > 0 && (chunk.length >= MAX_CHUNK_ROWS || bytes + rowBytes > MAX_CHUNK_BYTES)) {
      chunks.push(chunk);
      chunk = [];
      bytes = 2;
    }
    chunk.push(row);
    bytes += rowBytes;
  }
  if (chunk.length > 0) chunks.push(chunk);
  return chunks;
}

export async function moveLibraryToLidora(onProgress: (progress: HandoffProgress) => void): Promise<void> {
  const origin = targetOrigin();
  const popup = window.open(`${origin}/migrate.html`, '_blank');
  if (!popup) throw new Error('Your browser blocked the transfer window. Allow pop-ups for this page and try again.');

  setMigrationState('transferring');
  const channel = new MessageChannel();
  let readyListener: ((event: MessageEvent) => void) | undefined;
  let readyTimer: ReturnType<typeof setTimeout> | null = null;
  let popupCheck: ReturnType<typeof setInterval> | null = null;
  const nonce = crypto.randomUUID();
  const ready = new Promise<string>((resolve, reject) => {
    const stopWaiting = () => {
      if (readyTimer) clearTimeout(readyTimer);
      if (popupCheck) clearInterval(popupCheck);
      readyTimer = null;
      popupCheck = null;
    };
    readyTimer = setTimeout(() => {
      stopWaiting();
      reject(new Error('Lidora did not open the transfer window. Your library is still safe.'));
    }, MESSAGE_TIMEOUT_MS);
    popupCheck = setInterval(() => {
      if (popup.closed) {
        stopWaiting();
        reject(new Error('The transfer window was closed. Your library is still safe; open it again to retry.'));
      }
    }, 250);
    readyListener = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== popup || typeof event.data !== 'object' || event.data === null) return;
      const data = event.data as { type?: unknown; nonce?: unknown };
      if (data.type !== 'lidora-migration-ready' || typeof data.nonce !== 'string') return;
      stopWaiting();
      resolve(data.nonce);
    };
    window.addEventListener('message', readyListener);
  });
  void ready.catch(() => {});
  try {
    onProgress({ phase: 'snapshot', sent: 0, total: 0 });
    const receiverNonce = await ready;
    popup.postMessage({ type: 'lidora-migration-start', nonce: receiverNonce, sourceNonce: nonce }, origin, [channel.port2]);
    const accepted = await waitForPortMessage(channel.port1, popup);
    if (accepted.type !== 'ready' || accepted.sourceNonce !== nonce) throw new Error('The transfer handshake failed. Your library is still safe.');

    const snapshot = await readLibrarySnapshot();
    const digest = await libraryDigest(snapshot);
    const batchList = (Object.keys(snapshot).filter((key) => key !== 'schemaVersion') as LibraryStore[])
      .flatMap((store) => chunkRows(snapshot[store]).map((rows) => ({ store, rows })));
    channel.port1.postMessage({
      type: 'begin',
      schemaVersion: snapshot.schemaVersion,
      digest,
      stores: Object.fromEntries(Object.keys(snapshot).filter((key) => key !== 'schemaVersion').map((store) => [store, snapshot[store as LibraryStore].length])),
      batches: batchList.length,
    });
    const begun = await waitForPortMessage(channel.port1, popup);
    if (begun.type !== 'ready-for-data') throw new Error('Lidora could not prepare the transfer. Your library is still safe.');

    onProgress({ phase: 'sending', sent: 0, total: batchList.length });
    for (const [index, batch] of batchList.entries()) {
      channel.port1.postMessage({ type: 'batch', index, store: batch.store, rows: batch.rows });
      const acknowledgement = await waitForPortMessage(channel.port1, popup);
      if (acknowledgement.type !== 'batch-received' || acknowledgement.index !== index) {
        throw new Error('Lidora could not receive a library section. Your library is still safe; try again.');
      }
      onProgress({ phase: 'sending', sent: index + 1, total: batchList.length });
    }

    onProgress({ phase: 'verifying', sent: batchList.length, total: batchList.length });
    channel.port1.postMessage({ type: 'finish' });
    const committed = await waitForPortMessage(channel.port1, popup);
    if (committed.type !== 'committed' || committed.digest !== digest) {
      throw new Error(typeof committed.message === 'string' ? committed.message : 'The library could not be verified. Your original library is still safe.');
    }
    if (await libraryDigest(await readLibrarySnapshot()) !== digest) {
      channel.port1.postMessage({ type: 'abort' });
      const aborted = await waitForPortMessage(channel.port1, popup);
      throw new Error(typeof aborted.message === 'string' ? aborted.message : 'Your library changed while it was moving. The original is safe; run Move to Lidora again.');
    }
    channel.port1.postMessage({ type: 'source-verified', digest });
    const result = await waitForPortMessage(channel.port1, popup);
    if (result.type !== 'complete' || result.digest !== digest) {
      throw new Error(typeof result.message === 'string' ? result.message : 'The library could not be verified. Your original library is still safe.');
    }
    await markSourceComplete();
    setMigrationState('complete');
    onProgress({ phase: 'complete', sent: batchList.length, total: batchList.length });
  } catch (error) {
    setMigrationState('idle');
    popup.close();
    throw error;
  } finally {
    if (readyTimer) clearTimeout(readyTimer);
    if (popupCheck) clearInterval(popupCheck);
    if (readyListener) window.removeEventListener('message', readyListener);
    channel.port1.close();
  }
}

async function markSourceComplete(): Promise<void> {
  const { setMeta } = await import('../db/meta');
  await setMeta('lidora-migration-complete', true);
}

export function migrationProgressLabel(progress: HandoffProgress): string {
  switch (progress.phase) {
    case 'snapshot': return 'Preparing your library…';
    case 'sending': return `Moving library section ${progress.sent} of ${progress.total}…`;
    case 'verifying': return 'Checking and saving your library…';
    case 'complete': return 'Your library is ready on Lidora.';
  }
}
