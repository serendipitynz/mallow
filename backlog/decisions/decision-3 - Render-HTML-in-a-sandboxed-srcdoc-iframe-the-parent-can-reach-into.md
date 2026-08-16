---
id: decision-3
title: Render HTML in a sandboxed srcdoc iframe the parent can reach into
date: '2026-07-30 09:27'
status: accepted
---
## Context

Supersedes decision-1, which chose *same-document rendering* — inserting a
document's filtered elements into a shadow root inside the app's own document —
on the premise that the alternative, *isolated-frame rendering* (loading the
document as a separate document in an iframe), could not support outline
navigation, anchor scrolling, or scroll-position preservation without running
script inside the frame.

**That premise was wrong.** An iframe carrying a `srcdoc` document with
`sandbox="allow-same-origin"` and deliberately **without** `allow-scripts` stays
same-origin with the parent: no script inside the document executes, yet the
parent can read and manipulate `contentDocument`. Heading extraction,
`scrollIntoView`, click interception, and sizing from `scrollHeight` are all
available from the parent side. Once that is true, isolated-frame rendering keeps
every reading affordance the shadow-root route offered while containing the
document strictly better.

The goal is unchanged: read HTML files — increasingly what AI agents hand back
instead of Markdown — the way Markdown is read in mallow, with no browser in the
loop. A *rendered view* builds a DOM and shows the document with its CSS applied;
a *source view* shows its text through the existing `SourceView`.

The four facts verified against the pinned tauri 2.11.3 still hold and are
recorded in decision-1. Two of them shape this decision directly: the app CSP
does not apply to a document served over the asset protocol, and asset URLs
collapse the whole path into one `encodeURIComponent`-ed segment so *relative
references* — subresource references resolved against the document's own location
— cannot resolve. A third — that child frames receive no Tauri IPC bridge, because the
`__TAURI_INTERNALS__` initialization script is registered
`for_main_frame_only: true` — is correct for 2.11.3 but **must not be counted as
a barrier in this design at all**: `allow-same-origin` makes the frame
same-origin with the parent, so a script that ran there would reach
`window.parent.__TAURI_INTERNALS__` regardless of what was injected into the
frame itself.

## Decision

**Render HTML in an iframe fed through `srcdoc`, with
`sandbox="allow-same-origin"` and no `allow-scripts`.** Read the file as text via
the existing `read_file` path, adjust the markup, and hand the result to `srcdoc`
— never point the frame at an `asset:` URL, which would escape the CSP entirely.

Script execution is then blocked by the sandbox flags and, for most shapes, by the
parent CSP that a `srcdoc` document inherits (`script-src` has no
`'unsafe-inline'`). The two layers are not equally broad, and the difference
matters when TASK-6 writes this up as a security contract:

| shape | stopped by |
|---|---|
| inline `<script>`, `on*` attribute, `javascript:` URL | sandbox **and** CSP |
| remote `<script src="https://…">` | sandbox **and** CSP |
| relative `<script src="./x.js">` | **sandbox only** — `srcdoc` resolves it against the app's own URL, so `script-src 'self'` permits it |

The relative case is unreachable in practice (nothing an attacker controls sits at
the app origin, and `asset:` is absent from `script-src`), and it is exactly the
probe TASK-7 uses to test the sandbox layer on its own. But "two independent
layers" is not true across the board, so do not write it that way.

Two further caveats about the CSP layer, both easy to trip over:

- **There is no CSP at all under `pnpm tauri dev` on desktop.** `set_csp` runs only
  when Tauri serves the assets (`manager/mod.rs:442`, via `get_asset`), the dev
  webview loads the Vite `devUrl` directly because `PROXY_DEV_SERVER` is
  `cfg!(all(dev, mobile))` (`manager/webview.rs:43`), `index.html` carries no CSP
  `<meta>`, and `app.security.devCsp` is unset. So during development the sandbox
  is the *only* layer, and anything about CSP behavior must be checked against a
  built app (or with `devCsp` set for the occasion).
