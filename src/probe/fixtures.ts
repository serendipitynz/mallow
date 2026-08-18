/** Fixture documents for TASK-7's srcdoc sandbox / CSP probe.
 *
 *  This module is a measuring instrument, not part of the app: it is reachable
 *  only from the probe build (`MALLOW_PROBE=1`, see `vite.config.ts`) and
 *  nothing under `src/` outside `src/probe/` imports it.
 *
 *  Every fixture carries `<p id="alive">`. An iframe's `load` event fires for
 *  the `about:blank` document it starts with as well as for the fixture, and a
 *  fixture that navigates itself away leaves a document that still answers
 *  `load` — so the harness waits for that marker instead, and a fixture whose
 *  marker is gone is a navigation, not a pass. */

declare global {
  interface Window {
    /** Bumped by the app-origin marker script in whatever window it runs in.
     *  Absent in the frame = the sandbox suppressed a script the CSP allows. */
    __mallowProbeMark?: number;
    __probeInline?: boolean;
    __probeOnclick?: boolean;
    __probeJsUrl?: boolean;
    __probeNested?: boolean;
  }
}

/** Reserved TLD (RFC 2606) that can never resolve, so a
 *  `securitypolicyviolation` naming one of these URLs is attributable to the
 *  CSP rather than to a failed lookup — the probe must not read "the network
 *  was down" as "the CSP blocked it". */
export const BLOCKED_ORIGIN = 'https://probe.invalid';

/** The one remote reference that must LOAD, because `img-src` already allows
 *  `https:`. This needs the network, so the harness records its CSP verdict
 *  (no violation reported) separately from its load verdict. */
export const REMOTE_IMAGE = 'https://raw.githubusercontent.com/serendipitynz/mallow/main/src-tauri/icons/32x32.png';

/** Emitted at the app origin by the probe build only, so `script-src 'self'`
 *  permits it. This is what probes the sandbox on its own: an inline script
 *  would be refused by the CSP even with the sandbox broken, so it cannot tell
 *  the two layers apart. */
export const MARKER_SRC = '/probe-marker.js';

/** Query the top-navigation probe navigates to. It points at the app's own
 *  index so a sandbox failure reloads the probe instead of stranding the window
 *  on a foreign page — the flag is then visible in `location.search` on boot,
 *  which is the observation itself. */
export const TOP_NAV_QUERY = 'probeTopNav';

const DOCTYPE = '<!doctype html>';

function attr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Every fixture ends with two markers. `alive` is how the harness recognises
 *  the fixture document; `click-control` is the positive control for clicks
 *  driven from the parent, without which every "nothing ran when clicked"
 *  result would pass vacuously on an engine that does not deliver them. */
function page(head: string, body: string): string {
  const markers = '<p id="alive">alive</p><span id="click-control"></span>';
  return `${DOCTYPE}<html><head><meta charset="utf-8">${head}</head><body>${body}${markers}</body></html>`;
}

/** Script execution, every shape at once. The app-origin external script is the
 *  sandbox probe (AC #1); the rest are AC #3 and #5. */
export function scriptsFixture(): string {
  const nested = `${DOCTYPE}<html><body><script>window.__probeNested = true;</script><p>nested</p></body></html>`;
  return page(
    '<style>#styled { color: rgb(0, 128, 0); }</style>',
    [
      '<p id="styled">inline style block (must apply)</p>',
      `<script src="${MARKER_SRC}"></script>`,
      '<script>window.__probeInline = true;</script>',
      '<button id="onclick-probe" onclick="window.__probeOnclick = true">on-click handler</button>',
      '<a id="jsurl-probe" href="javascript:window.__probeJsUrl = true">javascript: link</a>',
      `<iframe id="nested-probe" srcdoc="${attr(nested)}" width="200" height="60"></iframe>`,
    ].join(''),
  );
}

