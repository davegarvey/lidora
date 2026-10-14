import { Show, createSignal } from 'solid-js';
import { useApp } from '../state';
import { serializeOpml } from '../opml/serialize';
import { parseOpml } from '../opml/parse';
import { buildMergePreview, applyMerge, type MergePreview } from '../opml/merge';
import { Section, SettingGroup } from './Section';
import {
  ActionButton,
  ExpandingPanel,
  InlineMessage,
  SettingRow,
  createPanel,
  errorMessage,
} from './controls';
import { formatCount } from './format';

const UNREADABLE = 'That file could not be read as OPML. Choose an OPML export from another reader and try again.';
const EMPTY = 'That file does not contain any feeds. Choose an OPML export that lists your subscriptions.';

function plural(count: number, one: string, many: string): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}

export function SubscriptionsSection() {
  const ctx = useApp();
  const panel = createPanel();
  const [preview, setPreview] = createSignal<MergePreview | null>(null);
  const [importError, setImportError] = createSignal<string | null>(null);
  const [panelError, setPanelError] = createSignal<string | null>(null);
  const [exportError, setExportError] = createSignal<string | null>(null);
  const [done, setDone] = createSignal<string | null>(null);
  let fileInput: HTMLInputElement | undefined;

  const exportFeeds = () => {
    setExportError(null);
    const blob = new Blob([serializeOpml(ctx.feeds())], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sift-subscriptions.opml';
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFileChosen = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setDone(null);
    setImportError(null);
    setPanelError(null);
    try {
      const parsed = parseOpml(await file.text());
      if (parsed.length === 0) {
        panel.close();
        setImportError(EMPTY);
        return;
      }
      setPreview(await buildMergePreview(parsed));
      panel.open();
    } catch {
      panel.close();
      setImportError(UNREADABLE);
    }
  };

  const runImport = async () => {
    const current = preview();
    if (!current) return;
    setPanelError(null);
    const ids = await applyMerge(current);
    await ctx.reloadFeeds();
    if (ids.length > 0) await ctx.refreshFeeds(ids);
    setDone(`Imported ${plural(ids.length, 'feed', 'feeds')}.`);
    panel.close(true);
  };

  const feedCount = () => ctx.feeds().length;

  return (
    <Section title="Subscriptions">
      <p class="settings-summary">{plural(feedCount(), 'feed', 'feeds')}</p>
      <SettingGroup>
        <SettingRow label="Export subscriptions" description="Download your feeds as an OPML file to use in another reader.">
          <ActionButton
            label="Export"
            busyLabel="Exporting…"
            disabled={feedCount() === 0}
            onAction={exportFeeds}
            onError={(e) => setExportError(errorMessage(e, 'Could not create the file. Try again.'))}
          />
        </SettingRow>
        <Show when={exportError()}>
          <InlineMessage kind="error">{exportError()}</InlineMessage>
        </Show>
        <SettingRow label="Import from OPML" description="Add feeds from an OPML file. Feeds you already follow are skipped.">
          <button
            type="button"
            class="btn"
            ref={panel.triggerRef}
            aria-expanded={panel.expanded()}
            aria-controls={panel.id}
            onClick={() => fileInput?.click()}
          >
            Choose file…
          </button>
          <input
            ref={fileInput}
            class="visually-hidden"
            type="file"
            tabIndex={-1}
            aria-hidden="true"
            accept=".opml,.xml,text/xml,application/xml"
            onChange={(e) => void onFileChosen(e)}
          />
        </SettingRow>
        <Show when={importError()}>
          <InlineMessage kind="error">{importError()}</InlineMessage>
        </Show>
        <Show when={done()}>
          <InlineMessage kind="success">{done()}</InlineMessage>
        </Show>
        <ExpandingPanel panel={panel}>
          <Show when={preview()}>
            {(p) => (
              <>
                <p class="panel__text">
                  {p().newSubscriptions.length > 0
                    ? `${plural(p().newSubscriptions.length, 'feed', 'feeds')} will be added. ${formatCount(p().skipped)} already subscribed.`
                    : `All ${plural(p().total, 'feed', 'feeds')} in this file are already subscribed.`}
                </p>
                <Show when={panelError()}>
                  <InlineMessage kind="error">{panelError()}</InlineMessage>
                </Show>
                <div class="panel__actions">
                  <ActionButton
                    variant="primary"
                    label="Import"
                    busyLabel="Importing…"
                    disabled={p().newSubscriptions.length === 0}
                    onAction={runImport}
                    onError={(e) => setPanelError(errorMessage(e, 'Could not import the feeds. Try again.'))}
                  />
                  <button type="button" class="btn subtle" onClick={() => panel.close(true)}>Cancel</button>
                </div>
              </>
            )}
          </Show>
        </ExpandingPanel>
      </SettingGroup>
    </Section>
  );
}
