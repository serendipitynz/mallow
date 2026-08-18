/**
 * Headings, and the seam that lets a viewer resolve them somewhere other than the
 * app document — inside an iframe (TASK-5.2) or scoped to one mounted tab
 * (TASK-13.2). `Outline` and `lib/scroll` take a `HeadingRoot` instead of calling
 * `document.getElementById`, which crosses neither boundary.
 */

export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

/**
 * Where heading ids are resolved, and where that place's coordinate space starts
 * in the app document's viewport. The two are one value because a root inside a
 * frame is unusable with anyone else's offset: rects taken in there are relative
 * to the frame's viewport, so a lookup that crossed the boundary without the
 * matching offset would compare two coordinate spaces silently.
 *
 * Both members are read per lookup / per measurement rather than captured: a
 * frame's `contentDocument` is replaced on every `srcdoc` swap (decision-3), and
 * the frame's own position moves while a document is open (the notice bar
 * appears, the outline opens).
 *
 * Pass a stable value — a module constant or a memoized one. `Outline` uses it as
 * an effect dependency, so a fresh object literal per render re-subscribes the
 * scroll spy every render.
 */
export interface HeadingRoot {
  node: () => Document | Element | null;
  frameOffset: () => number;
}

export const appDocumentRoot: HeadingRoot = {
  node: () => document,
  frameOffset: () => 0,
};

export function findHeading(root: HeadingRoot, slug: string): HTMLElement | null {
  const node = root.node();
  if (node === null) {
    return null;
  }
  // Not `instanceof Document`: a frame's document belongs to the frame's realm, so
  // it fails that test against the parent's constructor even when same-origin.
  if (node.nodeType === Node.DOCUMENT_NODE) {
    return (node as Document).getElementById(slug);
  }
  // `getElementById` takes a raw id but exists only on Document. The selector form
  // needs escaping and not just for exotic ids: github-slugger emits `2026-年の計画`
  // for a heading starting with a digit, which is not a valid bare id selector.
  return node.querySelector(`#${CSS.escape(slug)}`);
}

/**
 * Distance from the scroll container's top edge down to a heading, in the app
 * document's coordinate space. `headingTop` is the heading's own
 * `getBoundingClientRect().top`, relative to its root's viewport; `frameOffset`
 * lifts it into the app document's, and is 0 when the heading is already there.
 */
export function offsetFromContainerTop(headingTop: number, frameOffset: number, containerTop: number): number {
  return headingTop + frameOffset - containerTop;
}
