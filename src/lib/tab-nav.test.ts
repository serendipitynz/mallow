import { describe, expect, it } from 'vitest';
import { tabKeyTarget } from './tab-nav';

describe('tabKeyTarget', () => {
  it('moves right and left one tab at a time', () => {
    expect(tabKeyTarget('ArrowRight', 0, 3)).toBe(1);
    expect(tabKeyTarget('ArrowLeft', 2, 3)).toBe(1);
  });

  it('stops at both ends instead of wrapping', () => {
    expect(tabKeyTarget('ArrowRight', 2, 3)).toBe(2);
    expect(tabKeyTarget('ArrowLeft', 0, 3)).toBe(0);
  });

  it('jumps to the first and last tab', () => {
    expect(tabKeyTarget('Home', 2, 3)).toBe(0);
    expect(tabKeyTarget('End', 0, 3)).toBe(2);
  });

  it('leaves the vertical arrows to the page', () => {
    expect(tabKeyTarget('ArrowDown', 0, 3)).toBeNull();
    expect(tabKeyTarget('ArrowUp', 1, 3)).toBeNull();
  });

  it('moves nothing for other keys or an empty group', () => {
    expect(tabKeyTarget('Enter', 1, 3)).toBeNull();
    expect(tabKeyTarget('ArrowRight', 0, 0)).toBeNull();
  });
});
