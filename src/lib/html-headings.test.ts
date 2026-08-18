import { describe, expect, it } from 'vitest';
import { assignHeadingIds, type HeadingElementLike } from './html-headings';

// Stands in for the DOM fact `assignHeadingIds` cannot work out for itself: which
// element `getElementById` would return for a given id. Elements are listed in
// document order, headings and others alike.
function firstHolder(documentOrder: { id: string }[]): (element: HeadingElementLike) => boolean {
  return (element) => element.id !== '' && documentOrder.find((candidate) => candidate.id === element.id) === element;
}

/** No id in the document is a duplicate, so every heading holds its own. */
const ownsAll = () => true;

// A stand-in for the heading elements inside the rendered frame, which Node has
// no DOM for. It carries exactly what `HeadingElementLike` declares, so what the
// assignment is tested against and what it is given at runtime cannot diverge
// without TypeScript saying so.
function heading(tagName: string, textContent: string, id = ''): HeadingElementLike {
  return {
    tagName,
    id,
    textContent,
    setAttribute(name: string, value: string) {
      if (name === 'id') {
        this.id = value;
      }
    },
  };
}

describe('assignHeadingIds', () => {
  it('reports depth and text, and slugs a heading that has no id', () => {
    const h1 = heading('H1', 'Getting Started');
    const h3 = heading('H3', '  Nested   heading  ');
    expect(assignHeadingIds([h1, h3], [], ownsAll)).toEqual([
      { depth: 1, slug: 'getting-started', text: 'Getting Started' },
      { depth: 3, slug: 'nested-heading', text: 'Nested heading' },
    ]);
    expect(h1.id).toBe('getting-started');
  });

  it('leaves an existing id alone, so the document keeps its own fragment links', () => {
    const h1 = heading('H1', 'Overview', 'sec-1');
    expect(assignHeadingIds([h1], ['sec-1'], ownsAll)).toEqual([{ depth: 1, slug: 'sec-1', text: 'Overview' }]);
    expect(h1.id).toBe('sec-1');
  });

  it('does not generate a slug that collides with an id elsewhere in the document', () => {
    const h1 = heading('H1', 'Notes');
    expect(assignHeadingIds([h1], ['notes'], ownsAll)[0].slug).toBe('notes-1');
  });

  it('numbers repeated headings apart', () => {
    const headings = assignHeadingIds(
      [heading('H2', 'Usage'), heading('H2', 'Usage'), heading('H2', 'Usage')],
      [],
      ownsAll,
    );
    expect(headings.map((h) => h.slug)).toEqual(['usage', 'usage-1', 'usage-2']);
  });

  it('re-slugs a heading whose id repeats one an earlier heading claimed', () => {
    const first = heading('H2', 'One', 'dup');
    const second = heading('H2', 'Two', 'dup');
    expect(assignHeadingIds([first, second], ['dup', 'dup'], firstHolder([first, second])).map((h) => h.slug)).toEqual([
      'dup',
      'two',
    ]);
    expect(first.id).toBe('dup');
    expect(second.id).toBe('two');
  });

  it('re-slugs a heading whose id is already held by an element that is not a heading', () => {
    // `<div id="toc">` sits above `<h2 id="toc">`, so `getElementById('toc')`
    // answers the div and an outline entry keeping that id would jump to it.
    const div = { id: 'toc' };
    const h2 = heading('H2', 'Table of contents', 'toc');
    expect(assignHeadingIds([h2], ['toc', 'toc'], firstHolder([div, h2]))).toEqual([
      { depth: 2, slug: 'table-of-contents', text: 'Table of contents' },
    ]);
    expect(h2.id).toBe('table-of-contents');
  });

  it('names a heading that slugs to nothing', () => {
    const headings = assignHeadingIds([heading('H1', '   '), heading('H1', '***')], [], ownsAll);
    expect(headings.map((h) => h.slug)).toEqual(['heading', 'heading-1']);
  });
});
