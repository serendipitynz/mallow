/**
 * The HTML rendered view's markup transform and its render ceiling (decision-3,
 * amended by decision-9).
 *
 * What a document is allowed to keep is decided here rather than by a sanitizer:
 * the sandbox flags and the inherited CSP hold script containment, so this
 * removes only what would otherwise escape the *network* boundary or redirect
 * every relative reference, and rewrites local media so it resolves at all.
 *
 * The parse stays at the component boundary (`HtmlView` owns the `DOMParser`
 * call), and everything the ceiling and the URL rules rest on is a pure function
 * over strings or over {@link DocNodeLike} — the structural subset a real DOM
 * node satisfies and a test can write as an object literal. That is doc-1's
 * rule, and it is what makes these testable under Node. It is also all it makes
 * testable: the mutate-and-serialize half below runs against a real DOM, so
 * browser normalisation of malformed markup is checked in the probe's
 * transform section, in a built app.
 */

import { resolvePath } from './path';

/**
 * Elements the rendered view will build at most, above which the document goes
 * to the capped source view instead (decision-6 made that a safe floor).
 *
 * Measured over 4,290 `.html` / `.htm` files on one working machine: the median
 * document holds 58 elements, the 99.9th percentile 7,371, and the largest —
 * 2.8 MB carrying 346 inline SVGs — 19,041. So this clears every document in the
 * corpus by better than 1.5×, and no file in it falls back. The margin is
 * deliberately modest rather than generous, because the two errors are not
 * symmetric in the usual direction: too high stalls the WebView, which freezes
 * the whole app since the frame lays out on the same thread, while too low costs
 * the rendering of a document the reader can still read as source.
 */
export const RENDER_MAX_ELEMENTS = 30_000;
/**
 * Characters of rendered text the view will build at most.
 *
 * The element count bounds how many boxes exist, not how much text one holds:
 * the same corpus has a 16-element document carrying 0.8 MB of text and a
 * 19,041-element one carrying 65 KB, so neither number bounds the other. The
 * largest rendered text observed was 688,981 characters. Text the engine never
 * lays out is excluded, as it was from the measurement.
 */
export const RENDER_MAX_TEXT_CHARS = 1_000_000;

/** Which ceiling a document exceeded. The UI does not word these apart; both say
 *  the document is too large to render and offer the source view. */
export type RenderSkipReason = 'elements' | 'text';

