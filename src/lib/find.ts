/** Find in the open document: how a query and the document's text are compared,
 *  and how a match found in the compared text is put back onto the text the view
 *  rendered (TASK-47). Pure, so the matching is testable under Node; the DOM half
 *  — which text nodes are searched, and the ranges painted over them — is
 *  `FindBar`'s.
 *
 *  **What is compared is a folded copy, never the text itself.** A match is a
 *  case-insensitive substring match with full-width and half-width forms taken as
 *  one, which is NFKC followed by lower-casing — and NFKC changes lengths (`ﬁ` is
 *  two characters after it, `ｶﾞ` one), so an offset found in the folded copy is
 *  not an offset in the original. Every folded code unit therefore carries the
 *  start and end of the original stretch it came from. Hiragana and katakana stay
 *  distinct because NFKC leaves them distinct; nothing here maps one to the
 *  other. */

/** How many matches are counted. Past it the bar says `1000+`, and the matches
 *  beyond are neither painted nor reachable by stepping: each is a range the
 *  engine paints, and a 10 MiB source view can hold millions of a single
 *  letter. */
export const FIND_MATCH_LIMIT = 1000;

export interface FoldedText {
  /** NFKC, lower-cased. */
  text: string;
  /** For each code unit of `text`, where in the original the stretch it came
   *  from starts and ends. */
  start: Int32Array;
  end: Int32Array;
}

/* A character is folded together with the marks that follow it, because NFKC
   composes across them: `か` + U+3099 is `が`, and so is half-width `ｶﾞ`.
   U+FF9E / U+FF9F are the half-width voiced and semi-voiced marks, which are
   letters (Lm) rather than marks, so `\p{M}` alone would fold `ｶ` and `ﾞ` apart
   into `カ` and a combining mark, and `ガ` would never match `ｶﾞ`. */
const MARK = /\p{M}/u;

function followsAsMark(codePoint: number): boolean {
  return (
    codePoint >= 0x300 && (codePoint === 0xff9e || codePoint === 0xff9f || MARK.test(String.fromCodePoint(codePoint)))
  );
}

export function foldForFind(source: string): FoldedText {
  const pieces: string[] = [];
  let capacity = source.length + 16;
  let start = new Int32Array(capacity);
  let end = new Int32Array(capacity);
  let length = 0;

  const push = (folded: string, from: number, to: number) => {
    if (length + folded.length > capacity) {
      capacity = Math.max(capacity * 2, length + folded.length);
      const grownStart = new Int32Array(capacity);
      const grownEnd = new Int32Array(capacity);
      grownStart.set(start);
      grownEnd.set(end);
      start = grownStart;
      end = grownEnd;
    }
    for (let k = 0; k < folded.length; k++) {
      start[length] = from;
      end[length] = to;
      length++;
    }
    pieces.push(folded);
  };

  let i = 0;
  while (i < source.length) {
    const codePoint = source.codePointAt(i) ?? 0;
    let j = i + (codePoint > 0xffff ? 2 : 1);
    while (j < source.length) {
      const next = source.codePointAt(j) ?? 0;
      if (!followsAsMark(next)) {
        break;
      }
      j += next > 0xffff ? 2 : 1;
    }
    // ASCII with no mark after it is the bulk of every document and folds to
    // itself lower-cased; skipping `normalize` for it is what keeps a 10 MiB
    // source view from taking seconds.
    const folded =
      j - i === 1 && codePoint < 0x80 ? source[i].toLowerCase() : source.slice(i, j).normalize('NFKC').toLowerCase();
    push(folded, i, j);
    i = j;
  }

  return { text: pieces.join(''), start: start.subarray(0, length), end: end.subarray(0, length) };
}

/** The query as it is compared. Folded by the same function as the document, so
 *  the two cannot be normalized differently. */
export function foldQuery(query: string): string {
  return foldForFind(query).text;
}

/** One run of text that a match may cross: the text nodes, in document order,
 *  that share one block. A match never crosses from one block into another. */
export interface FindBlock {
  folded: FoldedText;
  /** Where each node starts in the block's joined text. */
  nodeStarts: number[];
  nodeLengths: number[];
}

export interface FindIndex {
  blocks: FindBlock[];
}

/** Each block is given as the text of its nodes; the index keeps nothing but
 *  those strings' folds and lengths, so the DOM nodes stay with the caller. */
export function buildFindIndex(blocks: readonly (readonly string[])[]): FindIndex {
  return {
    blocks: blocks.map((nodes) => {
      const nodeStarts: number[] = [];
      const nodeLengths: number[] = [];
      let offset = 0;
      for (const node of nodes) {
        nodeStarts.push(offset);
        nodeLengths.push(node.length);
        offset += node.length;
      }
      return { folded: foldForFind(nodes.join('')), nodeStarts, nodeLengths };
    }),
  };
}

export interface NodePosition {
  node: number;
  offset: number;
}

export interface FindMatch {
  block: number;
  start: NodePosition;
  end: NodePosition;
}

export interface FindResult {
  matches: FindMatch[];
  /** More matches exist than `matches` holds. */
  overflow: boolean;
}

/** Where `offset` in the block's joined text falls. A start on a boundary between
 *  two nodes goes to the later node and an end to the earlier one, so a range
 *  never begins or ends on a node it does not cover any of — and an empty node
 *  is never chosen at all. */
function locate(block: FindBlock, offset: number, edge: 'start' | 'end'): NodePosition {
  const { nodeStarts, nodeLengths } = block;
  let low = 0;
  let high = nodeStarts.length - 1;
  let found = edge === 'start' ? nodeStarts.length - 1 : 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const from = nodeStarts[mid];
    const to = from + nodeLengths[mid];
    const before = edge === 'start' ? offset < from : offset <= from;
    const after = edge === 'start' ? offset >= to : offset > to;
    if (before) {
      high = mid - 1;
    } else if (after) {
      low = mid + 1;
    } else {
      found = mid;
      break;
    }
  }
  return { node: found, offset: offset - nodeStarts[found] };
}

/** Every non-overlapping occurrence of `query`, in document order, up to `limit`.
 *  An empty query matches nothing. */
export function searchFindIndex(index: FindIndex, query: string, limit = FIND_MATCH_LIMIT): FindResult {
  const needle = foldQuery(query);
  const matches: FindMatch[] = [];
  if (needle.length === 0) {
    return { matches, overflow: false };
  }
  for (let b = 0; b < index.blocks.length; b++) {
    const block = index.blocks[b];
    const { text, start, end } = block.folded;
    let from = text.indexOf(needle);
    while (from !== -1) {
      if (matches.length === limit) {
        return { matches, overflow: true };
      }
      const to = from + needle.length;
      matches.push({ block: b, start: locate(block, start[from], 'start'), end: locate(block, end[to - 1], 'end') });
      from = text.indexOf(needle, to);
    }
  }
  return { matches, overflow: false };
}

export type FindDirection = 'next' | 'previous';

/** The match a step lands on, wrapping at both ends. From no current match, the
 *  first step goes to the first match either way. */
export function stepMatch(current: number | null, count: number, direction: FindDirection): number | null {
  if (count === 0) {
    return null;
  }
  if (current === null) {
    return direction === 'next' ? 0 : count - 1;
  }
  return direction === 'next' ? (current + 1) % count : (current - 1 + count) % count;
}
