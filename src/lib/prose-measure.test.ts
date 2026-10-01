import { describe, expect, it, vi } from 'vitest';
import { applyProseMeasure, onProseMeasureChange, parseProseMeasure, readProseMeasure } from './prose-measure';

describe('parseProseMeasure', () => {
  it('reads back each value it writes', () => {
    expect(parseProseMeasure('standard')).toBe('standard');
    expect(parseProseMeasure('wide')).toBe('wide');
    expect(parseProseMeasure('full')).toBe('full');
  });

  it('lands on the standard measure for nothing stored and for a value it does not know', () => {
    expect(parseProseMeasure(null)).toBe('standard');
    expect(parseProseMeasure('narrow')).toBe('standard');
    expect(parseProseMeasure('')).toBe('standard');
  });
});

// No localStorage under Node, so every access throws and the module falls back
// to the default — the same path a reader in private mode takes.
describe('prose measure preference', () => {
  it('reads the standard measure when storage cannot be reached at all', () => {
    expect(readProseMeasure()).toBe('standard');
  });

  it('reports a change another window made, and reads back what was applied', () => {
    const seen = vi.fn();
    const stop = onProseMeasureChange(seen);

    applyProseMeasure('wide');
    expect(seen).toHaveBeenCalledTimes(1);
    // The cache is what makes this hold: a re-read of unreachable storage would
    // answer the default and the article would spring back to it.
    expect(readProseMeasure()).toBe('wide');

    stop();
    applyProseMeasure('full');
    expect(seen).toHaveBeenCalledTimes(1);
    expect(readProseMeasure()).toBe('full');
  });
});
