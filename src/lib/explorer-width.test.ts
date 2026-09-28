import { describe, expect, it } from 'vitest';
import {
  clampExplorerWidth,
  MAX_EXPLORER_WIDTH,
  MIN_EXPLORER_WIDTH,
  widthAtPointer,
  widthForKey,
} from './explorer-width';

describe('clampExplorerWidth', () => {
  it('keeps a width between the minimum and the maximum', () => {
    expect(clampExplorerWidth(100)).toBe(MIN_EXPLORER_WIDTH);
    expect(clampExplorerWidth(300)).toBe(300);
    expect(clampExplorerWidth(9000)).toBe(MAX_EXPLORER_WIDTH);
  });
});

describe('widthForKey', () => {
  it('moves the handle the way the arrow points, whichever side the explorer is on', () => {
    expect(widthForKey('ArrowRight', false, 'left', 300)).toBe(316);
    expect(widthForKey('ArrowLeft', false, 'left', 300)).toBe(284);
    expect(widthForKey('ArrowLeft', false, 'right', 300)).toBe(316);
    expect(widthForKey('ArrowRight', false, 'right', 300)).toBe(284);
  });

  it('takes a larger step with Shift', () => {
    expect(widthForKey('ArrowRight', true, 'left', 300)).toBe(364);
  });

  it('stops at the minimum and maximum', () => {
    expect(widthForKey('ArrowLeft', true, 'left', MIN_EXPLORER_WIDTH + 10)).toBe(MIN_EXPLORER_WIDTH);
    expect(widthForKey('Home', false, 'left', 300)).toBe(MIN_EXPLORER_WIDTH);
    expect(widthForKey('End', false, 'right', 300)).toBe(MAX_EXPLORER_WIDTH);
  });

  it('leaves other keys alone', () => {
    expect(widthForKey('ArrowUp', false, 'left', 300)).toBeNull();
    expect(widthForKey('Enter', false, 'left', 300)).toBeNull();
  });
});

describe('widthAtPointer', () => {
  it('measures from the edge the explorer sits against', () => {
    expect(widthAtPointer('left', 350, 0, 1200)).toBe(350);
    expect(widthAtPointer('right', 850, 0, 1200)).toBe(350);
  });

  it('clamps a pointer past either limit', () => {
    expect(widthAtPointer('left', 20, 0, 1200)).toBe(MIN_EXPLORER_WIDTH);
    expect(widthAtPointer('right', 10, 0, 1200)).toBe(MAX_EXPLORER_WIDTH);
  });
});
