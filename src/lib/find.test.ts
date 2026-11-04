import { describe, expect, it } from 'vitest';
import { buildFindIndex, FIND_MATCH_LIMIT, foldForFind, foldQuery, searchFindIndex, stepMatch } from './find';

function matchedText(blocks: string[][], query: string): string[] {
  const { matches } = searchFindIndex(buildFindIndex(blocks), query);
  return matches.map(({ block, start, end }) => {
    const nodes = blocks[block];
    if (start.node === end.node) {
      return nodes[start.node].slice(start.offset, end.offset);
    }
    return [
      nodes[start.node].slice(start.offset),
      ...nodes.slice(start.node + 1, end.node),
      nodes[end.node].slice(0, end.offset),
    ].join('');
  });
}

describe('foldQuery', () => {
  it('ignores case', () => {
    expect(foldQuery('NeEdLe')).toBe('needle');
  });

  it('takes full-width and half-width forms as one', () => {
    expect(foldQuery('ＡＢＣ１２３')).toBe('abc123');
    expect(foldQuery('ｶﾀｶﾅ')).toBe('カタカナ');
  });

  it('composes a half-width voiced mark with the kana before it', () => {
    expect(foldQuery('ｶﾞｲﾄﾞ')).toBe('ガイド');
    expect(foldQuery('ﾊﾟﾝ')).toBe('パン');
  });

  it('composes Hangul jamo, which are letters rather than marks, into one syllable', () => {
    // Half-width and conjoining jamo both fold to the precomposed U+AC00.
    expect(foldQuery('\uFFA1\uFFC2')).toBe('\uAC00');
    expect(foldQuery('\u1100\u1161')).toBe('\uAC00');
  });

  it('keeps hiragana and katakana distinct', () => {
    expect(foldQuery('ひらがな')).not.toBe(foldQuery('ヒラガナ'));
  });
});

describe('foldForFind', () => {
  it('maps each folded unit back to the stretch of the original it came from', () => {
    // `ﬁ` folds to two units and `ｶﾞ` (two units) to one.
    const folded = foldForFind('aﬁｶﾞb');
    expect(folded.text).toBe('afiガb');
    expect([...folded.start]).toEqual([0, 1, 1, 2, 4]);
    expect([...folded.end]).toEqual([1, 2, 2, 4, 5]);
  });

  it('keeps a combining mark with the letter before it', () => {
    const folded = foldForFind('éx');
    expect(folded.text).toBe('éx');
    expect([...folded.start]).toEqual([0, 2]);
    expect([...folded.end]).toEqual([2, 3]);
  });

  it('takes a surrogate pair as one character', () => {
    const folded = foldForFind('😀A');
    expect(folded.text).toBe('😀a');
    expect([...folded.start]).toEqual([0, 0, 2]);
    expect([...folded.end]).toEqual([2, 2, 3]);
  });
});

