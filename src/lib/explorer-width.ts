export type ExplorerSide = 'left' | 'right';

export const DEFAULT_EXPLORER_WIDTH = 280;
export const MIN_EXPLORER_WIDTH = 180;
export const MAX_EXPLORER_WIDTH = 600;

const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;

export function clampExplorerWidth(width: number): number {
  return Math.min(MAX_EXPLORER_WIDTH, Math.max(MIN_EXPLORER_WIDTH, width));
}

/** The width a key on the focused handle asks for, or `null` when the key is not
 *  the handle's. The arrows move the handle rather than name a growth direction,
 *  so which of them widens depends on the side the explorer is on — the handle
 *  goes where the arrow points either way. */
export function widthForKey(key: string, shift: boolean, side: ExplorerSide, width: number): number | null {
  const step = shift ? KEY_STEP_LARGE : KEY_STEP;
  const widening = side === 'left' ? 'ArrowRight' : 'ArrowLeft';
  const narrowing = side === 'left' ? 'ArrowLeft' : 'ArrowRight';
  switch (key) {
    case widening:
      return clampExplorerWidth(width + step);
    case narrowing:
      return clampExplorerWidth(width - step);
    case 'Home':
      return MIN_EXPLORER_WIDTH;
    case 'End':
      return MAX_EXPLORER_WIDTH;
    default:
      return null;
  }
}

/** The width that puts the handle under the pointer, measured from the edge of
 *  the body the explorer sits against. This is the single-pointer path — press
 *  the handle, then press where it should go — which cannot work from a drag's
 *  delta, since nothing is held between the two presses. */
export function widthAtPointer(side: ExplorerSide, clientX: number, bodyLeft: number, bodyRight: number): number {
  return clampExplorerWidth(side === 'left' ? clientX - bodyLeft : bodyRight - clientX);
}
