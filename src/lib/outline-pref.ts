/** Whether the document outline is open. One preference across the views that
 *  have one — a reader who closed it in a markdown document does not expect it
 *  back on the next HTML one — and, since TASK-12.8, across windows too, which
 *  is why the two views subscribe here rather than each holding their own copy. */

const OUTLINE_KEY = 'doc-outline:open';

const listeners = new Set<() => void>();

/** Cached because `useSyncExternalStore` compares snapshots by identity and
 *  calls the getter on every render: reading localStorage each time would be a
 *  synchronous storage hit per render, and a throwing accessor (private mode,
 *  blocked site data) would then be hit per render too. */
let current: boolean | null = null;

export function readOutlineOpen(): boolean {
  if (current === null) {
    try {
      current = localStorage.getItem(OUTLINE_KEY) !== '0';
    } catch {
      current = true;
    }
  }
  return current;
}

/** Subscribe to the outline preference. Shaped for `useSyncExternalStore`,
 *  whose snapshot is `readOutlineOpen`. */
export function onOutlineOpenChange(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Apply the preference to this window without persisting it — what a window
 *  does when another window is the one that toggled it (`lib/settings-sync`).
 *  Every window shares one WebView data store, so the value is already
 *  written. */
export function applyOutlineOpen(open: boolean): void {
  current = open;
  listeners.forEach((cb) => {
    cb();
  });
}

/** Persist the preference and apply it. Telling the other windows is the
 *  caller's, so that this module keeps no dependency on the Tauri layer. */
export function writeOutlineOpen(open: boolean): void {
  try {
    localStorage.setItem(OUTLINE_KEY, open ? '1' : '0');
  } catch {
    // Non-fatal: the toggle still works for this view.
  }
  applyOutlineOpen(open);
}