- **`style-src`'s `'unsafe-inline'` is one inline `<style>` away from being
  ignored.** CSP disables `'unsafe-inline'` as soon as a nonce or hash source is
  present in that directive, and tauri-codegen adds a hash for inline styles it
  finds in `index.html` (the same mechanism that already puts the bootstrap
  script's `sha256-` into `script-src`, `manager/mod.rs:126-152`). Adding an inline
  `<style>` to `index.html` would therefore break Shiki, mermaid, and every
  rendered HTML document's own styling at once. Treat that as a standing
  constraint on `index.html`, not a detail of this feature.

**No hand-rolled element allowlist is needed for script containment, and the
DOMPurify question decision-1 had to answer does not arise.** What remains is a
short, explicit removal list plus URL rewriting — for rendering and network
reasons, not as a sanitizer:

- **Remove nested `<iframe>` / `<frame>`.** The parent CSP's `frame-src` permits
  `'self'` and `asset:`, and by fact 1 an asset-protocol response carries no CSP
  of its own. The inherited sandbox flags still stop script inside such a frame,
  but its *subresource* loads would sit outside both the CSP and the notice-bar
  count — so "external references stay blocked" would not hold. `<object>` and
  `<embed>` need no handling: the CSP already sets `object-src 'none'`.
- **Remove `<base>`**, which would otherwise redirect every relative reference.
- **Rewrite local subresource references** to `convertFileSrc` URLs. `srcdoc`
  falls back to the app's own URL as its base, so relative references do not
  reach the opened folder on their own. Cover every URL-bearing media attribute:
  `img src`, `img srcset`, `source src`, `source srcset`, `video src`,
  `video poster`. `asset:` is already permitted by `img-src` and `media-src`, and
  the opened folder already has its `allow_media_dir` grant. Relative `url()`
  inside CSS is out of scope and must be stated rather than left silently broken.
  **Equally important is what must not be rewritten**: `data:` URIs above all —
  base64-embedded images are the most common shape of AI-generated single-file HTML
  and already work, since `img-src` allows `data:` — plus `http(s)`,
  protocol-relative `//host/…`, `blob:`, empty values, and bare `#fragment`s.
- **Preserve the doctype.** `documentElement.outerHTML` omits it, and a `srcdoc`
  document without one lands in quirks mode, which changes layout *and* moves which
  element reports the scroll height — silently corrupting the height measurement
  below.
- **Count what is inert** (script elements, external references) to drive the
  notice bar.

Other sandbox flags stay off deliberately: no `allow-forms` (submissions
blocked), no `allow-popups`, no `allow-top-navigation`. Note that
`allow-same-origin` is safe here **only** because `allow-scripts` is absent — the
two together would let a document remove its own sandbox.

**Adding `allow-scripts` later is not a small change, and this is where to stop
anyone who tries.** The obvious motivation exists — tabs and charts in
AI-generated HTML stay inert without it — so the blast radius has to be written
down: with `allow-same-origin` in place, script in the frame is script in the app
origin, and mallow's `read_file` / `read_dir_tree` are plain `std::fs` with no
scope and no capability gating (AGENTS.md). The failure mode is arbitrary local
file read, not a broken widget. If script support is ever wanted, it needs its own
decision that revisits the origin, not a one-line flag addition.

**External references stay blocked; the CSP is not changed.** An *external
reference* points at an `http(s)` URL — CDN CSS or JS, remote images, web fonts.
The inherited CSP refuses remote stylesheets, fonts, and scripts. Remote images
do load, because `img-src` already allows `https:` — the same behavior Markdown
has today, so this adds no new class of outbound request.

**Local stylesheets and fonts beside the document do not load either, and that is
accepted.** A relative `<link rel="stylesheet" href="./style.css">` resolves
against the app's own URL, where `style-src 'self'` permits it and it 404s.
Rewriting it to `asset:` would require adding `asset:` to `style-src` / `font-src`
— a CSP change this decision rules out. So it joins relative `url()` in CSS as an
accepted gap, on one condition: it must be **counted and shown in the notice bar**
rather than failing silently, because a document rendering unstyled with no
explanation reads as a bug in mallow.

**Links are intercepted by the parent, never followed by the frame.** The parent
attaches a click handler to `contentDocument`. It is close to
`MarkdownView.tsx:79-93` but not a copy: that handler returns early for `#` links
and lets native fragment navigation do the scrolling, which does nothing here
because a frame sized to its own content has no scrollable viewport. Fragment
links must be `preventDefault`-ed and scrolled by the parent through TASK-8;
`http(s)` links go to the OS browser; everything else is inert.

**Opening the file outside mallow uses a custom command, not the opener plugin.**
Adding `opener:allow-open-path` on its own does not work: `is_path_allowed` in
tauri-plugin-opener 2.5.4 requires an allowed `Entry::Path`
(`matches_path_program` returns `false` for `Entry::Url`, `scope.rs:126-139`),
`allow-open-path` ships with no scope entries, and `opener:default` contributes
only URL entries — so every call returns `ForbiddenPath`.

The plugin route is nevertheless *possible*: `Manager::add_capability`
(`tauri-2.11.3/src/lib.rs:812-820`, behind the `dynamic-acl` feature, which is one
of tauri's defaults and is enabled here since `src-tauri/Cargo.toml` does not set
`default-features = false`) plus `CapabilityBuilder::permission_scoped` can widen
an ACL scope at runtime, the same way `allow_media_dir` widens the asset scope. It
is declined anyway, on cost: it means maintaining a **second** runtime-scope
mechanism alongside `allow_media_dir`, for a call that `editors.rs` can make
directly with `std::process` — which is what it already does for `reveal`, and
which AGENTS.md notes is exempt from capabilities entirely.

Label the action for what it does: the OS default handler for `.html` is not
always a browser, so either name it after the default app or resolve a browser
explicitly.

**The rendered view is the default mode**, with a toggle to the source view where
`ConfigView` puts its tree/source toggle.

### Prerequisite

The two behaviors this rests on — same-origin access under
`sandbox="allow-same-origin"`, and CSP inheritance into `srcdoc` — are specified,
but have not been observed on WKWebView, WebView2, and WebKitGTK in this project.
TASK-7 confirms them first. If either fails on a platform, this decision reopens
rather than being worked around.

The two layers must be probed **independently**, which constrains how TASK-7 is
written: an inline script proves nothing by itself, because a broken sandbox with
an intact CSP would still refuse it and the test would pass while the layer under
test is broken. The sandbox is probed with a script the CSP *would* allow — an
app-origin external script, permitted by `script-src 'self'`.

## Consequences

- Inline `<script>` never runs, so tabs, disclosure widgets, and canvas-drawn
  charts in AI-generated HTML are inert or absent; CDN-styled documents render
  with plain styling. Self-contained documents using inline `<style>` — the common
  shape of AI-generated HTML — render essentially as intended. The UI must say
  what was disabled (script count, external-reference count) and offer
  "open in browser".
- Compared with same-document rendering, containment improves on two axes that
  shadow DOM cannot cover: the frame clips `position: fixed` and `:host`-style
  attempts to overlay the app UI, and the document's `<style>` needs no
  inspection at all.
- **CSS remains a network side channel.** `url(https://…)` inside a `<style>`
  block or a `style` attribute is fetched under `img-src https:`, as are
  `srcset` and `poster`. This is not solved by sandboxing, and would not be
  solved by DOMPurify either, which does not sanitize CSS contents. It matches
  the existing exposure from remote images in Markdown; tightening it means
  removing `https:`/`http:` from `img-src`, which is a separate decision.
- `Outline` and `lib/scroll` resolve headings with `document.getElementById`
  (`Outline.tsx:29,57`, `scroll.ts:14,27`), which does not cross the frame
  boundary — and swapping in a lookup root is not enough on its own. The scroll
  spy compares `getBoundingClientRect()` values (`Outline.tsx:26-31`), and rects
  taken inside the frame are relative to the frame's viewport, not the parent's.
  Both the root and the coordinate conversion are TASK-8, shared with any future
  viewer whose content is not in the app document.
- The frame does not size itself to its content, so the parent measures
  `scrollHeight` and applies it, keeping the app's own scroller (and with it
  scroll-anchor preservation) in charge. **That is a feedback loop**: a document
  with `body { min-height: 200vh }` grows on every applied height. It has to be
  bounded — a capped number of measurement passes and a maximum height — while
  still re-measuring after a live reload and after late layout changes (images,
  `<details>`).

  **The app scroller stays the only scroller, so exceeding the maximum height sends
  the document to the capped source view** rather than giving the frame a scrollbar
  of its own. This is not a free choice at the task level: fragment links being
  scrolled by the parent, the keyboard forwarding below, and TASK-8's single
  boundary-crossing mechanism all assume the frame has no scrollable viewport.
  Allowing nested scrolling would mean reopening this decision, TASK-8, and the
  fragment and keyboard criteria together as one contract. The maximum is therefore
  a backstop against pathological growth, set high enough that ordinary long
  documents never reach it.
