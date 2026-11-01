import { Show } from 'solid-js';
import { Star, CircleDot, ArrowDownWideNarrow, Lightbulb } from 'lucide-solid';
import { useApp } from '../state';

export function RiverHeader(props: { scrolled: boolean }) {
  const ctx = useApp();

  const title = () => {
    const scope = ctx.state.riverScope;
    if (scope !== null) return ctx.feedMap().get(scope)?.title ?? 'All';
    if (ctx.state.activeTags.length > 0) return ctx.state.activeTags.join(', ');
    return 'All';
  };
  const starredOnly = () => ctx.state.starredOnly;
  const unreadOnly = () => ctx.state.readMode === 'unread';
  const forYouActive = () => ctx.settings().articleOrder === 'for-you';
  const unreadActive = () => unreadOnly() && !starredOnly();
  const unreadLabel = () => starredOnly() ? 'Unread filter is off while showing starred' : 'Show unread only';
  const orderLabel = () => `Article order: ${forYouActive() ? 'For you' : 'Latest'}`;

  return (
    <Show when={ctx.feeds().length > 0}>
      <header class="river-header" data-scrolled={props.scrolled || undefined}>
        <div class="river-header-inner">
          <h2 class="river-header-title" title={title()}>{title()}</h2>
          <div class="river-header-toggles">
            <button
              type="button"
              class="river-header-toggle"
              classList={{ active: starredOnly() }}
              title="Show starred only"
              aria-label="Show starred only"
              aria-pressed={starredOnly()}
              onClick={() => ctx.toggleStarFilter()}
            >
              <Star size={16} fill={starredOnly() ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              class="river-header-toggle"
              classList={{ active: unreadActive() }}
              title={unreadLabel()}
              aria-label="Show unread only"
              aria-pressed={unreadOnly()}
              disabled={starredOnly()}
              onClick={() => void ctx.setReadMode(unreadOnly() ? 'all' : 'unread')}
            >
              <CircleDot size={16} />
            </button>
            <button
              type="button"
              class="river-header-toggle"
              classList={{ active: forYouActive() }}
              title={orderLabel()}
              aria-label={orderLabel()}
              aria-pressed={forYouActive()}
              onClick={() => void ctx.setArticleOrder(forYouActive() ? 'latest' : 'for-you')}
            >
              {forYouActive() ? <Lightbulb size={16} /> : <ArrowDownWideNarrow size={16} />}
            </button>
          </div>
        </div>
      </header>
    </Show>
  );
}
