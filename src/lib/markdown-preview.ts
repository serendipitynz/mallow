/** Whether the active view is markdown in preview — the one fact three entries
 *  are gated on.
 *
 *  `Print…` (decision-13) and `Export as PDF…` (decision-14) carry the same
 *  sentence and **have to enable and disable together**, so they read one flag
 *  rather than each keeping its own. Their reasons differ and are written where
 *  each entry is: printing is gated because the body worth printing is the
 *  rendered markdown, PDF export because the print stylesheet is markdown-only.
 *  The native menu items for the two are the third reader, and they are in
 *  another process — which is why this notifies as well as answers.
 *
 *  Module state rather than React state on purpose: the readers are `keydown`
 *  handlers outside the tree, and threading a boolean through `Viewer` to reach
 *  them would put the condition in three files instead of one.
 *
 *  It cannot be derived from `file.kind`: `markdown` is true of the source half of
 *  the toggle, which neither entry may act on. Being mounted with `mode` at
 *  `preview` *is* the condition, which is why `MarkdownView` publishes it. */
let markdownPreviewActive = false;

type Listener = (active: boolean) => void;

const listeners = new Set<Listener>();

/** Called by the markdown preview as it mounts and unmounts. */
export function setMarkdownPreviewActive(active: boolean): void {
  if (markdownPreviewActive === active) {
    return;
  }
  markdownPreviewActive = active;
  for (const listener of listeners) {
    listener(active);
  }
}

export function isMarkdownPreviewActive(): boolean {
  return markdownPreviewActive;
}

/** Subscribe to the flag, and answer the unsubscribe.
 *
 *  **The current value is not replayed here.** A subscriber that needs it reads
 *  `isMarkdownPreviewActive` itself, which is what `App` does: React runs a
 *  child's effects before its parent's, so the preview has already published by
 *  the time `App` subscribes, and a replay built into this would be a second way
 *  to get the same value rather than a fix for that ordering. */
export function onMarkdownPreviewChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
