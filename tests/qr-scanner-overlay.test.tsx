import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'solid-js/web';
import { QrScannerOverlay } from '../src/components/QrScannerOverlay';

vi.mock('../src/state', () => ({ useApp: () => ({}) }));

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.unstubAllGlobals();
});

describe('QrScannerOverlay', () => {
  it('announces a camera failure as an alert', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn(async () => { throw new DOMException('denied', 'NotAllowedError'); }) },
      configurable: true,
    });
    document.body.innerHTML = '';
    dispose = render(() => <QrScannerOverlay onClose={() => {}} />, document.body);
    await vi.waitFor(() =>
      expect(document.querySelector('.scanner-overlay [role="alert"]')?.textContent).toBe(
        'Camera permission denied. Grant access in your browser settings or enter the code manually.',
      ),
    );
    expect(document.querySelector('.scanner-overlay [role="status"]')).not.toBeNull();
  });
});