- **The rendered view needs a complexity ceiling of its own.** The 10 MiB
  `read_file` cap bounds bytes, not element count; hundreds of thousands of nodes
  or heavy SVG filters fit well inside it, and the rendered view is the default.
  Fall back to the source view above a render threshold. TASK-3 has since capped
  the CSV table (decision-7), but **not by falling back**: it truncates the table
  and leaves the source view one toggle away, which works there because a
  truncated table is still a table. A truncated rendering is not a rendering, so
  the ceiling here still has to switch views. When this was written the source
  view was not a safe floor —
  it highlighted the whole file unconditionally, so escaping a 9 MiB document
  into it traded one stall for a worse one. **TASK-9 closed that (decision-6):
  above its caps the source view drops the highlighting rather than the
  document, so it is now a floor a fallback can land on.**
- **The frame's canvas is light under every app theme, declared from the parent
  side.** css-color-adjust-1 says the embedding element's used colour scheme
  becomes the embedded document's *preferred* scheme, and that when the two used
  schemes differ the UA must paint an **opaque** `Canvas` rather than a transparent
  one. So the document that breaks is not the unstyled one: under a dark palette
  (`global.scss:14` puts `color-scheme: dark` on `:root`, which the iframe element
  inherits) an unstyled document mismatches and gets a white canvas, staying
  readable. What breaks is the document that *opts in* — `<meta
  name="color-scheme" content="light dark">`, or `color-scheme` in its own CSS —
  while setting `color` but no `background`: the schemes now match, the canvas
  stays transparent, and its dark-ish text lands on mallow's dark surface.

  Resolve it by setting `color-scheme: light` plus a background on the **iframe
  element** in the app's own SCSS, rather than injecting a base style into the
  document. Three reasons: it also fixes what `prefers-color-scheme` evaluates to
  inside the frame, it cannot conflict with the document's author styles (so
  "author styles win" stays true *inside* the canvas), and it survives theme
  changes — a style baked into `srcdoc` would not, because `onThemeChange`
  (`theme.ts:52`) only fires when the resolved light/dark mode changes, not on a
  palette-only switch between two dark themes. TASK-7 still records the actual
  per-WebView behavior.