export interface HtmlCounts {
  elements: number;
  /** Characters of text the engine lays out; see {@link RENDER_MAX_TEXT_CHARS}. */
  textChars: number;
  /** `<script>` elements, all of them inert (sandbox, and mostly the CSP too). */
  scripts: number;
  /** `<a href>` and `<area href>` elements that do nothing wherever the frame
   *  runs no parent-registered listener — **the two classes whose fate is
   *  settled, and only those**: an app-origin href, which no longer reaches a
   *  destination there (decision-10, and a bare fragment is one of them, so the
   *  document's own table of contents is counted), and an `http(s)` one, which
   *  `frame-src` refuses (decision-9). Widening it past those would make the
   *  notice bar's number larger than what it can account for.
   *
   *  **`mailto:` and `tel:` are therefore excluded**: neither argument reaches
   *  them. TASK-23 has since measured them — a sandboxed frame hands an
   *  external-protocol scheme to no OS application on any of the three WebViews —
   *  so what keeps them out is now a policy question (whether a link that does
   *  nothing belongs in a count about links doing nothing), and the policy is
   *  decision-10's to take rather than this contract's.
   *
   *  **`<area href>` is in the count as of TASK-25, and by a different
   *  settlement than the `<a>` beside it.** Its app-origin href is removed here
   *  rather than neutralized in the frame — see
   *  {@link neutralizeAppOriginAreas} — so the region navigates nowhere on any
   *  engine, which is what makes it countable; before that it navigated on all
   *  three (TASK-23 AC #3). An `http(s)` one is settled by the argument the
   *  `<a>` case rests on, since `frame-src` answers for the destination and not
   *  for the element that asked. */
  links: number;
  /** References the CSP refuses, so the document does not get them: a remote
   *  stylesheet or script, a `data:` or protocol-relative one in the same place,
   *  and remote media on the attributes `media-src` answers for.
   *
   *  **A remote image is deliberately not in this count**, because it arrives:
   *  `img-src` carries `https:` / `http:` / `data:`, which decision-3 accepts as
   *  the same exposure the markdown view already has. **A remote video is, and
   *  that asymmetry is the whole reason {@link RefSite} exists** — `media-src` is
   *  `'self' asset:` only, so the same URL on `video src` is refused exactly as
   *  one on `script src` is. Counting an arrival and a refusal behind one number
   *  leaves the notice bar unable to be right about either. */
  blockedRefs: number;
  /** References to local files this transform deliberately did not rewrite — a
   *  relative stylesheet or script, and a document-absolute path anywhere.
   *  Rewriting a stylesheet would need `asset:` in `style-src`, a CSP change
   *  decision-3 rules out. Counted so the notice bar can say the document is
   *  unstyled on purpose rather than by a fault in mallow.
   *
   *  **Fonts are not in this count.** A web font is reached through `url()`
   *  inside CSS, and no CSS is parsed here — so a document whose fonts do not
   *  load is covered by the stylesheet that would have named them, and not
   *  otherwise. */
  unresolvedLocalRefs: number;
  /** Nested `<iframe>` / `<frame>` elements removed. */
  removedFrames: number;
}

export interface HtmlTransform {
  /** The `srcdoc` document, or `null` when {@link HtmlTransform.skipped} says the
   *  ceiling was exceeded — nothing is serialized in that case. */
  html: string | null;
  skipped: RenderSkipReason | null;
  counts: HtmlCounts;
  /** The document's `<title>`, which `HtmlView` reports up to `Viewer` for the
   *  native window title — read here so nothing parses the document a second time.
   *  `null` when it has none. */
  title: string | null;
  /** Whether the source document declared a doctype. The serialized output
   *  always carries `<!DOCTYPE html>` regardless: quirks mode changes which
   *  element reports the scroll height, which would silently corrupt TASK-5.2's
   *  measurement, so standards mode is not the document's to choose. */
  hadDoctype: boolean;
}

/** The part of a DOM node the counting walk reads. Mirrors `lib/xml-tree`'s
 *  `DomNodeLike` for the same reason and is deliberately not shared with it:
 *  neither module should have to import the other's model to describe a DOM. */
export interface DocNodeLike {
  nodeType: number;
  nodeName: string;
  nodeValue: string | null;
  childNodes: ArrayLike<DocNodeLike>;
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;

/** Elements whose text is markup for the engine, never a box on screen. */
const UNRENDERED_TEXT = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'TITLE']);

export function countDocument(root: DocNodeLike): { elements: number; textChars: number } {
  let elements = 0;
  let textChars = 0;
  // Iterative, because nesting depth is the document's to choose.
  const stack: DocNodeLike[] = [root];
  while (stack.length > 0) {
    const node = stack.pop() as DocNodeLike;
    if (node.nodeType === ELEMENT_NODE) {
      elements += 1;
    } else if (node.nodeType === TEXT_NODE || node.nodeType === CDATA_SECTION_NODE) {
      // Trimmed, so a whitespace-only node between two tags counts as nothing:
      // collapsed whitespace lays out no glyphs, and the corpus this cap was
      // measured against was counted the same way.
      textChars += node.nodeValue?.trim().length ?? 0;
    }
    if (node.nodeType === ELEMENT_NODE && UNRENDERED_TEXT.has(node.nodeName.toUpperCase())) {
      continue;
    }
    for (let i = 0; i < node.childNodes.length; i += 1) {
      stack.push(node.childNodes[i]);
    }
  }
  return { elements, textChars };
}

