/** TASK-5.1's markup transform, exercised against a real DOM in a built app.
 *
 *  The pure halves of `lib/html-doc` — the URL rules, the srcset split, the
 *  counting — are unit-tested under Node. What Node cannot show is the half that
 *  matters most here: how an engine *normalises* malformed markup before the
 *  transform ever sees it, and whether removing `<base>` and nested frames from
 *  a live document actually leaves them out of what `srcdoc` receives. Both are
 *  properties of the engine, so they are measured on the engine (doc-1's
 *  corollary: a passing Node-only test is not evidence that this boundary
 *  holds).
 *
 *  This section stands apart from the TASK-7 run above it: its verdicts are
 *  evidence for TASK-5.1's acceptance criteria, not TASK-7's, and mixing the two
 *  numbering schemes in one table would make each unreadable as a record. */

import { convertFileSrc } from '@tauri-apps/api/core';
import { type HtmlTransform, RENDER_MAX_ELEMENTS, transformHtmlDocument } from '../lib/html-doc';

export interface TransformCheck {
  id: string;
  /** TASK-5.1 acceptance criteria this check is evidence for. */
  ac: number[];
  title: string;
  verdict: 'pass' | 'fail';
  detail: string;
}

/** A directory the document is pretended to sit in. Only its shape matters: the
 *  asset URLs below are produced by the real `convertFileSrc`, which is what a
 *  rewritten reference has to survive. */
const DIR = '/probe/docs';

const SANDBOX = 'allow-same-origin';
const LOAD_TIMEOUT_MS = 5000;

function transform(markup: string): HtmlTransform {
  return transformHtmlDocument(new DOMParser().parseFromString(markup, 'text/html'), {
    dir: DIR,
    toAssetUrl: convertFileSrc,
  });
}

function check(id: string, ac: number[], title: string, verdict: boolean, detail: string): TransformCheck {
  return { id, ac, title, verdict: verdict ? 'pass' : 'fail', detail };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Put a transformed document in a frame with the flags the app uses, and hand
 *  back the document the engine built from it. */
async function render(host: HTMLElement, html: string): Promise<Document> {
  host.replaceChildren();
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', SANDBOX);
  frame.className = 'probe-frame';
  frame.srcdoc = html;
  host.appendChild(frame);
  const deadline = Date.now() + LOAD_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const doc = frame.contentDocument;
    if (doc !== null && doc.getElementById('alive') !== null) {
      return doc;
    }
    await sleep(25);
  }
  throw new Error('the transformed document never reached the frame');
}

/** Markup a regex over HTML gets wrong and a parser does not: an uppercase tag,
 *  a newline inside a tag, an unquoted attribute value, an unclosed element, and
 *  attributes in an order no template would produce. */
const MESSY = `<!doctype html>
<html><head><TITLE>Messy</TITLE><BASE
   HREF="https://example.com/"><style>#alive { color: rgb(0, 128, 0) }</style></head>
<body>
  <IMG
     srcset="img/a,1.png 1x,   img/b,2.png 2x" ALT=none src=img/logo.png>
  <picture><source srcset='../shared/wide.png 640w' src="clip.mp4"></picture>
  <video POSTER=poster.png src="clip.mp4"><audio src="tone.mp3">
  <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" >
  <img src="https://example.com/remote.png">
  <img src="//cdn.example.com/proto.png"><img src="blob:1234"><img src=""><img src="#frag">
  <img src="/absolute.png">
  <iframe src="nested.html"></iframe>
  <a href="https://example.com/">out</a>
  <p id="alive">alive</p>
</body></html>`;

function hasTag(html: string, tag: string): boolean {
  return new RegExp(`<${tag}\\b`, 'i').test(html);
}

function assetUrlFor(relative: string): string {
  return convertFileSrc(`${DIR}/${relative}`);
}

/** A document with more elements than the ceiling allows, built as markup so the
 *  engine — not the test — decides how many elements it really holds. */
function oversized(): string {
  return `<!doctype html><html><body><p id="alive">alive</p>${'<span>x</span>'.repeat(RENDER_MAX_ELEMENTS)}</body></html>`;
}

