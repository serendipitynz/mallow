/** Which of `count` menu items a key moves the focus to from `index`, or `null`
 *  when the key does not move it. `index` is -1 when no item holds the focus.
 *
 *  The arrows wrap at the ends because a menu is short and gone once closed; the
 *  lists that stay on screen stop at their ends instead (snz-design doc-9 §6.11).
 *  Disabled items are not skipped: they take the focus so their reason can be
 *  read (snz-design doc-8 §5.4). */
export function menuKeyTarget(key: string, index: number, count: number): number | null {
  if (count === 0) {
    return null;
  }
  switch (key) {
    case 'ArrowDown':
      return index < 0 || index === count - 1 ? 0 : index + 1;
    case 'ArrowUp':
      return index <= 0 ? count - 1 : index - 1;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/** Where a menu's focus lands when it opens. */
export type OpenFocus = 'first' | 'last' | 'current';

/** Which of the items an opening menu focuses, given which are marked
 *  `aria-checked`, or `null` when there are none and the popup itself takes the
 *  focus. `current` is the reader's value in a value menu; with nothing checked
 *  it falls back to the first item. */
export function openFocusIndex(focus: OpenFocus, checked: readonly boolean[]): number | null {
  if (checked.length === 0) {
    return null;
  }
  if (focus === 'last') {
    return checked.length - 1;
  }
  if (focus === 'current') {
    return Math.max(checked.indexOf(true), 0);
  }
  return 0;
}
