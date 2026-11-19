/** What the status bar says about the link under the pointer or holding the
 *  focus (TASK-68): where it goes, or that pressing it does nothing. One per
 *  window, since each window is its own WebView and holds its own module state. */

export type LinkDestination =
  | { kind: 'web'; text: string }
  | { kind: 'fragment'; text: string }
  | { kind: 'inert'; text: string };

export interface DescribeOptions {
  /** Whether a click on `#…` moves within the view. True in the preview, where
   *  the engine follows it; false on a slide, where every link but `http(s)` is
   *  inert — so saying it moves would be a promise the click does not keep. */
  fragmentsMove: boolean;
  /** The text of the heading an id names, or `null` when the id names no
   *  heading. Injected so this module reads no DOM. */
  headingText: (id: string) => string | null;
}

/** Mirrors the views' click handlers, which are what decide: `http(s)` opens in
 *  the OS browser, `#…` scrolls where the view lets it, and everything else is
 *  inert. Reading it off the same test is what keeps "does not open" true. */
export function describeLink(href: string, options: DescribeOptions): LinkDestination {
  if (/^https?:\/\//i.test(href)) {
    return { kind: 'web', text: href };
  }
  if (options.fragmentsMove && href.startsWith('#')) {
    return { kind: 'fragment', text: options.headingText(decodeFragment(href.slice(1))) ?? href };
  }
  return { kind: 'inert', text: href };
}

function decodeFragment(fragment: string): string {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

let hovered: LinkDestination | null = null;
let focused: LinkDestination | null = null;
const listeners = new Set<() => void>();

function same(a: LinkDestination | null, b: LinkDestination | null): boolean {
  return a === b || (a !== null && b !== null && a.kind === b.kind && a.text === b.text);
}

function notify(): void {
  listeners.forEach((cb) => {
    cb();
  });
}

/** The pointer wins over the focus, as in a browser: pointing at one link while
 *  another holds the focus shows the one pointed at, and leaving it brings the
 *  focused one back. */
export function readLinkStatus(): LinkDestination | null {
  return hovered ?? focused;
}

/** Shaped for `useSyncExternalStore`, whose snapshot is `readLinkStatus`. */
export function onLinkStatusChange(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function setHoveredLink(destination: LinkDestination | null): void {
  if (!same(hovered, destination)) {
    hovered = destination;
    notify();
  }
}

export function setFocusedLink(destination: LinkDestination | null): void {
  if (!same(focused, destination)) {
    focused = destination;
    notify();
  }
}

export function clearLinkStatus(): void {
  if (hovered !== null || focused !== null) {
    hovered = null;
    focused = null;
    notify();
  }
}
