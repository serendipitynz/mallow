export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Kept clear of the window's edge, so the body never touches it. */
export const CONTEXT_MENU_MARGIN = 8;

/** Where a context menu's top-left corner goes for an opening point, in viewport
 *  coordinates. It opens to the right of and below the point; on an axis where
 *  that would leave the window it opens to the other side, and where neither
 *  side fits it is held inside the margin (snz-design doc-9 §6.11). */
export function contextMenuPlacement(at: Point, menu: Size, viewport: Size): Point {
  return {
    x: placeOnAxis(at.x, menu.width, viewport.width),
    y: placeOnAxis(at.y, menu.height, viewport.height),
  };
}

function placeOnAxis(at: number, length: number, room: number): number {
  const far = room - CONTEXT_MENU_MARGIN;
  if (at + length <= far) {
    return Math.max(CONTEXT_MENU_MARGIN, at);
  }
  if (at - length >= CONTEXT_MENU_MARGIN) {
    return at - length;
  }
  return Math.max(CONTEXT_MENU_MARGIN, far - length);
}

/** Whether a key press asks for the focused element's context menu: the
 *  ContextMenu key, or Shift+F10, with no Alt, Ctrl or Meta held — a row passes
 *  every other modified key through, and these are no different. */
export function isContextMenuKey(e: {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}): boolean {
  if (e.altKey || e.ctrlKey || e.metaKey) {
    return false;
  }
  return e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey);
}
