import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  assertMarkersAreAbsentFromFixture,
  judgePaper,
  markersPresent,
  medianWordHeight,
  parseBboxWords,
  SHELL_MARKERS,
  textExtentX,
  webView2ChromeFound,
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

describe('judgePaper', () => {
  const words = [word(1, '§1'), word(2, 'body', { y0: 0, y1: 18.5 }), word(3, `12. 最後の節`)];
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

  // The 0.847 shrink this instrument was written for.
  it('fails a paper whose type is scaled', () => {
    const scaled = [word(1, '§1'), word(2, 'body', { y0: 0, y1: 15.7 }), word(3, '12. 最後の節')];
    expect(check(judgePaper({ ...base, words: scaled }), 'scale').ok).toBe(false);
  });

  it('accepts drift inside the tolerance, since fonts differ between machines', () => {
    const nudged = [word(1, '§1'), word(2, 'body', { y0: 0, y1: 18.0 }), word(3, '12. 最後の節')];
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
    { page: 3, text: '12. 最後の節', x0: 0, y0: 0, x1: 10, y1: 10 },
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
        { page: 3, text: '12. 最後の節', x0: 0, y0: 0, x1: 10, y1: 10 },
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
