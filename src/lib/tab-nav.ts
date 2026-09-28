/** Which of `count` tabs a key moves the focus to from `index`, or `null` when
 *  the key does not move it.
 *
 *  The arrows stop at the ends rather than wrapping, and moving never selects:
 *  selecting follows Enter, Space or a press, so an arrow can cross a tab that
 *  would refuse to be chosen (snz-design doc-9 §6.7). */
export function tabKeyTarget(key: string, index: number, count: number): number | null {
  if (count === 0) {
    return null;
  }
  switch (key) {
    case 'ArrowRight':
      return Math.min(index + 1, count - 1);
    case 'ArrowLeft':
      return Math.max(index - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
