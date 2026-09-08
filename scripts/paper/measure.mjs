// The part of the paper measurement that has no I/O, so `pnpm test` can hold it.
//
// What it measures is procedure.md §3's list minus the half a machine cannot
// judge: whether the type is comfortable to read, and how a table that straddles
// a page break actually looks, stay with the person who opens the PDF. What is
// here is what a number can settle — the document reached its end, the app shell
// is absent, the type is the size it was the last time a human called the paper
// right, and the file is not the runaway that started this.

/** The UI strings that prove the app shell reached the paper.
 *
 *  **Three obvious ones are missing on purpose**: `プレビュー`, `エクスプローラ`
 *  and `設定` all appear in the fixture's own prose, so they would report a shell
 *  that is not there. `assertMarkersAreAbsentFromFixture` is what keeps that from
 *  happening again silently when either side changes — a marker that the document
 *  itself carries is a broken instrument, not a failing paper.
 *
 *  Both languages are listed because the shell follows the reader's locale and a
 *  CI runner's is not this machine's. */
export const SHELL_MARKERS = [
  'テーマを選択',
  'Select theme',
  'ソース',
  'Preview',
  'Source',
  'アウトライン',
  'Outline',
  'Explorer',
  'Settings',
  'フォルダを開く',
  'Open Folder',
];

/** The fixture's own last-page marker. `最後の節` rather than the whole heading
 *  because the glyphs a PDF gives back are not always the ones the source wrote:
 *  pdftotext returns `本⽂` (U+2F02, the Kangxi radical) for this document's
 *  `本文`, so a longer needle would fail on a paper that is perfectly fine. */
export const LAST_SECTION_MARKER = '最後の節';

/** Words as `pdftotext -bbox` reports them, with the page they sit on.
 *
 *  The XML is read with a scanner rather than a parser because poppler's output
 *  is machine-written and flat — `<page>` elements holding `<word>` elements —
 *  and an XML dependency for that would be the only dependency this script has. */
export function parseBboxWords(xml) {
  const words = [];
  let page = 0;
  const token =
    /<page\b[^>]*>|<word xMin="([\d.-]+)" yMin="([\d.-]+)" xMax="([\d.-]+)" yMax="([\d.-]+)"[^>]*>([^<]*)<\/word>/g;
  for (const match of xml.matchAll(token)) {
    if (match[0].startsWith('<page')) {
      page += 1;
      continue;
    }
    words.push({
      page,
      text: decodeEntities(match[5]),
      x0: Number(match[1]),
      y0: Number(match[2]),
      x1: Number(match[3]),
      y1: Number(match[4]),
    });
  }
  return words;
}