export async function runTransformChecks(host: HTMLElement): Promise<TransformCheck[]> {
  const checks: TransformCheck[] = [];
  const messy = transform(MESSY);
  const html = messy.html ?? '';

  checks.push(
    check(
      'removals',
      [3],
      'base and nested frames are gone from the serialized document',
      !hasTag(html, 'base') && !hasTag(html, 'iframe') && !hasTag(html, 'frame') && messy.counts.removedFrames === 1,
      `removedFrames=${messy.counts.removedFrames}, base present=${hasTag(html, 'base')}, iframe present=${hasTag(html, 'iframe')}`,
    ),
  );

  const rewritten = [
    assetUrlFor('logo.png'),
    assetUrlFor('img/a,1.png'),
    assetUrlFor('img/b,2.png'),
    assetUrlFor('poster.png'),
    assetUrlFor('tone.mp3'),
    convertFileSrc('/probe/shared/wide.png'),
  ];
  const missing = rewritten.filter((url) => !html.includes(url));
  checks.push(
    check(
      'rewrites',
      [6, 8],
      'every rewritten attribute survived the engine, including a srcset with commas in its paths',
      missing.length === 0,
      missing.length === 0 ? `${rewritten.length} references rewritten` : `not found: ${missing.join(' ')}`,
    ),
  );
  checks.push(
    check(
      'descriptors',
      [8],
      'srcset descriptors survived the rewrite',
      /1x/.test(html) && /2x/.test(html) && /640w/.test(html),
      `1x=${/1x/.test(html)} 2x=${/2x/.test(html)} 640w=${/640w/.test(html)}`,
    ),
  );

  const untouched = [
    'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
    'https://example.com/remote.png',
    '//cdn.example.com/proto.png',
    'blob:1234',
    '#frag',
    '/absolute.png',
  ];
  const rewrittenByMistake = untouched.filter((value) => !html.includes(value));
  // The empty value is checked as the attribute it sits in: `includes('')` is
  // true of every string, so the obvious form of this check cannot fail.
  const emptyKept = html.includes('src=""');
  checks.push(
    check(
      'untouched',
      [7],
      'data:, http(s), protocol-relative, blob:, empty and fragment references are as written',
      rewrittenByMistake.length === 0 && emptyKept,
      rewrittenByMistake.length === 0
        ? `all six survived, empty src kept=${emptyKept}`
        : `changed: ${rewrittenByMistake.join(' ')} (empty src kept=${emptyKept})`,
    ),
  );

  checks.push(
    check(
      'contract',
      [9],
      'the transform result carries the title and the doctype flag',
      messy.title === 'Messy' && messy.hadDoctype,
      `title=${String(messy.title)} hadDoctype=${messy.hadDoctype} counts=${JSON.stringify(messy.counts)}`,
    ),
  );

  const undeclared = transform('<html><body><p id="alive">no doctype here</p></body></html>');
  checks.push(
    check(
      'doctype-added',
      [5, 9],
      'a document that declared no doctype is serialized with one, and says it had none',
      (undeclared.html ?? '').startsWith('<!DOCTYPE html>') && !undeclared.hadDoctype,
      `hadDoctype=${undeclared.hadDoctype} head=${(undeclared.html ?? '').slice(0, 20)}`,
    ),
  );

  const big = transform(oversized());
  checks.push(
    check(
      'ceiling',
      [11],
      'a document over the element ceiling is neither serialized nor rendered',
      big.html === null && big.skipped === 'elements',
      `elements=${big.counts.elements} (ceiling ${RENDER_MAX_ELEMENTS}) skipped=${String(big.skipped)}`,
    ),
  );

  // The one check that has to reach the frame: everything above reads the string
  // this transform produced, and a string can be right while the document the
  // engine builds from it is not.
  const rendered = await render(host, html);
  const marker = rendered.getElementById('alive');
  const color = marker === null ? '' : rendered.defaultView?.getComputedStyle(marker).color;
  checks.push(
    check(
      'standards-mode',
      [5],
      'the rendered document is in standards mode',
      rendered.compatMode === 'CSS1Compat',
      `compatMode=${rendered.compatMode}`,
    ),
  );
  checks.push(
    check(
      'styles-apply',
      [1],
      "the document's own inline style applies inside the frame",
      color === 'rgb(0, 128, 0)',
      `computed color=${String(color)}`,
    ),
  );
  checks.push(
    check(
      'live-removals',
      [3],
      'the document the engine built holds no base or nested frame either',
      rendered.querySelector('base, iframe, frame') === null,
      `found=${rendered.querySelector('base, iframe, frame')?.tagName ?? 'none'}`,
    ),
  );

  return checks;
}
