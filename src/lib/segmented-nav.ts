/** Which of `count` options in a segmented control a key moves the focus to from
 *  `index`, or `null` when the key does not move it.
 *
 *  The arrows stop at the ends rather than wrapping, and moving never selects:
 *  a choice takes effect the moment it is made, so selecting on every arrow would
 *  apply each option passed on the way (snz-design doc-9 §6.12). */
export function segmentedKeyTarget(key: string, index: number, count: number): number | null {
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