export function renderSkipReason(counts: { elements: number; textChars: number }): RenderSkipReason | null {
  if (counts.elements > RENDER_MAX_ELEMENTS) {
    return 'elements';
  }
  if (counts.textChars > RENDER_MAX_TEXT_CHARS) {
    return 'text';
  }
  return null;
}

/**
 * What a URL-bearing attribute value is, for the one decision this transform
 * makes about it.
 *
 * - `untouched` — it already resolves, or resolves to nothing: a `data:`,
 *   `http(s)`, `blob:` or any other explicit scheme, a protocol-relative
 *   `//host/…`, a bare `#fragment`, an empty value.
 * - `external` — an `http(s)` URL. A subset of `untouched` for rewriting
 *   purposes, separated because whether it loads depends on where it sits:
 *   fetched under `img-src`, refused under `media-src` and on the attributes
 *   nothing rewrites (see {@link RefSite}).
 * - `local` — a document-relative path, the only kind rewritten to an `asset:` URL.
 * - `unresolvable` — a document-absolute `/x.png`. Left alone deliberately: the
 *   viewer knows the document's own directory, not the folder the user opened,
 *   and resolving one against the filesystem root would point outside the
 *   asset-protocol grant. Counted instead, so the notice bar can say so.
 */
export type RefKind = 'untouched' | 'external' | 'local' | 'unresolvable';

const SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export function classifyRef(value: string): RefKind {
  const ref = value.trim();
  if (ref === '' || ref.startsWith('#')) {
    return 'untouched';
  }
  if (ref.startsWith('//')) {
    return 'untouched';
  }
  if (SCHEME.test(ref)) {
    return /^https?:/i.test(ref) ? 'external' : 'untouched';
  }
  return ref.startsWith('/') ? 'unresolvable' : 'local';
}

/**
 * Where a reference sits, which is what decides whether it arrives.
 *
 * - `imgSrc` — an attribute this transform rewrites that is fetched under
 *   `img-src`, which carries `https:`, `http:` and `data:`. A remote or embedded
 *   image arrives, so nothing was lost. **A reference this site does not count is
 *   not the same as one that loads**: a protocol-relative `//host/x.png` resolves
 *   against the parent's base URL, so it becomes `tauri://host/x.png` on macOS
 *   and Linux — refused — and `http://host/x.png` on Windows, which `img-src`
 *   carries. Nothing this module can read says which, and a count that has to be
 *   wrong on one platform is worse here than one that is silent: a refused image
 *   announces itself as a broken image, which is not the unexplained-fault case
 *   the notice bar exists for. TASK-23's round is where it gets measured.
 * - `mediaSrc` — an attribute this transform rewrites that is fetched under
 *   `media-src`, which carries none of them: `'self' asset:` and nothing else. A
 *   remote video is refused exactly as a remote script is. **The two rewritten
 *   sites are not interchangeable**, which is why they are named apart rather
 *   than folded into "the transform rewrites this".
 * - `unrewritten` — an attribute left as written: `<link rel=…>` and
 *   `<script src>`. A relative path there resolves against the app's own URL and
 *   404s; anything carrying a scheme or a host is refused, since `style-src` is
 *   `'self' 'unsafe-inline'` and `script-src` is `'self' 'wasm-unsafe-eval'`.
 */
export type RefSite = 'imgSrc' | 'mediaSrc' | 'unrewritten';

/** Which count a reference falls into, or `null` when the reader lost nothing by
 *  it — it was rewritten and resolves, it arrives as written, or it addresses
 *  nothing to fetch. */
export type RefTally = 'blocked' | 'unresolvedLocal' | null;

/**
 * What one reference costs the reader, given where it sits.
 *
 * Split out as a pure function because the answer reverses between sites for the
 * same value: `https://x/a.mp4` arrives on `img src` and is refused on `video
 * src`, and `./a.css` is rewritten on a media attribute and lost on `<link>`.
 * A single rule over the value alone was wrong about one of the two, whichever
 * way it was written.
 */
