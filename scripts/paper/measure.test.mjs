import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  assertMarkersAreAbsentFromFixture,
  columnStrips,
  judgePaper,
  markersPresent,
  medianWordHeight,
  parseBboxWords,
  SHELL_MARKERS,
  textExtentX,
  WIDE_TABLE_EDGE_MARKERS,
  webView2ChromeFound,
  wordsPastRightEdge,
} from './measure.mjs';

const here = dirname(fileURLToPath(import.meta.url));

function word(page, text, box = {}) {
  return { page, text, x0: 0, y0: 0, x1: 10, y1: 10, ...box };
}

describe('parseBboxWords', () => {
  const xml = `<doc>
<page width="595" height="842">
<word xMin="45.35" yMin="60.00" xMax="90.35" yMax="75.72">hello</word>
<word xMin="95.00" yMin="60.00" xMax="120.00" yMax="78.00">&amp;world</word>
</page>
<page width="595" height="842">
<word xMin="45.35" yMin="60.00" xMax="60.00" yMax="70.00">second</word>
</page>
</doc>`;

  // The page a word sits on is not in the word element, so losing the page
  // boundaries would silently measure page 1 as if it were the whole document.
  it('carries the page each word sits on', () => {
    expect(parseBboxWords(xml).map((w) => [w.page, w.text])).toEqual([
      [1, 'hello'],
      [1, '&world'],
      [2, 'second'],
    ]);
  });

  it('carries the width of the page each word sits on', () => {
    expect(parseBboxWords(xml).map((w) => w.pageWidth)).toEqual([595, 595, 595]);
  });

  it('reads the box back as numbers', () => {
    expect(parseBboxWords(xml)[0]).toMatchObject({ x0: 45.35, y0: 60, x1: 90.35, y1: 75.72 });
  });

  it('answers an empty document with no words rather than throwing', () => {
    expect(parseBboxWords('<doc></doc>')).toEqual([]);
  });
});

describe('medianWordHeight', () => {
  // The measurement that catches a scaled page, so it has to be per-page: a mean
  // over the document moves with wherever the headings and code landed.
  it('is the median height of the words on that page alone', () => {
    const words = [
      word(1, 'a', { y0: 0, y1: 100 }),
      word(2, 'b', { y0: 0, y1: 10 }),
      word(2, 'c', { y0: 0, y1: 20 }),
      word(2, 'd', { y0: 0, y1: 30 }),
    ];
    expect(medianWordHeight(words, 2)).toBe(20);
  });

  it('is null for a page with no words, rather than 0', () => {
    expect(medianWordHeight([word(1, 'a')], 2)).toBeNull();
  });
});

describe('textExtentX', () => {
  it('spans the leftmost and rightmost word on the page', () => {
    const words = [word(2, 'a', { x0: 45.4, x1: 100 }), word(2, 'b', { x0: 200, x1: 549.9 })];
    expect(textExtentX(words, 2)).toEqual({ min: 45.4, max: 549.9 });
  });
});

describe('the shell markers', () => {
  /* The instrument checking itself. `プレビュー`, `エクスプローラ` and `設定` are
     absent from the list because the fixture's own prose carries them, and this
     is what stops either side drifting back into a marker that proves nothing. */
  it('do not appear in the fixture the paper is made from', () => {
    const fixture = readFileSync(resolve(here, 'print-pagebreaks.md'), 'utf8');
    expect(markersPresent(fixture, SHELL_MARKERS)).toEqual([]);
    expect(() => assertMarkersAreAbsentFromFixture(fixture)).not.toThrow();
  });

  it('refuse to measure against a document that carries one', () => {
    expect(() => assertMarkersAreAbsentFromFixture('… the Outline button …')).toThrow(/cannot prove anything/);
  });
});

describe('webView2ChromeFound', () => {
  it('finds the footer URL and the page number', () => {
    expect(webView2ChromeFound([word(1, 'file:///C:/x.md'), word(1, '1/12')])).toEqual([
      'file:///',
      'page number 1/12',
    ]);
  });

  /* The fixture contains tokens like `m3/3o`, so a substring match for N/M would
     report WebView2's footer on a clean paper. */
  it('does not read a page number out of the middle of a word', () => {
    expect(webView2ChromeFound([word(1, 'm3/3o'), word(1, 'A7/4c')])).toEqual([]);
  });
});

describe('columnStrips', () => {
  it('reads the words sharing a left edge top to bottom', () => {
    const strips = columnStrips([
      word(1, 'b', { x0: 50.2, y0: 20 }),
      word(1, 'x', { x0: 10 }),
      word(1, 'a', { x0: 49.9 }),
    ]);
    expect(strips).toEqual(['ab', 'x']);
  });

  // A row straddling a page break leaves the head of a value on one page and its
  // tail at the top of the next.
  it('carries on across a page break', () => {
    const strips = columnStrips([word(2, 'G', { x0: 50, y0: 40 }), word(1, 'EDGE', { x0: 50, y0: 760 })]);
    expect(strips).toEqual(['EDGEG']);
  });
});