/** Remote subresources. The `@font-face` is authored in the document rather than
 *  injected, and it is the only blocked shape whose violation the harness can
 *  still catch: a font is fetched lazily, only once something asks for it, so
 *  the listener can be attached after load and the fetch forced afterwards. That
 *  makes it the evidence that a document's OWN markup inherits the CSP, which a
 *  parent-injected node could not show on its own.
 *
 *  Nothing in the body uses that family, deliberately. An element carrying it
 *  would start the fetch during the first layout — before the listener exists —
 *  and the missed violation would read as "the CSP did not refuse it". */
export function networkFixture(): string {
  return page(
    [
      `<link id="authored-css" rel="stylesheet" href="${BLOCKED_ORIGIN}/authored.css">`,
      `<script id="authored-js" src="${BLOCKED_ORIGIN}/authored.js"></script>`,
      '<style>',
      `@font-face { font-family: 'ProbeAuthoredFont'; src: url('${BLOCKED_ORIGIN}/authored.woff2') format('woff2'); }`,
      // Blue unless the data: stylesheet the harness injects overrides it to red.
      '#csp-effect-target { color: rgb(0, 0, 255); }',
      '</style>',
    ].join(''),
    [
      `<img id="remote-img" src="${REMOTE_IMAGE}" alt="remote image (must load)" width="32" height="32">`,
      '<p id="csp-effect-target">CSP inheritance, measured by effect</p>',
    ].join(''),
  );
}

/** A stylesheet as a `data:` URL. `style-src` is `'self' 'unsafe-inline'` with no
 *  `data:`, so an inherited policy refuses it and the rule never applies.
 *
 *  This exists because a violation that is never reported and a policy that was
 *  never inherited look identical from the event side, and separating them is
 *  the whole of decision-3's second premise. It touches no network, so unlike
 *  the `probe.invalid` references its silence is meaningful. */
export const DATA_STYLESHEET = 'data:text/css,%23csp-effect-target%7Bcolor%3Argb(255%2C0%2C0)%7D';

/** A 1×1 transparent GIF. `img-src` lists `data:` explicitly, so this must load —
 *  it is the control that `data:` subresources work in this engine at all, which
 *  is what makes the stylesheet's silence attributable to the CSP. */