export function refTally(value: string, site: RefSite): RefTally {
  const kind = classifyRef(value);
  if (kind === 'unresolvable') {
    return 'unresolvedLocal';
  }
  if (kind === 'local') {
    return site === 'unrewritten' ? 'unresolvedLocal' : null;
  }
  if (site === 'imgSrc') {
    return null;
  }
  // An empty value or a bare fragment addresses nothing to fetch, so no site
  // loses anything by it.
  const ref = value.trim();
  return ref === '' || ref.startsWith('#') ? null : 'blocked';
}

/**
 * Whether following this href would navigate the frame to a URL in the app's own
 * origin.
 *
 * **A bare fragment is one of them**, which is the part that surprises. A
 * `srcdoc` document's base URL is the *parent's* document URL, so `#section`
 * resolves to the app's own URL plus a fragment — a different document, not a
 * same-document link — and `frame-src 'self'` permits loading it. So does a
 * relative or root-absolute path. What follows is the app shell rendered inside
 * the sandboxed frame with its scripts refused, which is a blank page the reader
 * has no way back from (decision-10).
 *
 * An explicit scheme is excluded because it resolves somewhere else and the CSP
 * is what answers for it: `http(s)` is not in `frame-src` and does not load,
 * which is the inertness decision-9 accepted. A protocol-relative `//host/x`
 * inherits `tauri:` but not the host, so it is not `'self'` either.
 */
export function navigatesAppOrigin(value: string): boolean {
  const ref = value.trim();
  if (ref.startsWith('//')) {
    return false;
  }
  return !SCHEME.test(ref);
}

/**
 * Make every app-origin `<a href>` in `root` visible but inert, by suppressing
 * hit-testing on it and taking it out of the tab order.
 *
 * For the branch where the frame runs no parent-registered listener, so nothing
 * can `preventDefault` a click. `pointer-events` rather than removing the
 * `href`: the click never reaches the anchor, so nothing activates, while
 * `:link` still matches and the document keeps the styling its author gave it.
 * An `http(s)` link is left alone — `frame-src` does not carry it, which is the
 * inertness decision-9 accepted.
 *
 * Both writes are needed. `pointer-events` suppresses hit-testing and nothing
 * else, so without the second a reader who tabs to the link and presses Enter
 * gets the navigation this exists to remove. Overwriting a `tabindex` the
 * document set changes an order that only reaches a link which no longer does
 * anything.
 *
 * **`<area href>` is not selected here, and that is measured rather than
 * assumed.** decision-10 wrote both attributes on it too; TASK-23 clicked one
 * for real on all three WebViews with this pass applied and the frame navigated
 * anyway: `pointer-events: none` on an `<area>` does not stop the click that
 * activates it. Why is not settled here — the region is hit-tested through the
 * `<img usemap>` it sits on, but the click event does reach the area on WebView2
 * (see {@link neutralizeAppOriginAreas}), so "the area does not own the region"
 * is a story and the measurement is the fact. {@link neutralizeAppOriginAreas}
 * settles that case instead, before this branch is chosen — so leaving
 * `area[href]` in this selector would be a branch nothing reaches carrying a
 * claim that was false while it did.
 */
export function neutralizeAppOriginLinks(root: ParentNode): void {
  for (const anchor of root.querySelectorAll<HTMLElement>('a[href]')) {
    if (navigatesAppOrigin(anchor.getAttribute('href') ?? '')) {
      anchor.style.pointerEvents = 'none';
      anchor.setAttribute('tabindex', '-1');
    }
  }
}

