---
id: decision-1
title: 'Render HTML via same-document rendering, not an iframe'
date: '2026-07-30 08:54'
status: superseded
---
## Superseded by decision-3

The comparison below rejected isolated-frame rendering on the premise that an
iframe cannot be reached from the app without running script inside it, making
outline navigation, anchor scrolling, and scroll-position preservation
structurally unavailable there. **That premise is wrong.** With
`sandbox="allow-same-origin"` and no `allow-scripts`, a `srcdoc` frame stays
same-origin with the parent: no script inside the document runs, yet the parent
can read and manipulate `contentDocument`. Once the decisive argument fails, the
iframe route wins on containment as well — see decision-3.

Two further gaps in this document, both carried into decision-3:

- The element-allowlist rule described below inspects `href`/`src` schemes and so
  misses `<style>` contents, `style` attributes, `srcset`, and `poster`. Because
  `img-src` allows `https:`, CSS `url(https://…)` is a live network side channel.
  "The CSP is the backstop" was an argument about script only, and does not carry
  over to CSS — so it was not a sound reason to decline DOMPurify (which does not
  sanitize CSS either).
- Shadow DOM does not contain `position: fixed` or `:host`-based attempts to
  overlay the app UI. An iframe does.

The four verified tauri facts below still hold and decision-3 builds on them,
except that fact 3 should be read as version-fragile: `for_main_frame_only` is an
internal implementation detail, not a documented guarantee.

## Context

AI agents increasingly hand back HTML rather than Markdown, and the need is to
read those files the way Markdown is read in mallow — no browser in the loop.
That means a *rendered view*: building a DOM from the document and showing it
with its CSS applied, as opposed to a *source view* (the document's text shown
through the existing `SourceView`, Shiki-highlighted and line-numbered).

Two routes exist for the rendered view:

- **Same-document rendering** — insert the document's elements into a shadow root
  inside the app's own document.
- **Isolated-frame rendering** — load the document as a separate document in an
  iframe.

HTML is executable content, so this reopens the untrusted-input boundary that
AGENTS.md describes for Markdown (where `html: false` guarantees a document never
becomes live DOM).

### Facts verified against the pinned tauri 2.11.3 (`src-tauri/Cargo.lock`)

1. **The app CSP does not apply to a document loaded over the asset protocol.**
   `src/protocol/asset.rs` contains no CSP handling at all, so serving an HTML
   file through `convertFileSrc` into an iframe leaves it ungoverned by the CSP
   in `tauri.conf.json`.
2. **Relative references cannot resolve through the asset protocol.** A
   *relative reference* is a subresource reference resolved against the
   document's own location (`./style.css`, `img/x.png`). `scripts/core.js` builds
   the URL as `` `${protocol}://localhost/${path}` `` on macOS and Linux, and as
   `` `${protocolScheme}://${protocol}.localhost/${path}` `` on Windows and Android
   — which is why the CSP also lists `http://asset.localhost` — where
   `path = encodeURIComponent(filePath)`.
   Either way the whole path collapses into a single segment, so `./style.css`
   resolves to `asset://localhost/style.css` and misses. Such references must be
   rewritten explicitly to `convertFileSrc` URLs.
3. **Child frames do not get the Tauri IPC bridge.** The initialization script
   defining `__TAURI_INTERNALS__` is registered with `for_main_frame_only: true`
   (`src/manager/webview.rs:162`), so `invoke` is unreachable from a subframe.
4. **`script-src` has no `'unsafe-inline'`.** Inline `<script>`, `on*`
   attributes, and `javascript:` URLs are refused by the WebView regardless of
   any element filtering the app performs. The CSP, not the element allowlist, is
   the real backstop against script execution.

## Decision

**Use same-document rendering.** Parse the file's text with `DOMParser`, drop
everything outside an element/attribute allowlist, and insert the result into a
shadow root, keeping the document's own `<style>` (shadow-encapsulated, so it
cannot restyle the app UI).

Supporting choices:

- **Element filtering is a hand-rolled allowlist — no new dependency.** Fact 4
  means the allowlist is a second layer rather than the only one. Keep it
  conservative: drop `script`, `iframe`, `object`, `embed`, `link`, `meta`,
  `base`, `form`, every `on*` attribute, and any `href`/`src` whose scheme is not
  `http(s)` or `asset:`.
- **External references stay blocked; the CSP is not changed.** An *external
  reference* is a subresource reference pointing at an `http(s)` URL — CDN CSS or
  JS, remote images, web fonts. CDN CSS/JS and web fonts therefore do not load.
  Remote images do load, because `img-src` already allows `https:` — that is the
  existing behavior for Markdown, so this adds no new class of outbound request.
  A local viewer should not start making network requests just because a file was
  opened.
- **The rendered view is the default mode**, with a toggle to the source view in
  the same position `ConfigView` puts its tree/source toggle.

### Alternatives rejected

- **Isolated-frame rendering** (iframe + `srcdoc` + `sandbox`). An iframe cannot
  be reached from the app without running script inside it, so outline
  navigation, `#anchor` scrolling, scroll-position preservation (`lib/scroll`),
  and in-page search are all structurally unavailable. An iframe also does not
  size itself to its content, which would put a second scroll region inside the
  viewer. Those are exactly the properties that make the Markdown reading
  experience work.
- **Loading the file over the asset protocol into an iframe.** Ruled out by
  facts 1 and 2.
- **DOMPurify.** Declined: fact 4 makes the allowlist the second layer, and
  mallow's dependency budget is deliberately small (AGENTS.md: ask before adding
  production dependencies).
- **Adding `https:` to `style-src`** so CDN-styled documents look right. Declined
  for the same reason external references stay blocked.

## Consequences

- Inline `<script>` never runs, so tabs, disclosure widgets, and canvas-drawn
  charts in AI-generated HTML are inert or absent. CDN-styled documents render
  with plain styling. Self-contained documents using inline `<style>` — the
  common shape of AI-generated HTML — render essentially as intended.
- Because things are silently disabled, the UI must say so: a notice bar stating
  what was removed (script count, external-reference count) plus an "open in
  browser" action reusing the existing OpenWith/opener path.
- Anchor clicks must be handled in JS against the shadow root; native fragment
  navigation does not reach into shadow DOM.
- The element allowlist becomes a security-relevant pure module and needs unit
  tests against hostile input, in the same spirit as the existing markdown
  security tests.
- The CSP in `tauri.conf.json` does **not** need to change. If a later change
  makes it need `'unsafe-inline'` or a remote fetch, that reopens this decision.
- AGENTS.md's untrusted-input section needs a subsection for the HTML boundary,
  since the Markdown guarantee ("a document never becomes live DOM") no longer
  covers every file kind.
