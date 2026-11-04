/** The DOM half of find (TASK-47): which text a view's root holds as its
 *  document, the ranges a match covers, how they are painted, and how one is
 *  brought into view. The matching itself is `lib/find`'s.
 *
 *  **Nothing here writes into the root.** The article's HTML is written only when
 *  its enhancements re-run (TASK-29's invariant), so matches are painted with the
 *  CSS Custom Highlight API, which registers ranges and paints them with no DOM
 *  mutation — measured on all three WebViews, including that a range across
 *  inline elements paints as one match (TASK-46). Wrapping them in `<mark>` is the
 *  rejected alternative for that reason. */

/** Text in the root that is not the document's: the code-copy buttons, the
 *  mermaid controls, the notes the app writes (a diagram's render error, the
 *  source view's skipped-highlighting notice) and the source view's line-number
 *  gutter, which is `aria-hidden`. A rendered mermaid diagram is excluded whole:
 *  its text is SVG, which TASK-46 did not measure the API on. */
const NOT_DOCUMENT_TEXT = 'button, svg, textarea, [aria-hidden="true"], .notice, .mermaid-rendered, .mermaid-copy';

/** Elements that end one run of text and start another, so a match never joins
 *  the end of a paragraph to the start of the next. Read from the tag rather than
 *  the computed `display`, which would cost a style lookup per text node across a
 *  document of tens of thousands of them. */
const BLOCK_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'BODY',
  'CAPTION',
  'DD',
  'DETAILS',
  'DIV',
  'DL',
  'DT',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'SUMMARY',
  'TABLE',
  'TBODY',
  'TD',
  'TFOOT',
  'TH',
  'THEAD',
  'TR',
  'UL',
]);

function blockOf(node: Node, root: HTMLElement): Element {
  for (let el = node.parentElement; el && el !== root; el = el.parentElement) {
    if (BLOCK_TAGS.has(el.tagName)) {
      return el;
    }
  }
  return root;
}

/** The root's document text as runs of text nodes. A new run starts wherever
 *  the nearest block changes, so `<li>a<ul><li>b</li></ul>c</li>` is three runs
 *  and `a` never joins `c` across the nested list. */
export function collectFindText(root: HTMLElement): Text[][] {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return NodeFilter.FILTER_ACCEPT;
      }
      return (node as Element).matches(NOT_DOCUMENT_TEXT) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
    },
  });
  const runs: Text[][] = [];
  let block: Element | null = null;
  let run: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const owner = blockOf(node, root);
    if (owner !== block || run.length === 0) {
      run = [];
      runs.push(run);
      block = owner;
    }
    run.push(node as Text);
  }
  return runs;
}

const MATCH_HIGHLIGHT = 'mallow-find';
const CURRENT_HIGHLIGHT = 'mallow-find-current';

function registry(): HighlightRegistry | undefined {
  return typeof CSS !== 'undefined' ? CSS.highlights : undefined;
}

/** Paint every match, and the current one over them. The current one is a
 *  second highlight at a higher priority rather than a different style on one
 *  range, which is the drawing TASK-46 saw work on all three. */
export function paintMatches(ranges: readonly Range[], current: Range | null): void {
  const highlights = registry();
  if (!highlights) {
    return;
  }
  highlights.set(MATCH_HIGHLIGHT, new Highlight(...ranges));
  if (current) {
    const highlight = new Highlight(current);
    highlight.priority = 1;
    highlights.set(CURRENT_HIGHLIGHT, highlight);
  } else {
    highlights.delete(CURRENT_HIGHLIGHT);
  }
}

export function clearMatches(): void {
  const highlights = registry();
  highlights?.delete(MATCH_HIGHLIGHT);
  highlights?.delete(CURRENT_HIGHLIGHT);
}

/** The scroller's `scroll-padding-top`, read back rather than restated: it is the
 *  pinned `.doc__bar`'s measured height, fallback included, and it is what
 *  `scrollIntoView` honours for an element. A range has no `scrollIntoView`, so
 *  the same clearance has to come from here — the reading `Outline` takes too. */
function clearance(scroller: HTMLElement): number {
  return parseFloat(getComputedStyle(scroller).scrollPaddingTop) || 0;
}

/** The first match that is not above the visible part of the scroller, which is
 *  where a new query starts from rather than the top of the document. */
export function firstMatchInView(ranges: readonly Range[], scroller: HTMLElement): number {
  const top = scroller.getBoundingClientRect().top + clearance(scroller);
  const index = ranges.findIndex((range) => range.getBoundingClientRect().bottom > top);
  return index === -1 ? 0 : index;
}

function scrollsSideways(el: HTMLElement): boolean {
  if (el.scrollWidth <= el.clientWidth) {
    return false;
  }
  const overflow = getComputedStyle(el).overflowX;
  return overflow === 'auto' || overflow === 'scroll';
}

/** Bring `range` into view below the bar, centred in what is left of the
 *  scroller, unless it is already wholly visible there. A code block or a table
 *  that scrolls sideways on its own is scrolled first, so a match past its right
 *  edge is reached too. Instant rather than smooth: stepping quickly through
 *  matches would abort one smooth scroll with the next. */
export function revealRange(range: Range, scroller: HTMLElement): void {
  for (
    let el: HTMLElement | null = range.commonAncestorContainer.parentElement;
    el && el !== scroller;
    el = el.parentElement
  ) {
    if (!scrollsSideways(el)) {
      continue;
    }
    const box = el.getBoundingClientRect();
    const rect = range.getBoundingClientRect();
    if (rect.left < box.left || rect.right > box.right) {
      el.scrollLeft += rect.left - box.left - (box.width - rect.width) / 2;
    }
  }

  const rect = range.getBoundingClientRect();
  const box = scroller.getBoundingClientRect();
  const top = box.top + clearance(scroller);
  if (rect.top >= top && rect.bottom <= box.bottom) {
    return;
  }
  const visible = box.bottom - top;
  scroller.scrollTop += rect.top - top - Math.max(0, (visible - rect.height) / 2);
}
