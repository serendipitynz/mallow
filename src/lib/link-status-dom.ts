import { clearLinkStatus, describeLink, type LinkDestination, setFocusedLink, setHoveredLink } from './link-status';

/** Reports the link under the pointer and the link holding the focus inside
 *  `root` to the status bar, until the returned function is called — which also
 *  clears it, since a view whose HTML is replaced or unmounted under the pointer
 *  sends no `pointerleave` for the links that went with it.
 *
 *  Listens and reads only: nothing is written into the view, which is what
 *  TASK-29's invariant and find's `MutationObserver` both rely on. */
export function watchLinks(
  root: HTMLElement,
  options: {
    fragmentsMove: boolean;
    /** The heading a fragment lands on, where the view resolves fragments by a
     *  rule of its own; by default an element with that id inside `root`. */
    headingText?: (id: string) => string | null;
  },
): () => void {
  const headingText =
    options.headingText ??
    ((id: string): string | null => {
      const target = root.ownerDocument.getElementById(id);
      return target && root.contains(target) ? headingTextOf(target) : null;
    });

  const destinationAt = (target: EventTarget | null): LinkDestination | null => {
    // Not `instanceof Element`: inside the rendered HTML view's frame a node
    // belongs to the frame's realm, whose `Element` is not this one.
    const anchor = (target as Element | null)?.closest?.('a[href]') ?? null;
    if (!anchor || !root.contains(anchor)) {
      return null;
    }
    // Wherever this listens, the view's own click handler runs as well, and that
    // handler is what opens `http(s)`.
    return describeLink(anchor.getAttribute('href') ?? '', {
      fragmentsMove: options.fragmentsMove,
      webOpens: true,
      headingText,
    });
  };

  // `pointerover` reaches every element the pointer enters, so moving off a link
  // onto the text beside it clears it without a `pointerout` of its own.
  const onPointerOver = (event: PointerEvent) => setHoveredLink(destinationAt(event.target));
  const onPointerLeave = () => setHoveredLink(null);
  const onFocusIn = (event: FocusEvent) => setFocusedLink(destinationAt(event.target));
  const onFocusOut = () => setFocusedLink(null);

  root.addEventListener('pointerover', onPointerOver);
  root.addEventListener('pointerleave', onPointerLeave);
  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);
  return () => {
    root.removeEventListener('pointerover', onPointerOver);
    root.removeEventListener('pointerleave', onPointerLeave);
    root.removeEventListener('focusin', onFocusIn);
    root.removeEventListener('focusout', onFocusOut);
    clearLinkStatus();
  };
}

/** The text of `element` where it is a heading, else `null`. */
export function headingTextOf(element: Element): string | null {
  if (!element.matches('h1, h2, h3, h4, h5, h6')) {
    return null;
  }
  return element.textContent?.trim() || null;
}
