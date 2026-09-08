/** Whether the active view is markdown in preview — the one fact two entries are
 *  gated on.
 *
 *  `Print…` (decision-13) and `Export as PDF…` (decision-14) carry the same
 *  sentence and **have to enable and disable together**, so they read one flag
 *  rather than each keeping its own. Their reasons differ and are written where
 *  each entry is: printing is gated because the body worth printing is the
 *  rendered markdown, PDF export because the print stylesheet is markdown-only.
 *
 *  Module state rather than React state on purpose: the readers are `keydown`
 *  handlers outside the tree, and threading a boolean through `Viewer` to reach
 *  them would put the condition in three files instead of one.
 *
 *  It cannot be derived from `file.kind`: `markdown` is true of the source half of
 *  the toggle, which neither entry may act on. Being mounted with `mode` at
 *  `preview` *is* the condition, which is why `MarkdownView` publishes it. */
let markdownPreviewActive = false;

/** Called by the markdown preview as it mounts and unmounts. */
export function setMarkdownPreviewActive(active: boolean): void {
  markdownPreviewActive = active;
}

export function isMarkdownPreviewActive(): boolean {
  return markdownPreviewActive;
}
