export type MigrationState = 'idle' | 'transferring' | 'complete';

const STATE_KEY = 'lidora-library-migration-state';
const STATE_EVENT = 'lidora-library-migration-state';

export function readMigrationState(): MigrationState {
  try {
    const value = localStorage.getItem(STATE_KEY);
    return value === 'transferring' || value === 'complete' ? value : 'idle';
  } catch {
    return 'idle';
  }
}

export function setMigrationState(state: MigrationState): void {
  try {
    if (state === 'idle') localStorage.removeItem(STATE_KEY);
    else localStorage.setItem(STATE_KEY, state);
  } catch {
  }
  window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: state }));
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(STATE_EVENT);
    channel.postMessage(state);
    channel.close();
  }
}

export function subscribeMigrationState(listener: (state: MigrationState) => void): () => void {
  const onCustom = (event: Event) => listener((event as CustomEvent<MigrationState>).detail);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STATE_KEY) listener(event.newValue === 'transferring' || event.newValue === 'complete' ? event.newValue : 'idle');
  };
  const onMessage = (event: MessageEvent<MigrationState>) => {
    if (event.data === 'transferring' || event.data === 'complete' || event.data === 'idle') listener(event.data);
  };
  window.addEventListener(STATE_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(STATE_EVENT) : null;
  channel?.addEventListener('message', onMessage);
  return () => {
    window.removeEventListener(STATE_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
    channel?.removeEventListener('message', onMessage);
    channel?.close();
  };
}