describe('wordsPastRightEdge', () => {
  it('takes a word ending past its page and leaves one ending at the edge', () => {
    const inside = word(1, 'in', { x0: 500, x1: 595.3, pageWidth: 595 });
    const past = word(1, 'out', { x0: 590, x1: 600, pageWidth: 595 });
    expect(wordsPastRightEdge([inside, past])).toEqual([past]);
  });

  it('does not judge a word whose page width is unknown', () => {
    expect(wordsPastRightEdge([word(1, 'x', { x1: 9999 })])).toEqual([]);
  });
});

describe('judgePaper', () => {
  const edge = WIDE_TABLE_EDGE_MARKERS.map((marker) => word(3, marker, { x0: 500, x1: 530, pageWidth: 595 }));
  const words = [word(1, '§1'), word(2, 'body', { y0: 0, y1: 18.5 }), ...edge, word(3, `13. 最後の節`)];
  const base = {
    os: 'macos',
    bytes: 290_000,
    maxBytes: 10 * 1024 * 1024,
    pages: 14,
    pageSize: '595 x 842 pts (A4)',
    words,
    key: 'macos',
    baseline: { macos: { medianWordHeight: 18.56 } },
  };

  function check(result, id) {
    return result.checks.find((entry) => entry.id === id);
  }

  it('passes a paper that reaches its end at the right size', () => {
    const result = judgePaper(base);
    expect(result.ok).toBe(true);
    expect(check(result, 'scale').ok).toBe(true);
  });

  // The failure the print route had: the page count looked plausible and the tail
  // was simply not there.
  it('fails a paper whose last section is missing', () => {
    const result = judgePaper({ ...base, words: words.slice(0, 2) });
    expect(result.ok).toBe(false);
    expect(check(result, 'reaches-last-section').ok).toBe(false);
  });

  it('fails a paper carrying the app shell, and names what it found', () => {
    const result = judgePaper({ ...base, words: [...words, word(1, 'Outline')] });
    expect(check(result, 'no-app-shell')).toMatchObject({ ok: false });
    expect(check(result, 'no-app-shell').detail).toContain('Outline');
  });

  // TASK-36: the tail is there and the right-hand columns are not, which
  // `reaches-last-section` alone passes.
  it('fails a paper whose wide table lost its right-hand column, and names the values', () => {
    const lost = words.filter((w) => w.text !== 'EDGEC' && w.text !== 'EDGEH');
    const result = judgePaper({ ...base, words: lost });
    expect(check(result, 'reaches-last-section').ok).toBe(true);
    expect(check(result, 'wide-table-in-full').ok).toBe(false);
    expect(check(result, 'wide-table-in-full').detail).toContain('EDGEC, EDGEH');
  });

  // The other way an engine can lose a column: the text is written, but where
  // the paper is not.
  it('fails a paper with a word past the right edge even when every value is in the text', () => {
    const spilled = [...words, word(3, 'agencies', { x0: 590, x1: 640, pageWidth: 595 })];
    const result = judgePaper({ ...base, words: spilled });
    expect(check(result, 'wide-table-in-full').ok).toBe(false);
    expect(check(result, 'wide-table-in-full').detail).toContain('agencies@640.0/595');
  });

  // A squeezed column may wrap a value mid-word; that is the fix working.
  it('reads a value wrapped across two lines as present', () => {
    const wrapped = words.flatMap((w) =>
      w.text === 'EDGEA'
        ? [
            { ...w, text: 'EDG' },
            { ...w, text: 'EA', y0: 12, y1: 22 },
          ]
        : [w],
    );
    expect(check(judgePaper({ ...base, words: wrapped }), 'wide-table-in-full').ok).toBe(true);
  });

  // What macOS actually wrote: one letter per line, and the text layer putting
  // each line's other cells between them.
  it('reads a value wrapped one letter per line, interleaved with other cells, as present', () => {
    const letters = [...'EDGEA'].map((letter, line) =>
      word(3, letter, { x0: 525.6, x1: 532, y0: 600 + line * 22, y1: 615 + line * 22, pageWidth: 595 }),
    );
    const others = [0, 1, 2, 3, 4].map((line) => word(3, `cell${line}`, { x0: 154, x1: 170, y0: 600 + line * 22 }));
    const interleaved = letters.flatMap((letter, line) => [others[line], letter]);
    const rest = words.filter((w) => w.text !== 'EDGEA');
    expect(check(judgePaper({ ...base, words: [...rest, ...interleaved] }), 'wide-table-in-full').ok).toBe(true);
  });

  // The 0.847 shrink this instrument was written for.
  it('fails a paper whose type is scaled', () => {
    const scaled = [word(1, '§1'), word(2, 'body', { y0: 0, y1: 15.7 }), ...edge, word(3, '13. 最後の節')];
    expect(check(judgePaper({ ...base, words: scaled }), 'scale').ok).toBe(false);
  });

  it('accepts drift inside the tolerance, since fonts differ between machines', () => {
    const nudged = [word(1, '§1'), word(2, 'body', { y0: 0, y1: 18.0 }), ...edge, word(3, '13. 最後の節')];
    expect(check(judgePaper({ ...base, words: nudged }), 'scale').ok).toBe(true);
  });

  /* A platform's first run is what produces its baseline, and only after a person
     has opened that paper — so no baseline records the number and passes. */
  it('records the size without failing where the platform has no baseline', () => {
    const result = judgePaper({ ...base, os: 'linux', key: 'ci-linux', baseline: {} });
    expect(result.ok).toBe(true);
    expect(check(result, 'scale')).toMatchObject({ skipped: true });
    expect(check(result, 'scale').detail).toContain('no baseline for ci-linux');
  });

  // The 318 MB of blank pages that started this, stopped by a number.
  it('fails a runaway file', () => {
    const result = judgePaper({ ...base, bytes: 333_815_808 });
    expect(check(result, 'file-size').ok).toBe(false);
  });

  it('checks WebView2 chrome on Windows only', () => {
    const withChrome = [...words, word(1, '1/12')];
    expect(
      judgePaper({ ...base, words: withChrome, baseline: {} }).checks.some((c) => c.id === 'no-webview2-chrome'),
    ).toBe(false);
    const windows = judgePaper({ ...base, os: 'windows', key: 'ci-windows', words: withChrome, baseline: {} });
    expect(check(windows, 'no-webview2-chrome').ok).toBe(false);
  });

  it('keeps page count as a record rather than a check, since fonts paginate differently', () => {
    const result = judgePaper({ ...base, pages: 12 });
    expect(result.ok).toBe(true);
    expect(result.records.pages).toBe(12);
  });
});

