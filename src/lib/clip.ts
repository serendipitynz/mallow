/**
 * Clip a value a view renders in a single cell or row, so what was dropped is
 * marked by the ellipsis alone.
 *
 * The cap counts UTF-16 code units, so cutting at it can land between the halves
 * of a surrogate pair and leave a lone surrogate the engine draws as U+FFFD —
 * right where the ellipsis is meant to be the only mark. Backing off one unit
 * drops the whole character instead.
 */
export function clipToChars(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  const last = value.charCodeAt(max - 1);
  const isHighSurrogate = last >= 0xd800 && last <= 0xdbff;
  return `${value.slice(0, isHighSurrogate ? max - 1 : max)}…`;
}
