// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { markActive, onCatchup } from '../src/util/idle';

afterEach(() => vi.useRealTimers());

describe('idle catch-up', () => {
  it('notifies subscribers on every idle-to-active transition until they unsubscribe', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    markActive();
    let calls = 0;
    const stop = onCatchup(() => { calls++; });

    vi.advanceTimersByTime(6 * 60_000);
    markActive();
    markActive();
    expect(calls).toBe(1);

    vi.advanceTimersByTime(6 * 60_000);
    markActive();
    expect(calls).toBe(2);

    stop();
    vi.advanceTimersByTime(6 * 60_000);
    markActive();
    expect(calls).toBe(2);
  });
});
