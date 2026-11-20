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

/** Reports the links inside `frame`'s document to the status bar where the
 *  frame runs no parent-registered listener (decision-9), so `watchLinks` hears
 *  nothing: the parent reads `:hover` and `activeElement` off the document
 *  instead, once a frame, until the returned function is called — which clears
 *  the status as `watchLinks`' does.
 *
 *  Every link is described as not opening, because on that engine none does:
 *  `frame-src` stops `http(s)`, and the app-origin links are neutralized
 *  (decision-10) — which also takes them out of hit-testing and the Tab order,
 *  so neither reading ever names one.
 *
 *  The reading runs only while the pointer is over the frame or the focus is
 *  inside it, started and stopped by events the parent hears for itself (TASK-72,
 *  measured on WKWebView and WebKitGTK): `pointerenter` / `pointerleave` on the
 *  iframe element, and the parent window's `blur` / `focus` with the iframe as
 *  the parent's `activeElement`. Nothing inside the frame says when the pointer
 *  or the focus moves from one link to the next — the element hears no
 *  `pointermove` — which is why it is a poll at all. */
export function watchFrameLinks(frame: HTMLIFrameElement, frameDocument: Document): () => void {
  const parentDocument = frame.ownerDocument;
  const parentWindow = parentDocument.defaultView;
  if (!parentWindow) {
    return () => {};
  }

  const describe = (element: Element | null): LinkDestination | null => {
    const href = element?.closest?.('a[href]')?.getAttribute('href');
    return href == null ? null : describeLink(href, { fragmentsMove: false, webOpens: false, headingText: () => null });
  };

  let pointerInside = frame.matches(':hover');
  const focusInside = () => parentDocument.activeElement === frame;

  let raf = 0;
  const tick = () => {
    // Gated on the parent's own answer rather than read alone: `:hover` was
    // measured outliving a `pointerleave` by a frame on WKWebView.
    setHoveredLink(pointerInside ? describe(frameDocument.querySelector('a[href]:hover')) : null);
    setFocusedLink(focusInside() ? describe(frameDocument.activeElement) : null);
    raf = pointerInside || focusInside() ? parentWindow.requestAnimationFrame(tick) : 0;
  };
  const start = () => {
    if (raf === 0) {
      raf = parentWindow.requestAnimationFrame(tick);
    }
  };

  const onPointerEnter = () => {
    pointerInside = true;
    start();
  };
  const onPointerLeave = () => {
    pointerInside = false;
    setHoveredLink(null);
  };
  // `blur` is the focus entering the frame and `focus` the focus coming back to
  // the app document; the iframe element itself was measured receiving neither.
  const onWindowFocusChange = () => {
    if (focusInside()) {
      start();
    } else {
      setFocusedLink(null);
    }
  };

  frame.addEventListener('pointerenter', onPointerEnter);
  frame.addEventListener('pointerleave', onPointerLeave);
  parentWindow.addEventListener('blur', onWindowFocusChange);
  parentWindow.addEventListener('focus', onWindowFocusChange);
  // A `srcdoc` swap under a still pointer sends no `pointerenter` for the new
  // document.
  if (pointerInside || focusInside()) {
    start();
  }
  return () => {
    parentWindow.cancelAnimationFrame(raf);
    raf = 0;
    frame.removeEventListener('pointerenter', onPointerEnter);
    frame.removeEventListener('pointerleave', onPointerLeave);
    parentWindow.removeEventListener('blur', onWindowFocusChange);
    parentWindow.removeEventListener('focus', onWindowFocusChange);
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
