import { type RefObject, useLayoutEffect, useRef } from 'react';
import { restoreScrollAnchor, type ScrollAnchor } from '../lib/scroll';
import type { FileViewState } from '../lib/visit-history';

/** What a view is handed about its file's view state (TASK-44): how the file
 *  was last left in this window, and where to report how it is left this time. */
export interface ViewMemory {
  remembered: FileViewState | null;
  leave: (state: FileViewState) => void;
}

/** Report the view's state as it unmounts, which is when its file is replaced on
 *  screen.
 *
 *  **A layout-effect cleanup, because capture has to run against the still-laid
 *  out container**: `captureScrollAnchor` reads rects, and React runs a
 *  component's layout cleanups before it detaches the host nodes beneath it. The
 *  container is taken at mount for the same reason — it is the view's root, and
 *  never replaced while the view lives.
 *
 *  **`leave` is the one the view was mounted with, not the latest.** A folder
 *  change unmounts the view and hands the window a new `leave` in the same
 *  breath; the view belongs to the folder it was shown under, and reporting
 *  through the new one would write its state into the new folder's memory. */
export function useLeaveReport(
  memory: ViewMemory,
  scrollRef: RefObject<HTMLElement | null>,
  capture: (scroller: HTMLElement | null) => FileViewState,
): void {
  const leave = useRef(memory.leave).current;
  const captureRef = useRef(capture);
  captureRef.current = capture;
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    return () => leave(captureRef.current(scroller));
  }, [leave, scrollRef]);
}

/** How long after mount a remembered position keeps being re-applied. Long
 *  enough for Shiki's highlighting and a mermaid render to land, which is what
 *  makes the content grow after the view mounts; the reader moving ends it
 *  sooner. */
const RESTORE_WINDOW_MS = 1_500;

/** What a reader does to move the document themselves. A scroll event cannot
 *  serve, since the restore's own writes raise those too. */
const READER_MOVES = ['wheel', 'pointerdown', 'touchstart'] as const;

/** Put the scroller back at `anchor` once, at mount, and again whenever the
 *  content grows during {@link RESTORE_WINDOW_MS}.
 *
 *  **Re-applied on growth rather than once more on the next frame**, which is
 *  what the live-reload path does: a source view is empty until Shiki resolves
 *  and a diagram is source until mermaid has drawn it, and neither is bound to
 *  land within a frame. Restoring is idempotent at the right position, so a
 *  growth that moves nothing costs nothing. */
export function useRememberedScroll(scrollRef: RefObject<HTMLElement | null>, anchor: ScrollAnchor): void {
  const atMount = useRef(anchor).current;
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const content = scroller?.firstElementChild;
    if (!scroller || !content || !atMount) {
      return;
    }
    restoreScrollAnchor(scroller, atMount);
    const observer = new ResizeObserver(() => restoreScrollAnchor(scroller, atMount));
    observer.observe(content);
    const stop = () => {
      observer.disconnect();
      window.clearTimeout(timer);
      for (const type of READER_MOVES) {
        scroller.removeEventListener(type, stop);
      }
      window.removeEventListener('keydown', stop);
    };
    const timer = window.setTimeout(stop, RESTORE_WINDOW_MS);
    for (const type of READER_MOVES) {
      scroller.addEventListener(type, stop, { passive: true });
    }
    window.addEventListener('keydown', stop);
    return stop;
  }, [scrollRef, atMount]);
}
