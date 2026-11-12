---
id: decision-18
title: >-
  Render a Marp deck with Marpit on mallow's own markdown-it, under mallow's
  slide theme, and apply the deck's CSS scoped to its slides
date: '2026-11-12 06:10'
status: accepted
---
## Context

TASK-51 adds a Slides view for a Markdown document written as a Marp deck.
TASK-51.1 measured the two routes the task named, and a third the measurement
turned up, far enough to choose. **A deck** below is a markdown document whose
leading **YAML** front matter (`---`), as `extractFrontMatter` parses it, has
`marp` equal to the boolean `true`. TOML front matter (`+++`) does not make a
deck: Marpit reads YAML only, so such a document would render its front matter
as text on the first slide with no directives, and Marp's own tools would not
open it as a deck either.

### What real decks use

222 public decks (one per repository, from a GitHub code search for
`"marp: true"`, fetched 2026-11-12; the median deck has 11 slides). Shares are of
decks, not of slides. The search returns its top 300 results by relevance, kept
here at one per repository, and the tally is by regular expression over the
source: the raw HTML and `$…$` rows can over-count, and none of the rows is a
measurement of Marp users at large.

| feature | decks |
|---|---|
| `theme:` set in front matter (`default` 74, `gaia` 24, `uncover` 18, another name 60; unset 46) | 79% |
| `paginate` | 68% |
| `_class` (`lead` 32%, `invert` 14%, `title` 12%) | 42% |
| deck CSS (`<style>`, `<style scoped>` or `style:`) | 44% |
| raw HTML (mostly `div`, `br`, `span`) | 38% |
| `footer` / `header` in front matter | 28% / 21% |
| image size (`![w:200]`) | 30% |
| `![bg]` / split `![bg left]` | 26% / 22% |
| HTML comments that are not directives (speaker notes) | 26% |
| `size:` (`16:9` 35, `4:3` 5) | 18% |
| math (`math:` directive 13%; `$…$` by pattern 17%) | 13–17% |
| image filters (`sepia`, `blur` …) | 7% |
| `<!-- fit -->` headings | 4% |
| mermaid fences | 1% |

### The three routes

**(a) `@marp-team/marp-core` 4.4.0** renders all of Marp. In mallow's own Vite
build it is a 3.70 MB chunk (1.22 MB gzip) against 0.88 MB for the app's entry
chunk; MathJax (1.7 MB), highlight.js (1.0 MB) and KaTeX are statically imported
and stay in the bundle with `math: false`. It brings its own markdown-it
pipeline, so Shiki, mermaid, custom emoji and decision-17's image resolution
reach its slides only by wiring each of them a second time (measured in Node:
`marp.use()` and a fence override do work). Its defaults widen three recorded
boundaries — its HTML allowlist admits `div`, `span`, `img src` and more where
mallow has `html: false`, math is on, and emoji become images from
cdn.jsdelivr.net — and each can be turned off (`html: false`, `math: false`,
`emoji: { shortcode: true, unicode: false }`).

**(b) A hand-written subset on mallow's markdown-it** adds no dependency, but
splitting, the directive cascade, `![bg]`'s split and multiple backgrounds and
`<style scoped>` would all be rewritten by hand, and deck CSS cannot be scoped
safely without a CSS parser — so 44% of decks would lose their styling.

**(c) `@marp-team/marpit` 3.2.3**, the engine marp-core is built on, takes a
markdown-it instance as its `markdown` option and installs its plugins into it
(measured in Node with mallow's markdown-it 14.2.0: `marpit.markdown === md`,
raw HTML stays escaped under `html: false`, and Shiki, the mermaid fence and
markdown-it-emoji all render inside its slides). It is 278 KB minified, 81 KB gzip with markdown-it external (esbuild),
of which postcss and postcss-selector-parser are 121 KB and js-yaml 62 KB. It
ships no theme: the look of a slide is whatever theme CSS the caller registers.
Its own package licences are MIT, its tree adds ISC, BSD-3-Clause, MIT-0 and
PSF-2.0 (`argparse` 3, through `js-yaml` 5).

### Under the shipped CSP

Measured 2026-11-12 in a `MALLOW_UNATTENDED=1 pnpm tauri build --debug
--no-bundle` build on macOS (WKWebView), with an inline script control refused
first to show the CSP was in force. marp-core's output, injected into the app
document, rendered: the slide section laid out at 1280px and scaled to the
container, the `_backgroundColor` inline style applied, and its inline helper
`<script>` did not run while the bundled `@marp-team/marp-core/browser` helper
(script-src `'self'`) ran with no violation. **Deck CSS** went in as follows:
selectors were scoped under `div.marpit > svg > foreignObject > section`, but a
deck's `@font-face` rules were registered as fonts of the whole app document
(a `data:` one and a remote one alike, the remote one then refused by
`font-src`), and its `@import` was hoisted to the top of the stylesheet and
refused by `style-src`. `url(https://…)` in deck CSS raised no violation,
since `img-src` carries `https:`. A slide's inline `background-image` raised
none either. With marp-core's defaults the twemoji images loaded from the CDN.
Marpit's output is built from the same parts, so (c) needs no CSP change.
**Windows and Linux were not measured.**

