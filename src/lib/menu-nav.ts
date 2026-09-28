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
