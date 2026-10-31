import { ChevronLeft, PanelLeft } from 'lucide-solid';
import { useApp } from '../state';
import { Show } from 'solid-js';
import { LoaderCircle } from 'lucide-solid';

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
        {open() ? <ChevronLeft size={18} /> : <PanelLeft size={18} />}
      </button>
      <a class="wordmark" href="/" title="Lidora">lidora</a>
      <span class="library-update-status">
        <Show when={ctx.state.view !== 'reading' && ctx.pendingUpdateLabel()}>
          {(label) => <button type="button" class="library-update-action" aria-label={`${label()}, apply the latest article list`} onClick={() => void ctx.showPendingUpdates()}>{label()}</button>}
        </Show>
        <Show when={ctx.libraryUpdating()}><span class="library-updating" aria-label="Updating"><LoaderCircle size={14} aria-hidden="true" /><Show when={!ctx.pendingUpdateLabel() && ctx.state.view !== 'reading'}>Updating…</Show></span></Show>
      </span>
    </div>
  );
}
