/**
 * Heading ids for a rendered HTML document, and the outline entries that address
 * them (TASK-5.2, decision-3).
 *
 * A rendered document is not one mallow produced: its headings may already carry
 * ids, may carry none, and two of them may carry the same one. Only what is
 * missing is assigned — overwriting an id would break the document's own
 * fragment links, which is the one thing this must not cost.
 *
 * The elements are passed in rather than queried here, so everything below runs
 * over {@link HeadingElementLike} — the structural subset a real element
 * satisfies and a test writes as an object literal. That is what keeps this
 * testable under Node while the frame's `DOMParser`-side work stays in the
 * component (doc-1).
 */

import { slug as slugify } from 'github-slugger';
import type { Heading } from './heading';

export interface HeadingElementLike {
  tagName: string;
  id: string;
  textContent: string | null;
  setAttribute(name: string, value: string): void;
}

/** Slug for a heading with no usable text — a heading holding only an image, say.
 *  Numbered by the same collision bump as any other slug. */
const UNTITLED_SLUG = 'heading';

function uniqueSlug(base: string, taken: Set<string>): string {
  const stem = base === '' ? UNTITLED_SLUG : base;
  let candidate = stem;
  let n = 1;
  while (taken.has(candidate)) {
    candidate = `${stem}-${n}`;
    n += 1;
  }
  taken.add(candidate);
  return candidate;
}

/**
 * Give every heading an id the outline can resolve, and return the outline.
 *
 * `takenIds` is every id already in the document, not just the headings' — a
 * generated slug that collided with one would address that other element, and
 * the outline would jump somewhere else entirely.
 *
 * `ownsId` answers whether the element is the document's **first** holder of its
 * own id, which only the DOM knows and which is the whole of what this needs
 * from it. A heading that is not gets a fresh slug, as does one repeating an id
 * an earlier heading already claimed: an id that is not the first of its name
 * addresses nothing, since `getElementById` and the document's own fragment
 * links both resolve to the first. So re-slugging one breaks no link that
 * worked, while leaving it would point an outline entry at some other element.
 */
export function assignHeadingIds(
  elements: ArrayLike<HeadingElementLike>,
  takenIds: Iterable<string>,
  ownsId: (element: HeadingElementLike) => boolean,
): Heading[] {
  const taken = new Set(takenIds);
  const claimed = new Set<string>();
  const headings: Heading[] = [];
  for (let i = 0; i < elements.length; i += 1) {
    const element = elements[i];
    const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
    const depth = Number.parseInt(element.tagName.slice(1), 10);
    let slug = element.id;
    if (slug === '' || claimed.has(slug) || !ownsId(element)) {
      slug = uniqueSlug(slugify(text), taken);
      element.setAttribute('id', slug);
    }
    claimed.add(slug);
    headings.push({ depth, slug, text });
  }
  return headings;
}
