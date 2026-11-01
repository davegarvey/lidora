import { ChevronLeft, PanelLeft } from 'lucide-solid';
import { useApp } from '../state';
import { Show } from 'solid-js';
import { LibraryActivity } from './LibraryActivity';

export function TopBar() {
  const ctx = useApp();
  const open = () => ctx.state.sidebarOpen;

  return (
    <div class="topbar" aria-label="App chrome">
      <button
        class="pill sidebar-toggle"
        title={open() ? 'Close feeds' : 'Feeds'}
        aria-label={open() ? 'Close feeds sidebar' : 'Open feeds sidebar'}
        aria-expanded={open()}
        onClick={() => ctx.toggleSidebar()}
      >
        {open() ? <ChevronLeft size={16} /> : <PanelLeft size={16} />}
      </button>
      <a class="wordmark" href="/" title="Lidora">lidora</a>
      <span class="library-update-status">
        <Show when={ctx.state.view !== 'reading' && ctx.pendingUpdateLabel()}>
          {(label) => <button type="button" class="library-update-action" aria-label={`${label()}, apply the latest article list`} onClick={() => void ctx.showPendingUpdates()}>{label()}</button>}
        </Show>
        <LibraryActivity />
      </span>
    </div>
  );
}
