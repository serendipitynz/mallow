/**
 * Bounds on what the source view hands to Shiki (decision-6). Kept as pure logic
 * + tunables, separate from the React component, so they can be unit-tested in a
 * Node environment — the same split as `lib/config-tree` / `ConfigTree`.
 *
 * Both caps are needed because neither implies the other: a minified bundle is
 * one heavy line, a log is many cheap ones, and Shiki charges for both (regex
 * work per byte, one `<span class="line">` per line).
 */

/** UTF-8 bytes above which highlighting is skipped. Same unit as `read_file`'s 10 MiB cap. */
export const HIGHLIGHT_MAX_BYTES = 256 * 1024;
/** Lines above which highlighting is skipped. */
export const HIGHLIGHT_MAX_LINES = 10_000;

/** Which cap was exceeded. Not worded per reason in the UI; see decision-6. */
export type HighlightSkipReason = 'bytes' | 'lines';

/** The text the source view shows: without its trailing line breaks, so there is
 *  no spurious empty last line number. The CR is in the class because a CRLF
 *  file would otherwise end on a lone CR, which `countLines` does not count but
 *  an engine that breaks on it would show. */
export function shownSource(source: string): string {
  // A scan from the end rather than `/[\r\n]+$/`, which restarts at every break
  // inside a long run of them: 80,000 blank lines mid-document took 3.9 s.
  let end = source.length;
  while (end > 0) {
    const code = source.charCodeAt(end - 1);
    if (code !== 0x0a && code !== 0x0d) {
      break;
    }
    end -= 1;
  }
  return source.slice(0, end);
}

/** The source view's last line number for this text — the status bar's line
 *  count is this, so the two cannot disagree (TASK-69). */
export function shownLineCount(source: string): number {
  return countLines(shownSource(source));
}

/** Lines the text occupies when rendered verbatim: no trailing newline means no trailing line. */
export function countLines(source: string): number {
  let count = 1;
  for (let i = source.indexOf('\n'); i !== -1; i = source.indexOf('\n', i + 1)) {
    count += 1;
  }
  return count;
}

function overByteCap(source: string): boolean {
  // UTF-8 is never shorter than the string's code-unit count, so anything longer
  // than the cap is over it without encoding — which keeps the transient copy
  // below to a bounded size instead of a second copy of a 10 MiB document.
  if (source.length > HIGHLIGHT_MAX_BYTES) {
    return true;
  }
  return new TextEncoder().encode(source).length > HIGHLIGHT_MAX_BYTES;
}

/** `null` when the text is within both caps and may be highlighted. */
export function highlightSkipReason(source: string): HighlightSkipReason | null {
  if (overByteCap(source)) {
    return 'bytes';
  }
  if (countLines(source) > HIGHLIGHT_MAX_LINES) {
    return 'lines';
  }
  return null;
}
