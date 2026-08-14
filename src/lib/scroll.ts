/** Scroll-position preservation across a live re-render of a markdown document. */
import type { Heading } from './markdown';

export type ScrollAnchor = { slug: string; offset: number } | { ratio: number } | null;

/**
 * Record where the document is scrolled, preferring the topmost heading still in
 * view (robust to content inserted above) and falling back to a scroll ratio.
 */
export function captureScrollAnchor(container: HTMLElement | null, headings: Heading[]): ScrollAnchor {
  if (!container) {
    return null;
  }
  const top = container.getBoundingClientRect().top;
  for (const h of headings) {
    const el = document.getElementById(h.slug);
    if (!el) {
      continue;
    }
    const rel = el.getBoundingClientRect().top - top;
    if (rel >= -1) {
      return { slug: h.slug, offset: rel };
    }
  }
  const max = Math.max(1, container.scrollHeight - container.clientHeight);
  return { ratio: container.scrollTop / max };
}

/** Restore a previously captured scroll position after the new content mounts. */
export function restoreScrollAnchor(container: HTMLElement | null, anchor: ScrollAnchor): void {
  if (!container || !anchor) {
    return;
  }
  if ('slug' in anchor) {
    const el = document.getElementById(anchor.slug);
    if (el) {
      const top = container.getBoundingClientRect().top;
      const cur = el.getBoundingClientRect().top - top;
      container.scrollTop += cur - anchor.offset;
      return;
    }
  }
  if ('ratio' in anchor) {
    const max = Math.max(0, container.scrollHeight - container.clientHeight);
    container.scrollTop = anchor.ratio * max;
  }
}
