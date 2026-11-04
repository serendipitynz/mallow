/** What find searches in this window: the element whose text is the document the
 *  active view rendered, and the scroller a match is brought into view in.
 *
 *  **One per window, set by the view that has find and by nothing else.** The
 *  markdown preview registers its article and `SourceView` registers itself, so
 *  every view rendering through `SourceView` has find with no code of its own,
 *  and a view that registers nothing — the trees, the table, the rendered HTML
 *  frame, media — has none. That absence is what the chord and the three menu
 *  entries are gated on, which is why this notifies as well as answers: the menu
 *  is in another process.
 *
 *  Module state rather than React state for `lib/markdown-preview`'s reason: the
 *  readers are `keydown` handlers outside the tree and a Rust menu. */
export interface FindTarget {
  root: HTMLElement;
  scroller: HTMLElement;
}

let current: FindTarget | null = null;

type Listener = (target: FindTarget | null) => void;

const listeners = new Set<Listener>();

function publish(next: FindTarget | null): void {
  if (current === next) {
    return;
  }
  current = next;
  for (const listener of listeners) {
    listener(next);
  }
}

/** Register `target` and answer the release. **The release clears only its own
 *  target**: a view that unmounts after the next one mounted would otherwise take
 *  the next one's away, which on a preview → source toggle is the order React's
 *  effects can run in. */
export function setFindTarget(target: FindTarget): () => void {
  publish(target);
  return () => {
    if (current === target) {
      publish(null);
    }
  };
}

export function getFindTarget(): FindTarget | null {
  return current;
}

export function isFindAvailable(): boolean {
  return current !== null;
}

/** Subscribe to the target, and answer the unsubscribe. The current value is not
 *  replayed, for the reason `onMarkdownPreviewChange` gives. */
export function onFindTargetChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
