import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { contextMenuPlacement, type Point } from '../lib/context-menu';
import { type OpenFocus, useMenuBody } from './useMenu';

/** A menu opened on an element rather than from a trigger button — the
 *  explorer's rows. It behaves as the toolbar menus do once open
 *  (snz-design doc-9 §6.11); what differs is where it appears, at the pointer or
 *  under the element, and that the element it was opened on is what Escape and
 *  a choice give the focus back to. */
export function useContextMenu<T>() {
  const [target, setTarget] = useState<{ item: T; at: Point } | null>(null);
  const originRef = useRef<HTMLElement | null>(null);
  const focusOnOpen = useRef<OpenFocus>('first');
  const open = target !== null;

  const close = useCallback((returnFocus: boolean) => {
    setTarget(null);
    if (returnFocus) {
      originRef.current?.focus();
    }
  }, []);

  const openAt = useCallback((item: T, origin: HTMLElement, at: Point) => {
    originRef.current = origin;
    setTarget({ item, at });
  }, []);

  const { popupProps } = useMenuBody({ open, close, focusOnOpen });
  const popupRef = popupProps.ref;

  // Placed before the first paint, once the body has a size to place.
  useLayoutEffect(() => {
    const popup = popupRef.current;
    if (!target || !popup) {
      return;
    }
    const { x, y } = contextMenuPlacement(
      target.at,
      { width: popup.offsetWidth, height: popup.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    );
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
  }, [target, popupRef]);

  // The body is fixed to the viewport while the row it was opened on is not, so
  // a scroll behind it, or a resize, would leave it pointing at another row; it
  // closes instead of following (snz-design doc-9 §5.3).
  useEffect(() => {
    if (!open) {
      return;
    }
    const onScroll = (e: Event) => {
      if (!popupRef.current?.contains(e.target as Node)) {
        close(false);
      }
    };
    const onResize = () => close(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, close, popupRef]);

  return { target: target?.item ?? null, openAt, close, popupProps };
}
