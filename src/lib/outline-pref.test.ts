import { describe, expect, it, vi } from 'vitest';
import { applyOutlineOpen, onOutlineOpenChange, readOutlineOpen } from './outline-pref';

// No localStorage under Node, so every access throws and the module falls back
// to open — which is the same path a reader in private mode takes.
describe('outline preference', () => {
  it('reads open when storage cannot be reached at all', () => {
    expect(readOutlineOpen()).toBe(true);
  });

  it('reports a change another window made, and reads back what was applied', () => {
    const seen = vi.fn();
    const stop = onOutlineOpenChange(seen);

    applyOutlineOpen(false);
    expect(seen).toHaveBeenCalledTimes(1);
    // The cached value is what makes this hold: a re-read of unreachable storage
    // would answer `true` again and the outline would spring back open.
    expect(readOutlineOpen()).toBe(false);

    stop();
    applyOutlineOpen(true);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(readOutlineOpen()).toBe(true);
  });
});
