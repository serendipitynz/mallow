import { type RefObject, useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Where the focus goes when the outline disappears while holding it: to the
 * toggle outside it, or — when the toggle went with it, because the document no
 * longer has headings enough for an outline — to the chosen view option
 * (snz-design doc-9 §6.3.1). Left alone it falls to the top of the document.
 *
 * Returns the callback to hand `Outline` as `onFocusDropped`. The move waits for
 * this view's layout effect rather than happening in the outline's own cleanup,
 * because in the same commit the toggle may be on its way out too, and only after
 * the commit is it known which of the two is still there.
 */
export function useOutlineFocusReturn(barRef: RefObject<HTMLElement | null>): () => void {
  const dropped = useRef(false);

  useLayoutEffect(() => {
    if (!dropped.current) {
      return;
    }
    dropped.current = false;
    const bar = barRef.current;
    const target =
      bar?.querySelector<HTMLElement>('.doc-outline-toggle') ??
      bar?.querySelector<HTMLElement>('.segmented [aria-pressed="true"]');
    target?.focus();
  });

  return useCallback(() => {
    dropped.current = true;
  }, []);
}
