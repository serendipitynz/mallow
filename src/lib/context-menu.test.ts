import { describe, expect, it } from 'vitest';
import { CONTEXT_MENU_MARGIN, contextMenuPlacement, isContextMenuKey } from './context-menu';

const viewport = { width: 800, height: 600 };
const menu = { width: 200, height: 150 };

describe('contextMenuPlacement', () => {
  it('opens to the right of and below the point when it fits', () => {
    expect(contextMenuPlacement({ x: 100, y: 100 }, menu, viewport)).toEqual({ x: 100, y: 100 });
  });

  it('opens to the left when the right side would leave the window', () => {
    expect(contextMenuPlacement({ x: 700, y: 100 }, menu, viewport)).toEqual({ x: 500, y: 100 });
  });

  it('opens above when the lower side would leave the window', () => {
    expect(contextMenuPlacement({ x: 100, y: 550 }, menu, viewport)).toEqual({ x: 100, y: 400 });
  });

  it('holds the menu against the far margin when neither side fits', () => {
    const tall = { width: 200, height: 580 };
    expect(contextMenuPlacement({ x: 100, y: 300 }, tall, viewport)).toEqual({ x: 100, y: 12 });
  });

  it('keeps a point inside the margin off the edge', () => {
    expect(contextMenuPlacement({ x: 2, y: 3 }, menu, viewport)).toEqual({
      x: CONTEXT_MENU_MARGIN,
      y: CONTEXT_MENU_MARGIN,
    });
  });

  it('counts the margin on the far side too', () => {
    // 595 + 200 fits the 800 window but not its 792 margin, so it flips.
    expect(contextMenuPlacement({ x: 595, y: 100 }, menu, viewport).x).toBe(395);
  });
});

describe('isContextMenuKey', () => {
  const none = { shiftKey: false, altKey: false, ctrlKey: false, metaKey: false };

  it('takes the ContextMenu key without Alt, Ctrl or Meta', () => {
    expect(isContextMenuKey({ ...none, key: 'ContextMenu' })).toBe(true);
    expect(isContextMenuKey({ ...none, key: 'ContextMenu', shiftKey: true })).toBe(true);
    expect(isContextMenuKey({ ...none, key: 'ContextMenu', ctrlKey: true })).toBe(false);
    expect(isContextMenuKey({ ...none, key: 'ContextMenu', metaKey: true })).toBe(false);
  });

  it('takes Shift+F10 alone', () => {
    expect(isContextMenuKey({ ...none, key: 'F10', shiftKey: true })).toBe(true);
    expect(isContextMenuKey({ ...none, key: 'F10' })).toBe(false);
    expect(isContextMenuKey({ ...none, key: 'F10', shiftKey: true, ctrlKey: true })).toBe(false);
    expect(isContextMenuKey({ ...none, key: 'F10', shiftKey: true, metaKey: true })).toBe(false);
    expect(isContextMenuKey({ ...none, key: 'F10', shiftKey: true, altKey: true })).toBe(false);
  });

  it('ignores other keys', () => {
    expect(isContextMenuKey({ ...none, key: 'Enter', shiftKey: true })).toBe(false);
  });
});