/* The finding this keying exists for: a baseline taken on a laptop was being
   applied to a CI runner, whose fonts measure the same document at 21.00. Against
   18.56 the 0.847 shrink measures 17.79 — 4.2% off, inside the tolerance — so the
   wrong baseline would have passed the exact defect the check is for. */
describe('a baseline belongs to the environment that produced it', () => {
  const words = (height) => [
    { page: 1, text: '§1', x0: 0, y0: 0, x1: 10, y1: 10 },
    { page: 2, text: 'body', x0: 0, y0: 0, x1: 10, y1: height },
    { page: 3, text: '13. 最後の節', x0: 0, y0: 0, x1: 10, y1: 10 },
  ];
  const paper = (height, key, baseline) =>
    judgePaper({
      os: 'macos',
      key,
      bytes: 1000,
      maxBytes: 10 * 1024 * 1024,
      pages: 14,
      pageSize: 'A4',
      words: words(height),
      baseline,
    });
  const scaleOf = (result) => result.checks.find((check) => check.id === 'scale');

  it('passes the runner’s own good paper and fails its shrunk one', () => {
    const runner = { 'ci-macos': { medianWordHeight: 21.0 } };
    expect(scaleOf(paper(21.0, 'ci-macos', runner)).ok).toBe(true);
    expect(scaleOf(paper(21.0 * 0.847, 'ci-macos', runner)).ok).toBe(false);
  });

  it('does not reach for another environment’s number', () => {
    const laptopOnly = { macos: { medianWordHeight: 18.56 } };
    expect(scaleOf(paper(21.0, 'ci-macos', laptopOnly))).toMatchObject({ skipped: true });
  });
});

/* Bootstrap has to end. With no `ci-*` entries the scale check skips on every
   runner, which is right for the first paper and wrong forever after: review
   pointed out that a 0.847 regression passes while it lasts. */
describe('a required baseline cannot be skipped', () => {
  const paper = (baseline, key = 'ci-macos') =>
    judgePaper({
      os: 'macos',
      key,
      bytes: 1000,
      maxBytes: 10 * 1024 * 1024,
      pages: 14,
      pageSize: 'A4',
      words: [
        { page: 1, text: '§1', x0: 0, y0: 0, x1: 10, y1: 10 },
        { page: 2, text: 'body', x0: 0, y0: 0, x1: 10, y1: 21 },
        ...WIDE_TABLE_EDGE_MARKERS.map((text) => ({ page: 3, text, x0: 0, y0: 0, x1: 10, y1: 10 })),
        { page: 3, text: '13. 最後の節', x0: 0, y0: 0, x1: 10, y1: 10 },
      ],
      baseline,
    });
  const scaleOf = (result) => result.checks.find((check) => check.id === 'scale');

  it('fails when the key is required and absent', () => {
    const result = paper({ _required: ['ci-macos'] });
    expect(result.ok).toBe(false);
    expect(scaleOf(result).detail).toContain('listed as required');
  });

  // Before a person has accepted that environment's first paper there is nothing
  // to compare against, so this skips — but it must say what is not being checked.
  it('skips loudly when the key is not required yet', () => {
    const result = paper({ _required: [] });
    expect(result.ok).toBe(true);
    expect(scaleOf(result)).toMatchObject({ skipped: true });
    expect(scaleOf(result).detail).toContain('NOT CHECKED');
  });

  it('checks normally once the key has both an entry and a requirement', () => {
    const result = paper({ _required: ['ci-macos'], 'ci-macos': { medianWordHeight: 21.0 } });
    expect(scaleOf(result).ok).toBe(true);
    expect(scaleOf(result).skipped).toBeFalsy();
    expect(scaleOf(result).detail).toContain('baseline 21.00');
  });
});