- The frame has a lifecycle the parent has to respect: `contentDocument` is
  `about:blank` until `load`, and every `srcdoc` replacement builds a fresh
  document, discarding ids, listeners, and the measured height. Heading ids, the
  click listener, anchor restore, and height measurement all have to re-run in
  that order after each load — a detail that fails half-visibly if left implicit.
- **Keyboard scrolling has to be forwarded.** A frame sized to its own content has
  no scrollable viewport, so once focus moves inside it — which `Outline.tsx:61-62`
  does deliberately, setting `tabindex="-1"` and calling `focus()` on the target
  heading — arrow keys, Space, PageDown, Home and End reach a document that cannot
  scroll, and the app's scroller stays put. Wheel events chain to the parent;
  keyboard events do not. Same-origin access makes the fix easy (forward `keydown`,
  or keep focus in the parent), but it has to be planned or the reading experience
  regresses exactly where the goal was to match Markdown.
- **One mechanism for crossing the boundary, chosen once.** Whether
  `scrollIntoView` on an element inside the frame scrolls the *parent* is what
  TASK-7 AC #6 measures. This decision assumes it does not and specifies
  parent-side scrolling; TASK-8 must name the mechanism it implements rather than
  leaving `Outline`'s current `el.scrollIntoView({ block: 'start' })`
  (`Outline.tsx:60`) to decide by accident.
- Heading ids must be added only where the element has none. Overwriting an
  existing id breaks the document's own fragment links.
- The document does not inherit mallow's theme. For a document that ships its own
  styling that is the intended outcome; a document with no styles at all will look
  unstyled.
- The CSP in `tauri.conf.json` does **not** need to change. If a later change
  makes it need `'unsafe-inline'` or a remote fetch, that reopens this decision.
- **Height has to be re-measured on width changes, not just late layout.** A window
  resize, an Explorer splitter drag, or opening the outline reflows the document and
  invalidates the baked-in height, leaving the bottom clipped or a large gap. The
  measurement-pass cap has to reset on those, or it exhausts itself and the height
  stays stale.
- **Relative images will work in HTML but still not in Markdown.** `convertFileSrc`
  is used today only by `MediaView` and `custom-emoji`, so a Markdown document's
  `![](./img/x.png)` does not resolve. Rendering HTML makes that asymmetry visible
  and it will be asked about; record it rather than discovering it as a bug report.
- AGENTS.md's untrusted-input section needs a subsection for the HTML boundary,
  since the Markdown guarantee ("a document never becomes live DOM") no longer
  covers every file kind.