/**
 * Stop every app-origin `<area href>` in `root` being a link at all, by removing
 * the `href` and taking it out of the tab order.
 *
 * **Applied before the branch on parent-registered listeners, not inside one**
 * (TASK-25). An image map reaches the same navigation by a different route on
 * each: where no listener runs, `pointer-events: none` does not close it, and
 * where one does, `HtmlView`'s handler matches `a[href]`, which an `<area>` is
 * not. One pass ahead of the branch is what leaves both with the same document,
 * and it is also what lets the probe's neutralized arm measure the shipped
 * mechanism on every engine rather than the one branch that engine happens to
 * take.
 *
 * **Removing the `href` costs here what decision-10 refused to pay for an
 * `<a>`.** There it would have cost the document its link styling, since `:link`
 * stops matching. An `<area>` has no box of its own, so nothing about it is
 * styled and nothing is lost; and with no `href` it is not a hyperlink, so
 * activating it has nothing to follow.
 *
 * **It is the activation that goes, not the click** — measured, because the
 * obvious reading is the wrong one. On WebView2 the click still reaches the
 * `<area>` itself after this pass: the probe's counter recorded it as
 * `area-link (not a link)`, twice, against no navigation. The region still
 * hit-tests; what is gone is the hyperlink the hit used to activate.
 *
 * `tabindex="-1"` stays even though an `href`-less area is not tabbable on its
 * own: it is what closed the keyboard path on the engines where it was measured
 * (TASK-23), and this is a removal of one mechanism, not of both.
 *
 * Measured after the fix on all three WebViews (2026-08-24, built probe runs,
 * `_sandbox/handoff/task-25/task-25-{mac,win,linux}.md`): armed raw the region
 * navigated the frame to the area's own destination on each, and armed with this
 * pass the frame stayed on `about:srcdoc` with no `area[href]` left.
 */
export function neutralizeAppOriginAreas(root: ParentNode): void {
  for (const area of root.querySelectorAll<HTMLElement>('area[href]')) {
    if (navigatesAppOrigin(area.getAttribute('href') ?? '')) {
      area.removeAttribute('href');
      area.setAttribute('tabindex', '-1');
    }
  }
}

/**
 * Split a `srcset` into its candidates.
 *
 * The list is comma-separated, but a comma may also sit inside a URL — and a
 * candidate's descriptor (`2x`, `320w`) is separated from its URL by whitespace.
 * So the split is on a comma that follows whitespace-terminated URL text, which
 * is what the HTML parsing rules for this attribute amount to: read the URL up
 * to whitespace, then read the descriptor up to a comma.
 */
export function parseSrcset(value: string): { url: string; descriptor: string }[] {
  const candidates: { url: string; descriptor: string }[] = [];
  let i = 0;
  while (i < value.length) {
    while (i < value.length && (/\s/.test(value[i]) || value[i] === ',')) {
      i += 1;
    }
    const start = i;
    while (i < value.length && !/\s/.test(value[i])) {
      i += 1;
    }
    if (i === start) {
      break;
    }
    // A trailing comma belongs to the list, not to the URL — but a comma inside
    // the URL, with no whitespace after it, does.
    let url = value.slice(start, i);
    let trailingComma = false;
    while (url.endsWith(',')) {
      url = url.slice(0, -1);
      trailingComma = true;
    }
    let descriptor = '';
    if (!trailingComma) {
      const rest = value.indexOf(',', i);
      const end = rest === -1 ? value.length : rest;
      descriptor = value.slice(i, end).trim();
      i = end + 1;
    }
    if (url !== '') {
      candidates.push({ url, descriptor });
    }
  }
  return candidates;
}

export function serializeSrcset(candidates: { url: string; descriptor: string }[]): string {
  return candidates.map((c) => (c.descriptor === '' ? c.url : `${c.url} ${c.descriptor}`)).join(', ');
}

/** How a reference is turned into something the frame can load, and what the
 *  caller learns about the ones that are not. */
export interface RefResolver {
  /** Directory the document sits in; relative references resolve against it. */
  dir: string;
  /** `convertFileSrc`, injected so this module imports no Tauri API. */
  toAssetUrl: (path: string) => string;
}