describe('searchFindIndex', () => {
  it('finds a case-insensitive substring', () => {
    expect(matchedText([['A Needle and a NEEDLE']], 'needle')).toEqual(['Needle', 'NEEDLE']);
  });

  it('finds full-width text from a half-width query and the reverse', () => {
    expect(matchedText([['価格は１２３円']], '123')).toEqual(['１２３']);
    expect(matchedText([['ｶﾞｲﾄﾞを読む']], 'ガイド')).toEqual(['ｶﾞｲﾄﾞ']);
    expect(matchedText([['ガイドを読む']], 'ｶﾞｲﾄﾞ')).toEqual(['ガイド']);
  });

  it('does not find katakana from a hiragana query', () => {
    expect(matchedText([['カタカナ']], 'かたかな')).toEqual([]);
  });

  it('crosses inline element boundaries within one block', () => {
    // `foo**bar**` renders as two text nodes in one paragraph.
    expect(matchedText([['foo', 'bar']], 'foobar')).toEqual(['foobar']);
    expect(matchedText([['a foo', 'b', 'ar z']], 'foobar')).toEqual(['foobar']);
  });

  it('never crosses from one block into the next', () => {
    expect(matchedText([['foo'], ['bar']], 'foobar')).toEqual([]);
  });

  it('starts a match on the node it covers, not the empty end of the one before', () => {
    const { matches } = searchFindIndex(buildFindIndex([['foo', '', 'bar']]), 'bar');
    expect(matches[0].start).toEqual({ node: 2, offset: 0 });
    expect(matches[0].end).toEqual({ node: 2, offset: 3 });
  });

  it('ends a match on the node it covers, not the start of the one after', () => {
    const { matches } = searchFindIndex(buildFindIndex([['foo', 'bar']]), 'foo');
    expect(matches[0].start).toEqual({ node: 0, offset: 0 });
    expect(matches[0].end).toEqual({ node: 0, offset: 3 });
  });

  it('maps a match back across folding that changed lengths', () => {
    expect(matchedText([['xﬁnd ﬁle']], 'find')).toEqual(['ﬁnd']);
    // A match ending inside a ligature takes the whole ligature.
    expect(matchedText([['ﬁ']], 'f')).toEqual(['ﬁ']);
  });

  it('finds a Hangul syllable whichever way it is spelled, and the reverse', () => {
    expect(matchedText([['x \uFFA1\uFFC2 y']], '\uAC00')).toEqual(['\uFFA1\uFFC2']);
    expect(matchedText([['x \u1100\u1161 y']], '\uAC00')).toEqual(['\u1100\u1161']);
    expect(matchedText([['x \uAC00 y']], '\uFFA1\uFFC2')).toEqual(['\uAC00']);
  });

  it('counts one original character once, however many characters it folds to', () => {
    // `ﬀ` folds to `ff`: two folded matches for `f`, one stretch of text.
    expect(matchedText([['ﬀ']], 'f')).toEqual(['ﬀ']);
    expect(matchedText([['aﬀb f']], 'f')).toEqual(['ﬀ', 'f']);
  });

  it('spends the limit on distinct stretches only', () => {
    const result = searchFindIndex(buildFindIndex([['ﬀ'.repeat(FIND_MATCH_LIMIT)]]), 'f');
    expect(result.matches).toHaveLength(FIND_MATCH_LIMIT);
    expect(result.overflow).toBe(false);
  });

  it('does not overlap matches', () => {
    expect(matchedText([['aaaa']], 'aa')).toEqual(['aa', 'aa']);
  });

  it('matches nothing for an empty query', () => {
    expect(searchFindIndex(buildFindIndex([['text']]), '').matches).toEqual([]);
  });

  it('stops at the limit and says more exist', () => {
    const text = 'a'.repeat(FIND_MATCH_LIMIT + 5);
    const result = searchFindIndex(buildFindIndex([[text]]), 'a');
    expect(result.matches).toHaveLength(FIND_MATCH_LIMIT);
    expect(result.overflow).toBe(true);
  });

  it('does not report an overflow at exactly the limit', () => {
    const result = searchFindIndex(buildFindIndex([['a'.repeat(FIND_MATCH_LIMIT)]]), 'a');
    expect(result.matches).toHaveLength(FIND_MATCH_LIMIT);
    expect(result.overflow).toBe(false);
  });
});

describe('stepMatch', () => {
  it('wraps at both ends', () => {
    expect(stepMatch(2, 3, 'next')).toBe(0);
    expect(stepMatch(0, 3, 'previous')).toBe(2);
    expect(stepMatch(1, 3, 'next')).toBe(2);
  });

  it('has nowhere to go without matches', () => {
    expect(stepMatch(null, 0, 'next')).toBeNull();
    expect(stepMatch(0, 0, 'previous')).toBeNull();
  });

  it('starts from the first or the last match when there is no current one', () => {
    expect(stepMatch(null, 4, 'next')).toBe(0);
    expect(stepMatch(null, 4, 'previous')).toBe(3);
  });
});
