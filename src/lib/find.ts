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

/* Characters are folded in the smallest stretches NFKC cannot see across: a
   character joins the stretch before it when normalizing the two together gives
   something other than normalizing them apart. That is what composes `か` +
   U+3099 into `が`, half-width `ｶﾞ` into `ガ` — U+FF9E is a letter, not a mark,
   so no mark class would catch it — and conjoining or half-width Hangul jamo
   into one syllable, where every piece is a letter. Testing the pair rather than
   listing the classes means no category is missed by having been left off.

   Some characters can never be the second half of a composition — ASCII, kana
   other than the two voiced marks, CJK ideographs — so a stretch ends before one
   without the test. They are the bulk of the documents mallow shows, and
   skipping two `normalize` calls per character for them is what keeps a long
   Japanese document quick to fold. */
function neverComposesBackward(codePoint: number): boolean {
  return (
    codePoint < 0x80 ||
    (codePoint >= 0x3041 && codePoint <= 0x30ff && codePoint !== 0x3099 && codePoint !== 0x309a) ||
    (codePoint >= 0x4e00 && codePoint <= 0x9fff)
  );
}

/* `normalize` is what folding costs, and a document repeats a few thousand
   distinct characters however long it is, so a character's — or a pair's —
   NFKC is computed once. Cleared rather than allowed to grow without bound
   across documents. */
const nfkcCache = new Map<string, string>();
const NFKC_CACHE_LIMIT = 50_000;

function nfkc(text: string): string {
  if (text.length > 4) {
    return text.normalize('NFKC');
  }
  let normalized = nfkcCache.get(text);
  if (normalized === undefined) {
    if (nfkcCache.size >= NFKC_CACHE_LIMIT) {
      nfkcCache.clear();
    }
    normalized = text.normalize('NFKC');
    nfkcCache.set(text, normalized);
  }
  return normalized;
}

/** Per BMP code unit below the surrogates: 0 not yet known, 1 folds to itself,
 *  2 does not. A fixed property of Unicode, so it is never cleared. */
const selfFolding = new Uint8Array(0xd800);

function foldsToItself(unit: number): boolean {
  let known = selfFolding[unit];
  if (known === 0) {
    const char = String.fromCharCode(unit);
    known = char.normalize('NFKC').toLowerCase() === char ? 1 : 2;
    selfFolding[unit] = known;
  }
  return known === 1;
}

export function foldForFind(source: string): FoldedText {
  const pieces: string[] = [];
  let capacity = source.length + 16;
  let start = new Int32Array(capacity);
  let end = new Int32Array(capacity);
  let length = 0;

  const reserve = (more: number) => {
    if (length + more > capacity) {
      capacity = Math.max(capacity * 2, length + more);
      const grownStart = new Int32Array(capacity);
      const grownEnd = new Int32Array(capacity);
      grownStart.set(start);
      grownEnd.set(end);
      start = grownStart;
      end = grownEnd;
    }
  };

  /** One stretch of the original, folded to `folded`. */
  const push = (folded: string, from: number, to: number) => {
    reserve(folded.length);
    for (let k = 0; k < folded.length; k++) {
      start[length] = from;
      end[length] = to;
      length++;
    }
    pieces.push(folded);
  };

  /** A run of characters that each fold to one unit of themselves (ASCII
   *  lower-cased), taken at once: per-character work over a 10 MiB source view
   *  took seconds, and over a long Japanese document most of a second. */
  const pushRun = (from: number, to: number) => {
    reserve(to - from);
    for (let k = from; k < to; k++) {
      start[length] = k;
      end[length] = k + 1;
      length++;
    }
    pieces.push(source.slice(from, to).toLowerCase());
  };

  let i = 0;
  let runFrom = 0;
  while (i < source.length) {
    const unit = source.charCodeAt(i);
    // Batched when it folds to itself and the next character cannot compose
    // back onto it (`e` + U+0301 must reach the stretch below). Surrogates
    // never are, so a range cannot end between the halves of a pair.
    if (
      (unit < 0x80 || (unit < 0xd800 && foldsToItself(unit))) &&
      (i + 1 >= source.length || neverComposesBackward(source.codePointAt(i + 1) ?? 0))
    ) {
      i++;
      continue;
    }
    if (i > runFrom) {
      pushRun(runFrom, i);
    }
    const codePoint = source.codePointAt(i) ?? 0;
    let j = i + (codePoint > 0xffff ? 2 : 1);
    let stretch = source.slice(i, j);
    let normalized = nfkc(stretch);
    while (j < source.length) {
      const next = source.codePointAt(j) ?? 0;
      if (neverComposesBackward(next)) {
        break;
      }
      const width = next > 0xffff ? 2 : 1;
      const nextText = source.slice(j, j + width);
      const together = nfkc(stretch + nextText);
      if (together === normalized + nfkc(nextText)) {
        break;
      }
      stretch += nextText;
      normalized = together;
      j += width;
    }
    push(normalized.toLowerCase(), i, j);
    i = j;
    runFrom = j;
  }
  if (i > runFrom) {
    pushRun(runFrom, i);
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
    // Where the last match ended in the original. One original character can
    // fold to several (`ﬀ` is `ff`), so two folded matches can map back to the
    // same stretch of text; the second is not another occurrence, and counting
    // it would make a step land where the reader already is.
    let covered = 0;
    let from = text.indexOf(needle);
    while (from !== -1) {
      const to = from + needle.length;
      if (start[from] >= covered) {
        if (matches.length === limit) {
          return { matches, overflow: true };
        }
        matches.push({ block: b, start: locate(block, start[from], 'start'), end: locate(block, end[to - 1], 'end') });
        covered = end[to - 1];
      }
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
