import { describe, expect, it, vi } from 'vitest';
import { applySourceWrap, onSourceWrapChange, parseSourceWrap, readSourceWrap } from './source-wrap';

describe('parseSourceWrap', () => {
  it('reads back each value it writes', () => {
    expect(parseSourceWrap('1')).toBe(true);
    expect(parseSourceWrap('0')).toBe(false);
  });

  it('wraps for nothing stored and for a value it does not know', () => {
    expect(parseSourceWrap(null)).toBe(true);
    expect(parseSourceWrap('')).toBe(true);
    expect(parseSourceWrap('off')).toBe(true);
  });
});

// No localStorage under Node, so every access throws and the module falls back
// to the default — the same path a reader in private mode takes.
describe('source wrap preference', () => {
  it('wraps when storage cannot be reached at all', () => {
    expect(readSourceWrap()).toBe(true);
  });

  it('reports a change another window made, and reads back what was applied', () => {
    const seen = vi.fn();
    const stop = onSourceWrapChange(seen);

    applySourceWrap(false);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(readSourceWrap()).toBe(false);

    stop();
    applySourceWrap(true);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(readSourceWrap()).toBe(true);
  });
});