/** The rewritten value for one reference, or `null` when it is left as written. */
export function rewriteRef(value: string, resolver: RefResolver): string | null {
  if (classifyRef(value) !== 'local') {
    return null;
  }
  const ref = value.trim();
  // A query or fragment addresses something inside the file, which the asset
  // protocol has no notion of; the path is what identifies the file on disk.
  const path = ref.replace(/[?#].*$/, '');
  if (path === '') {
    return null;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // A stray `%` is not an escape; the name on disk is then the literal text.
    decoded = path;
  }
  return resolver.toAssetUrl(resolvePath(resolver.dir, decoded));
}

/** Attributes rewritten to `asset:` URLs, per element.
 *
 *  `<audio src>` is here even though decision-3's list omits it: `<audio>` with a
 *  nested `<source>` was already covered, and leaving the shorthand form out
 *  would have been an asymmetry with no reason a reader could reconstruct.
 *
 *  Deliberately absent, and stated rather than left to be discovered: `<track
 *  src>`, `<input type=image src>`, inline SVG `<image>` / `<use>` `href`,
 *  relative `url()` inside CSS, and relative `<link rel=stylesheet>` / local
 *  fonts — the last two because rewriting them would need `asset:` in
 *  `style-src` / `font-src`, a CSP change decision-3 rules out. */
const REWRITTEN: { selector: string; attributes: { name: string; site: RefSite | 'fromParent' }[] }[] = [
  {
    selector: 'img',
    attributes: [
      { name: 'src', site: 'imgSrc' },
      { name: 'srcset', site: 'imgSrc' },
    ],
  },
  // `srcset` on a `<source>` is a `<picture>` candidate whatever the parent, so
  // only `src` has to ask.
  {
    selector: 'source',
    attributes: [
      { name: 'src', site: 'fromParent' },
      { name: 'srcset', site: 'imgSrc' },
    ],
  },
  {
    selector: 'video',
    attributes: [
      { name: 'src', site: 'mediaSrc' },
      { name: 'poster', site: 'imgSrc' },
    ],
  },
  { selector: 'audio', attributes: [{ name: 'src', site: 'mediaSrc' }] },
];

/** A `<source src>` is fetched under whichever directive answers for its parent,
 *  so the parent decides. An unrecognized parent is read as `imgSrc`, which
 *  claims nothing was blocked: understating beats asserting a refusal for markup
 *  the parser may never fetch at all. */
function siteOf(element: Element, declared: RefSite | 'fromParent'): RefSite {
  if (declared !== 'fromParent') {
    return declared;
  }
  const parent = element.parentElement?.tagName.toLowerCase();
  return parent === 'video' || parent === 'audio' ? 'mediaSrc' : 'imgSrc';
}

/** `rel` values whose `<link>` fetches something. `rel="canonical"` and friends
 *  are not counted, because nothing is fetched for them and a count that
 *  included them would overstate what the document lost. */
const FETCHING_REL = new Set(['stylesheet', 'preload', 'prefetch', 'icon', 'apple-touch-icon', 'manifest']);

function emptyCounts(): HtmlCounts {
  return {
    elements: 0,
    textChars: 0,
    scripts: 0,
    links: 0,
    blockedRefs: 0,
    unresolvedLocalRefs: 0,
    removedFrames: 0,
  };
}

/**
 * Parse-mutate-serialize, in the one order that holds: count first and stop
 * before the mutation when the document is over the ceiling, so a document too
 * large to render is also never serialized.
 *
 * `doc` is a real `Document` — the caller's `DOMParser` output. It is not
 * connected to any window, so nothing here lays anything out; layout starts when
 * the returned string reaches `srcdoc`, which is exactly what the ceiling
 * decides about.
 */
export function transformHtmlDocument(doc: Document, resolver: RefResolver): HtmlTransform {
  const counts = emptyCounts();
  const { elements, textChars } = countDocument(doc.documentElement);
  counts.elements = elements;
  counts.textChars = textChars;
  const title = doc.title === '' ? null : doc.title;
  const hadDoctype = doc.doctype !== null;

  const skipped = renderSkipReason(counts);
  if (skipped !== null) {
    return { html: null, skipped, counts, title, hadDoctype };
  }

  counts.scripts = doc.querySelectorAll('script').length;

  // A nested frame pointed at an `asset:` URL would load a document carrying no
  // CSP of its own, so its subresource loads would sit outside both the CSP and
  // the notice bar's count (decision-3, fact 1). `<object>` / `<embed>` need no
  // handling: `object-src 'none'` already covers them.
  for (const frame of doc.querySelectorAll('iframe, frame')) {
    frame.remove();
    counts.removedFrames += 1;
  }
  // `<base>` would redirect every relative reference, including the ones
  // rewritten below.
  for (const base of doc.querySelectorAll('base')) {
    base.remove();
  }

  for (const link of doc.querySelectorAll('a[href], area[href]')) {
    // The two classes whose fate is settled: an app-origin href reaches nowhere
    // (decision-10 for an `<a>`, the pass below for an `<area>`) and an `http(s)`
    // one is refused by `frame-src` (decision-9). A `mailto:` or `tel:` href is
    // neither — measured in TASK-23 as reaching no OS application on any of the
    // three, which makes its exclusion decision-10's policy call rather than a
    // gap.
    const href = link.getAttribute('href') ?? '';
    if (navigatesAppOrigin(href) || classifyRef(href) === 'external') {
      counts.links += 1;
    }
  }
  // After the count, because it takes the href the count reads. Here rather than
  // in `HtmlView` so that both branches of decision-9's listener test get the
  // same document — see `neutralizeAppOriginAreas`.
  neutralizeAppOriginAreas(doc);

  for (const { selector, attributes } of REWRITTEN) {
    for (const element of doc.querySelectorAll(selector)) {
      for (const { name, site: declared } of attributes) {
        const value = element.getAttribute(name);
        if (value === null) {
          continue;
        }
        const site = siteOf(element, declared);
        if (name === 'srcset') {
          element.setAttribute(name, rewriteSrcsetValue(value, resolver, counts, site));
          continue;
        }
        tally(value, counts, site);
        const rewritten = rewriteRef(value, resolver);
        if (rewritten !== null) {
          element.setAttribute(name, rewritten);
        }
      }
    }
  }

  for (const link of doc.querySelectorAll('link[href]')) {
    const rels = (link.getAttribute('rel') ?? '').toLowerCase().split(/\s+/);
    if (rels.some((rel) => FETCHING_REL.has(rel))) {
      tally(link.getAttribute('href') ?? '', counts, 'unrewritten');
    }
  }
  for (const script of doc.querySelectorAll('script[src]')) {
    tally(script.getAttribute('src') ?? '', counts, 'unrewritten');
  }

  return {
    // `documentElement.outerHTML` omits the doctype, and without one the frame
    // parses in quirks mode.
    html: `<!DOCTYPE html>${doc.documentElement.outerHTML}`,
    skipped: null,
    counts,
    title,
    hadDoctype,
  };
}

/** Add one reference to whichever count {@link refTally} puts it in. */
function tally(value: string, counts: HtmlCounts, site: RefSite): void {
  const verdict = refTally(value, site);
  if (verdict === 'blocked') {
    counts.blockedRefs += 1;
  } else if (verdict === 'unresolvedLocal') {
    counts.unresolvedLocalRefs += 1;
  }
}

function rewriteSrcsetValue(value: string, resolver: RefResolver, counts: HtmlCounts, site: RefSite): string {
  return serializeSrcset(
    parseSrcset(value).map((candidate) => {
      tally(candidate.url, counts, site);
      return { url: rewriteRef(candidate.url, resolver) ?? candidate.url, descriptor: candidate.descriptor };
    }),
  );
}
