import { describe, expect, it } from 'vitest';
import { segmentedKeyTarget } from './segmented-nav';

describe('segmentedKeyTarget', () => {
  it('moves right and left one option at a time', () => {
    expect(segmentedKeyTarget('ArrowRight', 0, 3)).toBe(1);
    expect(segmentedKeyTarget('ArrowLeft', 2, 3)).toBe(1);
  });

  it('stops at both ends instead of wrapping', () => {
    expect(segmentedKeyTarget('ArrowRight', 2, 3)).toBe(2);
    expect(segmentedKeyTarget('ArrowLeft', 0, 3)).toBe(0);
  });

  it('jumps to the first and last option', () => {
    expect(segmentedKeyTarget('Home', 2, 3)).toBe(0);
    expect(segmentedKeyTarget('End', 0, 3)).toBe(2);
  });

  it('leaves the vertical arrows to the page', () => {
    expect(segmentedKeyTarget('ArrowDown', 0, 3)).toBeNull();
    expect(segmentedKeyTarget('ArrowUp', 1, 3)).toBeNull();
  });

  it('moves nothing for other keys or an empty group', () => {
    expect(segmentedKeyTarget('Enter', 1, 3)).toBeNull();
    expect(segmentedKeyTarget('ArrowRight', 0, 0)).toBeNull();
  });
});
