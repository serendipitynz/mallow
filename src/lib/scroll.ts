/** Scroll-position preservation across a live re-render of a markdown document. */
import { appDocumentRoot, findHeading, type Heading, type HeadingRoot, offsetFromContainerTop } from './heading';

export type ScrollAnchor = { slug: string; offset: number } | { ratio: number } | null;

/**
 * Record where the document is scrolled, preferring the topmost heading still in
 * view (robust to content inserted above) and falling back to a scroll ratio.
 */
export function captureScrollAnchor(
  container: HTMLElement | null,
  headings: Heading[],
  root: HeadingRoot = appDocumentRoot,
): ScrollAnchor {
  if (!container) {
    return null;
  }
  const top = container.getBoundingClientRect().top;
  const frameOffset = root.frameOffset();
  for (const h of headings) {
    const el = findHeading(root, h.slug);
    if (!el) {
      continue;
    }
    const rel = offsetFromContainerTop(el.getBoundingClientRect().top, frameOffset, top);
    if (rel >= -1) {
      return { slug: h.slug, offset: rel };
    }
  }
  const max = Math.max(1, container.scrollHeight - container.clientHeight);
  return { ratio: container.scrollTop / max };
}

/** Restore a previously captured scroll position after the new content mounts. */
export function restoreScrollAnchor(
  container: HTMLElement | null,
  anchor: ScrollAnchor,
  root: HeadingRoot = appDocumentRoot,
): void {
  if (!container || !anchor) {
    return;
  }
  if ('slug' in anchor) {
    const el = findHeading(root, anchor.slug);
    if (el) {
      const top = container.getBoundingClientRect().top;
      // `frameOffset` is read again here, not carried over from the capture: what
      // moved in between may be the frame itself rather than the content in it.
      const cur = offsetFromContainerTop(el.getBoundingClientRect().top, root.frameOffset(), top);
      container.scrollTop += cur - anchor.offset;
      return;
    }
  }
  if ('ratio' in anchor) {
    const max = Math.max(0, container.scrollHeight - container.clientHeight);
    container.scrollTop = anchor.ratio * max;
  }
}