Measured in Node with Marpit and mallow's markdown-it under `html: false`:
directives in HTML comments still apply (`_class: lead` sets the class,
`header:` carries to the next slide), because Marpit parses comments itself. An
unquoted colour such as `_backgroundColor: #123456` is dropped under Marpit's
default `looseYAML: false`, since YAML reads `#` as a comment, and applied with
`looseYAML: true`, which marp-core sets by default.

## Decision

### 1. Route (c): Marpit on a second instance of mallow's markdown-it

A deck's slides are rendered by `@marp-team/marpit` given a markdown-it
instance built by the same factory as the preview's — `html: false`, Shiki, the
mermaid fence, emoji and custom emoji, alerts, task lists, lone images and
decision-17's local images. **A second instance, never the preview's cached
one**, because Marpit installs its plugins into the instance it is handed, and
sharing it would change how every other document renders. The whole source,
front matter included, goes to Marpit, which reads its directives from it.
Marpit runs with `looseYAML: true`, as marp-core does, so a directive written
the way Marp's own documentation writes it — an unquoted `#123456` — applies.

The owner approved `@marp-team/marpit` as a production dependency on
2026-11-12. TASK-51.2 adds it and regenerates `THIRD-PARTY-NOTICES.md`.
marp-core was rejected for the size of what it carries that mallow would switch
off, and for the second pipeline every enhancement would need; the hand-written
subset for losing deck CSS and re-implementing what Marpit already gets right.

The preview of a deck is unchanged: it stays an ordinary markdown document with
its front matter table. Only the Slides view goes through Marpit.

### 2. Supported subset

What Marpit implements is supported as Marpit implements it:

- the split at every horizontal rule, and `headingDivider`;
- the global directives `theme`, `style`, `headingDivider`, `lang`, and the
  local directives `paginate`, `header`, `footer`, `class`, `backgroundColor`,
  `backgroundImage`, `backgroundPosition`, `backgroundRepeat`,
  `backgroundSize`, `color` — in front matter, in HTML comments, and
  `_`-scoped to one slide;
- the image syntax: `![bg]` with its keywords (`contain`, `cover`, `fit`,
  `auto`, a percentage), split backgrounds (`left`, `right`, with a width),
  several backgrounds on one slide, `w:` / `h:` / `width:` / `height:`, and the
  CSS filters.

mallow adds the one marp-core directive real decks use beyond those: **`size`,
with the values `16:9` and `4:3`**, as a custom global directive.

Every image a slide loads — `![bg]` included — goes through decision-17: a path
relative to the document is resolved to an `asset:` URL, and a
document-written `asset:` URL is refused. **In the deck instance that rule
cannot stay where the preview has it.** The preview applies it in the `image`
render rule, but Marpit reads a background image's URL in its own inline rule
(`marpit_parse_image`) and turns the token into an inline `background-image`,
so no render rule ever sees it: `![bg](img/cover.png)` would resolve against the
app's URL and show nothing, and `![bg](asset://…)` would not be refused. So in
the deck instance the resolution and the refusal both happen once, on the image
token, in a rule that runs before `marpit_parse_image`, and the render rule does
not apply them a second time — a second pass would refuse the `asset:` URL the
first pass wrote. Where that rule hooks in is TASK-51.2's to build and verify;
what it must do is settled here.

HTML comments that are not directives are speaker notes. Marpit collects them
per slide and they are never drawn on a slide; nothing shows them until a
presenter view exists (out of scope in TASK-51).

### 3. Not supported, and reported

- **raw HTML** stays escaped and is shown as text, as in the preview
  (`html: false`);
- **math** is not typeset (AGENTS.md: KaTeX is intentionally not implemented);
- **a theme other than `default`** — `gaia`, `uncover` or a custom name — is
  drawn with mallow's slide theme (§5);
- **at-rules in deck CSS other than `@media`, `@supports` and `@container`**,
  and **`asset:` URLs written in deck CSS**, which are removed (§6);
- **a `size` other than `16:9` and `4:3`**;
- **`<!-- fit -->`**, whose heading is drawn at its ordinary size.

A deck that uses any of them shows one notice above the slides, as
`highlightSkipped` does for the source view, naming each feature it uses, so
a slide that looks different from Marp does not read as a rendering fault. A
feature is listed only where the deck's own markup names it unambiguously — the
`math` directive rather than a `$` in the text, a tag markdown-it's HTML rules
recognise, the theme or size value, the at-rule removed — so the notice is not
wrong about a deck that merely mentions a price.

### 4. Slide size and scaling

