import { Show } from 'solid-js';
import { LoaderCircle } from 'lucide-solid';
import { useApp } from '../state';

export function LibraryActivity() {
  const ctx = useApp();
  return (
    <Show when={ctx.libraryUpdating()}>
      <span class="library-updating" role="img" aria-label="Updating articles" title="Updating articles">
        <LoaderCircle size={14} aria-hidden="true" />
      </span>
    </Show>
  );
}