export const DATA_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Form submission, both the form's own action and a button's `formaction`
 *  (AC #4). `allow-forms` is absent, so neither may leave the fixture. */
export function formFixture(): string {
  return page(
    '',
    [
      `<form id="probe-form" method="get" action="${BLOCKED_ORIGIN}/form">`,
      '<input name="q" value="1">',
      '<button id="submit-plain" type="submit">submit</button>',
      `<button id="submit-formaction" type="submit" formaction="${BLOCKED_ORIGIN}/formaction">formaction</button>`,
      '</form>',
    ].join(''),
  );
}

/** Meta refresh (AC #4). A sandbox without `allow-top-navigation` does not stop
 *  a frame navigating itself, so this one is expected to be stopped by the
 *  parent's `frame-src` instead — which is why the harness records WHICH layer
 *  answered rather than only that nothing moved. */
export function metaRefreshFixture(): string {
  return page(`<meta http-equiv="refresh" content="0;url=${BLOCKED_ORIGIN}/refresh">`, '<p>meta refresh target</p>');
}

/** `target="_top"` (AC #4). */
export function topNavFixture(): string {
  return page('', `<a id="top-link" target="_top" href="/index.html?${TOP_NAV_QUERY}=1">navigate the app away</a>`);
}

/** A plain link with no target (AC #10), checked both with and without the
 *  parent's click interception in place. */
export function plainLinkFixture(): string {
  return page('', `<a id="plain-link" href="${BLOCKED_ORIGIN}/plain">plain link, no target</a>`);
}

/** Targets for a REAL mouse click (AC #10). Synthetic clicks driven from the
 *  parent are delivered on WebView2 and on neither WebKit engine, and a
 *  synthetic click is not what decision-3's link interception has to survive —
 *  a user's click is. This fixture exists to be clicked by hand. */
export function manualClickFixture(): string {
  return page(
    '<style>body { font: 14px system-ui, sans-serif; } a, button { font-size: 15px; padding: 6px; }</style>',
    [
      `<p><a id="manual-link" href="${BLOCKED_ORIGIN}/manual">click this link</a></p>`,
      '<p><button id="manual-button" type="button">click this button</button></p>',
    ].join(''),
  );
}

/** Late layout. decision-3 requires the parent to re-measure the frame's height
 *  after an image finishes loading or a `<details>` opens, and plans to hear
 *  about both through listeners — which are dead on WebKit. This fixture is what
 *  the surviving mechanisms are measured against.
 *
 *  The image is deliberately given no intrinsic size and a cache-busting query,
 *  so it reflows the document after first layout rather than before the observers
 *  are attached. `<details>` is here because it is the one late change a
 *  scripting-disabled document can still make on its own: opening it is UA
 *  behaviour, not script. */
export function lateLayoutFixture(cacheBuster: number): string {
  return page(
    '<style>body { font: 14px system-ui, sans-serif; } summary { cursor: pointer; font-size: 15px; padding: 6px; } .tall { height: 240px; background: #eeffee; }</style>',
    [
      `<p><img id="late-img" src="${REMOTE_IMAGE}?probe=${cacheBuster}" alt="late image"></p>`,
      '<details id="late-details"><summary>open me — this changes the height</summary><p class="tall">late layout</p></details>',
    ].join(''),
  );
}

/** A document taller than any viewport, for the parent-side reach-in checks
 *  (AC #6, #12, #13). Heights are declared so the measured `scrollHeight` has
 *  something to be compared against.
 *
 *  The scroll target sits at roughly two thirds rather than at the end: a target
 *  in the last viewport's worth of the document cannot be brought to the top of
 *  the scroller at all, so a working mechanism would leave a residual offset and
 *  be recorded as a failure. */
export function tallFixture(sections = 12): string {
  const targetIndex = Math.ceil(sections * 0.7);
  const blocks: string[] = [];
  for (let i = 1; i <= sections; i += 1) {
    const id = i === targetIndex ? 'deep-target' : `section-${i}`;
    blocks.push(`<h2 id="${id}">Section ${i}${i === targetIndex ? ' (deep target)' : ''}</h2>`);
    blocks.push(`<p class="filler">filler ${i}</p>`);
  }
  return page(
    '<style>body { margin: 0; font: 16px system-ui, sans-serif; } h2 { margin: 0; height: 40px; } .filler { margin: 0; height: 260px; background: #eef; }</style>',
    blocks.join(''),
  );
}

/** A document with no styling at all (AC #11). Under a dark palette the frame's
 *  used colour scheme differs from the document's, so the UA must paint an
 *  opaque canvas — this is the case decision-3 predicts stays readable. */
export function unstyledFixture(): string {
  return page('', '<h1>Unstyled document</h1><p>No author styles at all. Is this text readable?</p>');
}

/** A document that opts into colour schemes and sets a colour but no background
 *  (AC #11) — decision-3 predicts THIS is the one that breaks under a dark
 *  palette, because the schemes now match and the canvas stays transparent. */
export function colorSchemeFixture(): string {
  return page(
    ['<meta name="color-scheme" content="light dark">', '<style>body { color: #222222; }</style>'].join(''),
    '<h1>color-scheme: light dark</h1><p>Dark-ish text, no background declared. Is this text readable?</p>',
  );
}

/** A rewritten local image (AC #16). The path is turned into an `asset:` URL by
 *  the caller, exactly as the rendered view will do. */
export function assetImageFixture(assetUrl: string): string {
  return page('', `<img id="asset-img" src="${attr(assetUrl)}" alt="asset: image (must load)" height="64">`);
}