A slide is laid out at its slide size, **1280×720 CSS pixels (16:9) by default
and 960×720 for `size: 4:3`**, Marp's own two sizes, and scaled uniformly to the
largest box that fits the view: the whole slide is always visible, its aspect
ratio is kept, the spare space is letterboxed, and nothing reflows as the
window changes. The scaling is Marpit's inline SVG (`inlineSVG: true`), because
split and multiple backgrounds exist only in that mode. Whether WebKit needs
`@marp-team/marpit-svg-polyfill` to paint it correctly is TASK-51.2's to
measure on WKWebView and WebKitGTK; that package would be a second dependency
and needs its own approval. **If it is needed and not approved**, slides are
laid out without the inline SVG and scaled by a CSS transform on the slide
instead, at the same size and fit; split and multiple backgrounds then fall
back to Marpit's single CSS background, and the notice (§3) lists them as
unsupported.

### 5. Theme rule

mallow registers **one slide theme of its own and no other**, installed both as
Marpit's `themeSet.default` and under the name `default`. Marpit draws a slide
with `themeSet.default` whenever the deck names no theme or a theme the set
does not hold, so a deck with no `theme:`, one naming `default`, and one naming
`gaia`, `uncover` or a custom theme all get mallow's theme — the last three
reported (§3). Its colours come
from the active colour family and mode through the same custom properties the
preview uses, so a deck follows Light / Dark and the family exactly as a
document does. It implements the two classes Marp's built-in themes give real
decks: **`lead`** centres the slide's content, and **`invert`** swaps the
slide's foreground and background. Any other class does nothing unless the
deck's CSS defines it. `backgroundColor`, `color` and `![bg]` override the
theme on the slides they apply to, as in Marp. Presenting uses the same theme.

### 6. Deck CSS is applied, scoped to its slides — a widened boundary

This is the first time a Markdown document puts CSS into the app document, and
it is decided here rather than left to fall out:

- **Selectors are scoped by Marpit** to the slide container, as measured.
- **Of the at-rules, only `@media`, `@supports` and `@container` are kept**, with
  the rules inside them; every other at-rule is removed before the CSS is
  applied, and reported (§3). Selector scoping leaves the at-rules' own names
  global: a deck's `@font-face` registers a family name for the whole app
  document, as measured, and `@keyframes`, `@property`, `@counter-style`,
  `@font-palette-values` and `@layer` do the same for their own names — a deck's
  `@keyframes busy-spin` would replace the app's spinner, and a registered
  `@property` cannot be undone for the life of the window. `@import` is hoisted
  out of the scope. A list of what is kept, rather than of what is removed,
  keeps an at-rule CSS adds later out until it is looked at.
- **Every `url()` in deck CSS follows decision-17**: a path relative to the
  document is resolved to an `asset:` URL, and a URL the deck writes with the
  `asset:` scheme or the `asset.localhost` host is removed, with the declaration
  holding it. Without this a deck's `background-image:url("asset://localhost/…")`
  would load any file inside any granted folder, which decision-17 §1 refuses
  for a Markdown image and AGENTS.md records as "mallow is the only author of an
  `asset:` URL" in Markdown; this keeps that sentence true for deck CSS too.
- **The removals and the rewriting walk parsed CSS, never the text.** The
  engine's own CSSOM is the intended parser — a constructed `CSSStyleSheet`
  whose rules are walked and serialised back — because it needs no dependency.
  It is unmeasured on the three WebViews; TASK-51.2 measures it, and if it does
  not hold, `postcss` as a direct dependency (it is in the tree through Marpit,
  but pnpm does not let mallow import it without declaring it) needs the
  owner's approval first.
- **The element that holds the slides establishes `contain: paint`**, so a
  `position: fixed` inside a slide is positioned and clipped by the slide host
  rather than by the window, and a deck cannot draw over the toolbar, the
  explorer or the document bar.
- **Remote URLs in deck CSS load**, because `img-src` carries `https:` and
  `http:`, cleartext included. This is the exposure a Markdown document already
  has through a remote image, so it adds no new class of outbound request.

The CSP is unchanged.

## Consequences

- AGENTS.md's untrusted-Markdown boundary gains one sentence when TASK-51.2
  lands: a deck's CSS reaches the app document, scoped, with only `@media`,
  `@supports` and `@container` among its at-rules, with its `url()`s under
  decision-17, inside a paint-contained host. README "Security" says the same.
- Marpit requires `markdown-it ^14.3.1` while mallow pins `^14.2.0`; the
  measurement ran with 14.2.0. Raising mallow's range when Marpit is added keeps
  one markdown-it in the bundle instead of two.
- A deck written for `gaia` or `uncover`, or with raw HTML layout, looks
  different in mallow than in Marp's tools, and says so. Drawing Marp's built-in
  themes faithfully would mean adding marp-core or vendoring its theme CSS,
  which is a new decision rather than an amendment of this one.
- §6 rests on a macOS measurement; Windows and Linux are checked when TASK-51.2
  is built.
