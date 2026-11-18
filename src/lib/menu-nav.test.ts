import { describe, expect, it } from 'vitest';
import { menuKeyTarget, openFocusIndex } from './menu-nav';

describe('menuKeyTarget', () => {
  it('moves down and up one item at a time', () => {
    expect(menuKeyTarget('ArrowDown', 0, 3)).toBe(1);
    expect(menuKeyTarget('ArrowUp', 2, 3)).toBe(1);
  });

  it('wraps at both ends', () => {
    expect(menuKeyTarget('ArrowDown', 2, 3)).toBe(0);
    expect(menuKeyTarget('ArrowUp', 0, 3)).toBe(2);
  });

  it('enters from either end when no item holds the focus', () => {
    expect(menuKeyTarget('ArrowDown', -1, 3)).toBe(0);
    expect(menuKeyTarget('ArrowUp', -1, 3)).toBe(2);
  });

  it('jumps to the first and last item', () => {
    expect(menuKeyTarget('Home', 1, 3)).toBe(0);
    expect(menuKeyTarget('End', 1, 3)).toBe(2);
  });

  it('moves nothing for other keys or an empty menu', () => {
    expect(menuKeyTarget('Enter', 1, 3)).toBeNull();
    expect(menuKeyTarget('ArrowDown', -1, 0)).toBeNull();
  });
});

describe('openFocusIndex', () => {
  it('opens on the first or the last item', () => {
    expect(openFocusIndex('first', [false, true, false])).toBe(0);
    expect(openFocusIndex('last', [false, true, false])).toBe(2);
  });

  it('opens a value menu on the checked item', () => {
    expect(openFocusIndex('current', [false, false, true])).toBe(2);
    expect(openFocusIndex('current', [false, true, true])).toBe(1);
  });

  it('opens a value menu on the first item when none is checked', () => {
    expect(openFocusIndex('current', [false, false])).toBe(0);
  });

  it('leaves the focus to the popup when there are no items', () => {
    expect(openFocusIndex('first', [])).toBeNull();
    expect(openFocusIndex('last', [])).toBeNull();
    expect(openFocusIndex('current', [])).toBeNull();
  });
});