function decodeEntities(text) {
  return text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

/** The type size, read off the paper rather than computed from the CSS.
 *
 *  A median over one page rather than a mean over the document: headings and code
 *  pull a mean around, and which page carries them depends on where the breaks
 *  fell. Page 2 is the sample because page 1 of this fixture is title matter. */
export function medianWordHeight(words, page) {
  const heights = words
    .filter((word) => word.page === page)
    .map((word) => word.y1 - word.y0)
    .sort((a, b) => a - b);
  if (heights.length === 0) {
    return null;
  }
  return heights[Math.floor(heights.length / 2)];
}

/** Where the text block starts and ends across the page, which is what a margin
 *  looks like from the PDF's side. */
export function textExtentX(words, page) {
  const onPage = words.filter((word) => word.page === page);
  if (onPage.length === 0) {
    return null;
  }
  return { min: Math.min(...onPage.map((w) => w.x0)), max: Math.max(...onPage.map((w) => w.x1)) };
}

/** Which of `needles` the paper carries. */
export function markersPresent(text, needles) {
  return needles.filter((needle) => text.includes(needle));
}

/** WebView2 prints its own header and footer, which the reader can switch off and
 *  CSS cannot — so their absence is a Windows-only judgement rather than a
 *  universal one.
 *
 *  **A date is deliberately not looked for.** The fixture carries dates of its
 *  own, so a date detector would report the header on a clean paper. The URL and
 *  the page number are enough, and the page number is matched as a whole word:
 *  the fixture contains tokens like `m3/3o`, which a substring match would call a
 *  page number. */
export function webView2ChromeFound(words) {
  const found = [];
  const text = words.map((word) => word.text).join(' ');
  for (const url of ['file:///', 'tauri://', 'http://asset.localhost']) {
    if (text.includes(url)) {
      found.push(url);
    }
  }
  const pageNumber = words.find((word) => /^\d{1,3}\/\d{1,3}$/.test(word.text));
  if (pageNumber) {
    found.push(`page number ${pageNumber.text}`);
  }
  return found;
}

/** How far the type may drift from the size a human last called correct **on the
 *  same machine**.
 *
 *  **A baseline belongs to the environment that produced it, and the first
 *  version of this file did not say so.** It carried one number for macOS, taken
 *  from a laptop, and the CI runner's fonts make the same document measure 21.00
 *  against that 18.56. Review did the arithmetic that matters: the 0.847 shrink
 *  this task chased would measure 17.79 on that runner, which is 4.2% from 18.56
 *  — inside this tolerance. **A baseline from the wrong machine does not merely
 *  fail good paper; it passes the exact defect the check exists for.** So the key
 *  names the environment, not the platform.
 *
 *  5% is then wide enough that nothing but a real scale change moves it, and
 *  narrow enough that 0.847 cannot hide: against its own environment's baseline
 *  that shrink is 15% off. */
export const SCALE_TOLERANCE = 0.05;

/** The judgement itself: which checks failed, and what to record either way.
 *
 *  **Page count is a record, not a check.** 12 and 14 are this machine's fonts;
 *  a runner with different Japanese fonts paginates differently and a check on it
 *  would go red for a paper that is perfectly good.
 *
 *  A missing baseline is not a failure either — the first run on a platform is
 *  the run that produces one, and a person has to look at that paper before its
 *  number means anything. */
export function judgePaper({ os, key, bytes, maxBytes, pages, pageSize, words, baseline }) {
  const text = words.map((word) => word.text).join('');
  const spaced = words.map((word) => word.text).join(' ');
  const height = medianWordHeight(words, 2);
  const expected = baseline?.[key]?.medianWordHeight ?? null;
  const shell = markersPresent(spaced, SHELL_MARKERS);

  const checks = [
    {
      id: 'reaches-last-section',
      ok: text.includes(LAST_SECTION_MARKER),
      detail: `${LAST_SECTION_MARKER} ${text.includes(LAST_SECTION_MARKER) ? 'present' : 'MISSING — the tail was cut'}`,
    },
    {
      id: 'no-app-shell',
      ok: shell.length === 0,
      detail: shell.length === 0 ? 'no shell strings' : `shell strings on the paper: ${shell.join(', ')}`,
    },
    {
      id: 'file-size',
      ok: bytes <= maxBytes,
      detail: `${bytes} bytes (cap ${maxBytes})`,
    },
  ];

  if (expected === null) {
    checks.push({
      id: 'scale',
      ok: true,
      skipped: true,
      detail: `no baseline for ${key} yet — recorded ${fmt(height)}, and a person has to call this paper right before it becomes one`,
    });
  } else {
    const drift = height === null ? null : Math.abs(height - expected) / expected;
    checks.push({
      id: 'scale',
      ok: drift !== null && drift <= SCALE_TOLERANCE,
      detail:
        height === null
          ? 'no words on page 2 to measure'
          : `median word height ${fmt(height)} vs baseline ${fmt(expected)} (${(drift * 100).toFixed(1)}% off, tolerance ${SCALE_TOLERANCE * 100}%)`,
    });
  }

  if (os === 'windows') {
    const chrome = webView2ChromeFound(words);
    checks.push({
      id: 'no-webview2-chrome',
      ok: chrome.length === 0,
      detail: chrome.length === 0 ? 'no WebView2 header or footer' : `WebView2 header/footer: ${chrome.join(', ')}`,
    });
  }

  return {
    ok: checks.every((check) => check.ok),
    checks,
    records: {
      pages,
      pageSize,
      medianWordHeight: height,
      textExtentX: textExtentX(words, 2),
      wordsOnPage2: words.filter((word) => word.page === 2).length,
      bytes,
    },
  };
}

function fmt(value) {
  return value === null ? 'n/a' : value.toFixed(2);
}

/** The instrument checking itself before it measures: a marker that appears in
 *  the document under test would report a shell that never reached the paper. */
export function assertMarkersAreAbsentFromFixture(fixtureText) {
  const collisions = markersPresent(fixtureText, SHELL_MARKERS);
  if (collisions.length > 0) {
    throw new Error(
      `these shell markers appear in the fixture itself, so they cannot prove anything: ${collisions.join(', ')}`,
    );
  }
}
