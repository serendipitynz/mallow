import { describe, expect, it } from 'vitest';
import { countLines, HIGHLIGHT_MAX_BYTES, HIGHLIGHT_MAX_LINES, highlightSkipReason } from './source-cap';

describe('countLines', () => {
  it('counts the lines the text actually occupies', () => {
    expect(countLines('')).toBe(1);
    expect(countLines('a')).toBe(1);
    expect(countLines('a\nb')).toBe(2);
  });

  it('counts a trailing newline as ending its line, not starting one', () => {
    expect(countLines('a\n')).toBe(2);
    expect(countLines('a\nb\n')).toBe(3);
  });
});

describe('highlightSkipReason', () => {
  it('allows highlighting inside both caps', () => {
    expect(highlightSkipReason('{ "a": 1 }')).toBeNull();
    expect(highlightSkipReason('x\n'.repeat(HIGHLIGHT_MAX_LINES - 1))).toBeNull();
  });

  it('skips above the byte cap', () => {
    expect(highlightSkipReason('x'.repeat(HIGHLIGHT_MAX_BYTES))).toBeNull();
    expect(highlightSkipReason('x'.repeat(HIGHLIGHT_MAX_BYTES + 1))).toBe('bytes');
  });

  it('measures UTF-8 bytes, not code units', () => {
    // 3 bytes each, so this is over the cap while its length is well under it.
    const japanese = 'あ'.repeat(HIGHLIGHT_MAX_BYTES / 2);
    expect(japanese.length).toBeLessThan(HIGHLIGHT_MAX_BYTES);
    expect(highlightSkipReason(japanese)).toBe('bytes');
  });

  it('skips above the line cap even when the text is small', () => {
    const atCap = 'x\n'.repeat(HIGHLIGHT_MAX_LINES - 1).concat('x');
    expect(countLines(atCap)).toBe(HIGHLIGHT_MAX_LINES);
    expect(highlightSkipReason(atCap)).toBeNull();

    const overCap = `${atCap}\nx`;
    expect(overCap.length).toBeLessThan(HIGHLIGHT_MAX_BYTES);
    expect(highlightSkipReason(overCap)).toBe('lines');
  });
});
