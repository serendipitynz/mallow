/** Whether the highlighted source view wraps a line longer than the view
 *  (TASK-65). One preference for every source view, and across windows, which
 *  is why `SourceView` subscribes here rather than holding its own copy.
 *
 *  localStorage rather than settings.json for `lib/prose-measure`'s reason: the
 *  view is laid out at mount, and the store's asynchronous read would lay it out
 *  unwrapped and then again. */

const SOURCE_WRAP_KEY = 'sourceWrap';

const listeners = new Set<() => void>();

/** Cached for the reason `lib/outline-pref` caches: `useSyncExternalStore`
 *  calls the getter on every render. */
let current: boolean | null = null;

/** Anything but an explicit off reads as on, so a reader who never chose wraps. */
export function parseSourceWrap(raw: string | null): boolean {
  return raw !== '0';
}

export function readSourceWrap(): boolean {
  if (current === null) {
    try {
      current = parseSourceWrap(localStorage.getItem(SOURCE_WRAP_KEY));
    } catch {
      current = true;
    }
  }
  return current;
}

/** Shaped for `useSyncExternalStore`, whose snapshot is `readSourceWrap`. */
export function onSourceWrapChange(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/** Apply the preference to this window without persisting it — what a window
 *  does when another window is the one that chose it (`lib/settings-sync`). */
export function applySourceWrap(wrap: boolean): void {
  current = wrap;
  listeners.forEach((cb) => {
    cb();
  });
}

/** Persist the preference and apply it. Telling the other windows is the
 *  caller's, so that this module keeps no dependency on the Tauri layer. */
export function writeSourceWrap(wrap: boolean): void {
  try {
    localStorage.setItem(SOURCE_WRAP_KEY, wrap ? '1' : '0');
  } catch {
    // Non-fatal: this window still lays the source out as chosen.
  }
  applySourceWrap(wrap);
}
